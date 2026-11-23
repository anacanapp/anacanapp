/* Mərcan Cümə (2026-11-23 → 2026-11-30 23:59:59 Baku). Page from the design hand-off (MERCAN_CUME_HANDOFF.md),
   copy in copy/<lang>.json (21 website languages), purchase on the real rails:
   - Epoint (AZN, saved card, automatic renewal): Azerbaijani visitors and anyone in Azerbaijan. Prices come from the
     server campaign (app_settings.web_premium_campaign 'mercan-2026': 16.99 / 3.39 AZN), shown in USD at the fixed
     display rate 1 USD = 1.70 AZN with the AZN amount stated before paying. The bank returns to the kampaniya page,
     which forwards here (?odenis=ugurlu|xeta) while the campaign runs.
   - Dodo Payments (USD) everywhere else: dodo-checkout applies the campaign code for the chosen plan
     (app_settings.dodo_campaign {campaign:'mercan', codes}) and returns here with ?done=1.
   Both paths need the Anacan account first (same account as the app); Premium is linked to it on the server.
   The discounted price is kept on every renewal until cancelled (owner decision 2026-11-23). */
(function () {
  'use strict';
  var A = window.AnacanAccount;
  var LANG = window.MERCAN_LANG || 'az';
  var PAY = window.MERCAN_PAY || 'epoint';
  var END = Date.parse(document.body.getAttribute('data-campaign-ends') || '') || 0;
  var LANGS = [['az', 'Azərbaycan'], ['en', 'English'], ['ru', 'Русский'], ['tr', 'Türkçe'], ['kk', 'Қазақша'], ['de', 'Deutsch'], ['ar', 'العربية'],
    ['uz', 'Oʻzbekcha'], ['ka', 'ქართული'], ['zh', '中文'], ['id', 'Indonesia'], ['fr', 'Français'], ['es', 'Español'], ['pt', 'Português'],
    ['vi', 'Tiếng Việt'], ['hi', 'हिन्दी'], ['ja', '日本語'], ['ko', '한국어'], ['pl', 'Polski'], ['nl', 'Nederlands'], ['sv', 'Svenska']];
  // Shown prices (USD). Epoint charges the server's AZN price (16.99 / 3.39 = $9.99 / $1.99 at 1.70).
  var USD = { yearly: { now: 9.99, was: 29.99 }, monthly: { now: 1.99, was: 3.99 } };
  var AZN_FALLBACK = { yearly: 16.99, monthly: 3.39 };
  var DODO = 'https://api.anacan.az/functions/v1/dodo-checkout';
  var CABINET = '/website/premium/hesab/index.html';
  var APP = '/website/premium/app/index.html';
  var CH = '/website/characters/';
  var T = null, plan = 'yearly', step = 0, status = null, generation = 0;
  var $ = function (s) { return document.querySelector(s); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ISO = function (v) { return (window.MERCAN_LANG === 'ar') ? '\u2066' + v + '\u2069' : v; };
  var usd = function (n) { return ISO('$' + Number(n).toFixed(2)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fill(str, extra) {
    var v = { y: usd(USD.yearly.now), m: usd(USD.monthly.now), yw: usd(USD.yearly.was), mw: usd(USD.monthly.was), pm: usd(Math.floor(USD.yearly.now / 12 * 100) / 100),
      save: ISO('$' + Math.round(USD.yearly.was - USD.yearly.now)), pay_faq: PAY === 'epoint' ? T.pay_faq_epoint : T.pay_faq_dodo };
    for (var k in extra || {}) v[k] = extra[k];
    return String(str).replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
  }
  function ended() { return END && Date.now() >= END; }
  function track(name, p) { try { window.anacanAnalytics && window.anacanAnalytics.track(name, Object.assign({ placement: 'mercan_cume', lang: LANG, provider: PAY }, p || {})); } catch (e) { /* ignore */ } }

  var params = new URLSearchParams(location.search);
  var bankReturn = params.get('odenis'); // 'ugurlu' | 'xeta' (Epoint, via the kampaniya page); never proof of payment
  var dodoReturn = params.get('done') === '1'; // back from Dodo; never proof of payment
  if (bankReturn || dodoReturn) {
    params.delete('odenis'); params.delete('done');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  }
  try { var keep = sessionStorage.getItem('anacan_mercan_plan'); if (keep === 'monthly' || keep === 'yearly') plan = keep; } catch (e) { /* ignore */ }

  // ── Render ───────────────────────────────────────────────────────────────────────────
  function cd(id) {
    return '<div class="cd" id="' + id + '" role="timer" aria-label="' + esc(T.timer_label) + '">' +
      ['d', 'h', 'm', 's'].map(function (u, i) { return '<div><b data-u="' + u + '">00</b><span>' + esc(T.units[i]) + '</span></div>'; }).join('') + '</div>';
  }
  function marquee() {
    var one = T.marquee.map(function (x) { return '<span>' + esc(x) + '</span><i>✦</i>'; }).join('');
    return '<div class="mq" aria-hidden="true"><div>' + one + one + one + one + '</div></div>';
  }
  function planName(p) { return p === 'yearly' ? T.yearly : T.monthly; }
  function render() {
    document.title = T.meta_title;
    var md = document.querySelector('meta[name="description"]'); if (!md) { md = document.createElement('meta'); md.name = 'description'; document.head.appendChild(md); }
    md.setAttribute('content', T.meta_desc);
    var langSel = '<label class="lang"><span class="sr" hidden>' + esc(T.lang_label) + '</span><select id="lang" aria-label="' + esc(T.lang_label) + '">' +
      LANGS.map(function (l) { return '<option value="' + l[0] + '"' + (l[0] === LANG ? ' selected' : '') + '>' + esc(l[1]) + '</option>'; }).join('') + '</select></label>';
    var y = USD.yearly, m = USD.monthly;
    var html =
      '<div class="ann"><div class="w"><span>' + fill(T.ann) + '</span><span class="num" id="ann-t"></span></div></div>' +
      '<div class="stage"><div class="w">' +
        '<div class="nav"><a class="brand" href="https://anacan.az/' + (LANG === 'az' ? '' : LANG + '/') + '" aria-label="Anacan"><img src="/website/brand-glyph-coral.png" alt="" width="26" height="26" style="filter:brightness(0)">anacan</a>' +
        '<div class="nav-r">' + langSel + '<button class="pill" type="button" data-go>' + esc(T.nav_cta) + '</button></div></div>' +
        '<div class="hero">' +
          '<span class="tag">' + esc(T.tag) + '</span>' +
          '<h1>' + esc(T.h1_a) + (LANG === 'nl' || LANG === 'sv' ? '' : ' ') + '<em>' + esc(T.h1_b) + '</em></h1>' +
          '<p class="lead">' + fill(T.lead) + '</p>' + cd('cd1') +
          '<button class="cta" type="button" data-go data-hero>' + esc(fill(T.cta_year)) + ' <s>' + usd(y.was) + '</s></button>' +
          '<button class="sub-cta" type="button" data-pick="monthly">' + esc(fill(T.sub_cta)) + '</button>' +
          '<div class="trio"><div class="stick"><div><b>−67%</b><span>' + esc(T.sticker) + '</span></div></div>' +
            '<img src="' + CH + 'ritm-success.webp" alt="Ritm" width="512" height="512"><img src="' + CH + 'qucaq-success.webp" alt="Qucaq" width="512" height="512"><img src="' + CH + 'tumurcuq-success.webp" alt="Tumurcuq" width="512" height="512"></div>' +
        '</div></div></div>' +
      marquee() +
      '<section class="sec" id="plans"><div class="w">' +
        '<h2>' + T.plans_h + '</h2><p class="intro">' + esc(T.plans_intro) + '</p>' +
        '<div class="plans">' +
          '<button class="plan" type="button" data-plan="yearly"><div class="top"><span class="nm">' + esc(T.yearly) + '</span><span class="off">' + ISO('−67%') + ' · ' + esc(T.best) + '</span></div>' +
            '<div class="price num"><b>' + usd(y.now) + '</b><s>' + usd(y.was) + '</s><span>' + esc(T.per_year) + '</span></div><p>' + fill(T.yearly_note) + '</p><span class="radio"></span></button>' +
          '<button class="plan" type="button" data-plan="monthly"><div class="top"><span class="nm">' + esc(T.monthly) + '</span><span class="off">−50%</span></div>' +
            '<div class="price num"><b>' + usd(m.now) + '</b><s>' + usd(m.was) + '</s><span>' + esc(T.per_month) + '</span></div><p>' + esc(T.monthly_note) + '</p><span class="radio"></span></button>' +
        '</div>' +
        '<div class="go"><button class="cta" type="button" data-go><span id="go-t"></span></button><p class="fine">' + esc(T.fine) + '</p></div>' +
      '</div></section>' +
      '<section class="sec math"><div class="w"><h2>' + T.math_h + '</h2><div class="row num">' +
        T.math.map(function (r) { return '<div><b>' + esc(fill(r[0])) + '</b><span>' + esc(fill(r[1])) + '</span></div>'; }).join('') + '</div></div></section>' +
      '<section class="sec"><div class="w"><h2>' + T.feat_h + '</h2><p class="intro">' + esc(T.feat_intro) + '</p><ul class="feat">' +
        T.features.map(function (f) { return '<li><span aria-hidden="true">' + f[0] + '</span><b>' + esc(f[1]) + '</b><small>' + esc(f[2]) + '</small></li>'; }).join('') + '</ul></div></section>' +
      '<section class="sec" style="padding-top:0"><div class="w"><h2>' + T.stages_h + '</h2><div class="stages">' +
        [['var(--ritm)', 'ritm'], ['var(--tumurcuq)', 'tumurcuq'], ['var(--qucaq)', 'qucaq']].map(function (c, i) {
          var s = T.stages[i];
          return '<div class="stg" style="background:' + c[0] + '"><div><small>' + esc(s[0]) + '</small><h3>' + esc(s[1]) + '</h3><p>' + esc(s[2]) + '</p></div><img src="' + CH + c[1] + '-welcome.webp" alt="" width="333" height="512"></div>';
        }).join('') + '</div></div></section>' +
      '<section class="sec" style="padding-top:0"><div class="w"><h2>' + esc(T.faq_h) + '</h2><div class="faq">' +
        T.faq.map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(fill(q[1])) + '</p></details>'; }).join('') + '</div></div></section>' +
      '<div class="stage end"><div class="w"><h2>' + T.end_h + '</h2>' + cd('cd2') +
        '<button class="cta" type="button" data-go>' + esc(T.end_cta) + '</button><p>' + esc(T.end_note) + '</p>' +
        '<div class="stores" aria-label="' + esc(T.stores_label) + '">' +
          '<a data-store="ios" data-store-placement="premium_mercan" href="https://apps.apple.com/app/id6758301924" target="_blank" rel="noopener">App Store</a>' +
          '<a data-store="android" data-store-placement="premium_mercan" href="https://play.google.com/store/apps/details?id=com.atlasoon.anacan" target="_blank" rel="noopener">Google Play</a>' +
        '</div></div></div>' +
      '<footer class="foot">© 2026 Anacan · anacan.az · <a href="https://anacan.az/terms" target="_blank" rel="noopener">' + esc(T.terms) + '</a> · <a href="https://anacan.az/privacy" target="_blank" rel="noopener">' + esc(T.privacy) + '</a></footer>' +
      '<div class="bar" id="bar" hidden><div class="w"><div><b class="num" id="bar-p"></b><span class="num" id="bar-t"></span></div><button class="cta" type="button" data-go>' + esc(T.bar_continue) + '</button></div></div>' +
      '<div class="fn" id="fn" hidden role="dialog" aria-modal="true" aria-labelledby="fn-h"><div class="w" id="fn-body"></div></div>';
    var app = $('#app'); app.innerHTML = html; app.removeAttribute('aria-busy');
    $('#lang').addEventListener('change', function (e) {
      var q = new URLSearchParams(location.search); q.set('lang', e.target.value);
      location.href = location.pathname + '?' + q.toString() + location.hash;
    });
    pick(plan);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { $('#bar').hidden = es[0].isIntersecting || ended(); }).observe($('[data-hero]'));
    else $('#bar').hidden = false;
    tick(); setInterval(tick, 1000);
  }

  function tick() {
    var left = Math.max(0, END - Date.now()), d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, mi = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
    [].forEach.call(document.querySelectorAll('.cd'), function (c) {
      c.querySelector('[data-u=d]').textContent = pad(d); c.querySelector('[data-u=h]').textContent = pad(h);
      c.querySelector('[data-u=m]').textContent = pad(mi); c.querySelector('[data-u=s]').textContent = pad(s);
    });
    var t = left ? fill(T.left, { d: d, hms: pad(h) + ':' + pad(mi) + ':' + pad(s) }) : T.ended;
    $('#ann-t').textContent = t; $('#bar-t').textContent = t;
    if (!left && !document.body.classList.contains('ended')) {
      document.body.classList.add('ended');
      [].forEach.call(document.querySelectorAll('[data-go],[data-pick]'), function (b) { b.disabled = true; });
      $('#bar').hidden = true;
      if (step && step < 4) showState('ended');
    }
  }

  function pick(p) {
    plan = p;
    try { sessionStorage.setItem('anacan_mercan_plan', p); } catch (e) { /* ignore */ }
    [].forEach.call(document.querySelectorAll('.plan'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-plan') === p)); });
    var price = usd(USD[p].now);
    $('#go-t').textContent = fill(T.go, { plan: planName(p), p: price });
    $('#bar-p').textContent = planName(p) + ' · ' + price;
  }

  // ── Checkout overlay ─────────────────────────────────────────────────────────────────
  function head(n) {
    return '<div class="fh"><button type="button" data-back aria-label="' + esc(T.back) + '">←</button><div class="steps">' +
      [1, 2, 3].map(function (i) { return '<i class="' + (n >= i ? 'on' : '') + '"></i>'; }).join('') + '</div></div>';
  }
  function sum() {
    var p = USD[plan];
    return '<div class="sum num"><div><span>' + esc(fill(T.sum_regular, { plan: planName(plan) })) + '</span><s class="v">' + usd(p.was) + '</s></div>' +
      '<div><span>' + esc(T.sum_discount) + '</span><span class="save v">−' + usd(p.was - p.now) + '</span></div>' +
      '<div><span>' + esc(T.sum_today) + '</span><span class="v">' + usd(p.now) + '</span></div></div>';
  }
  function body() { return $('#fn-body'); }
  function openFn(at) {
    if (ended()) return;
    $('#fn').hidden = false; document.body.style.overflow = 'hidden';
    step = at || 1; view();
    track('checkout_open', { plan: plan });
  }
  function closeFn() { $('#fn').hidden = true; document.body.style.overflow = ''; step = 0; generation++; }
  function focusTop() { $('#fn').scrollTop = 0; var h = $('#fn-h'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } } }

  function view() {
    var b = body();
    if (step === 1) {
      b.innerHTML = head(1) + '<h2 id="fn-h">' + esc(T.s1_h) + '</h2>' + sum() +
        '<p class="sub">' + esc(plan === 'yearly' ? fill(T.s1_y) : fill(T.s1_m)) + '</p>' +
        '<button class="cta" type="button" data-next>' + esc(T.next) + '</button>' +
        (plan === 'monthly' ? '<button class="link" type="button" data-swap>' + esc(fill(T.swap)) + '</button>' : '');
      focusTop();
    } else if (step === 2) {
      accountStep();
    } else if (step === 3) {
      payStep();
    }
  }

  /** Step 2: the Anacan account (same as the app). Signed in → show it and continue; otherwise the shared login. */
  async function accountStep() {
    var mine = ++generation, b = body();
    // The shared login draws its own title (T.s2_h); a signed-in account gets the same heading here.
    b.innerHTML = head(2) + '<div class="login-box" id="acc"><span class="spin"></span></div>';
    $('#fn').scrollTop = 0;
    var s = null;
    try { s = await A.session(); } catch (e) { s = null; }
    if (mine !== generation) return;
    var box = $('#acc');
    if (!s) { A.renderLogin(box, { title: T.s2_h, subtitle: T.s2_sub }); return; }
    var verify = false;
    try { verify = await A.needsVerification(); } catch (e) { verify = false; }
    if (mine !== generation) return;
    if (verify) { A.renderVerify(box, s.user && s.user.email, function () { if (step === 2) accountStep(); }); return; }
    var email = (s.user && s.user.email) || '';
    box.outerHTML = '<h2 id="fn-h">' + esc(T.s2_h) + '</h2><p class="sub">' + esc(T.s2_sub) + '</p><p class="who-line">' + fill(T.signed_as, { e: esc(email) }) + '</p>' +
      '<button class="cta" type="button" data-next>' + esc(T.next) + '</button>' +
      '<button class="link" type="button" data-other>' + esc(T.other_account) + '</button>';
    focusTop();
  }

  /** Step 3: the account's status decides; then consent and the payment page of the provider. */
  async function payStep() {
    var mine = ++generation, b = body();
    b.innerHTML = head(3) + '<h2 id="fn-h">' + esc(T.s3_h) + '</h2><div class="state"><span class="spin"></span></div>';
    focusTop();
    var s = null;
    try { s = await A.session(); } catch (e) { s = null; }
    if (mine !== generation) return;
    if (!s) { step = 2; accountStep(); return; }
    try { status = await A.call('status'); } catch (e) {
      if (mine !== generation) return;
      if (e && e.code === 'unauthorized') { await A.signOut(); step = 2; accountStep(); return; }
      status = null; // Status unavailable: still let the account pay; the server refuses a second subscription.
    }
    if (mine !== generation) return;
    if (status && status.premium && status.premium.active) { showState('has'); return; }
    if (PAY === 'epoint' && status && (!status.campaign || !status.campaign.active)) { showState(ended() ? 'ended' : 'err_generic'); return; }
    var azn = PAY === 'epoint' ? (status && status.campaign && status.campaign.plans && status.campaign.plans[plan] && status.campaign.plans[plan].price) || AZN_FALLBACK[plan] : null;
    var ready = PAY === 'dodo' || !status || status.payments_ready !== false;
    b.innerHTML = head(3) + '<h2 id="fn-h">' + esc(T.s3_h) + '</h2>' + sum() +
      (bankReturn === 'xeta' ? '<p class="err" role="alert">' + esc(T.err_paid_fail) + '</p>' : '') +
      '<label class="consent"><input type="checkbox" id="consent"><span>' + (PAY === 'epoint' ? T.consent_epoint : T.consent_dodo) + '</span></label>' +
      '<button class="cta" type="button" id="pay" disabled>' + esc(fill(T.pay_btn, { p: usd(USD[plan].now) })) + '</button>' +
      '<p class="err" id="pay-err" role="alert" hidden></p>' +
      (PAY === 'epoint' ? '<p class="note">' + fill(T.azn_note, { azn: esc(A.money(azn)) }) + '</p><p class="note">' + esc(T.bank_note) + '</p>' : '<p class="note">' + esc(T.dodo_note) + '</p>') +
      '<p class="fine">' + esc(T.fine) + '</p>';
    bankReturn = null;
    var consent = $('#consent'), pay = $('#pay');
    var sync = function () { pay.disabled = !ready || !consent.checked; };
    consent.addEventListener('change', sync); sync();
    pay.addEventListener('click', function () { (PAY === 'epoint' ? payEpoint : payDodo)(pay); });
  }

  function payError(text, pay, label) {
    if (pay && document.body.contains(pay)) { pay.textContent = label; pay.disabled = !$('#consent').checked; }
    var e = $('#pay-err'); if (e) { e.textContent = text; e.hidden = false; }
  }
  async function payEpoint(pay) {
    var label = pay.textContent; pay.disabled = true; pay.innerHTML = '<span class="spin"></span>';
    track('checkout_start', { plan: plan });
    try {
      var d = await A.call('subscribe', { consent: 'premium-autorenew-v1', plan: plan });
      if (d && d.ok && typeof d.redirect_url === 'string' && /^https:\/\/([a-z0-9-]+\.)+az(:443)?\//i.test(d.redirect_url)) { location.href = d.redirect_url; return; }
      if (d && (d.error === 'premium_active' || d.error === 'already_subscribed')) { showState('has'); return; }
      if (d && d.error === 'campaign_inactive') { showState(ended() ? 'ended' : 'err_generic'); return; }
      payError(d && (d.error === 'rate_limited' || d.error === 'too_many_attempts') ? T.err_rate : T.err_generic, pay, label);
    } catch (e) {
      if (e && e.code === 'unauthorized') { await A.signOut(); step = 2; accountStep(); return; }
      payError(T.err_generic, pay, label);
    }
  }
  async function payDodo(pay) {
    var label = pay.textContent; pay.disabled = true; pay.innerHTML = '<span class="spin"></span>';
    var s = null; try { s = await A.session(); } catch (e) { s = null; }
    if (!s || !s.access_token) { step = 2; accountStep(); return; }
    track('checkout_start', { plan: plan });
    try {
      var r = await fetch(DODO, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
        body: JSON.stringify({ plan: plan, email: (s.user && s.user.email) || '', language: LANG, pay_label: 'Anacan Premium', campaign: 'mercan' }) });
      var d = {}; try { d = await r.json(); } catch (e) { d = {}; }
      // The functions router replaces error bodies with a code per HTTP status, so read the status.
      if (r.status === 401) { await A.signOut(); step = 2; accountStep(); return; }
      if (r.status === 409) { showState('has'); return; }
      if (r.status === 429) { payError(T.err_rate, pay, label); return; }
      if (r.status === 410) { showState(ended() ? 'ended' : 'err_generic'); return; }
      if (!r.ok || typeof d.checkout_url !== 'string' || !/^https:\/\//.test(d.checkout_url)) { payError(T.err_generic, pay, label); return; }
      location.href = d.checkout_url;
    } catch (e) { payError(T.err_generic, pay, label); }
  }

  function showState(kind) {
    var b = body(), img = CH + 'tumurcuq-success.webp', title = '', text = '', actions = '';
    var appBtn = function (src) { return '<a class="cta" href="' + APP + '?src=' + src + '">' + esc(T.open_app) + '</a>'; };
    if (kind === 'wait') { title = T.wait_h; text = esc(T.wait_t); img = ''; }
    else if (kind === 'ok') { title = T.ok_h; text = esc(fill(T.ok_t, { plan: planName(plan) })); actions = appBtn('mercan_success') + (PAY === 'epoint' ? '<a class="btn2" href="' + CABINET + '">' + esc(T.cabinet) + '</a>' : ''); }
    else if (kind === 'late') { title = T.late_h; text = esc(T.late_t); img = CH + 'qucaq-welcome.webp'; actions = appBtn('mercan_pending') + (PAY === 'epoint' ? '<a class="btn2" href="' + CABINET + '">' + esc(T.cabinet) + '</a>' : ''); }
    else if (kind === 'has') { title = T.has_h; text = esc(T.has_t); img = CH + 'qucaq-success.webp'; actions = appBtn('mercan_active'); }
    else if (kind === 'ended') { title = T.ended_h; text = esc(T.ended_t); img = CH + 'ritm-welcome.webp'; actions = appBtn('mercan_ended'); }
    else { title = T.err_load; text = ''; img = ''; actions = '<button class="cta" type="button" data-retry>' + esc(T.retry) + '</button>'; }
    b.innerHTML = '<div class="fh"><button type="button" data-close aria-label="' + esc(T.back) + '">←</button><div class="steps"><i class="on"></i><i class="on"></i><i class="on"></i></div></div>' +
      '<div class="state">' + (kind === 'wait' ? '<span class="spin" style="width:40px;height:40px"></span>' : img ? '<img src="' + img + '" alt="">' : '') +
      '<h2 id="fn-h">' + esc(title) + '</h2>' + (text ? '<p class="sub">' + text + '</p>' : '') + actions + '</div>';
    if ($('#fn').hidden) { $('#fn').hidden = false; document.body.style.overflow = 'hidden'; }
    if (kind !== 'wait') step = 4;
    focusTop();
    if (kind === 'ok') { track('purchase_confirmed', { plan: plan }); confetti(); }
  }

  /** After the payment page: wait for the signed callback/webhook to open Premium on this account (~1 minute). */
  async function waitForPremium() {
    var mine = ++generation;
    step = 4; showState('wait');
    for (var i = 0; i < 20; i++) {
      try {
        var d = await A.call('status');
        if (mine !== generation) return;
        var p = d && d.premium;
        if (p && p.active && (PAY === 'dodo' || p.source === 'web_subscription')) {
          if (d.subscription && (d.subscription.plan === 'monthly' || d.subscription.plan === 'yearly')) plan = d.subscription.plan;
          showState('ok'); return;
        }
      } catch (e) { if (e && e.code === 'unauthorized') { await A.signOut(); closeFn(); return; } }
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    if (mine === generation) showState('late');
  }

  function confetti() {
    if (reduceMotion) return;
    var c = document.createElement('canvas'), g = c.getContext('2d'), dpr = Math.max(1, window.devicePixelRatio || 1);
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:30';
    document.body.appendChild(c); c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    var cols = ['#ff5a5f', '#ffe7e1', '#ffc94d', '#2fa67f', '#9a5bd6'], ps = [];
    for (var i = 0; i < 90; i++) ps.push({ x: c.width / 2, y: c.height * 0.35, vx: (Math.random() - 0.5) * 14 * dpr, vy: (-Math.random() * 12 - 4) * dpr, s: (4 + Math.random() * 5) * dpr, c: cols[i % cols.length], r: Math.random() * 6 });
    var t = 0;
    (function frame() {
      g.clearRect(0, 0, c.width, c.height);
      ps.forEach(function (p) { p.vy += 0.35 * dpr; p.x += p.vx; p.y += p.vy; p.r += 0.2; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); g.restore(); });
      if (++t < 90) requestAnimationFrame(frame); else c.remove();
    })();
  }

  // ── Events ───────────────────────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.hasAttribute('data-plan')) pick(t.getAttribute('data-plan'));
    else if (t.hasAttribute('data-pick')) { pick(t.getAttribute('data-pick')); openFn(1); }
    else if (t.hasAttribute('data-go')) openFn(1);
    else if (t.hasAttribute('data-next')) { step++; view(); }
    else if (t.hasAttribute('data-swap')) { pick('yearly'); view(); }
    else if (t.hasAttribute('data-other')) { A.signOut().then(function () { if (step === 2) accountStep(); }); }
    else if (t.hasAttribute('data-back')) { if (step <= 1) closeFn(); else { step--; generation++; view(); } }
    else if (t.hasAttribute('data-close')) closeFn();
    else if (t.hasAttribute('data-retry')) { step = 3; view(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && step && !$('#fn').hidden) closeFn(); });

  // ── Boot ─────────────────────────────────────────────────────────────────────────────
  function loadCopy(lang) {
    return fetch('/website/premium/mercan/copy/' + lang + '.json?v=1', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('copy'); return r.json(); });
  }
  loadCopy(LANG).catch(function () { LANG = 'az'; return loadCopy('az'); }).then(function (copy) {
    T = copy;
    if (A && A.setLang) A.setLang(LANG);
    render();
    // A sign-in that finished (Google/Apple come back to this page) continues the checkout where it stopped.
    A.onChange(function () { if (step === 2) accountStep(); });
    var resume = false;
    try { resume = sessionStorage.getItem('anacan_mercan_step') === '2'; sessionStorage.removeItem('anacan_mercan_step'); } catch (e) { /* ignore */ }
    if (bankReturn === 'ugurlu' || dodoReturn) { bankReturn = null; waitForPremium(); }
    else if (bankReturn === 'xeta') { openFn(3); }
    else if (resume && !ended()) { A.session().then(function (s) { if (s) openFn(3); }).catch(function () {}); }
    if (ended()) tick();
  }).catch(function () {
    $('#app').innerHTML = '<div class="boot"><p style="padding:24px;text-align:center">anacan.az</p></div>';
  });
  // Remember the step across the Google/Apple redirect (they reload this page).
  window.addEventListener('pagehide', function () { try { if (step === 2) sessionStorage.setItem('anacan_mercan_step', '2'); } catch (e) { /* ignore */ } });
})();
