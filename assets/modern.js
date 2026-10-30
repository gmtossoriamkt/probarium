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
    // активный пункт меню
    var path=location.pathname.replace(/\/index\.html$/,'').replace(/\/$/,'')||'/';
    d.querySelectorAll('nav.main-nav a[href^="/"]').forEach(function(a){
      var p=a.getAttribute('href').replace(/\/$/,'')||'/';
      if(p!=='/' && (path===p || path.indexOf(p+'/')===0)) a.setAttribute('aria-current','page');
    });
    // мобильная панель связи (не на юр. страницах и контактах)
    var dock=null;
    if(!/^\/(kontakty|privacy|terms|cookie|disclaimer|oferta|lk|data-room)/.test(path)){
      dock=d.createElement('div'); dock.className='pb-dock';
      dock.innerHTML='<a class="d-main" href="/kontakty/">Оставить заявку</a><a class="d-tel" href="tel:+79888777295">Позвонить</a>';
      d.body.appendChild(dock);
    }
    window.addEventListener('scroll',onScroll,{passive:true}); onScroll();
    // раскрытие подменю с клавиатуры/тача
    d.querySelectorAll('.has-sub > .nav-trigger').forEach(function(b){
      b.addEventListener('click',function(){
        var open=b.getAttribute('aria-expanded')==='true';
        b.setAttribute('aria-expanded',open?'false':'true');
      });
    });
    // закрывать мобильное меню по ссылке
    d.querySelectorAll('#mobileNav a').forEach(function(a){
      a.addEventListener('click',function(){ var n=d.getElementById('mobileNav'); if(n&&n.classList.contains('open')&&typeof toggleMobileNav==='function') toggleMobileNav(); });
    });
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
})();
