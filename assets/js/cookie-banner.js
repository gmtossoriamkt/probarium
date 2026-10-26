/* Баннер cookie и согласие на веб-аналитику (Яндекс.Метрика).
 * Выбор хранится в localStorage: cookieConsent = 'accepted' | 'declined'.
 * Метрика (assets/js/analytics.js) загружается только при 'accepted'. Без выбора и при 'declined' аналитика не грузится.
 * Ссылка «Настройки cookie» (атрибут data-cookie-settings) в подвале показывает баннер снова, чтобы можно было отозвать согласие. */
(function () {
  var KEY = 'cookieConsent';
  var COUNTER = 113257593;
  var ANALYTICS = '/assets/js/analytics.js';
  var banner = null;

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  function loadAnalytics() {
    if (window.__pbAnalyticsRequested) return;
    window.__pbAnalyticsRequested = true;
    var s = document.createElement('script');
    s.src = ANALYTICS; s.async = true;
    document.head.appendChild(s);
  }

  /* Отзыв согласия: останавливаем счётчик на текущей странице (если уже загружен) и удаляем его cookie */
  function stopAnalytics() {
    window['disableYaCounter' + COUNTER] = true;
    try {
      var host = location.hostname, parts = host.split('.'), parent = parts.length > 2 ? parts.slice(-2).join('.') : host;
      document.cookie.split(';').forEach(function (c) {
        var n = c.split('=')[0].trim();
        if (!/^_ym/.test(n)) return;
        var exp = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = exp;
        document.cookie = exp + '; domain=' + host;
        document.cookie = exp + '; domain=.' + parent;
      });
      Object.keys(localStorage).forEach(function (k) { if (/^_ym/.test(k)) localStorage.removeItem(k); });
    } catch (e) {}
  }

  function css() {
    if (document.getElementById('cookie-banner-style')) return;
    var style = document.createElement('style');
    style.id = 'cookie-banner-style';
    style.textContent =
      '#cookie-banner{position:fixed;left:0;right:0;bottom:0;width:100%;z-index:9999;' +
        'background:var(--blue-deep,#0F2A4D);color:#fff;padding:16px 24px;box-shadow:0 -2px 12px rgba(0,0,0,.18);}' +
      '#cookie-banner .cookie-banner-inner{max-width:1160px;margin:0 auto;display:flex;align-items:center;' +
        'justify-content:space-between;gap:20px;flex-wrap:wrap;}' +
      '#cookie-banner .cookie-banner-text{font-family:Arial,sans-serif;font-size:14px;line-height:1.5;margin:0;flex:1;min-width:240px;}' +
      '#cookie-banner .cookie-banner-text a{color:#fff;text-decoration:underline;}' +
      '#cookie-banner .cookie-banner-actions{display:flex;gap:10px;flex-shrink:0;}' +
      '#cookie-banner .cookie-banner-btn{border-radius:8px;padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer;' +
        'font-family:\'Space Grotesk\',Arial,sans-serif;border:2px solid #FF6B1A;}' +
      '#cookie-banner .cookie-banner-accept{background:#FF6B1A;color:#0F2A4D;}' +
      '#cookie-banner .cookie-banner-accept:hover{background:#F6600A;border-color:#F6600A;}' +
      '#cookie-banner .cookie-banner-decline{background:transparent;color:#fff;border-color:rgba(255,255,255,.55);}' +
      '#cookie-banner .cookie-banner-decline:hover{border-color:#fff;}' +
      /* пока виден баннер: контент прокручивается выше него, нижняя панель связи поднята над ним */
      'html.cookie-open body{padding-bottom:var(--cookie-h,0px);}' +
      '@media (max-width:820px){html.cookie-open body{padding-bottom:calc(var(--cookie-h,0px) + 76px);}' +
        'html.cookie-open .pb-dock{bottom:calc(var(--cookie-h,0px) + 12px);}}' +
      '@media (max-width:600px){#cookie-banner .cookie-banner-inner{flex-direction:column;align-items:stretch;text-align:center;}' +
        '#cookie-banner .cookie-banner-actions{justify-content:center;}#cookie-banner .cookie-banner-btn{flex:1;}}';
    document.head.appendChild(style);
  }

  function syncHeight() {
    if (!banner) return;
    document.documentElement.style.setProperty('--cookie-h', banner.offsetHeight + 'px');
  }

  function hide() {
    if (banner) { banner.remove(); banner = null; }
    document.documentElement.classList.remove('cookie-open');
    document.documentElement.style.removeProperty('--cookie-h');
    window.removeEventListener('resize', syncHeight);
  }

  function show() {
    if (banner || document.getElementById('cookie-banner')) return;
    css();
    banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Согласие на использование cookie');
    banner.innerHTML =
      '<div class="cookie-banner-inner">' +
        '<p class="cookie-banner-text">Мы используем cookie и сервис веб-аналитики Яндекс.Метрика, чтобы улучшать сайт. Аналитика включается только с вашего согласия. Подробнее в <a href="/cookie/">Политике cookie</a>.</p>' +
        '<div class="cookie-banner-actions">' +
          '<button type="button" class="cookie-banner-btn cookie-banner-decline" id="cookie-banner-decline">Отклонить</button>' +
          '<button type="button" class="cookie-banner-btn cookie-banner-accept" id="cookie-banner-accept">Принять</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);
    document.documentElement.classList.add('cookie-open');
    syncHeight();
    window.addEventListener('resize', syncHeight);

    document.getElementById('cookie-banner-accept').addEventListener('click', function () {
      set('accepted'); hide(); loadAnalytics();
    });
    document.getElementById('cookie-banner-decline').addEventListener('click', function () {
      set('declined'); hide(); stopAnalytics();
    });
  }

  function init() {
    var v = get();
    if (v === 'accepted') { loadAnalytics(); }
    else if (v === 'declined') { /* ничего не грузим */ }
    else { try { if (v) localStorage.removeItem(KEY); } catch (e) {} show(); }   /* пустое или устаревшее значение — спрашиваем заново */

    document.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (!a) return;
      e.preventDefault();
      show();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
