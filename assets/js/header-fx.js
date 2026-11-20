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

/* Компактная шапка с тенью после прокрутки (гистерезис, одно обновление на кадр). */
(function(){
  var header = document.querySelector('header.site-header');
  if(!header) return;
  var on = false, ticking = false;
  function update(){
    ticking = false;
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if(!on && y > 60){ on = true; header.classList.add('is-scrolled'); }
    else if(on && y < 20){ on = false; header.classList.remove('is-scrolled'); }
  }
  window.addEventListener('scroll', function(){
    if(!ticking){ ticking = true; window.requestAnimationFrame(update); }
  }, {passive:true});
  update();
})();
