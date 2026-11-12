/* Anacan Premium at the normal price (2026-11-12): login first (the app's methods), then the plans of the server's
   current offer (web-premium status.offer: the standard price, or a running campaign's price); an account with
   Premium (store or web) sees that instead. Subscribing opens Epoint's bank page (card saved for renewals); the
   result is confirmed by the signed Epoint callback, the page only polls the status after the redirect back. */
(function () {
  'use strict';
  var A = window.AnacanAccount;
  var $ = function (id) { return document.getElementById(id); };
  var card = $('plans');
  var params = new URLSearchParams(location.search);
  var payment = params.get('odenis'); // 'ugurlu' | 'xeta' (redirect back from the bank page; never proof of payment)
  if (payment) { params.delete('odenis'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '')); }
  var CABINET = '/website/premium/hesab/index.html';
  var selected = 'yearly';
  var status = null;
  var generation = 0;

  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>';
  var ICON_WAIT = '<span class="spinner" style="width:26px;height:26px"></span>';

  // ── Sticky bar and scroll buttons ─────────────────────────────────────────────────────
  var sticky = $('sticky');
  if ('IntersectionObserver' in window) new IntersectionObserver(function (entries) {
    var e = entries[0];
    var on = !e.isIntersecting && e.boundingClientRect.top < 0;
    sticky.classList.toggle('on', on); sticky.setAttribute('aria-hidden', String(!on));
  }).observe(card);
  document.querySelectorAll('[data-scroll]').forEach(function (b) {
    b.addEventListener('click', function () { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  });

  // ── Rendering ─────────────────────────────────────────────────────────────────────────
  function offer() { return status && status.offer && status.offer.active ? status.offer : null; }
  function plans() { var o = offer(); return o && o.plans && o.plans.monthly && o.plans.yearly ? o.plans : null; }
  /** Yearly vs twelve monthly payments, in whole percent. */
  function yearlySaving(p) { var full = p.monthly.price * 12; return full > p.yearly.price ? Math.round((1 - p.yearly.price / full) * 100) : 0; }

  function updateHero() {
    var p = plans();
    if (!p) return;
    var v = selected === 'yearly' ? p.yearly : p.monthly;
    $('heroSub').textContent = selected === 'yearly' ? 'illik plan, ayda ≈ ' + A.money(p.yearly.per_month) : 'aylıq plan, ' + A.money(p.monthly.price);
    $('finalText').textContent = 'İllik ' + A.money(p.yearly.price) + ' (ayda ≈ ' + A.money(p.yearly.per_month) + ') və ya aylıq ' + A.money(p.monthly.price);
    $('stickyText').innerHTML = '<b>' + A.money(v.price) + '</b>' + (v.was ? '<s>' + A.money(v.was) + '</s>' : '') +
      '<small>' + (selected === 'yearly' ? 'illik' : 'aylıq') + '</small>';
  }

  function selling(on) { document.body.classList.toggle('no-sell', !on); }
  function renderState(icon, title, text, actionsHtml, soft) {
    selling(false);
    card.innerHTML = '<div class="state"><div class="big' + (soft ? ' soft' : '') + '">' + icon + '</div><h2>' + A.esc(title) + '</h2>' +
      '<p>' + text + '</p>' + (actionsHtml || '') + '</div>';
  }

  function storeName(store) {
    return store === 'app_store' || store === 'mac_app_store' ? 'App Store' : store === 'play_store' ? 'Google Play' : 'tətbiq mağazası';
  }

  function renderPremium(premium) {
    var until = premium.expires_at ? A.day(premium.expires_at) : '';
    if (premium.source === 'web_subscription') {
      var sub = status.subscription;
      var line = sub && sub.status === 'cancelled' ? 'Abunəlik ləğv edilib; Premium ' + until + ' tarixinə qədər açıqdır.'
        : 'Növbəti ödəniş ' + A.day(sub && sub.next_charge_at || premium.expires_at) + (sub ? ' · ' + A.money(sub.next_price || sub.price) : '') + '.';
      renderState(ICON_OK, 'Premium abunəliyin aktivdir', A.esc((sub && sub.plan === 'monthly' ? 'Aylıq' : 'İllik') + ' plan. ' + line),
        '<a class="cta" href="/website/premium/app/index.html?src=web_active">Tətbiqi aç <span class="arr">→</span></a>' +
        '<a class="btn" href="' + CABINET + '">Premium hesabım</a>');
    } else if (premium.source === 'store') {
      renderState(ICON_OK, 'Premium-un artıq aktivdir', A.esc('Premium ' + storeName(premium.store) + ' abunəliyi ilə açıqdır' + (until ? ' (' + until + ' tarixinə qədər)' : '') +
        '. Bu abunəlik mağazada idarə olunur, ona görə burada yeni abunəlik lazım deyil.'), '');
    } else {
      renderState(ICON_OK, 'Premium-un artıq aktivdir', A.esc('Premium ' + (until ? until + ' tarixinə qədər ' : '') + 'açıqdır. Müddət bitəndə burada abunə ola bilərsən.'),
        '<a class="btn" href="' + CABINET + '">Premium hesabım</a>');
    }
  }

  function planButton(id, title, sub, p, badges) {
    return '<button type="button" class="plan" role="radio" aria-checked="' + (selected === id) + '" data-plan="' + id + '">' +
      '<span class="radio" aria-hidden="true"></span>' +
      '<span><span class="pname">' + title + badges + '</span><span class="psub">' + sub + '</span></span>' +
      '<span class="price">' + (p.was ? '<s>' + A.money(p.was) + '</s>' : '') + '<b>' + A.money(p.price) + '</b></span></button>';
  }

  function renderPlans(message) {
    selling(true);
    var p = plans();
    var o = offer();
    var saving = yearlySaving(p);
    var campaign = o.kind === 'campaign';
    card.innerHTML =
      '<h2>Planını seç</h2>' +
      (message ? '<p class="msg err" role="alert">' + A.esc(message) + '</p>' : '') +
      '<div role="radiogroup" aria-label="Plan">' +
      planButton('yearly', 'İllik ', 'ayda ≈ ' + A.money(p.yearly.per_month) + ' · 12 ay', p.yearly,
        (p.yearly.pct ? '<span class="badge">−' + p.yearly.pct + '%</span>' : '') + '<span class="badge ghost">Ən sərfəli</span>') +
      planButton('monthly', 'Aylıq ', 'hər ay', p.monthly, p.monthly.pct ? '<span class="badge">−' + p.monthly.pct + '%</span>' : '') +
      '</div>' +
      (selected === 'yearly' && saving > 0 ? '<div class="save"><span>Aylıq ödənişlə müqayisədə</span><span>' + saving + '% qənaət</span></div>' : '') +
      (status.payments_ready ? consentHtml('consent') : '') +
      '<button class="cta" type="button" id="cta"' + (status.payments_ready ? '' : ' disabled') + '>' +
      (status.payments_ready ? 'Abunə ol <span class="arr">→</span>' : 'Ödəniş sistemi hələ aktiv deyil') + '</button>' +
      '<p class="fine">Avtomatik yenilənir, istədiyin vaxt ləğv edə bilərsən. ' + (campaign ? 'Kampaniya qiyməti ləğv edənə qədər hər yenilənmədə qorunur. ' : '') +
      'Kartla, manatla (Epoint).</p>' +
      (status.email ? '<p class="acct">Hesab: ' + A.esc(status.email) + '</p>' : '');
    card.querySelectorAll('.plan').forEach(function (b) {
      b.addEventListener('click', function () { selected = b.getAttribute('data-plan'); renderPlans(); updateHero(); });
    });
    var cta = $('cta');
    if (cta && status.payments_ready) { cta.addEventListener('click', subscribe); bindConsent('consent', cta); }
  }

  /** The bank page has no "save card" switch: the card is registered by the payment itself, so ask for consent here. */
  function consentHtml(id) {
    return '<label class="consent"><input type="checkbox" id="' + id + '">' +
      '<span>Kartımın avtomatik yenilənmə üçün Epoint-də təhlükəsiz <b>yadda saxlanmasına</b> razıyam. Kartı “Premium hesabım” səhifəsində istədiyim vaxt silə bilərəm.</span></label>' +
      '<p class="bank-note">Növbəti addım Paşa Bank-ın ödəniş səhifəsidir. Orada ayrıca “kartı yadda saxla” seçimi olmur: kart bu ödənişlə birlikdə saxlanılır. Anacan yalnız maskalı nömrəni (•••• 1234) görür.</p>';
  }
  function bindConsent(id, button) {
    var box = $(id);
    if (!box || !button) return;
    var sync = function () { button.disabled = !box.checked; };
    box.addEventListener('change', sync); sync();
  }

  var ERRORS = {
    premium_active: 'Premium-un artıq aktivdir.',
    already_subscribed: 'Sənin artıq abunəliyin var. “Premium hesabım” səhifəsinə bax.',
    campaign_inactive: 'Abunəlik hazırda satışda deyil. Bir az sonra yenidən yoxla.',
    payments_unavailable: 'Ödəniş sistemi hələ aktiv deyil. Bir az sonra yenidən yoxla.',
    too_many_attempts: 'Çox cəhd edildi. Bir saat sonra yenidən yoxla.',
    rate_limited: 'Çox cəhd edildi. Bir dəqiqə sonra yenidən yoxla.',
    checkout_unavailable: 'Ödəniş səhifəsi açılmadı. Bir az sonra yenidən cəhd et.',
  };

  async function subscribe() {
    var cta = $('cta');
    cta.disabled = true; cta.innerHTML = '<span class="spinner"></span>';
    try {
      var d = await A.call('subscribe', { consent: 'premium-autorenew-v1', plan: selected, page: 'standard' });
      if (d.ok && typeof d.redirect_url === 'string' && /^https:\/\/([a-z0-9-]+\.)+az(:443)?\//i.test(d.redirect_url)) {
        try { window.anacanAnalytics && window.anacanAnalytics.track('begin_checkout', { item_id: 'premium_' + selected, placement: 'abune' }); } catch (e) { /* ignore */ }
        location.href = d.redirect_url; // Epoint / bank card page; it returns to this page
        return;
      }
      if (d.error === 'premium_active' || d.error === 'already_subscribed') { await load(); return; }
      failed(ERRORS[d.error] || ERRORS.checkout_unavailable);
    } catch (e) {
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      failed(ERRORS.checkout_unavailable);
    }
  }

  function failed(message) {
    if (plans() && !(status.premium && status.premium.active)) renderPlans(message);
    else { A.toast(message, true); renderStatus(); }
  }

  function savedCardLine(d) {
    var cards = (d.cards || []).filter(function (c) { return c.status === 'active'; });
    var c = cards.filter(function (x) { return x.is_default; })[0] || cards[0];
    if (!c) return '';
    var digits = String(c.mask || '').replace(/[^0-9*]/g, '');
    var mask = digits.length >= 8 ? digits.slice(0, 4) + ' •••• ' + digits.slice(-4) : (c.mask || 'Bank kartı');
    return '<p class="saved-card"><span class="chip-card" aria-hidden="true"></span>Kart yadda saxlandı: <b>' + A.esc(mask) + '</b></p>';
  }

  function renderStatus() {
    $('cabinetLink').hidden = false;
    if (status.premium && status.premium.active) { renderPremium(status.premium); return; }
    if (!plans()) {
      renderState(ICON_INFO, 'Abunəlik hazırda satışda deyil', 'Premium-u tətbiqdən ala bilərsən.',
        '<a class="cta" href="/website/premium/app/index.html?src=abune_unavailable">Tətbiqi aç <span class="arr">→</span></a>', true);
      return;
    }
    updateHero();
    renderPlans();
  }

  async function load() {
    var mine = ++generation;
    try {
      status = await A.call('status');
      if (mine !== generation) return;
      if (!status.ok) throw new Error(status.error || 'status');
      renderStatus();
    } catch (e) {
      if (mine !== generation) return;
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      loadFailed(load);
    }
  }

  /** After the bank page: wait for the signed callback to activate the subscription (up to ~1 minute). */
  async function waitForPayment() {
    var mine = ++generation;
    renderState(ICON_WAIT, 'Ödəniş yoxlanılır…', 'Bank təsdiqini gözləyirik. Bu bir neçə saniyə çəkə bilər.', '', true);
    for (var i = 0; i < 20; i++) {
      try {
        var d = await A.call('status');
        if (mine !== generation) return;
        if (d.ok && d.premium && d.premium.active && d.premium.source === 'web_subscription') {
          status = d;
          $('cabinetLink').hidden = false;
          var sub = d.subscription;
          renderState(ICON_OK, 'Premium aktivdir!', A.esc((sub && sub.plan === 'monthly' ? 'Aylıq' : 'İllik') + ' abunəlik başladı. Tətbiqə eyni hesabla daxil ol, Premium avtomatik açılacaq.' +
            (sub && sub.next_charge_at ? ' Növbəti ödəniş: ' + A.day(sub.next_charge_at) + '.' : '')),
            savedCardLine(d) + '<a class="cta" href="/website/premium/app/index.html?src=web_success">Tətbiqi aç <span class="arr">→</span></a>' +
            '<a class="btn app-store-link" href="/website/premium/app/index.html?src=web_success_download">Tətbiqi endir</a>' +
            '<a class="btn" href="' + CABINET + '">Premium hesabım</a>');
          return;
        }
      } catch (e) { if (e && e.code === 'unauthorized') { await A.signOut(); return; } }
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
    if (mine !== generation) return;
    renderState(ICON_INFO, 'Ödəniş hələ təsdiqlənməyib', 'Bank cavabı gecikir. Bir neçə dəqiqə sonra “Premium hesabım” səhifəsində statusu yoxla. Pul çıxıbsa, abunəlik avtomatik aktivləşəcək.',
      '<a class="cta" href="' + CABINET + '">Premium hesabım <span class="arr">→</span></a>', true);
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────────────
  async function boot() {
    var mine = ++generation;
    var s = null;
    try { s = await A.session(); } catch (e) {
      if (mine !== generation) return;
      if (e && e.code === 'timeout') { loadFailed(boot); return; }
      s = null;
    }
    if (mine !== generation) return;
    A.renderWho($('who'), s);
    if (!s) {
      $('cabinetLink').hidden = true;
      selling(true);
      card.innerHTML = '';
      A.renderLogin(card, { title: 'Abunə olmaq üçün daxil ol', subtitle: 'Anacan hesabınla daxil ol: tətbiqdəki eyni hesab. Premium bu hesaba bağlanacaq.' });
      return;
    }
    var verify = await A.needsVerification();
    if (mine !== generation) return;
    if (verify) { A.renderVerify(card, s.user && s.user.email, boot); return; }
    if (payment === 'ugurlu') { payment = null; await waitForPayment(); return; }
    if (payment === 'xeta') { payment = null; A.toast('Ödəniş alınmadı. Kartı yoxlayıb yenidən cəhd et.', true); }
    await load();
  }

  var autoRetried = false;
  function loadFailed(retry) {
    renderState(ICON_INFO, 'Məlumat yüklənmədi', 'Bağlantını yoxlayıb yenidən cəhd et.', '<button class="btn" type="button" id="retry">Yenidən yoxla</button>', true);
    $('retry').addEventListener('click', function () { card.innerHTML = '<div class="skeleton" aria-hidden="true"></div>'; retry(); });
    if (!autoRetried) { autoRetried = true; setTimeout(function () { if ($('retry')) retry(); }, 2500); }
  }

  function stillLoading() { return !!card.querySelector('.skeleton'); }
  setTimeout(function () { if (stillLoading()) boot(); }, 25000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && stillLoading()) boot(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted && stillLoading()) boot(); });

  A.onChange(function () { boot(); });
  boot();
})();

['storeIos', 'storeAndroid'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', function () {
    try { window.anacanAnalytics && window.anacanAnalytics.track('app_store_click', { store: id === 'storeIos' ? 'app_store' : 'google_play', placement: 'abune_hero' }); } catch (e) { /* ignore */ }
  });
});
