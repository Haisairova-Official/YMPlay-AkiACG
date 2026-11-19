/* YiMaiPlay integration for forumaker-magicslider. No forum settings are written. */
(() => {
  'use strict';
  const forumOrigin = 'https://forum.akiacg.com';
  if (window.location.origin !== forumOrigin) return;

  const version = '20261119-2';
  const advertOrigin = 'https://yimaiplay.akiacg.com';
  const embedURL = advertOrigin + '/ad/?placement=forum-slider&v=' + version;
  const coverURL = advertOrigin + '/ad/forum-cover.webp?v=' + version;
  const targetPath = '/assets/magicslider/09ed3132a5ec1aaf55ef8b42967ee6e6.gif';
  const controllers = new Map();
  let scanQueued = false;
  let active = true;

  window.__YMPLAY_FORUM_SLIDER__?.destroy();

  function isTarget(source) {
    try {
      const url = new URL(source, window.location.href);
      return url.origin === forumOrigin && url.pathname === targetPath;
    } catch { return false; }
  }

  function findTarget(slider) {
    const track = slider.querySelector('.MagicSlider-track');
    const slides = [...(track?.querySelectorAll('.MagicSlide') || [])];
    for (const [index, slide] of slides.entries()) {
      const poster = slide.querySelector('.MagicSlide-image');
      if (poster && isTarget(poster.getAttribute('src'))) return { track, slide, poster, index };
    }
    return null;
  }

  function removeLegacyStyles(elements) {
    for (const element of elements) {
      const sheet = element.sheet;
      if (!sheet) continue;
      const rules = [...sheet.cssRules];
      const coverIndex = rules.findIndex(rule =>
        rule.selectorText?.replace(/\s+/g, '') === '.MagicSlider-track>.MagicSlide:nth-child(2)' &&
        rule.style?.backgroundImage.includes(advertOrigin + '/ad/forum-cover.webp'));
      const imageIndex = rules.findIndex(rule =>
        rule.selectorText?.replace(/\s+/g, '') === '.MagicSlider-track>.MagicSlide:nth-child(2)>.MagicSlide-image' &&
        rule.style?.opacity === '0');
      if (coverIndex < 0 || imageIndex < 0) continue;
      // Remove only the two rules shipped in the old YiMaiPlay snippet.
      for (const index of [coverIndex, imageIndex].sort((a, b) => b - a)) sheet.deleteRule(index);
    }
  }

  function createController(slider) {
    const match = findTarget(slider);
    if (!match) return null;
    const { track, slide, poster } = match;

    const originalHref = slide.getAttribute('href');
    const originalLabel = slide.getAttribute('aria-label');
    const originalTabIndex = slide.getAttribute('tabindex');
    const originalPointerEvents = slide.style.pointerEvents;
    const originalTrackPosition = track.style.position;
    slide.setAttribute('aria-label', 'YiMaiPlay 音乐游戏控制器');
    slide.removeAttribute('href');
    slide.setAttribute('tabindex', '-1');
    slide.style.pointerEvents = 'none';
    track.style.position = 'relative';

    let frame = null;
    let ready = false;
    let inView = false;
    let destroyed = false;
    let lastPlayback = null;

    // The panel moves with the matched slide and sits outside its original anchor.
    const panel = document.createElement('div');
    panel.className = 'YiMaiPlaySliderPanel';
    panel.setAttribute('aria-label', 'YiMaiPlay 产品展示');
    panel.style.cssText = 'position:absolute;left:100%;top:0;width:100%;height:100%;pointer-events:none;overflow:hidden;container-type:size';

    panel.style.background = 'center / cover no-repeat url("' + coverURL + '")';

    // The native slider receives pointer events over the left half. The model owns the right half.
    const gestures = document.createElement('div');
    gestures.setAttribute('aria-hidden', 'true');
    gestures.style.cssText = 'position:absolute;left:0;top:0;width:50%;height:100%;z-index:1;pointer-events:auto;touch-action:pan-y';
    panel.append(gestures);

    const cta = document.createElement('a');
    cta.className = 'YiMaiPlaySliderMore';
    cta.textContent = '了解更多';
    cta.href = advertOrigin + '/';
    cta.target = '_top';
    cta.style.cssText = 'position:absolute;left:var(--yimaiplay-cta-left,7%);bottom:7%;z-index:2;pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:6px 16px;padding:clamp(5px,1.6cqh,9px) clamp(13px,1.6cqw,22px);border:1px solid #36576a;border-radius:24px;background:#ffffffeb;color:#254758;font:600 13px/1.2 Inter,Arial,sans-serif;font-size:clamp(11px,1.05cqw,15px);text-decoration:none;box-shadow:0 2px 10px #1d35450a';
    cta.addEventListener('pointerdown', event => event.stopPropagation());
    cta.addEventListener('pointerup', event => event.stopPropagation());
    cta.addEventListener('click', event => event.stopPropagation());
    panel.append(cta);
    track.append(panel);

    function sendPlayback(paused) {
      if (!frame || !ready || paused === lastPlayback) return;
      lastPlayback = paused;
      frame.contentWindow?.postMessage({ type: 'yimaiplay:ad-playback', paused }, advertOrigin);
    }

    function refresh() {
      if (destroyed) return;
      const slides = [...track.querySelectorAll('.MagicSlide')];
      const index = slides.indexOf(slide);
      const offset = (index * 100) + '%';
      if (panel.style.left !== offset) panel.style.left = offset;
      const selectedDot = slider.querySelectorAll('.MagicSlider-dots .dot')[index];
      const selected = selectedDot
        ? selectedDot.getAttribute('aria-current') === 'true'
        : Math.abs(Number(track.style.transform.match(/translateX\(\s*(-?[\d.]+)%\s*\)/)?.[1]) + index * 100) < 0.01;
      const showing = selected && inView && !document.hidden && slider.isConnected;

      // Keep the offscreen slide out of keyboard navigation without hiding its transition.
      cta.tabIndex = selected ? 0 : -1;
      if (showing && !frame) {
        frame = document.createElement('iframe');
        frame.title = 'YiMaiPlay 可旋转产品模型';
        frame.tabIndex = -1;
        frame.setAttribute('allow', 'autoplay');
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;border:0;opacity:0;pointer-events:none;color-scheme:light';
        frame.src = embedURL;
        panel.prepend(frame);
      }
      if (frame) {
        frame.style.opacity = ready ? '1' : '0';
        frame.style.pointerEvents = ready && selected ? 'auto' : 'none';
        frame.tabIndex = ready && selected ? 0 : -1;
        frame.setAttribute('aria-hidden', String(!ready || !selected));
      }
      sendPlayback(!showing);
    }

    function onMessage(event) {
      if (event.origin !== advertOrigin || event.source !== frame?.contentWindow) return;
      if (event.data?.type === 'yimaiplay:ad-error') {
        sendPlayback(true);
        ready = false;
        refresh();
        return;
      }
      if (event.data?.type !== 'yimaiplay:ad-ready') return;
      ready = true;
      lastPlayback = null;
      refresh();
    }

    function blockWholeSlideLink(event) {
      if (event.target === slide || slide.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function fallbackVisibility() {
      const rect = slider.getBoundingClientRect();
      inView = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      refresh();
    }

    const changes = new MutationObserver(records => {
      // Ignore mutations made to the iframe and panel by refresh itself.
      if (records.some(record => record.target === track || record.target.matches('.MagicSlider-dots .dot'))) refresh();
    });
    changes.observe(slider, { attributes: true, attributeFilter: ['style', 'aria-current'], subtree: true });
    const visibility = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      refresh();
    }, { threshold: 0 }) : null;
    if (visibility) visibility.observe(slider);
    else {
      window.addEventListener('scroll', fallbackVisibility, { passive: true });
      window.addEventListener('resize', fallbackVisibility, { passive: true });
      fallbackVisibility();
    }
    slide.addEventListener('click', blockWholeSlideLink, true);
    window.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', refresh);
    refresh();

    return {
      track,
      slide,
      panel,
      poster,
      refresh,
      pause() { sendPlayback(true); },
      destroy() {
        destroyed = true;
        sendPlayback(true);
        changes.disconnect();
        visibility?.disconnect();
        slide.removeEventListener('click', blockWholeSlideLink, true);
        window.removeEventListener('message', onMessage);
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('scroll', fallbackVisibility);
        window.removeEventListener('resize', fallbackVisibility);
        panel.remove();
        if (slide.getAttribute('aria-label') === 'YiMaiPlay 音乐游戏控制器') {
          if (originalLabel === null) slide.removeAttribute('aria-label');
          else slide.setAttribute('aria-label', originalLabel);
        }
        if (slide.getAttribute('tabindex') === '-1') {
          if (originalTabIndex === null) slide.removeAttribute('tabindex');
          else slide.setAttribute('tabindex', originalTabIndex);
        }
        if (!slide.hasAttribute('href') && originalHref !== null) slide.setAttribute('href', originalHref);
        slide.style.pointerEvents = originalPointerEvents;
        track.style.position = originalTrackPosition;
      }
    };
  }

  function scan() {
    scanQueued = false;
    for (const [slider, controller] of controllers) {
      const match = findTarget(slider);
      if (!slider.isConnected || !match || match.track !== controller.track || match.slide !== controller.slide || match.poster !== controller.poster || !controller.panel.isConnected) {
        controller.destroy();
        controllers.delete(slider);
      } else controller.refresh();
    }
    for (const slider of document.querySelectorAll('.MagicSlider')) {
      if (controllers.has(slider)) continue;
      const controller = createController(slider);
      if (controller) controllers.set(slider, controller);
    }
  }

  function scheduleScan() {
    if (scanQueued || !active) return;
    scanQueued = true;
    queueMicrotask(() => {
      if (active) scan();
    });
  }
  const pageChanges = new MutationObserver(records => {
    const styles = new Set();
    for (const record of records) {
      if (record.target.nodeName === 'STYLE') styles.add(record.target);
      for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.nodeName === 'STYLE') styles.add(node);
        for (const style of node.querySelectorAll('style')) styles.add(style);
      }
    }
    if (styles.size) removeLegacyStyles(styles);
    scheduleScan();
  });
  function start() {
    removeLegacyStyles(document.querySelectorAll('style'));
    scan();
    pageChanges.observe(document.body, { childList: true, attributes: true, attributeFilter: ['src'], subtree: true });
  }
  function onPageHide() {
    for (const controller of controllers.values()) controller.pause();
  }
  function onPageShow() {
    for (const controller of controllers.values()) controller.refresh();
    scheduleScan();
  }
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.__YMPLAY_FORUM_SLIDER__ = {
    destroy() {
      pageChanges.disconnect();
      active = false;
      scanQueued = false;
      document.removeEventListener('DOMContentLoaded', start);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      for (const controller of controllers.values()) controller.destroy();
      controllers.clear();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
