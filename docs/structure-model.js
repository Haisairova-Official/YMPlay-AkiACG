import { mountTurntable } from './ad/forum-turntable.js';

const model = document.querySelector('#structure-model');
const stage = model.parentElement;
const hint = stage.parentElement.querySelector('.rotation-hint');
let turntable;
let dragging = false;

function showModel() {
  if (!model.loaded || dragging) return;
  const control = stage.querySelector('.forum-turntable');
  if (control) {
    model.cameraOrbit = control.getAttribute('aria-valuenow') + 'deg 78deg 103%';
    model.jumpCameraToGoal();
  }
  const hadFocus = control && document.activeElement === control;
  turntable?.destroy();
  turntable = undefined;
  stage.dataset.view = 'model';
  model.tabIndex = 0;
  model.removeAttribute('aria-hidden');
  hint.hidden = false;
  if (hadFocus) model.focus();
}

async function showTurntable() {
  const sprite = new URL('./ad/forum-turntable.webp?v=20261122-1', import.meta.url);
  const view = await mountTurntable(stage, sprite, {
    onInteraction(active) {
      dragging = active;
      if (!active) showModel();
    }
  });
  if (stage.dataset.view === 'model') {
    view.destroy();
    return;
  }
  turntable = view;
  stage.dataset.view = 'turntable';
  hint.hidden = false;
}

model.addEventListener('load', showModel);
model.addEventListener('error', () => {
  if (stage.dataset.view !== 'model') return;
  delete stage.dataset.view;
  model.tabIndex = -1;
  model.setAttribute('aria-hidden', 'true');
  hint.hidden = true;
  showTurntable().catch(() => {});
});
async function loadModel() {
  const context = document.createElement('canvas').getContext('webgl2');
  if (!context) return;
  context.getExtension('WEBGL_lose_context')?.loseContext();
  await import('./model/vendor/model-viewer.min.js');
  model.src = new URL('./model/yimaiplay.glb?v=20261122-1', import.meta.url).href;
}
function start() {
  showTurntable().catch(() => { /* Keep the side-view photograph while the model loads. */ });
  loadModel().catch(() => { /* The turntable also supports drag and keyboard rotation. */ });
}
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    start();
  }, { rootMargin: '320px' });
  observer.observe(stage);
} else {
  start();
}
