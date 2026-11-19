/* Compatibility entry for existing forum headers. */
(() => {
  if (location.origin !== 'https://forum.akiacg.com') return;
  const url = 'https://yimaiplay.akiacg.com/forum/first-slide.js?v=20261119-5';
  if (Array.from(document.scripts).some(script => script.src === url)) return;
  const script = document.createElement('script');
  script.src = url;
  document.head.append(script);
})();
