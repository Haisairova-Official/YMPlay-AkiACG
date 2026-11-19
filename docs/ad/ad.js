const player = document.querySelector('.player');
const advert = document.querySelector('.advert');
const scenes = [...document.querySelectorAll('.scene')];
const chapters = [...document.querySelectorAll('[data-index]')];
const video = document.querySelector('video');
const toggle = document.querySelector('.toggle');
const sound = document.querySelector('.sound');
const fullscreen = document.querySelector('.fullscreen');
const viewer = document.querySelector('.model-view');
const modelHint = document.querySelector('.model-hint');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const durations = [8000, 6500, 7500];
const forumPlacement = document.documentElement.classList.contains('forum-slider');
const forumOrigin = 'https://forum.akiacg.com';
let sceneIndex = 0;
let elapsed = 0;
let lastFrame = null;
let frameRequest = null;
let playing = !reducedMotion.matches;
let interacting = false;
let viewerReady = false;
let parentPaused = forumPlacement;
let inViewport = true;
let pageInactive = false;

function playbackPaused() {
  return !playing || document.hidden || interacting || parentPaused || !inViewport || pageInactive;
}

function syncViewer() {
  viewer.contentWindow?.postMessage({
    type: 'yimaiplay:viewer',
    paused: playbackPaused() || sceneIndex !== 0,
    showing: sceneIndex === 0 && !document.hidden && !parentPaused && inViewport && !pageInactive,
  }, location.origin);
}

function updatePlayback() {
  const paused = playbackPaused();
  player.classList.toggle('paused', paused);
  toggle.setAttribute('aria-label', playing ? '暂停广告' : '播放广告');
  toggle.title = playing ? '暂停广告' : '播放广告';
  toggle.firstElementChild.textContent = playing ? 'Ⅱ' : '▷';
  if (sceneIndex === 1 && !paused) {
    video.play().catch(() => {});
  } else {
    video.pause();
  }
  syncViewer();
  cancelAnimationFrame(frameRequest);
  frameRequest = null;
  lastFrame = null;
  if (!paused && !forumPlacement) frameRequest = requestAnimationFrame(tick);
}

function showScene(index) {
  if (forumPlacement) index = 0;
  sceneIndex = index;
  elapsed = 0;
  interacting = false;
  advert.dataset.scene = String(index);
  scenes.forEach((scene, position) => {
    const active = position === index;
    scene.classList.toggle('active', active);
    scene.setAttribute('aria-hidden', String(!active));
    scene.inert = !active;
    chapters[position].setAttribute('aria-pressed', String(active));
  });
  viewer.tabIndex = index === 0 && viewerReady ? 0 : -1;
  player.style.setProperty('--progress', '0');
  video.currentTime = 0;
  updatePlayback();
}

for (const button of chapters) {
  button.addEventListener('click', () => showScene(Number(button.dataset.index)));
}
toggle.addEventListener('click', () => {
  playing = !playing;
  updatePlayback();
});
sound.addEventListener('click', () => {
  video.muted = !video.muted;
  sound.setAttribute('aria-pressed', String(!video.muted));
  sound.textContent = video.muted ? '声音关' : '声音开';
});
if (!document.fullscreenEnabled) fullscreen.hidden = true;
fullscreen.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await player.requestFullscreen();
  } catch {
    fullscreen.hidden = true;
  }
});
document.addEventListener('fullscreenchange', () => {
  fullscreen.textContent = document.fullscreenElement ? '退出全屏' : '全屏';
});
document.addEventListener('visibilitychange', () => {
  interacting = false;
  updatePlayback();
});
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    playing = false;
    updatePlayback();
  }
});
player.addEventListener('keydown', event => {
  if (forumPlacement || event.key !== ' ' || event.target.closest('button, a, iframe')) return;
  event.preventDefault();
  playing = !playing;
  updatePlayback();
});
viewer.addEventListener('load', syncViewer);
window.addEventListener('message', event => {
  if (forumPlacement && event.origin === forumOrigin && event.source === window.parent) {
    if (event.data?.type === 'yimaiplay:ad-playback' && typeof event.data.paused === 'boolean') {
      parentPaused = event.data.paused;
      updatePlayback();
    }
    return;
  }
  if (event.origin !== location.origin || event.source !== viewer.contentWindow) return;
  if (event.data?.type === 'yimaiplay:viewer-ready') {
    viewerReady = true;
    if (forumPlacement) window.parent.postMessage({ type: 'yimaiplay:ad-ready' }, forumOrigin);
    advert.classList.add('model-ready');
    modelHint.hidden = false;
    viewer.tabIndex = sceneIndex === 0 ? 0 : -1;
    syncViewer();
  }
  if (event.data?.type === 'yimaiplay:viewer-error') {
    viewerReady = false;
    if (forumPlacement) window.parent.postMessage({ type: 'yimaiplay:ad-error' }, forumOrigin);
    advert.classList.remove('model-ready');
    modelHint.hidden = true;
    viewer.tabIndex = -1;
  }
  if (event.data?.type === 'yimaiplay:viewer-interaction' && sceneIndex === 0) {
    interacting = event.data.active === true;
    if (forumPlacement) {
      syncViewer();
    } else {
      if (!interacting) elapsed = 0;
      updatePlayback();
    }
  }
});

function tick(time) {
  frameRequest = null;
  if (playbackPaused() || forumPlacement) return;
  if (lastFrame !== null) elapsed += Math.min(time - lastFrame, 100);
  lastFrame = time;
  if (elapsed >= durations[sceneIndex]) {
    showScene((sceneIndex + 1) % scenes.length);
    return;
  }
  player.style.setProperty('--progress', String(elapsed / durations[sceneIndex]));
  frameRequest = requestAnimationFrame(tick);
}

if (forumPlacement) {
  player.tabIndex = -1;
  player.setAttribute('aria-label', 'YiMaiPlay 产品广告');
  for (const link of advert.querySelectorAll('a')) {
    link.removeAttribute('href');
    link.removeAttribute('target');
    link.removeAttribute('aria-label');
    link.tabIndex = -1;
  }

}
const modelUrl = new URL(viewer.dataset.src, location.href);
if (forumPlacement) modelUrl.searchParams.set('placement', 'forum-slider');
viewer.src = modelUrl.href;
if (!forumPlacement) {
  video.preload = 'auto';
  video.src = video.dataset.src;
  video.load();
}
if ('IntersectionObserver' in window) {
  const visibilityObserver = new IntersectionObserver(entries => {
    inViewport = entries[0].isIntersecting;
    updatePlayback();
  }, { threshold: 0 });
  visibilityObserver.observe(player);
}
window.addEventListener('pagehide', () => {
  pageInactive = true;
  updatePlayback();
});
window.addEventListener('pageshow', () => {
  pageInactive = false;
  updatePlayback();
});
updatePlayback();
