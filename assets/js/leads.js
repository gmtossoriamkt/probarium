/* Единая отправка заявок со всех форм сайта (Formspree) с надёжной обработкой ошибок.
 *
 *  • Форма отправляется без перезагрузки; успех показывается только если сервер подтвердил приём (HTTP 2xx и ok !== false).
 *  • При ошибке сервера пользователь видит сообщение с телефоном и почтой, данные остаются в форме.
 *  • Если сеть/блокировщик не дают выполнить запрос — пробуем обычную отправку формы (переходом на страницу Formspree).
 *  • Дублирование: если в SECONDARY указан второй приёмник, каждая заявка уходит и туда (независимый канал).
 *  • Заявка, которую не удалось отправить, сохраняется в браузере и досылается при следующем заходе на сайт.
 *
 *  window.ProbariumLeads.submit(fields) — программная отправка (используется классификатором МИ).
 */
(function(){
  var PRIMARY = 'https://formspree.io/f/mzdlwqbk';
  /* Второй независимый приёмник заявок. Пример для второй формы Formspree с другим адресом получателя:
   *   SECONDARY = [{url: 'https://formspree.io/f/XXXXXXXX'}];
   * Для сервисов с ключом доступа (Web3Forms и т. п.): {url: '…', extra: {access_key: '…'}} */
  var SECONDARY = [];
  var COUNTER = 113257593;
  var QKEY = 'probarium_lead_queue_v1';
  var CONTACTS = 'Напишите на info@probarium.ru или позвоните +7 985 316-91-04.';

  function goal(name, params){ try{ if(typeof ym === 'function') ym(COUNTER, 'reachGoal', name, params || {}); }catch(e){} }
  var article = (location.pathname.match(/\/blog\/([^\/]+)\//) || [])[1] || '';

  function post(url, body){
    return fetch(url, {method:'POST', body:body, headers:{'Accept':'application/json'}}).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){ return {ok: r.ok && j.ok !== false, status: r.status}; });
    });
  }
  function toFormData(fields, extra){
    var fd = new FormData();
    Object.keys(fields).forEach(function(k){ fd.append(k, fields[k]); });
    if(extra) Object.keys(extra).forEach(function(k){ fd.append(k, extra[k]); });
    return fd;
  }
  /* Отправка во все каналы. Успех — если принял основной ИЛИ любой запасной. network=true — запрос вообще не ушёл. */
  function sendAll(fields){
    var tasks = [post(PRIMARY, toFormData(fields))].concat(SECONDARY.map(function(s){
      return post(s.url, toFormData(fields, s.extra)).catch(function(){ return {ok:false}; });
    }));
    return Promise.all(tasks.map(function(p, i){
      return p.catch(function(){ return {ok:false, network:true, idx:i}; });
    })).then(function(res){
      return {ok: res.some(function(r){ return r.ok; }), network: res[0].network === true, results: res};
    });
  }

  /* Очередь неотправленных заявок */
  function queueGet(){ try{ return JSON.parse(localStorage.getItem(QKEY) || '[]'); }catch(e){ return []; } }
  function queueSet(q){ try{ localStorage.setItem(QKEY, JSON.stringify(q)); }catch(e){} }
  function queuePush(fields){
    var q = queueGet(); q.push({t: Date.now(), f: fields}); queueSet(q.slice(-5));
  }
  function queueFlush(){
    var q = queueGet().filter(function(x){ return Date.now() - x.t < 7 * 864e5; });
    if(!q.length){ queueSet([]); return; }
    var next = q.shift();
    var f = next.f; f._subject = '[ПОВТОРНАЯ ОТПРАВКА] ' + (f._subject || 'Заявка с сайта Probarium');
    sendAll(f).then(function(r){
      queueSet(r.ok ? q : [next].concat(q));
      if(r.ok){ goal('lead_resent'); if(q.length) queueFlush(); }
    });
  }

  function formFields(form){
    var o = {};
    new FormData(form).forEach(function(v, k){ if(typeof v === 'string') o[k] = v; });
    if(!o.source_url) o.source_url = location.href.split('#')[0];
    if(!o.source_page) o.source_page = location.pathname;
    return o;
  }

  function showError(form, text){
    var el = form.querySelector('.form-error');
    if(!el){
      el = document.createElement('p'); el.className = 'form-error'; el.setAttribute('role', 'alert');
      el.style.cssText = 'color:#B3261E;font-size:14px;margin:0;line-height:1.4;';
      var btn = form.querySelector('button[type="submit"]');
      (btn && btn.parentNode ? btn.parentNode : form).insertBefore(el, btn || null);
    }
    el.textContent = text;
  }

  function bind(form){
    if(form.dataset.leadsBound) return;
    form.dataset.leadsBound = '1';
    form.addEventListener('submit', function(e){
      if(form.dataset.sending === 'native') return;       // обычная отправка (резервный путь)
      if(!window.fetch || !window.FormData || !window.Promise) return;
      e.preventDefault();
      if(form.dataset.sending === '1') return;
      form.dataset.sending = '1';
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : '';
      if(btn){ btn.disabled = true; btn.textContent = 'Отправляем…'; }
      var err = form.querySelector('.form-error'); if(err) err.textContent = '';
      var fields = formFields(form);
      sendAll(fields).then(function(r){
        if(r.ok){
          goal(article ? 'article_form_submit' : 'form_submit', {page: location.pathname});
          var ok = document.createElement('div');
          ok.className = 'form-thanks'; ok.setAttribute('role', 'status');
          ok.style.cssText = 'background:#fff;border-radius:16px;padding:28px;font-weight:600;color:#0F2A4D;font-size:18px;line-height:1.4;';
          ok.textContent = 'Спасибо, заявка отправлена. Мы свяжемся с вами в течение рабочего дня.';
          form.replaceWith(ok);
          return;
        }
        if(r.network){            // запрос не ушёл (сеть, блокировщик) — пробуем обычную отправку
          form.dataset.sending = 'native';
          form.submit();
          return;
        }
        queuePush(fields);        // сервер ответил ошибкой — не теряем заявку
        goal('form_error', {page: location.pathname});
        showError(form, 'Не удалось отправить заявку. ' + CONTACTS);
        form.dataset.sending = '0';
        if(btn){ btn.disabled = false; btn.textContent = label; }
      });
    });
  }

  window.ProbariumLeads = {
    /* Программная отправка: возвращает Promise<{ok:boolean}> */
    submit: function(fields){
      fields = Object.assign({source_url: location.href.split('#')[0]}, fields);
      return sendAll(fields).then(function(r){
        if(!r.ok) queuePush(fields);
        goal(r.ok ? 'form_submit' : 'form_error', {page: location.pathname});
        return {ok: r.ok, contacts: CONTACTS};
      });
    }
  };

  function init(){
    [].forEach.call(document.querySelectorAll('form[action*="formspree.io/f/"]'), bind);
    queueFlush();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
