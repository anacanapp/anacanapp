/* Anacan Premium mini funnel (anacan.az). Steps: stage → needs → plan + e-mail → inline Dodo checkout → done.
   The checkout session is created by api.anacan.az/functions/v1/dodo-checkout (Anacan theme, language, return URL);
   Premium is granted only by the signed Dodo webhook, never by this page. */
(function () {
  'use strict';
  var LANGS = ['az', 'en', 'tr', 'ru', 'kk', 'uz', 'ka', 'de', 'ar', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv'];
  var API = 'https://api.anacan.az/functions/v1/dodo-checkout';
  var PRICES = { monthly: 2.22, yearly: 15.55 };
  var APP_STORE = 'https://apps.apple.com/app/anacan/id6758301924';
  var GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan';
  var CHARACTERS = { flow: 'ritm', bump: 'tumurcuq', mommy: 'qucaq' };
  var params = new URLSearchParams(location.search);
  var store = {
    get: function (k) { try { return sessionStorage.getItem('anacan_funnel_' + k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem('anacan_funnel_' + k, v); } catch (e) { /* private mode */ } }
  };
  var browser = (navigator.language || 'az').slice(0, 2).toLowerCase();
  var lang = LANGS.indexOf(params.get('lang')) >= 0 ? params.get('lang') : LANGS.indexOf(browser) >= 0 ? browser : 'az';
  var t = null;
  var state = { step: 1, stage: store.get('stage'), needs: [], plan: 'yearly', email: store.get('email') || '' };
  var view = document.getElementById('view');
  var money = function (n) {
    try { return new Intl.NumberFormat(lang === 'az' ? 'az-Latn-AZ' : lang, { style: 'currency', currency: 'USD' }).format(n); }
    catch (e) { return '$' + n.toFixed(2); }
  };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var track = function (name, data) {
    // Hook for later analytics; never sends the e-mail address.
    window.dataLayer = window.dataLayer || []; window.dataLayer.push(Object.assign({ event: 'anacan_funnel_' + name, lang: lang }, data || {}));
  };

  function header(step) {
    document.getElementById('step').textContent = step <= 4 ? t.step.replace('{n}', String(step)) : '';
    document.getElementById('progress').style.width = Math.min(100, step * 25) + '%';
    var back = document.getElementById('back');
    back.hidden = step <= 1 || step >= 5;
    back.setAttribute('aria-label', t.back);
  }

  function option(id, emoji, title, sub, pressed) {
    return '<button type="button" class="option" data-id="' + id + '" aria-pressed="' + pressed + '"><span class="emoji" aria-hidden="true">' + emoji + '</span>' +
      '<span><b>' + esc(title) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><span class="check" aria-hidden="true">✓</span></button>';
  }

  function stepStage() {
    header(1);
    view.innerHTML = '<img class="hero" src="/website/characters/' + (CHARACTERS[state.stage] || 'tumurcuq') + '-welcome.webp" alt="" width="150" height="150">' +
      '<h1>' + esc(t.q1) + '</h1><div class="options">' +
      option('flow', '🌸', t.q1_flow, t.q1_flow_sub, state.stage === 'flow') +
      option('bump', '🤰', t.q1_bump, t.q1_bump_sub, state.stage === 'bump') +
      option('mommy', '👶', t.q1_mommy, t.q1_mommy_sub, state.stage === 'mommy') + '</div>';
    view.querySelectorAll('.option').forEach(function (b) {
      b.onclick = function () { state.stage = b.dataset.id; store.set('stage', state.stage); track('stage', { stage: state.stage }); go(2); };
    });
  }

  function stepNeeds() {
    header(2);
    var items = [['ai', '💬', t.q2_ai], ['track', '📅', t.q2_track], ['partner', '🤝', t.q2_partner], ['calm', '🌿', t.q2_calm]];
    view.innerHTML = '<h1>' + esc(t.q2) + '</h1><p class="sub">' + esc(t.q2_sub) + '</p><div class="options">' +
      items.map(function (i) { return option(i[0], i[1], i[2], '', state.needs.indexOf(i[0]) >= 0); }).join('') +
      '</div><button type="button" class="cta" id="next">' + esc(t.next) + '</button>';
    view.querySelectorAll('.option').forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.id, at = state.needs.indexOf(id);
        if (at >= 0) state.needs.splice(at, 1); else state.needs.push(id);
        b.setAttribute('aria-pressed', String(at < 0));
      };
    });
    document.getElementById('next').onclick = function () { track('needs', { needs: state.needs.join(',') }); go(3); };
  }

  function planButton(id, title, price, unit, note, badge) {
    return '<button type="button" class="plan" role="radio" data-plan="' + id + '" aria-checked="' + (state.plan === id) + '">' +
      (badge ? '<span class="badge">' + esc(badge) + '</span>' : '') + '<span class="radio" aria-hidden="true"></span>' +
      '<span><b>' + esc(title) + '</b>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</span>' +
      '<span class="price">' + esc(price) + '<small>' + esc(unit) + '</small></span></button>';
  }

  function stepPlan() {
    header(3);
    var stage = state.stage || 'bump';
    var save = Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100);
    view.innerHTML = '<img class="hero" src="/website/characters/' + CHARACTERS[stage] + '-value.webp" alt="" width="150" height="150">' +
      '<h1>' + esc(t.result_title) + '</h1><p class="sub">' + esc(t['result_' + stage]) + '</p>' +
      '<div class="card"><ul class="benefits">' + t.benefits.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>' +
      '<h2 class="sub" style="font-weight:800;color:var(--ink);font-size:16px;margin:4px 2px 0">' + esc(t.plans_title) + '</h2>' +
      '<div class="plans" role="radiogroup">' +
      planButton('yearly', t.yearly, money(PRICES.yearly), t.per_year, t.yearly_note.replace('{price}', money(PRICES.yearly / 12)) + ' · ' + t.save.replace('{n}', String(save)), t.popular) +
      planButton('monthly', t.monthly, money(PRICES.monthly), t.per_month, '', '') + '</div>' +
      '<label class="field" for="email">' + esc(t.email_label) + '</label>' +
      '<input class="email" id="email" type="email" inputmode="email" autocomplete="email" dir="ltr" placeholder="' + esc(t.email_placeholder) + '" value="' + esc(state.email) + '">' +
      '<p class="hint">' + esc(t.email_hint) + '</p><p class="error" id="err" hidden></p>' +
      '<button type="button" class="cta" id="pay">' + esc(t.pay) + '</button>' +
      '<p class="secure">🔒 ' + esc(t.secure) + '</p>' +
      '<p class="fine">' + esc(t.renew_note) + ' ' + esc(t.legal).replace(esc(t.terms), '<a href="https://anacan.az/terms" target="_blank" rel="noopener">' + esc(t.terms) + '</a>')
        .replace(esc(t.privacy), '<a href="https://anacan.az/privacy" target="_blank" rel="noopener">' + esc(t.privacy) + '</a>') + '</p>';
    view.querySelectorAll('.plan').forEach(function (b) {
      b.onclick = function () {
        state.plan = b.dataset.plan;
        view.querySelectorAll('.plan').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      };
    });
    document.getElementById('pay').onclick = startCheckout;
  }

  function showError(text) { var e = document.getElementById('err'); if (e) { e.hidden = false; e.textContent = text; } }

  function startCheckout() {
    var input = document.getElementById('email');
    var email = (input.value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { showError(t.email_invalid); input.focus(); return; }
    state.email = email; store.set('email', email); store.set('plan', state.plan);
    var pay = document.getElementById('pay'); pay.disabled = true; pay.textContent = t.loading;
    track('checkout_start', { plan: state.plan });
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: state.plan, email: email, language: lang, pay_label: t.pay.slice(0, 40) }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.checkout_url) throw new Error(res.d && res.d.error || 'checkout');
        if (res.d.test_mode) { var tm = document.getElementById('test'); tm.hidden = false; tm.textContent = t.test_mode; }
        openInline(res.d.checkout_url, res.d.test_mode);
      })
      .catch(function () { pay.disabled = false; pay.textContent = t.pay; showError(t.error); });
  }

  function openInline(url, testMode) {
    header(4);
    view.innerHTML = '<h1 style="font-size:20px">' + esc(t.plans_title) + ' · ' + esc(state.plan === 'yearly' ? t.yearly : t.monthly) + '</h1>';
    var wrap = document.getElementById('checkout-wrap'); wrap.hidden = false;
    var Dodo = window.DodoPaymentsCheckout && window.DodoPaymentsCheckout.DodoPayments;
    if (!Dodo) { location.href = url; return; }   // SDK blocked: the hosted page has the same Anacan theme.
    Dodo.Initialize({
      mode: testMode ? 'test' : 'live', displayType: 'inline', manualRedirect: true,
      onEvent: function (event) {
        var type = event && event.event_type;
        var data = (event && event.data) || {};
        var status = data.status || (data.message && data.message.status);
        if (type === 'checkout.status' && (status === 'succeeded' || status === 'active')) done();
        if (type === 'checkout.redirect' || type === 'checkout.redirect_requested') {
          var target = event.data && event.data.message && (event.data.message.redirect_to || event.data.message.url);
          if (target && /^https:\/\/(anacan\.az|www\.anacan\.az|[a-z0-9.-]+\.dodopayments\.com)\//.test(target) && target.indexOf('done=1') < 0) location.href = target; else done();
        }
        if (type === 'checkout.error') track('checkout_error');
      }
    });
    Dodo.Checkout.open({ checkoutUrl: url, elementId: 'dodo-inline-checkout' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function done() {
    track('purchase_return', { plan: store.get('plan') || '' });
    document.getElementById('checkout-wrap').hidden = true;
    header(5);
    document.getElementById('progress').style.width = '100%';
    var email = state.email || store.get('email') || '';
    view.innerHTML = '<img class="hero" src="/website/characters/' + (CHARACTERS[state.stage] || 'tumurcuq') + '-success.webp" alt="" width="150" height="150">' +
      '<h1>' + esc(t.done_title) + '</h1><p class="sub">' + esc(t.done_body).replace(esc('{email}'), '<b dir="ltr">' + esc(email) + '</b>') + '</p>' +
      '<div class="card"><ol class="steps"><li>' + esc(t.done_step1) + '</li><li>' + esc(t.done_step2) + '</li><li>' + esc(t.done_step3) + '</li></ol>' +
      '<div class="stores"><a href="' + APP_STORE + '" rel="noopener">App Store</a><a href="' + GOOGLE_PLAY + '" rel="noopener">Google Play</a></div></div>';
  }

  function go(step) {
    state.step = step;
    document.getElementById('checkout-wrap').hidden = true;
    if (step === 1) stepStage(); else if (step === 2) stepNeeds(); else stepPlan();
    window.scrollTo({ top: 0 });
  }

  document.getElementById('back').onclick = function () { if (state.step > 1) go(Math.min(state.step - 1, 3)); };

  fetch('/website/premium/copy/' + lang + '.json').then(function (r) { return r.json(); }).then(function (copy) {
    t = copy;
    document.documentElement.lang = lang;
    document.documentElement.dir = copy.dir || 'ltr';
    document.title = copy.title;
    if (params.get('done') === '1') done(); else go(1);
    track('view');
  }).catch(function () { view.innerHTML = '<p class="loading">Anacan Premium</p>'; });
})();
