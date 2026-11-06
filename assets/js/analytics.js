/* Яндекс.Метрика (счётчик 113257593). Подгружается ТОЛЬКО после согласия пользователя —
 * см. assets/js/cookie-banner.js. Напрямую в страницы не подключать. */
(function () {
  if (window.__ymStarted) return;
  window.__ymStarted = true;
  window.dataLayer = window.dataLayer || [];
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
    k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=113257593', 'ym');
  ym(113257593, 'init', {ssr: true, webvisor: true, clickmap: true, ecommerce: 'dataLayer', referrer: document.referrer, url: location.href, accurateTrackBounce: true, trackLinks: true});
})();
