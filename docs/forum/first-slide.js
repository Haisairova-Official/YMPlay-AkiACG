/* YiMaiPlay integration for forumaker-magicslider. No forum settings are written. */
(() => {
  'use strict';
  const forumOrigin = 'https://forum.akiacg.com';
  if (window.location.origin !== forumOrigin) return;

  const release = 'forum-inline-1';
  const placement = 'homepage-first';
  if (window.__YMPLAY_FORUM_SLIDER__?.placement === placement) return;
  const advertOrigin = 'https://yimaiplay.akiacg.com';
  const embedURL = advertOrigin + '/forum/yimaiplay-banner.html?v=20261119-6';
  const coverURL = advertOrigin + '/forum/cover-wide-a4c1e96a.webp';
  const mobileCoverURL = advertOrigin + '/forum/cover-mobile-6e59dfa8.webp';
  // This specific artwork already includes a printed “了解更多” button.
  const printedPoster = forumOrigin + '/assets/magicslider/17725f74892709f03b2fc1161d5b3086.png';
  const controllers = new Map();
  let scanQueued = false;
  let active = true;

  window.__YMPLAY_FORUM_SLIDER__?.destroy();

  function findTarget(slider) {
    if (!/^\/(?:all\/?)?$/.test(location.pathname) || slider !== document.querySelector('.MagicSlider')) return null;
    const track = slider.querySelector(':scope > .MagicSlider-track');
    const slide = track?.querySelector(':scope > .MagicSlide');
    const poster = slide?.querySelector('.MagicSlide-image');
    const source = poster?.getAttribute('src');
    return source ? { track, slide, poster, source: poster.src } : null;
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
    const { track, slide, poster, source } = match;

    const originalHref = slide.getAttribute('href');
    const originalLabel = slide.getAttribute('aria-label');
    const originalTabIndex = slide.getAttribute('tabindex');
    const originalPointerEvents = slide.style.pointerEvents;
    const originalVisibility = slide.style.visibility;
    const originalTrackPosition = track.style.position;
    slide.setAttribute('aria-label', 'YiMaiPlay 音乐游戏控制器');
    slide.removeAttribute('href');
    slide.setAttribute('tabindex', '-1');
    slide.style.pointerEvents = 'none';
    slide.style.visibility = 'hidden';
    track.style.position = 'relative';

    let frame = null;
    let ready = false;
    let inView = false;
    let destroyed = false;
    let lastPlayback = null;

    // The panel moves with the matched slide and sits outside its original anchor.
    const panel = document.createElement('div');
    panel.className = 'YiMaiPlaySliderPanel';
    panel.dataset.release = release;
    panel.setAttribute('aria-label', 'YiMaiPlay 产品展示');
    panel.style.cssText = 'position:absolute;top:0;width:100%;height:100%;z-index:1;isolation:isolate;pointer-events:none;overflow:hidden;container-type:size;background:#f0f9fd';

    // The opaque poster sits above the live document until HTML and CSS are ready.
    const cover = document.createElement('picture');
    cover.className = 'YiMaiPlaySliderCover';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.cssText = 'position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none;background:#f0f9fd';
    const coverImage = document.createElement('img');
    coverImage.alt = '';
    coverImage.draggable = false;
    coverImage.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;object-position:center';
    coverImage.addEventListener('error', () => {
      const replacement = matchMedia('(max-width: 768px)').matches ? mobileCoverURL : coverURL;
      coverImage.style.objectFit = 'contain';
      coverImage.src = replacement;
      refresh();
    }, { once: true });
    coverImage.src = source;
    cover.append(coverImage);
    panel.append(cover);

    // The native slider receives pointer events over the left half. The model owns the right half.
    const gestures = document.createElement('div');
    gestures.setAttribute('aria-hidden', 'true');
    gestures.style.cssText = 'position:absolute;left:0;top:0;width:50%;height:100%;z-index:2;pointer-events:auto;touch-action:pan-y';
    panel.append(gestures);

    const cta = document.createElement('a');
    cta.className = 'YiMaiPlaySliderMore';
    cta.textContent = '了解更多';
    cta.href = advertOrigin + '/';
    cta.target = '_top';
    cta.style.cssText = 'position:absolute;left:max(50px,7%);bottom:7%;z-index:3;pointer-events:auto;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:6px 16px;padding:clamp(5px,1.6cqh,9px) clamp(13px,1.6cqw,22px);border:1px solid #36576a;border-radius:24px;background:#ffffffeb;color:#254758;font:600 13px/1.2 Inter,Arial,sans-serif;font-size:clamp(11px,1.05cqw,15px);text-decoration:none;box-shadow:0 2px 10px #1d35450a';
    cta.addEventListener('pointerdown', event => event.stopPropagation());
    cta.addEventListener('pointerup', event => event.stopPropagation());
    cta.addEventListener('click', event => event.stopPropagation());
    panel.append(cta);
    track.append(panel);

    const buttonStyle = cta.style.cssText;
    let printedLinkActive = false;
    let compactPoster = false;
    function positionPosterLink() {
      // A center crop of the wide artwork loses both the title and the machine.
      // On narrow slots reframe those two regions of the same uploaded image.
      if (!ready && coverImage.src.split(/[?#]/, 1)[0] === printedPoster) {
        const width = panel.clientWidth;
        const height = panel.clientHeight;
        if (!width || !height) return;
        let scale = Math.max(width / 2020, height / 450);
        let originX = (width - 2020 * scale) / 2;
        if (width / height < 3.9) {
          const split = Math.min(width * 0.54, height * 625 / 450);
          // Leave room beside the native slider's previous-slide arrow.
          originX = Math.min(28, width * 0.08);
          scale = (split - originX) / 625;
          cover.style.background = `#f3eee2 url("${printedPoster}") ${originX}px center / ${2020 * scale}px auto no-repeat`;
          const productWidth = width - split;
          // Center the right crop on the illuminated ring at x=1590 of 2020.
          const productScale = Math.max(height / 450, productWidth / 2020);
          const cropOffset = Math.max(0, Math.min(2020 * productScale - productWidth, 1590 * productScale - productWidth / 2));
          Object.assign(coverImage.style, { marginLeft: split + 'px', width: productWidth + 'px', objectPosition: -cropOffset + 'px center' });
          compactPoster = true;
        } else resetCrop();
        const left = originX + 75 * scale;
        const top = (height - 450 * scale) / 2 + 380 * scale;
        const buttonWidth = 182 * scale;
        const buttonHeight = 44 * scale;
        if (left >= 0 && left + buttonWidth <= width && top >= 0 && top + buttonHeight <= height) {
          const hitHeight = Math.min(height, Math.max(32, buttonHeight));
          const hitTop = Math.max(0, Math.min(height - hitHeight, top - (hitHeight - buttonHeight) / 2));
          Object.assign(cta.style, { left: left + 'px', top: hitTop + 'px', bottom: 'auto',
            width: buttonWidth + 'px', height: hitHeight + 'px', minHeight: '0',
            padding: '0', background: 'transparent', borderColor: 'transparent',
            color: 'transparent', boxShadow: 'none' });
          printedLinkActive = true;
          return;
        }
      } else resetCrop();
      if (printedLinkActive) {
        cta.style.cssText = buttonStyle;
        printedLinkActive = false;
      }
    }
    function resetCrop() {
      if (!compactPoster) return;
      cover.style.background = '#f0f9fd';
      Object.assign(coverImage.style, { marginLeft: '', width: '100%', objectPosition: 'center' });
      compactPoster = false;
    }
    const coverSize = new ResizeObserver(positionPosterLink);
    coverSize.observe(panel);

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
      positionPosterLink();
      if (showing && !frame) {
        frame = document.createElement('iframe');
        frame.title = 'YiMaiPlay 可旋转产品模型';
        frame.tabIndex = -1;
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.style.cssText = 'position:absolute;inset:0;z-index:0;display:block;width:100%;height:100%;border:0;background:#e5f4fc;pointer-events:none;color-scheme:light';
        frame.addEventListener('load', () => {
          frame.contentWindow?.postMessage({ type: 'yimaiplay:ad-status-request' }, advertOrigin);
        });
        frame.src = embedURL;
        panel.prepend(frame);
      }
      if (frame) {
        // Remove the cover from the render tree once the layout has been verified.
        if (ready && cover.isConnected) cover.remove();
        if (!ready && !cover.isConnected) panel.insertBefore(cover, gestures);
        frame.style.pointerEvents = ready && selected ? 'auto' : 'none';
        frame.tabIndex = ready && selected ? 0 : -1;
        frame.setAttribute('aria-hidden', String(!ready || !selected));
      }
      sendPlayback(!showing);
    }

    function onMessage(event) {
      if (event.origin !== advertOrigin || event.source !== frame?.contentWindow || event.data?.release !== release) return;
      if (event.data?.type === 'yimaiplay:banner-error') {
        sendPlayback(true);
        ready = false;
        refresh();
        return;
      }
      if (event.data?.type !== 'yimaiplay:banner-ready') return;
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
      source,
      refresh,
      pause() { sendPlayback(true); },
      destroy() {
        destroyed = true;
        sendPlayback(true);
        changes.disconnect();
        visibility?.disconnect();
        coverSize.disconnect();
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
        if (slide.style.visibility === 'hidden') slide.style.visibility = originalVisibility;
        track.style.position = originalTrackPosition;
      }
    };
  }

  function scan() {
    scanQueued = false;
    for (const [slider, controller] of controllers) {
      const match = findTarget(slider);
      if (!slider.isConnected || !match || match.track !== controller.track || match.slide !== controller.slide || match.poster !== controller.poster || match.source !== controller.source || !controller.panel.isConnected) {
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
    // The previous installation included a stylesheet which hid one particular GIF.
    for (const link of document.querySelectorAll('link[rel~="stylesheet"][href]')) {
      const url = new URL(link.href, document.baseURI);
      if (url.origin === advertOrigin && url.pathname === '/ad/forum-slider.css') link.disabled = true;
    }
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
  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.__YMPLAY_FORUM_SLIDER__ = {
    release,
    placement,
    destroy() {
      pageChanges.disconnect();
      active = false;
      scanQueued = false;
      document.removeEventListener('DOMContentLoaded', start);
      window.removeEventListener('popstate', scheduleScan);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      for (const controller of controllers.values()) controller.destroy();
      controllers.clear();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
