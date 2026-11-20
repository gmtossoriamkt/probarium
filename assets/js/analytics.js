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

  /* Цели по клику на ссылки с data-ym-goal (tel:/mailto: в шапке, меню и .pb-dock): phone_click, email_click.
   * Отправка только при принятых cookie: файл грузится лишь после согласия, а при отзыве согласия на этой же
   * странице cookie-banner.js ставит disableYaCounter113257593 и меняет cookieConsent — тогда ничего не шлём. */
  function consented() {
    try { if (localStorage.getItem('cookieConsent') !== 'accepted') return false; } catch (e) { return false; }
    return !window.disableYaCounter113257593 && typeof window.ym === 'function';
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-ym-goal]') : null;
    if (!a || !consented()) return;
    try { window.ym(113257593, 'reachGoal', a.getAttribute('data-ym-goal')); } catch (err) {}
  }, true);
})();
