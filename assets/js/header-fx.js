/* Шапка: подсветка активного раздела меню. */
(function(){
  /* Страницы, которые относятся к разделу меню, но лежат не под его адресом */
  var sections = {
    '/uslugi': ['/uslugi','/klinicheskie-ispytaniya-medizdeliy','/doklinicheskie-issledovaniya','/tehnicheskie-ispytaniya-medizdeliy',
      '/registraciya-medizdeliy','/razrabotka-dokumentatsii','/podbor-ispytaniy','/podbor-tehispytaniy','/eticheskiy-komitet','/kalkulyator','/dorozhnaya-karta'],
    '/o-kompanii': ['/o-kompanii','/komanda','/licenzii-sertifikaty','/kejsy','/klinicheskie-bazy'],
    '/npa': ['/npa','/reestry'],
    '/biblioteka': ['/biblioteka','/glossariy'],
    '/blog': ['/blog'],
    '/kontakty': ['/kontakty']
  };
  function norm(p){ return (p.replace(/\/+$/, '') || '/'); }
  var path = norm(location.pathname);
  function inList(list){
    return list.some(function(base){ return path === base || path.indexOf(base + '/') === 0; });
  }
  [].forEach.call(document.querySelectorAll('nav.main-nav a, nav.mobile-nav a'), function(a){
    var href = a.getAttribute('href');
    if(!href || href.charAt(0) !== '/') return;
    var key = norm(href);
    if(key === '/') return;
    var list = sections[key] || [key];
    if(path === key) a.setAttribute('aria-current', 'page');
    else if(inList(list)) a.setAttribute('aria-current', 'true');
  });
})();
