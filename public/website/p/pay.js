/* Anacan "someone else pays for Premium" page (anacan.az/website/p/?t=<token>).
   Shows who the payer is helping, lets them pick a plan and pay via Dodo (api.anacan.az/functions/v1/
   dodo-checkout with the sponsor_token). Premium is granted to the LINK OWNER by the signed webhook,
   never by this page. The payer gets no app access and sees no personal data. */
(function () {
  'use strict';
  var LANGS = ['az', 'en', 'tr', 'ru', 'kk', 'uz', 'ka', 'de', 'ar', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv'];
  var INFO = 'https://api.anacan.az/functions/v1/sponsor-link-info';
  var CHECKOUT = 'https://api.anacan.az/functions/v1/dodo-checkout';
  var PRICES = { monthly: 2.22, yearly: 15.55 };
  var params = new URLSearchParams(location.search);
  var token = (params.get('t') || location.hash.replace(/^#/, '') || '').trim();
  var browser = (navigator.language || 'az').slice(0, 2).toLowerCase();
  // Language: /<lang>/p/ path first, then ?lang=, then the browser.
  var pathLang = (location.pathname.match(/^\/([a-z]{2})\/p\/?/) || [])[1];
  var lang = LANGS.indexOf(pathLang) >= 0 ? pathLang : LANGS.indexOf(params.get('lang')) >= 0 ? params.get('lang') : LANGS.indexOf(browser) >= 0 ? browser : 'az';
  var t = null, info = null, state = { plan: 'yearly', email: '' };
  var view = document.getElementById('view');
  var money = function (n) { try { return new Intl.NumberFormat(lang === 'az' ? 'az-Latn-AZ' : lang, { style: 'currency', currency: 'USD' }).format(n); } catch (e) { return '$' + n.toFixed(2); } };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fill = function (s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; }); };

  function planButton(id, title, price, note) {
    return '<button type="button" class="plan" role="radio" data-plan="' + id + '" aria-checked="' + (state.plan === id) + '">' +
      '<span class="radio" aria-hidden="true"></span><span style="flex:1"><b>' + esc(title) + '</b><small>' + esc(note) + '</small></span>' +
      '<b dir="ltr">' + esc(price) + '</b></button>';
  }

  function renderPay() {
    var save = Math.max(0, Math.round((1 - (PRICES.yearly / 12) / PRICES.monthly) * 100));
    var who = info && info.firstName ? info.firstName : '';
    var heading = who ? fill(t.title_named, { name: who }) : t.title_generic;
    view.innerHTML =
      '<h1>' + esc(heading) + '</h1>' +
      '<p class="sub">' + esc(info && info.kind === 'partner' ? t.sub_partner : t.sub_gift) + '</p>' +
      '<div class="card" style="display:flex;gap:10px;align-items:flex-start">' +
        '<span aria-hidden="true" style="font-size:20px">🔒</span><div><b style="display:block;font-size:13.5px">' + esc(t.privacy_title) + '</b>' +
        '<small style="color:var(--ink2);font-size:12.5px">' + esc(t.privacy_body) + '</small></div></div>' +
      '<div class="plans" role="radiogroup" aria-label="' + esc(t.plans_title) + '">' +
        planButton('yearly', t.yearly, money(PRICES.yearly), fill(t.per_month, { price: money(PRICES.yearly / 12) }) + ' · ' + fill(t.save, { n: save })) +
        planButton('monthly', t.monthly, money(PRICES.monthly), t.flexible) + '</div>' +
      '<input class="email" id="email" type="email" inputmode="email" autocomplete="email" placeholder="' + esc(t.email_ph) + '" value="' + esc(state.email) + '">' +
      '<p class="error" id="err" hidden></p>' +
      '<button type="button" class="cta" id="pay">' + esc(t.pay) + '</button>' +
      '<p class="fine">' + esc(t.fine) + '</p>';
    view.querySelectorAll('.plan').forEach(function (b) {
      b.onclick = function () { state.plan = b.dataset.plan; view.querySelectorAll('.plan').forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); }); };
    });
    document.getElementById('pay').onclick = pay;
  }

  function showErr(msg) { var e = document.getElementById('err'); if (e) { e.hidden = false; e.textContent = msg; } }

  function pay() {
    var input = document.getElementById('email');
    var email = (input.value || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr(t.email_err); input.focus(); return; }
    state.email = email;
    var btn = document.getElementById('pay'); btn.disabled = true; btn.textContent = t.loading;
    fetch(CHECKOUT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: state.plan, email: email, language: lang, sponsor_token: token, pay_label: t.pay.slice(0, 40) }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.d.checkout_url) throw new Error((res.d && res.d.error) || 'checkout');
        if (res.d.test_mode) { var tm = document.getElementById('test'); tm.hidden = false; tm.textContent = t.test_mode; }
        openCheckout(res.d.checkout_url, res.d.test_mode);
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = t.pay;
        showErr(String(e.message) === 'link_expired' ? t.expired : String(e.message) === 'link_not_found' ? t.not_found : t.error);
      });
  }

  // Card entry stays on anacan.az: Dodo inline checkout embedded on the page. If the SDK is missing or
  // errors, fall back to the hosted Dodo page (redirect) so the sponsor can always complete the payment.
  function openCheckout(url, testMode) {
    var Dodo = window.DodoPaymentsCheckout && window.DodoPaymentsCheckout.DodoPayments;
    if (!Dodo) { location.href = url; return; }
    var wrap = document.getElementById('checkout-wrap');
    view.innerHTML = '<h1 style="font-size:20px">' + esc(t.doc_title) + '</h1><p class="sub">' + esc(t.inline_hint || '') + '</p>';
    wrap.hidden = false;
    try {
      Dodo.Initialize({
        mode: testMode ? 'test' : 'live', displayType: 'inline', manualRedirect: true,
        onEvent: function (event) {
          var type = event && event.event_type;
          var data = (event && event.data) || {};
          var status = data.status || (data.message && data.message.status);
          if (type === 'checkout.status' && (status === 'succeeded' || status === 'active')) { wrap.hidden = true; info.paid = true; renderState(); }
          if (type === 'checkout.redirect' || type === 'checkout.redirect_requested') {
            var target = data.message && (data.message.redirect_to || data.message.url);
            if (target && target.indexOf('done=1') < 0 && /^https:\/\/(anacan\.az|[a-z0-9.-]+\.dodopayments\.com)\//.test(target)) location.href = target;
            else { wrap.hidden = true; info.done = true; params.set('done', '1'); renderState(); }
          }
          if (type === 'checkout.error') { wrap.hidden = true; location.href = url; }
        }
      });
      Dodo.Checkout.open({ checkoutUrl: url, elementId: 'dodo-inline-checkout' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { location.href = url; }
  }

  function renderState() {
    if (!info || !info.found) { view.innerHTML = '<h1>' + esc(t.not_found_title) + '</h1><p class="sub">' + esc(t.not_found) + '</p>'; return; }
    if (info.paid) { view.innerHTML = '<div class="card" style="text-align:center"><div style="font-size:44px">🎉</div><h1>' + esc(t.paid_title) + '</h1><p class="sub">' + esc(t.paid_body) + '</p></div>'; return; }
    if (params.get('done') === '1') { view.innerHTML = '<div class="card" style="text-align:center"><div style="font-size:44px">💛</div><h1>' + esc(t.done_title) + '</h1><p class="sub">' + esc(t.done_body) + '</p></div>'; return; }
    if (!info.valid) { view.innerHTML = '<h1>' + esc(t.expired_title) + '</h1><p class="sub">' + esc(t.expired) + '</p>'; return; }
    renderPay();
  }

  function start() {
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir || 'ltr';
    document.title = t.doc_title;
    if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) { view.innerHTML = '<h1>' + esc(t.not_found_title) + '</h1><p class="sub">' + esc(t.not_found) + '</p>'; return; }
    fetch(INFO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { info = d; renderState(); })
      .catch(function () { view.innerHTML = '<p class="loading">Anacan Premium</p>'; });
  }

  fetch('/website/p/copy/' + lang + '.json').then(function (r) { return r.json(); }).then(function (copy) { t = copy; start(); })
    .catch(function () { fetch('/website/p/copy/az.json').then(function (r) { return r.json(); }).then(function (copy) { t = copy; lang = 'az'; start(); }); });
})();
