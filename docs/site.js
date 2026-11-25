const cabinetView = document.querySelector('.cabinet-view');
const shotControls = cabinetView.querySelector('.cabinet-views');
const shotLabels = {
  whole: 'YiMaiPlay 控制器侧前方，可见环形按键、珍珠白机壳和方管支架',
  ring: '环形按键和中间的磨砂触摸玻璃特写',
  screen: '机台上部的副屏和屏幕边框特写'
};
shotControls.hidden = false;
shotControls.addEventListener('click', event => {
  const selected = event.target.closest('button[data-shot]');
  if (!selected) return;
  cabinetView.dataset.view = selected.dataset.shot;
  cabinetView.querySelector('.cabinet').alt = shotLabels[selected.dataset.shot];
  for (const button of shotControls.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button === selected));
  }
});

const photo = document.querySelector('#light-image');
const caption = document.querySelector('#light-caption');
const lighting = document.querySelector('.lighting');
const controls = document.querySelectorAll('[data-light]');

for (const control of controls) {
  control.addEventListener('click', () => {
    const mode = control.dataset.light;
    const label = control.textContent.trim();
    for (const button of controls) button.setAttribute('aria-pressed', String(button === control));
    photo.alt = label + '下的控制器正面灯效实拍';
    caption.textContent = label + '实拍';
    lighting.classList.toggle('bright', mode === 'bright');
  });
}

const film = document.querySelector('#film');
const video = film.querySelector('video');
for (const link of document.querySelectorAll('.film-link')) {
  link.addEventListener('click', event => {
    if (!film.showModal || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    film.showModal();
    document.body.classList.add('watching');
    video.play().catch(() => {});
  });
}
document.querySelector('#close-film').addEventListener('click', () => film.close());
film.addEventListener('click', event => {
  if (event.target !== film) return;
  const rect = film.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) film.close();
});
film.addEventListener('close', () => {
  video.pause();
  video.currentTime = 0;
  document.body.classList.remove('watching');
});

if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('in-view');
      reveal.unobserve(entry.target);
    }
  }, { threshold: 0.08 });

  for (const element of document.querySelectorAll(
    '.structure > div, .software > img, .dimensions figure'
  )) {
    reveal.observe(element);
  }
}

const story = document.querySelector('.detail-story');
const chapters = Array.from(story.querySelectorAll('article'));
const stage = document.createElement('div');
stage.className = 'detail-stage';
stage.setAttribute('aria-hidden', 'true');
const frames = chapters.map(chapter => {
  const frame = chapter.querySelector('img').cloneNode();
  frame.alt = '';
  frame.loading = 'eager';
  stage.append(frame);
  return frame;
});
const motion = matchMedia('(prefers-reduced-motion: no-preference)');
const tall = matchMedia('(min-height: 540px)');
const narrow = matchMedia('(max-width: 700px)');
let queued = false;
let ready = false;

function paintScroll() {
  queued = false;
  const height = document.documentElement.clientHeight;
  if (!motion.matches) return;
  const lightBox = lighting.getBoundingClientRect();
  if (lightBox.bottom > 0 && lightBox.top < height) {
    const entrance = Math.max(0, Math.min(1, (height - lightBox.top) / (height * .78)));
    lighting.style.setProperty('--light-scale', (1 + .32 * (1 - entrance)).toFixed(4));
  }
  if (!ready || !tall.matches) return;
  const bounds = story.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > height) return;
  const target = narrow.matches
    ? 55 + stage.offsetHeight + height * .23
    : (height + 64) / 2;
  const centers = chapters.map(chapter => {
    const rect = chapter.getBoundingClientRect();
    return rect.top + rect.height / 2;
  });
  for (let i = 1; i < frames.length; i++) {
    const fraction = (target - centers[i - 1]) / (centers[i] - centers[i - 1]);
    const mix = Math.max(0, Math.min(1, (fraction - .15) / .7));
    frames[i].style.opacity = (mix * mix * (3 - 2 * mix)).toFixed(3);
  }
}

function queuePaint() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(paintScroll);
  }
}

function syncMotion() {
  story.classList.toggle('is-scrolling', motion.matches && tall.matches && ready);
  if (motion.matches) {
    window.addEventListener('scroll', queuePaint, { passive: true });
    window.addEventListener('resize', queuePaint);
    queuePaint();
  } else {
    window.removeEventListener('scroll', queuePaint);
    window.removeEventListener('resize', queuePaint);
    lighting.style.removeProperty('--light-scale');
  }
}

Promise.all(frames.map(frame => frame.decode())).then(() => {
  story.prepend(stage);
  ready = true;
  syncMotion();
}).catch(() => { /* Keep the original photographed articles if a frame fails. */ });
tall.addEventListener('change', syncMotion);
motion.addEventListener('change', syncMotion);
syncMotion();
