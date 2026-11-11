/* Weekend campaign: login first (app's methods), then the plans at the server's campaign prices; an account with
   Premium (store or web) sees that instead. Subscribing opens Epoint's bank page (card saved for renewals); the
   result is confirmed by the signed Epoint callback, the page only polls the status after the redirect back. */
/* 11.11 (2026-11-11 Baku) has its own page. The server's payment redirects (?odenis=…) and reminder links keep
   pointing here, so forward them there with the query and hash intact. Before the status loads this is decided by
   the Baku date (plus the morning after for a payment that returns after midnight); once loaded, by the server's
   campaign name. The 1111 page never redirects back, so there is no loop. */
var ANACAN_1111_PAGE = '/website/premium/1111/index.html';
function anacanGo1111() {
  if (location.pathname.indexOf('/premium/1111/') !== -1) return false;
  try { location.replace(ANACAN_1111_PAGE + (location.search ? location.search + '&' : '?') + 'lang=az' + location.hash); } catch (e) { return false; }
  return true;
}
var anacanForwarded = (function () {
  try {
    var bakuDay = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10); // Baku is UTC+4, no DST
    var returning = /[?&]odenis=/.test(location.search);
    if (bakuDay === '2026-11-10' || bakuDay === '2026-11-11' || (returning && bakuDay === '2026-11-12')) return anacanGo1111();
  } catch (e) { /* stay on this page */ }
  return false;
})();

(function () {
  'use strict';
  if (anacanForwarded) return;
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

  // ── Campaign window known without login (the page is public). After it ends the whole page says so. ──────
  var CAMPAIGN_ENDS_AT = Date.parse(document.body.getAttribute('data-campaign-ends') || '');
  var ended = isFinite(CAMPAIGN_ENDS_AT) && Date.now() >= CAMPAIGN_ENDS_AT;
  function showEnded() {
    document.body.classList.add('no-sell', 'campaign-ended');
    $('liveText').textContent = 'Kampaniya bitdi';
    $('heroPct').textContent = 'endirimi bitdi';
    $('heroSub').textContent = 'Həftəsonu kampaniyası başa çatdı';
    $('timer').hidden = true;
    if ($('finalText')) $('finalText').textContent = 'Növbəti endirimlər üçün Anacan tətbiqini izlə';
    card.innerHTML = '';
    renderState(ICON_INFO, 'Kampaniya bitdi', 'Bu kampaniya artıq bitib. Premium-u tətbiqdən ala bilərsən. Növbəti endirimləri qaçırmamaq üçün tətbiqdə bildirişləri aç.',
      '<a class="cta" href="/website/premium/app/index.html?src=campaign_ended">Tətbiqi aç <span class="arr">→</span></a>', true);
  }

  // ── Countdown (campaign end from the server; before login the coming Sunday 23:59:59 Baku) ───────────────
  var target = isFinite(CAMPAIGN_ENDS_AT) ? CAMPAIGN_ENDS_AT : (function () {
    var nowBaku = new Date(Date.now() + 4 * 3600e3);
    var end = new Date(Date.UTC(nowBaku.getUTCFullYear(), nowBaku.getUTCMonth(), nowBaku.getUTCDate(), 23, 59, 59));
    end.setUTCDate(end.getUTCDate() + (7 - nowBaku.getUTCDay()) % 7);
    return end.getTime() - 4 * 3600e3;
  })();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  function tick() {
    var s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    $('tD').textContent = Math.floor(s / 86400); s %= 86400;
    $('tH').textContent = pad(Math.floor(s / 3600)); s %= 3600;
    $('tM').textContent = pad(Math.floor(s / 60)); $('tS').textContent = pad(s % 60);
  }
  tick(); setInterval(tick, 1000);

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
  function plans() { return status && status.campaign && status.campaign.plans; }
  function pctText(p) { return p && p.pct ? '−' + p.pct + '%' : ''; }
  function updateHero() {
    var p = plans();
    if (!p) return;
    var y = p.yearly, m = p.monthly, v = selected === 'yearly' ? y : m;
    $('heroPct').textContent = pctText(v) || 'Premium';
    $('heroSub').textContent = selected === 'yearly' ? 'illik plan, ayda ≈ ' + A.money(y.per_month) : 'aylıq plan, ' + A.money(m.price);
    $('finalText').textContent = 'İllik ' + A.money(y.price) + ', ayda cəmi ≈ ' + A.money(y.per_month);
    $('stickyText').innerHTML = '<b>' + A.money(v.price) + '</b>' + (v.was ? '<s>' + A.money(v.was) + '</s>' : '') +
      '<small>' + A.esc((pctText(v) ? pctText(v) + ' · ' : '') + (selected === 'yearly' ? 'illik' : 'aylıq')) + '</small>';
    if (status.campaign.ends_at && isFinite(Date.parse(status.campaign.ends_at))) target = Date.parse(status.campaign.ends_at);
  }

  /** No selling (sticky bar, final CTA) once the account has Premium or the campaign is over. */
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

  function renderPlans(message) {
    selling(true);
    var p = plans();
    var y = p.yearly, m = p.monthly;
    var v = selected === 'yearly' ? y : m;
    var save = v.was ? Math.round((v.was - v.price) * 100) / 100 : 0;
    card.innerHTML =
      '<h2>Planını seç</h2>' +
      (message ? '<p class="msg err" role="alert">' + A.esc(message) + '</p>' : '') +
      '<div role="radiogroup" aria-label="Plan">' +
      '<button type="button" class="plan" role="radio" aria-checked="' + (selected === 'yearly') + '" data-plan="yearly">' +
      '<span class="radio" aria-hidden="true"></span>' +
      '<span><span class="pname">İllik ' + (y.pct ? '<span class="badge">−' + y.pct + '%</span>' : '') + '<span class="badge ghost">Ən sərfəli</span></span>' +
      '<span class="psub">ayda ≈ ' + A.money(y.per_month) + ' · 12 ay</span></span>' +
      '<span class="price">' + (y.was ? '<s>' + A.money(y.was) + '</s>' : '') + '<b>' + A.money(y.price) + '</b></span></button>' +
      '<button type="button" class="plan" role="radio" aria-checked="' + (selected === 'monthly') + '" data-plan="monthly">' +
      '<span class="radio" aria-hidden="true"></span>' +
      '<span><span class="pname">Aylıq ' + (m.pct ? '<span class="badge">−' + m.pct + '%</span>' : '') + '</span><span class="psub">hər ay</span></span>' +
      '<span class="price">' + (m.was ? '<s>' + A.money(m.was) + '</s>' : '') + '<b>' + A.money(m.price) + '</b></span></button>' +
      '</div>' +
      (save > 0 ? '<div class="save"><span>Qənaətin</span><span>' + A.money(save) + '</span></div>' : '') +
      (status.payments_ready ? consentHtml('consent') : '') +
      '<button class="cta" type="button" id="cta"' + (status.payments_ready ? '' : ' disabled') + '>' +
      (status.payments_ready ? 'Endirimi əldə et <span class="arr">→</span>' : 'Ödəniş sistemi hələ aktiv deyil') + '</button>' +
      '<p class="fine">Avtomatik yenilənir, istədiyin vaxt ləğv edə bilərsən. Endirimli qiymət ləğv edənə qədər hər yenilənmədə qorunur. Kartla, manatla (Epoint).</p>' +
      (status.email ? '<p class="acct">Hesab: ' + A.esc(status.email) + '</p>' : '');
    card.querySelectorAll('.plan').forEach(function (b) {
      b.addEventListener('click', function () { selected = b.getAttribute('data-plan'); renderPlans(); updateHero(); });
    });
    var cta = $('cta');
    if (cta && status.payments_ready) { cta.addEventListener('click', function () { subscribe(false); }); bindConsent('consent', cta); }
    appendTest();
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

  /** Admin-only tiny-price offer for real card tests (the server returns test_offer only for admins). */
  function appendTest() {
    var t = status && status.test_offer;
    if (!t || !status.payments_ready || (status.premium && status.premium.source === 'web_subscription')) return;
    var box = document.createElement('div');
    box.className = 'testbox';
    box.innerHTML = '<b>Admin test</b><span>' + (t.plan === 'monthly' ? 'Aylıq' : 'İllik') + ' abunəlik · ' + A.money(t.price) + '</span>' +
      consentHtml('consentTest') + '<button class="btn" type="button" id="ctaTest">Test ödənişi et</button>';
    card.appendChild(box);
    var b = $('ctaTest');
    b.addEventListener('click', function () { subscribe(true); });
    bindConsent('consentTest', b);
  }

  var ERRORS = {
    premium_active: 'Premium-un artıq aktivdir.',
    already_subscribed: 'Sənin artıq abunəliyin var. “Premium hesabım” səhifəsinə bax.',
    campaign_inactive: 'Kampaniya bitib.',
    payments_unavailable: 'Ödəniş sistemi hələ aktiv deyil. Bir az sonra yenidən yoxla.',
    too_many_attempts: 'Çox cəhd edildi. Bir saat sonra yenidən yoxla.',
    rate_limited: 'Çox cəhd edildi. Bir dəqiqə sonra yenidən yoxla.',
    checkout_unavailable: 'Ödəniş səhifəsi açılmadı. Bir az sonra yenidən cəhd et.',
  };

  async function subscribe(test) {
    var cta = $(test ? 'ctaTest' : 'cta');
    cta.disabled = true; cta.innerHTML = '<span class="spinner"></span>';
    try {
      var d = await A.call('subscribe', test ? { plan: status.test_offer.plan, test: true, consent: 'premium-autorenew-v1' } : { consent: 'premium-autorenew-v1', plan: selected });
      if (d.ok && typeof d.redirect_url === 'string' && /^https:\/\/([a-z0-9-]+\.)+az(:443)?\//i.test(d.redirect_url)) {
        location.href = d.redirect_url; // Epoint / bank card page; it returns to this page
        return;
      }
      if (d.error === 'premium_active' || d.error === 'already_subscribed' || d.error === 'campaign_inactive') { await load(); return; }
      failed(ERRORS[d.error] || ERRORS.checkout_unavailable);
    } catch (e) {
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      failed(ERRORS.checkout_unavailable);
    }
  }

  function failed(message) {
    if (plans() && status.campaign.active && !(status.premium && status.premium.active)) renderPlans(message);
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

  function is1111(s) {
    var name = s && s.campaign && s.campaign.name;
    return typeof name === 'string' && name.indexOf('1111') === 0;
  }

  function renderStatus() {
    $('cabinetLink').hidden = false;
    if (status.premium && status.premium.active) { renderPremium(status.premium); appendTest(); return; }
    if (!status.campaign || !status.campaign.active || !plans()) {
      $('liveText').textContent = 'Kampaniya bitdi';
      renderState(ICON_INFO, 'Kampaniya bitdi', 'Bu kampaniya artıq bitib. Növbəti endirimlər üçün Anacan tətbiqini izlə.', '', true);
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
      if (is1111(status) && anacanGo1111()) return;
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
      // A hung or failed session read must never leave the card on its loading placeholder.
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
      A.renderLogin(card, { title: 'Endirimi görmək üçün daxil ol', subtitle: 'Anacan hesabınla daxil ol: tətbiqdəki eyni hesab. Premium bu hesaba bağlanacaq.' });
      return;
    }
    var verify = await A.needsVerification();
    if (mine !== generation) return;
    if (verify) {
      A.renderVerify(card, s.user && s.user.email, boot);
      return;
    }
    if (payment === 'ugurlu') { payment = null; await waitForPayment(); return; }
    if (payment === 'xeta') { payment = null; A.toast('Ödəniş alınmadı. Kartı yoxlayıb yenidən cəhd et.', true); }
    await load();
  }

  /** Error state with a retry button; the first failure also retries once by itself. */
  var autoRetried = false;
  function loadFailed(retry) {
    renderState(ICON_INFO, 'Məlumat yüklənmədi', 'Bağlantını yoxlayıb yenidən cəhd et.', '<button class="btn" type="button" id="retry">Yenidən yoxla</button>', true);
    $('retry').addEventListener('click', function () { card.innerHTML = '<div class="skeleton" aria-hidden="true"></div>'; retry(); });
    if (!autoRetried) { autoRetried = true; setTimeout(function () { if ($('retry')) retry(); }, 2500); }
  }

  /** Safety net: if the card is still the placeholder (e.g. Safari froze a request while the tab was in the background), start again. */
  function stillLoading() { return !!card.querySelector('.skeleton'); }
  setTimeout(function () { if (stillLoading()) boot(); }, 25000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && stillLoading()) boot(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted && stillLoading()) boot(); });

  if (ended) {
    // Ended: no login, no plans; the account chip still works for subscribers.
    A.session().then(function (s) { A.renderWho($('who'), s); }).catch(function () {});
    showEnded();
  } else {
    A.onChange(function () { boot(); });
    boot();
  }
})();

// Hero store buttons: report the click to GA4 (the page keeps working without analytics).
['storeIos', 'storeAndroid'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', function () {
    try { window.anacanAnalytics && window.anacanAnalytics.track('app_store_click', { store: id === 'storeIos' ? 'app_store' : 'google_play', placement: 'kampaniya_hero' }); } catch (e) { /* ignore */ }
  });
});
