const model = document.querySelector('#product-model');
const state = document.querySelector('#load-state');
const message = document.querySelector('#load-message');
const spinner = state.querySelector('.loader');
const retry = document.querySelector('#retry');
const viewButtons = document.querySelectorAll('[data-view]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const embedded = document.documentElement.classList.contains('embedded');
let paused = false;
const orbits = {
  front: '0deg 90deg 105%',
  side: '90deg 90deg 105%',
  back: '180deg 90deg 105%'
};

function setView(orbit) {
  model.cameraTarget = '0m 0.925m 0m';
  model.cameraOrbit = orbit;
  if (reducedMotion.matches) model.jumpCameraToGoal();
}

for (const button of viewButtons) {
  button.addEventListener('click', () => {
    setView(orbits[button.dataset.view]);
    for (const option of viewButtons) {
      option.setAttribute('aria-pressed', String(option === button));
    }
  });
}

model.addEventListener('camera-change', event => {
  if (event.detail.source !== 'user-interaction') return;
  for (const button of viewButtons) button.setAttribute('aria-pressed', 'false');
});

document.querySelector('#reset').addEventListener('click', () => {
  setView('30deg 78deg 105%');
  for (const button of viewButtons) button.setAttribute('aria-pressed', 'false');
});

document.querySelector('#zoom-in').addEventListener('click', () => model.zoom(1));
document.querySelector('#zoom-out').addEventListener('click', () => model.zoom(-1));

model.addEventListener('progress', event => {
  const progress = Math.round(event.detail.totalProgress * 100);
  message.textContent = progress < 100 ? '正在载入模型 ' + progress + '%' : '正在准备视图';
});

model.addEventListener('load', () => {
  state.hidden = true;
  if (embedded) {
    model.autoRotate = !paused && !reducedMotion.matches;
    model.autoRotateDelay = 150;
    model.rotationPerSecond = '5deg';
    window.parent.postMessage({ type: 'yimaiplay:viewer-ready' }, window.location.origin);
  }
  if (reducedMotion.matches) model.jumpCameraToGoal();
});

model.addEventListener('error', () => {
  state.hidden = false;
  spinner.hidden = true;
  message.textContent = '模型暂时未能载入，请重新加载。';
  retry.hidden = false;
  if (embedded) window.parent.postMessage({ type: 'yimaiplay:viewer-error' }, window.location.origin);
});

retry.addEventListener('click', () => window.location.reload());

window.addEventListener('message', event => {
  if (!embedded || event.origin !== window.location.origin || event.source !== window.parent) return;
  if (event.data?.type !== 'yimaiplay:viewer' || typeof event.data.paused !== 'boolean') return;
  paused = event.data.paused;
  if (event.data.showing === false && model.loaded) {
    model.resetTurntableRotation();
    setView('30deg 78deg 105%');
    model.jumpCameraToGoal();
  }
  model.autoRotate = !paused && !reducedMotion.matches;
});
reducedMotion.addEventListener('change', () => {
  if (embedded) model.autoRotate = !paused && !reducedMotion.matches;
});

const activePointers = new Set();
model.addEventListener('pointerdown', event => {
  if (!embedded) return;
  activePointers.add(event.pointerId);
  window.parent.postMessage({ type: 'yimaiplay:viewer-interaction', active: true }, window.location.origin);
});
function endInteraction(event) {
  if (!activePointers.delete(event.pointerId) || activePointers.size > 0) return;
  window.parent.postMessage({ type: 'yimaiplay:viewer-interaction', active: false }, window.location.origin);
}
window.addEventListener('pointerup', endInteraction);
window.addEventListener('pointercancel', endInteraction);
