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

/* One-tap copy for the presales group number. */
const copyButton = document.querySelector('.copy-qq');
if (copyButton) {
  copyButton.hidden = false;
  let copyTimer = null;
  copyButton.addEventListener('click', async () => {
    const value = copyButton.dataset.copy;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        ok = true;
      }
    } catch { /* Fall back below when clipboard API is unavailable. */ }
    if (!ok) {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.append(area);
      area.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
    }
    if (!ok) return;
    clearTimeout(copyTimer);
    copyButton.textContent = '✓ 已复制';
    copyButton.classList.add('copied');
    copyTimer = setTimeout(() => {
      copyButton.textContent = '复制';
      copyButton.classList.remove('copied');
    }, 1800);
  });
}

const photo = document.querySelector('#light-image');
const lightFigure = document.querySelector('.light-photo');
const caption = document.querySelector('#light-caption');
const lighting = document.querySelector('.lighting');
const lightingBand = document.querySelector('.lighting-band');
const controls = Array.from(document.querySelectorAll('[data-light]'));
let captionTimer = null;

function setLightMode(mode) {
  const control = controls.find(item => item.dataset.light === mode);
  if (!control) return;
  const label = control.textContent.trim();
  for (const button of controls) button.setAttribute('aria-pressed', String(button === control));
  photo.alt = label + '下的控制器正面灯效实拍';
  const bright = mode === 'bright';
  lighting.classList.toggle('bright', bright);
  lightingBand.classList.toggle('is-bright', bright);
  clearTimeout(captionTimer);
  caption.classList.add('swapping');
  captionTimer = setTimeout(() => {
    caption.textContent = label + '实拍';
    caption.classList.remove('swapping');
  }, 150);
}

for (const control of controls) {
  control.addEventListener('click', () => setLightMode(control.dataset.light));
}
lightFigure?.addEventListener('click', () => {
  setLightMode(lighting.classList.contains('bright') ? 'dark' : 'bright');
});

/* Segmented controls: a pill slides to the selected option. */
function mountPill(group) {
  const buttons = Array.from(group.querySelectorAll('button'));
  function place(instant) {
    const active = buttons.find(button => button.getAttribute('aria-pressed') === 'true');
    if (!active || !active.offsetWidth) return;
    if (instant) group.classList.add('pill-instant');
    group.style.setProperty('--pill-x', active.offsetLeft + 'px');
    group.style.setProperty('--pill-w', active.offsetWidth + 'px');
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => group.classList.remove('pill-instant')));
  }
  group.classList.add('has-pill');
  place(true);
  new MutationObserver(() => place(false)).observe(group, { attributes: true, subtree: true, attributeFilter: ['aria-pressed'] });
  if ('ResizeObserver' in window) new ResizeObserver(() => place(true)).observe(group);
  if (document.fonts) document.fonts.ready.then(() => place(true));
}
for (const group of document.querySelectorAll('.cabinet-views, .switcher')) mountPill(group);

/* Calm the 3D rotation hint once the visitor drags the model. */
const productStage = document.querySelector('.product-stage');
const rotationHint = document.querySelector('.rotation-hint');
productStage?.addEventListener('pointerdown', () => {
  rotationHint?.classList.add('interacted');
}, { once: true, passive: true });

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

const motion = matchMedia('(prefers-reduced-motion: no-preference)');

/* Cross-browser smooth accordion for specification disclosures (including iOS Safari). */
document.querySelectorAll('.spec-list details').forEach(details => {
  const summary = details.querySelector('summary');
  if (!summary) return;
  const body = document.createElement('div');
  body.className = 'spec-body';
  while (summary.nextSibling) body.append(summary.nextSibling);
  details.append(body);
  let anim = null;

  summary.addEventListener('click', event => {
    if (!motion.matches || !body.animate) return;
    event.preventDefault();
    if (anim) anim.cancel();
    if (details.open) {
      const start = body.offsetHeight;
      anim = body.animate(
        [{ height: start + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 360, easing: 'cubic-bezier(.32, .72, 0, 1)' }
      );
      anim.onfinish = () => {
        details.open = false;
        anim = null;
      };
      anim.oncancel = () => { anim = null; };
    } else {
      details.open = true;
      const end = body.scrollHeight;
      anim = body.animate(
        [{ height: '0px', opacity: 0 }, { height: end + 'px', opacity: 1 }],
        { duration: 420, easing: 'cubic-bezier(.16, 1, .3, 1)' }
      );
      anim.onfinish = () => { anim = null; };
      anim.oncancel = () => { anim = null; };
    }
  });
});

/* Scroll reveal: content fades up as it arrives, siblings follow one another. */
if ('IntersectionObserver' in window && motion.matches) {
  const groups = [
    '.metric-grid > div',
    '.lighting-copy > *',
    '.light-photo',
    '.detail-section .eyebrow, .detail-section h2',
    '.structure > div > *',
    '.structure-product',
    '.software',
    '.software > div > *',
    '.software > img',
    '.dimensions > *',
    '.spec-list > *',
    '.acknowledgements > *',
    '.footer-inner > *'
  ];
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-shown');
      reveal.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
  for (const selector of groups) {
    document.querySelectorAll(selector).forEach((element, index) => {
      element.classList.add('reveal');
      element.style.setProperty('--reveal-delay', Math.min(index, 5) * 0.075 + 's');
      reveal.observe(element);
    });
  }
  document.documentElement.classList.add('motion-ready');
}

/* Metrics count up once, landing on the printed value. */
function countUp(dd) {
  const node = Array.from(dd.childNodes).find(child => child.nodeType === 3 && /\d/.test(child.nodeValue));
  if (!node) return;
  const match = node.nodeValue.match(/^(\s*)(\d+)(.*)$/s);
  if (!match) return;
  const [, lead, digits, tail] = match;
  const target = Number(digits);
  const number = document.createElement('span');
  number.className = 'count-num';
  number.style.minWidth = digits.length + 'ch';
  number.textContent = digits;
  node.nodeValue = lead;
  dd.insertBefore(number, node.nextSibling);
  if (tail) dd.insertBefore(document.createTextNode(tail), number.nextSibling);
  const duration = 1150 + Math.min(target, 360);
  let start;
  number.textContent = '0';
  function step(now) {
    start ??= now;
    const progress = Math.min(1, (now - start) / duration);
    number.textContent = String(Math.round(target * (1 - Math.pow(1 - progress, 4))));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
if ('IntersectionObserver' in window && motion.matches) {
  const counter = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      counter.unobserve(entry.target);
      countUp(entry.target);
    }
  }, { threshold: 0.25 });
  document.querySelectorAll('.metric-grid dd').forEach(dd => counter.observe(dd));
}

const story = document.querySelector('.detail-story');
const chapters = Array.from(story.querySelectorAll('article'));
const stageWrap = document.createElement('div');
stageWrap.className = 'detail-stage-wrap';
const stage = document.createElement('div');
stage.className = 'detail-stage';
const frames = chapters.map(chapter => {
  const frame = chapter.querySelector('img').cloneNode();
  frame.alt = '';
  frame.loading = 'eager';
  stage.append(frame);
  return frame;
});
const chapterIndex = document.createElement('span');
chapterIndex.className = 'detail-index';
chapterIndex.setAttribute('aria-hidden', 'true');
chapterIndex.textContent = '01 / 0' + chapters.length;
stage.append(chapterIndex);

const dots = document.createElement('div');
dots.className = 'detail-dots';
dots.setAttribute('role', 'tablist');
dots.setAttribute('aria-label', '工艺细节章节');
const dotMarks = chapters.map((chapter, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', chapter.querySelector('h3')?.textContent.trim() || ('第 ' + (index + 1) + ' 项'));
  button.addEventListener('click', () => {
    const offset = narrow.matches ? stageWrap.offsetHeight + 66 : (document.documentElement.clientHeight - chapter.offsetHeight) / 2;
    const top = window.scrollY + chapter.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
  dots.append(button);
  return button;
});
stage.append(dots);
stageWrap.append(stage);

const headerEl = document.querySelector('header');
const navCraft = document.querySelector('.craft-link');
const navSpecs = document.querySelector('.specs-nav-link');
const detailsSection = document.querySelector('#details');
const specsSection = document.querySelector('#specs');
const softwareCard = document.querySelector('.software');
const softwareImg = softwareCard?.querySelector('img');

const tall = matchMedia('(min-height: 540px)');
const narrow = matchMedia('(max-width: 700px)');
let queued = false;
let ready = false;

function ease(value) {
  return value * value * (3 - 2 * value);
}

function paintScroll() {
  queued = false;
  const height = document.documentElement.clientHeight;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - height);
  const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
  headerEl?.style.setProperty('--scroll-progress', progress.toFixed(4));
  headerEl?.style.setProperty('--progress-vis', window.scrollY > 36 ? '1' : '0');

  if (navCraft && navSpecs && detailsSection && specsSection) {
    const detailsTop = detailsSection.getBoundingClientRect().top;
    const specsTop = specsSection.getBoundingClientRect().top;
    navSpecs.classList.toggle('is-active', specsTop <= height * 0.45);
    navCraft.classList.toggle('is-active', detailsTop <= height * 0.45 && specsTop > height * 0.45);
  }

  if (!motion.matches) return;

  const lightBox = lighting.getBoundingClientRect();
  if (lightBox.bottom > 0 && lightBox.top < height) {
    const entrance = ease(Math.max(0, Math.min(1, (height - lightBox.top) / (height * .82))));
    lighting.style.setProperty('--light-scale', (1 + .10 * (1 - entrance)).toFixed(4));
  }

  if (softwareCard && softwareImg) {
    const swBox = softwareCard.getBoundingClientRect();
    if (swBox.bottom > 0 && swBox.top < height) {
      const ratio = Math.max(0, Math.min(1, (height - swBox.top) / (height + swBox.height)));
      softwareImg.style.setProperty('--app-shift', ((0.5 - ratio) * 24).toFixed(2) + 'px');
    }
  }

  if (!ready || !tall.matches) return;
  const bounds = story.getBoundingClientRect();
  if (bounds.bottom < 0 || bounds.top > height) return;

  const target = narrow.matches
    ? stageWrap.getBoundingClientRect().bottom + 96
    : (height + 64) / 2;

  const anchors = chapters.map(chapter => {
    const rect = chapter.getBoundingClientRect();
    return narrow.matches ? rect.top + Math.min(rect.height * 0.35, 90) : rect.top + rect.height / 2;
  });

  for (let i = 1; i < frames.length; i++) {
    const span = Math.max(1, anchors[i] - anchors[i - 1]);
    const fraction = (target - anchors[i - 1]) / span;
    const mix = ease(Math.max(0, Math.min(1, (fraction - .16) / .68)));
    frames[i].style.opacity = mix.toFixed(3);
    frames[i].style.transform = 'scale(' + (1.06 - .06 * mix).toFixed(4) + ')';
  }

  let active = 0;
  let nearest = Infinity;
  anchors.forEach((anchor, i) => {
    const distance = Math.abs(anchor - target);
    if (distance < nearest) { nearest = distance; active = i; }
    const plateau = narrow.matches ? 72 : 90;
    const reach = Math.max(chapters[i].offsetHeight * .65, 190);
    const norm = Math.max(0, (distance - plateau) / Math.max(1, reach - plateau));
    chapters[i].style.setProperty('--focus', ease(Math.max(0, 1 - norm)).toFixed(3));
  });
  dotMarks.forEach((dot, i) => {
    dot.classList.toggle('on', i === active);
    dot.setAttribute('aria-selected', String(i === active));
  });
  chapterIndex.textContent = '0' + (active + 1) + ' / 0' + chapters.length;
}

function queuePaint() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(paintScroll);
  }
}

function syncMotion() {
  story.classList.toggle('is-scrolling', motion.matches && tall.matches && ready);
  window.addEventListener('scroll', queuePaint, { passive: true });
  window.addEventListener('resize', queuePaint);
  if (!motion.matches) {
    lighting.style.removeProperty('--light-scale');
    softwareImg?.style.removeProperty('--app-shift');
  }
  queuePaint();
}

Promise.all(frames.map(frame => frame.decode())).then(() => {
  story.prepend(stageWrap);
  ready = true;
  syncMotion();
}).catch(() => { /* Keep the original photographed articles if a frame fails. */ });
tall.addEventListener('change', syncMotion);
motion.addEventListener('change', syncMotion);
syncMotion();
