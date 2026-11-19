/* Existing installations use the same dedicated forum banner as new installations. */
(() => {
  if (location.origin !== 'https://forum.akiacg.com') return;
  const url = 'https://yimaiplay.akiacg.com/forum/yimaiplay-banner.js';
  if ([...document.scripts].some(script => script.src === url)) return;
  const script = document.createElement('script');
  script.src = url;
  document.head.append(script);
})();
