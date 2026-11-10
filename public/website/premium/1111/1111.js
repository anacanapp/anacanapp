/* 11.11 campaign "Poz-Aç" (one day, 2026-11-11 Baku). The visitor scratches the card (or presses "Birdən aç") to see the
   yearly price; the subscribe block then opens directly under the card. Same account flow as the weekend page
   (kampaniya.js): login first, then the yearly plan at the server's campaign price; an account with Premium sees that
   instead. Subscribing opens Epoint's bank page; the result is confirmed by the signed Epoint callback, the page only
   polls the status after the redirect back.
   Prices are SHOWN in USD (owner decision, fixed display rate 1 USD = 1.70 AZN) converted from the server's AZN
   prices; the charge is always the server's AZN price, which is stated under the button. Yearly plan only.
   The server's payment redirects and reminder links point to the kampaniya page, which forwards here during 11.11;
   this page never redirects back. */
(function () {
  'use strict';
  var A = window.AnacanAccount;
  var $ = function (id) { return document.getElementById(id); };
  var card = $('plans');
  var params = new URLSearchParams(location.search);
  var payment = params.get('odenis'); // 'ugurlu' | 'xeta' (redirect back from the bank page; never proof of payment)
  if (payment) { params.delete('odenis'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); }
  var CABINET = '/website/premium/hesab/index.html';
  var PLAN = 'yearly';
  var status = null;
  var generation = 0;
  var signedIn = false;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var USD_RATE = 1.70; // display only
  function usdValue(azn) { var n = Number(azn); return isFinite(n) ? Math.round(n / USD_RATE * 100) / 100 : NaN; }
  function usd(azn) { var v = usdValue(azn); return isFinite(v) ? '$' + v.toFixed(2) : ''; }
  function usdPerMonth(azn) { var v = usdValue(azn); return isFinite(v) ? '$' + (Math.round(v / 12 * 100) / 100).toFixed(2) : ''; }
  function centsPerDay(azn) { var v = usdValue(azn); return isFinite(v) ? Math.max(1, Math.round(v / 365 * 100)) : NaN; }

  var ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICON_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>';
  var ICON_WAIT = '<span class="spinner" style="width:26px;height:26px"></span>';

  // Display fallback before the server status is loaded (the page is public; prices need a session).
  var FALLBACK = { price: 18.89, was: 50.98, pct: 63 };
  function yearly() { var p = status && status.campaign && status.campaign.plans; return (p && p.yearly) || null; }
  function shownPlan() { return yearly() || FALLBACK; }

  // ── Campaign window known without login (the page is public). ──────────────────────────
  var CAMPAIGN_STARTS_AT = Date.parse(document.body.getAttribute('data-campaign-starts') || '');
  var CAMPAIGN_ENDS_AT = Date.parse(document.body.getAttribute('data-campaign-ends') || '');
  var ended = isFinite(CAMPAIGN_ENDS_AT) && Date.now() >= CAMPAIGN_ENDS_AT;
  function notStarted() { return isFinite(CAMPAIGN_STARTS_AT) && Date.now() < CAMPAIGN_STARTS_AT; }

  // ── Panel under the scratch card ──────────────────────────────────────────────────────
  // 'gate': shown only after the card is revealed (plans, login, pre-start, retry).
  // 'state': no card to scratch (Premium active, payment result, campaign over): shown at once, card hidden.
  var panelMode = 'gate';
  var revealed = false;
  function setPanel(mode) {
    panelMode = mode;
    document.body.classList.toggle('no-scratch', mode === 'state');
    card.hidden = !(mode === 'state' || revealed);
  }

  function endedHero() {
    document.body.classList.add('campaign-ended');
    $('liveText').textContent = 'Kampaniya bitdi';
    $('heroTitle').textContent = '11.11 kampaniyası bitdi.';
    $('heroLead').textContent = 'Növbəti endirimlər üçün Anacan tətbiqini izlə və bildirişləri aç.';
    $('timer').hidden = true;
  }
  function endedCard(text) {
    renderState(ICON_INFO, 'Kampaniya bitdi', text || '11.11 kampaniyası artıq bitib. Premium-u tətbiqdən ala bilərsən. Növbəti endirimləri qaçırmamaq üçün tətbiqdə bildirişləri aç.',
      '<a class="cta" href="/website/premium/app/index.html?src=campaign_ended">Tətbiqi aç <span class="arr">→</span></a>' +
      '<a class="btn" href="' + CABINET + '">Premium hesabım</a>', true);
  }
  function showEnded() { endedHero(); endedCard(); }

  // ── Countdown: to the start before 11.11, then to the end (server ends_at once loaded). ───
  var target = isFinite(CAMPAIGN_ENDS_AT) ? CAMPAIGN_ENDS_AT : Date.now();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var wasPre = notStarted();
  function tick() {
    var pre = notStarted();
    var over = document.body.classList.contains('campaign-ended');
    var to = pre ? CAMPAIGN_STARTS_AT : target;
    $('timerLabel').textContent = pre ? 'Kampaniya başlayanadək' : 'Kampaniya bitənədək';
    if (pre) $('liveText').textContent = 'Tezliklə · 11 noyabr';
    else if (!over) $('liveText').textContent = 'Yalnız bu gün · 11 noyabr';
    var ms = Math.max(0, to - Date.now());
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400);
    $('tD').textContent = d; $('tDBox').hidden = d === 0; s %= 86400;
    $('tH').textContent = pad(Math.floor(s / 3600)); s %= 3600;
    $('tM').textContent = pad(Math.floor(s / 60)); $('tS').textContent = pad(s % 60);
    var urgent = !pre && !over && ms > 0 && ms < 3600000;
    $('timer').classList.toggle('urgent', urgent);
    $('cdHint').textContent = pre ? '11.11 tezliklə başlayır.' : over || ms === 0 ? 'Kampaniya bitdi.' : urgent ? 'Son saat! Endirim tezliklə bitir.' : '';
    if (wasPre && !pre) { wasPre = false; if (signedIn && !over) load(); }
    if (!pre && !over && Date.now() >= target && status && !(status.premium && status.premium.active)) {
      endedHero(); endedCard();
    }
  }
  tick(); setInterval(tick, 1000);

  // ── Prices on the scratch prize, the subscribe row and the sticky bar ─────────────────
  function pctText(p) { return p && p.pct ? '−' + p.pct + '%' : ''; }
  function updatePrices() {
    var y = shownPlan();
    $('prizePrice').textContent = usd(y.price);
    $('prizeWas').textContent = y.was ? usd(y.was) : ''; $('prizeWas').hidden = !y.was;
    $('prizeOff').textContent = (pctText(y) ? pctText(y) + ' · ' : '') + 'yalnız bu gün';
    var c = centsPerDay(y.price);
    $('prizeSub').textContent = 'ayda ≈ ' + usdPerMonth(y.price) + (isFinite(c) ? ' · gündə cəmi ' + c + ' sent' : '');
    if (revealed) {
      $('sPrice').textContent = usd(y.price);
      $('sWas').textContent = y.was ? usd(y.was) : '';
      $('sSub').textContent = 'İllik Premium' + (pctText(y) ? ' · ' + pctText(y) : '');
      $('scratchHint').textContent = 'Endirim açıldı: illik Premium ' + usd(y.price);
    }
    var yy = yearly();
    if (yy && status.campaign.ends_at && isFinite(Date.parse(status.campaign.ends_at))) target = Date.parse(status.campaign.ends_at);
  }

  /** No selling (sticky bar) once the account has Premium or the campaign is over. */
  function selling(on) { document.body.classList.toggle('no-sell', !on); }
  function renderState(icon, title, text, actionsHtml, soft, gate) {
    if (!gate) selling(false);
    card.innerHTML = '<div class="state"><div class="big' + (soft ? ' soft' : '') + '">' + icon + '</div><h2>' + A.esc(title) + '</h2>' +
      '<p>' + text + '</p>' + (actionsHtml || '') + '</div>';
    setPanel(gate ? 'gate' : 'state');
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

  function subRowHtml(y) {
    return '<div class="sub-row"><div><b>İllik Premium</b><small>12 ay · ayda ≈ ' + usdPerMonth(y.price) + ' · hər il bu qiymətlə yenilənir</small></div>' +
      '<div class="sub-price">' + (y.was ? '<s>' + usd(y.was) + '</s>' : '') + usd(y.price) + '</div></div>';
  }
  function aznNote(y) { return '<p class="note">Ödəniş Azərbaycan manatı ilə alınır: <b>' + A.esc(A.money(y.price)) + '</b></p>'; }
  var FINE = '<p class="fine">Avtomatik yenilənir, istədiyin vaxt ləğv edə bilərsən. Endirimli qiymət ləğv edənə qədər hər yenilənmədə qorunur. Kartla, manatla (Epoint). Dollar qiymətləri məlumat üçündür (1 USD = 1,70 ₼). <a href="https://anacan.az/terms" target="_blank" rel="noopener">İstifadə şərtləri</a></p>';

  function renderPlans(message) {
    selling(true);
    var y = yearly();
    var ready = !!status.payments_ready;
    card.innerHTML =
      (message ? '<p class="msg err" role="alert">' + A.esc(message) + '</p>' : '') +
      subRowHtml(y) +
      (ready ? consentHtml('consent') : '') +
      '<button class="pbtn btn-full" type="button" id="cta"' + (ready ? '' : ' disabled') + '>' +
      (ready ? 'Abunə ol · ' + A.esc(usd(y.price)) : 'Ödəniş sistemi hələ aktiv deyil') + '</button>' +
      aznNote(y) + FINE +
      (status.email ? '<p class="acct">Hesab: ' + A.esc(status.email) + '</p>' : '');
    setPanel('gate');
    var cta = $('cta');
    if (cta && ready) { cta.addEventListener('click', function () { subscribe(false); }); bindConsent('consent', cta); }
    appendTest();
  }

  /** Logged in before 11.11 starts: the offer is visible, the button opens at the start. */
  function renderPrestart() {
    selling(true);
    var y = shownPlan();
    card.innerHTML = subRowHtml(y) +
      '<button class="pbtn btn-full" type="button" id="cta" disabled>11.11 tezliklə başlayır</button>' +
      '<p class="sub-wait">Kampaniya 11 noyabr saat 00:00-da (Bakı vaxtı) başlayır. Abunə düyməsi o zaman açılacaq.</p>' +
      aznNote(y) + (status && status.email ? '<p class="acct">Hesab: ' + A.esc(status.email) + '</p>' : '');
    setPanel('gate');
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
      var d = await A.call('subscribe', test ? { plan: status.test_offer.plan, test: true } : { plan: PLAN });
      if (d.ok && typeof d.redirect_url === 'string' && /^https:\/\/([a-z0-9-]+\.)+az(:443)?\//i.test(d.redirect_url)) {
        location.href = d.redirect_url; // Epoint / bank card page; it returns to the kampaniya page, which forwards here
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
    if (yearly() && status.campaign.active && !(status.premium && status.premium.active)) renderPlans(message);
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
    updatePrices();
    if (status.premium && status.premium.active) { renderPremium(status.premium); appendTest(); return; }
    if (!status.campaign || !status.campaign.active || !yearly()) {
      if (notStarted()) { renderPrestart(); return; }
      endedHero();
      endedCard();
      return;
    }
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
          confetti();
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
      // A hung or failed session read must never leave the panel on its loading placeholder.
      if (mine !== generation) return;
      if (e && e.code === 'timeout') { loadFailed(boot); return; }
      s = null;
    }
    if (mine !== generation) return;
    signedIn = !!s;
    A.renderWho($('who'), s);
    if (!s) {
      $('cabinetLink').hidden = true;
      if (ended) { showEnded(); return; }
      selling(true);
      card.innerHTML = '';
      A.renderLogin(card, { title: 'Endirimi almaq üçün daxil ol', subtitle: 'Anacan hesabınla daxil ol: tətbiqdəki eyni hesab. Premium bu hesaba bağlanacaq.' });
      setPanel('gate');
      return;
    }
    var verify = await A.needsVerification();
    if (mine !== generation) return;
    if (verify) {
      A.renderVerify(card, s.user && s.user.email, boot);
      setPanel('gate');
      return;
    }
    if (payment === 'ugurlu') { payment = null; await waitForPayment(); return; }
    if (payment === 'xeta') { payment = null; A.toast('Ödəniş alınmadı. Kartı yoxlayıb yenidən cəhd et.', true); reveal(true); }
    if (ended) { $('cabinetLink').hidden = false; showEnded(); return; }
    await load();
  }

  /** Error state with a retry button; the first failure also retries once by itself. */
  var autoRetried = false;
  function loadFailed(retry) {
    renderState(ICON_INFO, 'Məlumat yüklənmədi', 'Bağlantını yoxlayıb yenidən cəhd et.', '<button class="btn" type="button" id="retry">Yenidən yoxla</button>', true, true);
    $('retry').addEventListener('click', function () { card.innerHTML = '<div class="skeleton" aria-hidden="true"></div>'; retry(); });
    if (!autoRetried) { autoRetried = true; setTimeout(function () { if ($('retry')) retry(); }, 2500); }
  }

  /** Safety net: if the panel is still the placeholder (e.g. Safari froze a request while the tab was in the background), start again. */
  function stillLoading() { return !!card.querySelector('.skeleton'); }
  setTimeout(function () { if (stillLoading()) boot(); }, 25000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && stillLoading()) boot(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted && stillLoading()) boot(); });

  // ── Scratch card ──────────────────────────────────────────────────────────────────────
  var box = $('scratch'), cv = $('foil'), ctx = cv.getContext('2d');
  var pctEl = $('pct');
  var drawing = false, last = null, dpr = Math.max(1, window.devicePixelRatio || 1);
  function paintFoil() {
    var r = box.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    var g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    var cs = getComputedStyle(document.documentElement);
    g.addColorStop(0, cs.getPropertyValue('--foil-a').trim() || '#FF7A73');
    g.addColorStop(1, cs.getPropertyValue('--foil-b').trim() || '#FF5A5F');
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    // repeating "11.11" pattern
    ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = '#fff';
    ctx.font = '800 ' + (28 * dpr) + 'px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.rotate(-0.18);
    for (var y = -cv.height; y < cv.height * 2; y += 46 * dpr) for (var x = -cv.width; x < cv.width * 2; x += 110 * dpr) ctx.fillText('11.11', x + (Math.round(y / (46 * dpr)) % 2) * 55 * dpr, y);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '800 ' + Math.round(cv.width / 7) + 'px "Plus Jakarta Sans", Inter, sans-serif';
    ctx.fillText('11.11', cv.width / 2, cv.height / 2 + cv.width / 40);
    ctx.font = '600 ' + (15 * dpr) + 'px Inter, sans-serif';
    ctx.fillText('Barmağınla poz', cv.width / 2, cv.height / 2 + cv.width / 7.5);
  }
  function pos(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; }
  function scratchAt(p) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 46 * dpr; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo((last || p).x, (last || p).y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  }
  var checkT = 0;
  function measure() {
    if (!cv.width || !cv.height) return;
    var step = 12 * dpr, data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    var clear = 0, total = 0;
    for (var y = 0; y < cv.height; y += step) for (var x = 0; x < cv.width; x += step) { total++; if (data[(Math.floor(y) * cv.width + Math.floor(x)) * 4 + 3] < 40) clear++; }
    if (!total) return;
    var pct = Math.round(clear / total * 100); pctEl.textContent = pct;
    if (pct >= 45) reveal();
  }
  cv.addEventListener('pointerdown', function (e) { if (revealed) return; drawing = true; last = null; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } scratchAt(pos(e)); });
  cv.addEventListener('pointermove', function (e) { if (!drawing) return; scratchAt(pos(e)); var now = Date.now(); if (now - checkT > 120) { checkT = now; measure(); } });
  var stop = function () { if (drawing) { drawing = false; measure(); } };
  cv.addEventListener('pointerup', stop); cv.addEventListener('pointercancel', stop);
  $('reveal').addEventListener('click', function () { reveal(); });
  window.addEventListener('resize', function () { if (!revealed) paintFoil(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!revealed) paintFoil(); });
  paintFoil();

  /** quiet: returning from the bank page (no confetti, no scroll). */
  function reveal(quiet) {
    if (revealed) return; revealed = true;
    cv.classList.add('done'); box.classList.add('done'); pctEl.textContent = '100';
    var hadFocus = document.activeElement === $('reveal');
    $('reveal').hidden = true;
    $('sBtn').textContent = 'Abunə ol'; $('sBtn').setAttribute('href', '#plans');
    updatePrices();
    if (panelMode === 'gate') card.hidden = false;
    if (quiet) return;
    if (hadFocus) { try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); } }
    setTimeout(function () { card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' }); }, 350);
    confetti();
    try { window.anacanAnalytics && window.anacanAnalytics.track('scratch_reveal', { placement: 'kampaniya_1111' }); } catch (e) { /* ignore */ }
  }
  $('sBtn').addEventListener('click', function (e) {
    e.preventDefault();
    var el = revealed && !card.hidden ? card : $('scratchArea');
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  });

  // ── 11 reasons light up as they scroll into view (resting state is fully readable). ───
  var items = [].slice.call(document.querySelectorAll('#reasons li')), bar = $('rBar'), cnt = $('rCount');
  var seen = [];
  function showSeen() { cnt.textContent = seen.length + ' / ' + items.length; bar.style.width = (seen.length / items.length * 100) + '%'; }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting && en.intersectionRatio > 0.6 && seen.indexOf(en.target) < 0) { seen.push(en.target); en.target.classList.add('on'); io.unobserve(en.target); } });
      showSeen();
    }, { threshold: [0, 0.6, 1] });
    items.forEach(function (li) { io.observe(li); });
  } else { seen = items.slice(); items.forEach(function (li) { li.classList.add('on'); }); showSeen(); }

  // ── Light confetti ────────────────────────────────────────────────────────────────────
  function confetti() {
    if (reduceMotion) return;
    var c = $('conf'), g = c.getContext('2d');
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    var cols = ['#FF5A5F', '#FFB37A', '#FFD84D', '#7BC8A4', '#9C7BD8'];
    var ps = [];
    for (var i = 0; i < 90; i++) ps.push({ x: c.width / 2, y: c.height * 0.35, vx: (Math.random() - 0.5) * 14 * dpr, vy: (-Math.random() * 12 - 4) * dpr, s: (4 + Math.random() * 5) * dpr, c: cols[Math.floor(Math.random() * cols.length)], r: Math.random() * 6 });
    var t = 0;
    (function frame() {
      g.clearRect(0, 0, c.width, c.height);
      ps.forEach(function (p) { p.vy += 0.35 * dpr; p.x += p.vx; p.y += p.vy; p.r += 0.2; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); g.restore(); });
      if (++t < 110) requestAnimationFrame(frame); else g.clearRect(0, 0, c.width, c.height);
    })();
  }

  // ── Start ─────────────────────────────────────────────────────────────────────────────
  updatePrices();
  if (ended && payment !== 'ugurlu') {
    // Ended: no login, no plans; the account chip and the cabinet link still work for subscribers.
    showEnded();
    A.session().then(function (s) { A.renderWho($('who'), s); if (s) $('cabinetLink').hidden = false; }).catch(function () {});
  } else {
    // A payment that returns after midnight still gets its confirmation (boot → waitForPayment).
    if (ended) endedHero();
    A.onChange(function () { boot(); });
    boot();
  }
})();

// Store buttons: report the click to GA4 (the page keeps working without analytics).
['storeIos', 'storeAndroid'].forEach(function (id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener('click', function () {
    try { window.anacanAnalytics && window.anacanAnalytics.track('app_store_click', { store: id === 'storeIos' ? 'app_store' : 'google_play', placement: 'kampaniya_1111_hero' }); } catch (e) { /* ignore */ }
  });
});
