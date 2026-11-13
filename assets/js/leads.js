/* Единая отправка заявок со всех форм сайта на функцию Яндекс Облака (JSON).
 *
 *  • Форма отправляется без перезагрузки; успех показывается только если сервер ответил {"ok":true}.
 *  • На коды ошибок (no_consent_pd, no_consent_offer, no_contact, bad_email, bad_phone, rate_limited…)
 *    пользователь видит понятное сообщение; кнопка на время отправки блокируется.
 *  • Неотправленная из-за сети или ответа сервера 5xx заявка сохраняется в браузере и досылается при следующем заходе.
 *    Ошибки проверки (4xx) в очередь не попадают.
 *
 *  window.ProbariumLeads.submit(fields) — программная отправка (используется классификатором МИ).
 */
(function(){
  var ENDPOINT = 'https://functions.yandexcloud.net/d4e389n57q1ils09t0f3';
  var COUNTER = 113257593;
  var QKEY = 'probarium_lead_queue_v1';
  var MAIL = 'info@probarium.ru';
  var GENERIC = 'Не удалось отправить заявку. Напишите нам на ' + MAIL;
  var MESSAGES = {
    no_consent_pd: 'Нужно согласие на обработку персональных данных',
    no_consent_offer: 'Нужно принять условия оферты',
    no_contact: 'Укажите email или телефон',
    bad_email: 'Проверьте адрес email',
    bad_phone: 'Проверьте номер телефона',
    rate_limited: 'Слишком много попыток, попробуйте позже или напишите на ' + MAIL
  };

  function goal(name, params){ try{ if(typeof ym === 'function') ym(COUNTER, 'reachGoal', name, params || {}); }catch(e){} }
  var article = (location.pathname.match(/\/blog\/([^\/]+)\//) || [])[1] || '';

  function on(v){ return v === true || v === 'on' || v === 'yes' || v === 'true' || v === '1'; }

  /* Приводим поля к контракту функции: согласия — 'on' только если отмечены, адрес страницы — page */
  function normalize(fields){
    var o = {};
    Object.keys(fields).forEach(function(k){ if(fields[k] !== undefined && fields[k] !== null) o[k] = fields[k]; });
    ['consent_pd', 'consent_offer'].forEach(function(k){ if(on(o[k])) o[k] = 'on'; else delete o[k]; });
    o.page = o.page || location.href.split('#')[0];
    delete o.source_url; delete o.source_page;
    return o;
  }

  /* Один запрос. Ответ функции всегда JSON; network=true — запрос не дошёл (сеть, блокировщик) */
  function post(fields){
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
      body: JSON.stringify(fields)
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        var ok = r.ok && j.ok === true;
        var code = ok ? '' : (j.error || 'http_' + r.status);
        return {ok: ok, status: r.status, error: code, message: ok ? '' : (MESSAGES[code] || GENERIC)};
      });
    }, function(){
      return {ok: false, network: true, status: 0, error: 'network', message: GENERIC};
    });
  }
  function retriable(r){ return r.network === true || r.status >= 500; }

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
    var f = Object.assign({}, next.f); f._subject = '[ПОВТОРНАЯ ОТПРАВКА] ' + (f._subject || 'Заявка с сайта Probarium');
    post(f).then(function(r){
      queueSet(r.ok || !retriable(r) ? q : [next].concat(q));   // 4xx не повторяем
      if(r.ok){ goal('lead_resent'); if(q.length) queueFlush(); }
    });
  }

  function formFields(form){
    var o = {};
    new FormData(form).forEach(function(v, k){ if(typeof v === 'string') o[k] = v; });
    return normalize(o);
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
      if(!window.fetch || !window.FormData || !window.Promise) return;   // совсем старый браузер — обычная отправка
      e.preventDefault();
      if(form.dataset.sending === '1') return;
      form.dataset.sending = '1';
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : '';
      if(btn){ btn.disabled = true; btn.textContent = 'Отправляем…'; }
      var err = form.querySelector('.form-error'); if(err) err.textContent = '';
      var fields = formFields(form);
      post(fields).then(function(r){
        if(r.ok){
          goal(article ? 'article_form_submit' : 'form_submit', {page: location.pathname});
          var ok = document.createElement('div');
          ok.className = 'form-thanks'; ok.setAttribute('role', 'status');
          ok.style.cssText = 'background:#fff;border-radius:16px;padding:28px;font-weight:600;color:#0F2A4D;font-size:18px;line-height:1.4;';
          ok.textContent = 'Спасибо, заявка отправлена. Мы свяжемся с вами в течение рабочего дня.';
          form.replaceWith(ok);
          return;
        }
        if(retriable(r)) queuePush(fields);   // не теряем заявку при сбое сети или сервера
        goal('form_error', {page: location.pathname, code: r.error});
        showError(form, r.message);
        form.dataset.sending = '0';
        if(btn){ btn.disabled = false; btn.textContent = label; }
      });
    });
  }

  window.ProbariumLeads = {
    /* Программная отправка: возвращает Promise<{ok:boolean, message:string}> */
    submit: function(fields){
      fields = normalize(Object.assign({page: location.href.split('#')[0]}, fields));
      return post(fields).then(function(r){
        if(!r.ok && retriable(r)) queuePush(fields);
        goal(r.ok ? 'form_submit' : 'form_error', {page: location.pathname});
        return {ok: r.ok, message: r.message, known: !!MESSAGES[r.error], contacts: 'Напишите на ' + MAIL + ' или позвоните +7 985 316-91-04.'};
      });
    }
  };

  function init(){
    [].forEach.call(document.querySelectorAll('form[action*="functions.yandexcloud.net"]'), bind);
    queueFlush();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
