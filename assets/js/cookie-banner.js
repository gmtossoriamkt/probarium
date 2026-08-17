(function(){
  function init(){
    if (localStorage.getItem('cookieConsent')) return;
    if (document.getElementById('cookie-banner')) return;

    var style = document.createElement('style');
    style.textContent =
      '#cookie-banner{position:fixed;left:0;right:0;bottom:0;width:100%;z-index:9999;' +
        'background:var(--blue-deep,#0F2A4D);color:#fff;padding:16px 24px;box-shadow:0 -2px 12px rgba(0,0,0,.18);}' +
      '#cookie-banner .cookie-banner-inner{max-width:1160px;margin:0 auto;display:flex;align-items:center;' +
        'justify-content:space-between;gap:20px;flex-wrap:wrap;}' +
      '#cookie-banner .cookie-banner-text{font-family:Arial,sans-serif;font-size:14px;line-height:1.5;margin:0;' +
        'flex:1;min-width:240px;}' +
      '#cookie-banner .cookie-banner-text a{color:#fff;text-decoration:underline;}' +
      '#cookie-banner .cookie-banner-btn{background:var(--gold,#B3701A);color:#fff;border:none;border-radius:8px;' +
        'padding:10px 22px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0;font-family:Arial,sans-serif;}' +
      '#cookie-banner .cookie-banner-btn:hover{background:#9E620F;}' +
      '@media (max-width:600px){#cookie-banner .cookie-banner-inner{flex-direction:column;align-items:stretch;text-align:center;}}';
    document.head.appendChild(style);

    var banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML =
      '<div class="cookie-banner-inner">' +
        '<p class="cookie-banner-text">Мы используем файлы cookie для корректной работы сайта. Продолжая использовать сайт, вы соглашаетесь с использованием cookie в соответствии с <a href="/cookie">cookie-политикой</a>.</p>' +
        '<button type="button" class="cookie-banner-btn" id="cookie-banner-accept">Принимаю</button>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('cookie-banner-accept').addEventListener('click', function(){
      localStorage.setItem('cookieConsent', 'true');
      banner.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
