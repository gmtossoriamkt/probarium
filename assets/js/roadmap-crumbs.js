/* Если пользователь пришёл с дорожной карты (?from=roadmap&step=N), хлебные крошки показывают путь через неё. */
(function(){
  var q = new URLSearchParams(location.search);
  if(q.get('from') !== 'roadmap') return;
  var cur = document.querySelector('nav[aria-label="Хлебные крошки"] [aria-current="page"], .breadcrumbs [aria-current="page"]');
  if(!cur || !cur.parentNode) return;
  var step = parseInt(q.get('step'), 10);
  var nav = cur.parentNode;
  var label = (step > 0 && step < 20 ? 'Этап ' + step + ': ' : '') + cur.textContent;
  nav.innerHTML = '<a href="/">Главная</a> / <a href="/dorozhnaya-karta">Дорожная карта вывода на рынок</a> / ' +
    '<span aria-current="page"></span>';
  nav.querySelector('[aria-current]').textContent = label;
})();
