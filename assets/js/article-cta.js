/* Статьи блога: предзаполнение формы из CTA, цели Яндекс.Метрики, оглавление на мобильных. Отправку форм делает leads.js. */
(function(){
  var COUNTER = 113257593;
  function goal(name, params){
    try{ if(typeof ym === 'function') ym(COUNTER, 'reachGoal', name, params || {}); }catch(e){}
  }
  var article = (location.pathname.match(/\/blog\/([^\/]+)\//) || [])[1] || '';

  // Клики по CTA: предзаполнение темы и поля «Что нужно», цели Метрики
  document.addEventListener('click', function(e){
    var a = e.target.closest ? e.target.closest('a[data-goal]') : null;
    if(!a) return;
    goal(a.getAttribute('data-goal'), {article: article});
    var topic = a.getAttribute('data-prefill');
    if(topic){
      var form = document.getElementById('cta-form');
      if(form){
        var msg = form.querySelector('textarea[name="message"]');
        if(msg && !msg.value.trim()) msg.value = topic + '. ';
        var need = a.getAttribute('data-need');
        var sel = form.querySelector('select[name="need"]');
        if(sel && need){ for(var i=0;i<sel.options.length;i++){ if(sel.options[i].text === need) sel.selectedIndex = i; } }
      }
    }
  });

  // Отправка формы выполняется общим скриптом /assets/js/leads.js

  // Оглавление: на узких экранах свёрнуто
  var toc = document.querySelector('details.toc');
  if(toc && window.matchMedia && window.matchMedia('(max-width: 700px)').matches) toc.removeAttribute('open');
})();
