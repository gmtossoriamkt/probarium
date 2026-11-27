/* Probarium — modern layer: поведение шапки, анимации, мобильная панель связи */
(function(){
  var d=document, root=d.documentElement; root.classList.add('js');
  function ready(f){ d.readyState!=='loading'?f():d.addEventListener('DOMContentLoaded',f); }
  ready(function(){
    var header=d.querySelector('header.site-header');
    var bar=d.createElement('div'); bar.className='pb-progress'; d.body.appendChild(bar);
    function onScroll(){
      var y=window.pageYOffset||root.scrollTop, h=root.scrollHeight-root.clientHeight;
      if(header) header.classList.toggle('scrolled', y>8);
      bar.style.width=(h>0?Math.min(100,y/h*100):0)+'%';
      if(dock) dock.classList.toggle('show', y>520);
    }
    var path=location.pathname.replace(/\/index\.html$/,'').replace(/\/$/,'')||'/';
    initMenu(path);
    // мобильная панель связи (не на юр. страницах и контактах)
    var dock=null;
    if(!/^\/(kontakty|privacy|terms|cookie|disclaimer|oferta|lk|data-room)/.test(path)){
      dock=d.createElement('div'); dock.className='pb-dock';
      dock.innerHTML='<a class="d-main" href="/kontakty/">Оставить заявку</a><a class="d-tel" href="tel:+79853169104" data-ym-goal="phone_click">Позвонить</a>';
      d.body.appendChild(dock);
    }
    window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
    // появление блоков
    var sel='.card,.segment,.trigger,.case-card,.form-card,.risk-card,.related-card,.step,.rstep,.base-chip,details.faq-item,.section-head,.roadmap-band,.final-cta,.pricing-band,.npa-list,.doc-list';
    var els=[].slice.call(d.querySelectorAll('main '+sel.split(',').join(',main ')));
    if(!('IntersectionObserver' in window)){ return; }
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    els.forEach(function(el){
      var sib=[].indexOf.call(el.parentNode.children,el);
      el.style.setProperty('--d',Math.min(sib,6)*0.06+'s');
      el.classList.add('rv'); io.observe(el);
    });
    // страховка: ничего не должно остаться скрытым
    setTimeout(function(){ els.forEach(function(el){ el.classList.add('in'); }); },4000);
  });

  /* ===== бургер-меню (разметка — scripts/header-burger.js) ===== */
  function initMenu(path){
    // Страницы, которые относятся к пункту меню, но лежат не под его адресом (как в header-fx.js)
    var SECTIONS={
      '/uslugi':['/kalkulyator','/podbor-ispytaniy','/podbor-tehispytaniy','/eticheskiy-komitet'],
      '/o-kompanii':['/komanda','/licenzii-sertifikaty','/klinicheskie-bazy'],
      '/npa':['/reestry']
    };
    var btn=d.querySelector('.pb-burger'), panel=d.getElementById('pbMenu'), backdrop=d.querySelector('.pb-menu-backdrop');
    if(!btn||!panel||!backdrop) return;
    var closeBtn=panel.querySelector('.pb-menu-close');
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isOpen=false, hideTimer=null;
    var norm=function(h){ return (h||'').replace(/\/$/,'')||'/'; };

    // текущая страница: самый длинный совпавший адрес — aria-current="page"; страница раздела — aria-current="true"
    var links=[].slice.call(panel.querySelectorAll('.pb-menu-nav a[href^="/"]')), best=null, bestLen=0;
    links.forEach(function(a){
      var p=norm(a.getAttribute('href'));
      if(p!=='/' && (path===p || path.indexOf(p+'/')===0) && p.length>bestLen){ best=a; bestLen=p.length; }
    });
    if(best) best.setAttribute('aria-current','page');
    else links.forEach(function(a){
      var list=SECTIONS[norm(a.getAttribute('href'))]||[];
      if(list.some(function(b){ return path===b || path.indexOf(b+'/')===0; })) a.setAttribute('aria-current','true');
    });
    // аккордеоны; группа с текущей страницей подсвечена и раскрыта
    [].forEach.call(panel.querySelectorAll('.pb-acc-btn'),function(b){
      var list=d.getElementById(b.getAttribute('aria-controls'));
      if(!list) return;
      function set(open){ b.setAttribute('aria-expanded',open?'true':'false'); list.hidden=!open; }
      if(list.querySelector('a[aria-current]')){ b.classList.add('is-current'); set(true); }
      b.addEventListener('click',function(){ set(b.getAttribute('aria-expanded')!=='true'); });
    });

    function focusables(){
      return [].slice.call(panel.querySelectorAll('a[href],button:not([disabled])')).filter(function(el){ return el.offsetParent!==null; });
    }
    function open(){
      if(isOpen) return; isOpen=true; clearTimeout(hideTimer);
      panel.hidden=false; backdrop.hidden=false;
      void panel.offsetWidth; // запуск перехода после снятия hidden
      panel.classList.add('open'); backdrop.classList.add('open');
      var sbw=window.innerWidth-root.clientWidth; // ширина полосы прокрутки: без неё страница не сдвигается
      if(sbw>0) d.body.style.paddingRight=sbw+'px';
      root.classList.add('pb-menu-open');
      btn.setAttribute('aria-expanded','true'); btn.setAttribute('aria-label','Закрыть меню');
      var cur=panel.querySelector('.pb-menu-nav a[aria-current="page"]');
      (closeBtn||focusables()[0]).focus({preventScroll:true});
      if(cur&&cur.scrollIntoView) cur.scrollIntoView({block:'nearest'});
    }
    function close(returnFocus){
      if(!isOpen) return; isOpen=false;
      panel.classList.remove('open'); backdrop.classList.remove('open');
      root.classList.remove('pb-menu-open'); d.body.style.paddingRight='';
      btn.setAttribute('aria-expanded','false'); btn.setAttribute('aria-label','Открыть меню');
      var done=function(){ if(!isOpen){ panel.hidden=true; backdrop.hidden=true; } };
      if(reduce) done(); else hideTimer=setTimeout(done,320);
      if(returnFocus!==false) btn.focus({preventScroll:true});
    }
    btn.addEventListener('click',function(){ isOpen?close():open(); });
    if(closeBtn) closeBtn.addEventListener('click',function(){ close(); });
    backdrop.addEventListener('click',function(){ close(); });
    d.addEventListener('keydown',function(e){
      if(!isOpen) return;
      if(e.key==='Escape'||e.key==='Esc'){ e.preventDefault(); close(); return; }
      if(e.key==='Tab'){
        var f=focusables(); if(!f.length) return;
        var first=f[0], last=f[f.length-1], a=d.activeElement;
        if(!panel.contains(a)){ e.preventDefault(); first.focus(); }
        else if(e.shiftKey && a===first){ e.preventDefault(); last.focus(); }
        else if(!e.shiftKey && a===last){ e.preventDefault(); first.focus(); }
      }
    });
    // фокус не уходит из открытой панели (клик мышью мимо, программный фокус)
    d.addEventListener('focusin',function(e){ if(isOpen && !panel.contains(e.target)){ (closeBtn||focusables()[0]).focus({preventScroll:true}); } });
    // переход по ссылке-якорю на этой же странице — закрыть панель
    panel.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('a[href]');
      if(a && a.hash && a.pathname===location.pathname) close(false);
    });
  }
})();
