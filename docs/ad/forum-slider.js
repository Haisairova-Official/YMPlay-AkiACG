/* YiMaiPlay integration for forumaker-magicslider. No forum settings are written. */
(() => {
  'use strict';
  const forumOrigin = 'https://forum.akiacg.com';
  if (window.location.origin !== forumOrigin) return;

  const version = '20261119-1';
  const advertOrigin = 'https://yimaiplay.akiacg.com';
  const advertURL = advertOrigin + '/ad/?v=' + version;
  const embedURL = advertOrigin + '/ad/?placement=forum-slider&v=' + version;
  const coverURL = advertOrigin + '/ad/forum-cover.webp?v=' + version;
  const controllers = new Map();
  let scanFrame = 0;

  window.__YMPLAY_FORUM_SLIDER__?.destroy();

  function createController(slider) {
    const track = slider.querySelector('.MagicSlider-track');
    const second = track?.querySelectorAll('.MagicSlide')[1];
    const poster = second?.querySelector('.MagicSlide-image');
    if (!track || !second || !poster) return null;

    const originalImage = poster.getAttribute('src');
    const originalHref = second.getAttribute('href');
    const originalLabel = second.getAttribute('aria-label');
    second.setAttribute('aria-label', 'YiMaiPlay 音乐游戏控制器，查看完整广告');
    poster.src = coverURL;
    if (second.tagName === 'A') second.href = advertURL;

    let frame = null;
    let ready = false;
    let inView = false;
    let destroyed = false;
    let secondSelected = false;
    let transitionTimer = 0;
    let transitionFinished = false;
    let lastPlayback = null;

    // Remains outside the translated track. Native arrows, dots, and gestures keep control.
    const overlay = document.createElement('div');
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.cssText = 'position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden;border-radius:inherit';
    slider.append(overlay);

    function sendPlayback(paused) {
      if (!frame || !ready || paused === lastPlayback) return;
      lastPlayback = paused;
      frame.contentWindow?.postMessage({ type: 'yimaiplay:ad-playback', paused }, advertOrigin);
    }

    function refresh() {
      if (destroyed) return;
      const selectedDot = slider.querySelectorAll('.MagicSlider-dots .dot')[1];
      const selected = selectedDot
        ? selectedDot.getAttribute('aria-current') === 'true'
        : /^translateX\(\s*-100%\s*\)$/.test(track.style.transform);
      if (selected !== secondSelected) {
        secondSelected = selected;
        transitionFinished = false;
        clearTimeout(transitionTimer);
        if (selected) {
          transitionTimer = window.setTimeout(() => {
            transitionFinished = true;
            refresh();
          }, 370);
        }
      }

      const showing = secondSelected && inView && !document.hidden && slider.isConnected;
      if (showing && !frame && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        frame = document.createElement('iframe');
        frame.title = 'YiMaiPlay 产品广告';
        frame.tabIndex = -1;
        frame.setAttribute('aria-hidden', 'true');
        frame.setAttribute('allow', 'autoplay');
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.style.cssText = 'display:block;width:100%;height:100%;border:0;pointer-events:none;color-scheme:light';
        frame.src = embedURL;
        overlay.append(frame);
      }
      overlay.hidden = !showing;
      overlay.style.opacity = ready && transitionFinished ? '1' : '0';
      sendPlayback(!showing || !transitionFinished);
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

    function onTransitionEnd(event) {
      if (event.target !== track || event.propertyName !== 'transform') return;
      transitionFinished = true;
      clearTimeout(transitionTimer);
      refresh();
    }

    function fallbackVisibility() {
      const rect = slider.getBoundingClientRect();
      inView = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      refresh();
    }

    const changes = new MutationObserver(refresh);
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
    track.addEventListener('transitionend', onTransitionEnd);
    window.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', refresh);
    refresh();

    return {
      track,
      second,
      refresh,
      pause() { sendPlayback(true); },
      destroy() {
        destroyed = true;
        sendPlayback(true);
        clearTimeout(transitionTimer);
        changes.disconnect();
        visibility?.disconnect();
        track.removeEventListener('transitionend', onTransitionEnd);
        window.removeEventListener('message', onMessage);
        document.removeEventListener('visibilitychange', refresh);
        window.removeEventListener('scroll', fallbackVisibility);
        window.removeEventListener('resize', fallbackVisibility);
        overlay.remove();
        if (originalLabel === null) second.removeAttribute('aria-label');
        else second.setAttribute('aria-label', originalLabel);
        if (poster.getAttribute('src') === coverURL) poster.setAttribute('src', originalImage);
        if (second.tagName === 'A' && second.getAttribute('href') === advertURL) {
          if (originalHref === null) second.removeAttribute('href');
          else second.setAttribute('href', originalHref);
        }
      }
    };
  }

  function scan() {
    scanFrame = 0;
    for (const [slider, controller] of controllers) {
      const currentTrack = slider.querySelector('.MagicSlider-track');
      const currentSecond = currentTrack?.querySelectorAll('.MagicSlide')[1];
      if (!slider.isConnected || currentTrack !== controller.track || currentSecond !== controller.second) {
        controller.destroy();
        controllers.delete(slider);
      }
    }
    for (const slider of document.querySelectorAll('.MagicSlider')) {
      if (controllers.has(slider)) continue;
      const controller = createController(slider);
      if (controller) controllers.set(slider, controller);
    }
  }

  function scheduleScan() {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  }
  const pageChanges = new MutationObserver(scheduleScan);
  function start() {
    scan();
    pageChanges.observe(document.body, { childList: true, subtree: true });
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
      cancelAnimationFrame(scanFrame);
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
