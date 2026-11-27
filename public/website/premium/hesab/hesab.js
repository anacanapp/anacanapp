/* "Premium hesabım": the web subscription bought on anacan.az (plan, price, status, next charge / end date), saved
   Epoint cards (add, remove, choose for renewals), cancel / resume, plan switch from the next renewal, payment history.
   App Store / Google Play subscriptions are only shown: they are managed in the store. */
(function () {
  'use strict';
  var A = window.AnacanAccount;
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var CAMPAIGN = '/website/premium/abune/index.html';
  var params = new URLSearchParams(location.search);
  var cardReturn = params.get('kart'); // 'ok' | 'xeta' after Epoint card registration (never proof by itself)
  if (cardReturn) { params.delete('kart'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '')); }
  var state = null;
  var busy = false;
  var generation = 0;

  var PLAN = { monthly: 'Aylıq', yearly: 'İllik' };
  var PER = { monthly: 'ay', yearly: 'il' };
  var STATUS = { active: 'Aktiv', cancelled: 'Ləğv edilib', past_due: 'Ödəniş gecikir', expired: 'Bitib' };
  var ERRORS = {
    card_needed: 'Bu, yenilənmə üçün yeganə kartdır. Əvvəlcə başqa kart əlavə et və ya abunəliyi ləğv et.',
    card_not_found: 'Kart tapılmadı. Səhifəni yenilə.',
    no_subscription: 'Aktiv abunəlik tapılmadı.',
    cannot_resume: 'Abunəliyin müddəti bitib; bərpa etmək mümkün deyil.',
    payments_unavailable: 'Ödəniş sistemi hələ aktiv deyil.',
    too_many_attempts: 'Çox cəhd edildi. Bir saat sonra yenidən yoxla.',
    rate_limited: 'Çox cəhd edildi. Bir dəqiqə sonra yenidən yoxla.',
    checkout_unavailable: 'Bank səhifəsi açılmadı. Bir az sonra yenidən cəhd et.',
  };
  function errorText(code) { return ERRORS[code] || 'Alınmadı. Bir az sonra yenidən cəhd et.'; }

  function storeName(store) {
    return store === 'app_store' || store === 'mac_app_store' ? 'App Store' : store === 'play_store' ? 'Google Play' : 'tətbiq mağazası';
  }
  function storeHow(store) {
    if (store === 'app_store' || store === 'mac_app_store') return 'iPhone-da: Ayarlar → adın → Abunəliklər.';
    if (store === 'play_store') return 'Android-də: Google Play → Profil → Ödənişlər və abunəliklər → Abunəliklər.';
    return 'Tətbiq mağazasının abunəliklər bölməsində.';
  }

  // ── Subscription panel ────────────────────────────────────────────────────────────────
  function subscriptionPanel() {
    var sub = state.subscription;
    var premium = state.premium || {};
    if (!sub) {
      var body;
      if (premium.active && premium.source === 'store') {
        body = '<p class="empty">Premium-un ' + A.esc(storeName(premium.store)) + ' abunəliyi ilə aktivdir' + (premium.expires_at ? ' (' + A.esc(A.day(premium.expires_at)) + ' tarixinə qədər)' : '') + '.</p>' +
          '<div class="note-box soft">Bu abunəlik mağazada idarə olunur: ləğv etmək və ya planı dəyişmək üçün ' + A.esc(storeHow(premium.store)) + '</div>';
      } else if (premium.active) {
        body = '<p class="empty">Premium-un ' + (premium.expires_at ? A.esc(A.day(premium.expires_at)) + ' tarixinə qədər ' : '') + 'açıqdır' +
          (premium.source === 'web_pass' ? ' (birdəfəlik keçid, avtomatik yenilənmir)' : '') + '.</p>' +
          '<div class="note-box soft">Bu Premium üçün idarə ediləcək abunəlik yoxdur. Müddət bitəndə abunəlik səhifəsində abunə ola bilərsən.</div>';
      } else {
        body = '<p class="empty">Hazırda anacan.az-da aktiv abunəliyin yoxdur.</p>' +
          '<div class="actions"><a class="cta" href="' + CAMPAIGN + '">Abunə ol <span class="arr">→</span></a></div>';
      }
      return '<section class="panel"><h2>Abunəlik</h2>' + body + '</section>';
    }
    var nextPlan = sub.next_plan;
    var card = sub.card;
    var rows = '<dt>Qiymət</dt><dd>' + A.money(sub.price) + ' / ' + PER[sub.plan] + '</dd>';
    if (sub.status === 'cancelled') rows += '<dt>Premium bitir</dt><dd>' + A.esc(A.day(sub.current_period_end)) + '</dd>';
    else rows += '<dt>Növbəti ödəniş</dt><dd>' + A.esc(A.day(sub.next_charge_at || sub.current_period_end)) + ' · ' + A.money(sub.next_price || sub.price) + '</dd>' +
      '<dt>Cari müddət</dt><dd>' + A.esc(A.day(sub.current_period_end)) + ' tarixinə qədər</dd>';
    rows += '<dt>Ödəniş kartı</dt><dd>' + (card ? A.esc(maskText(card.mask)) : '—') + '</dd>';
    rows += '<dt>Abunə tarixi</dt><dd>' + A.esc(A.day(sub.created_at)) + '</dd>';

    var notes = '';
    if (sub.status === 'past_due') notes += '<div class="note-box warn">Son ödəniş alınmadı. ' + (sub.next_charge_at ? A.esc(A.day(sub.next_charge_at)) + ' tarixində ' : '') +
      'yenidən cəhd edəcəyik. Kartdakı balansı yoxla və ya yeni kart əlavə et.</div>';
    if (sub.status === 'cancelled') notes += '<div class="note-box soft">Abunəlik ləğv edilib, yeni ödəniş alınmayacaq. Premium ' + A.esc(A.day(sub.current_period_end)) +
      ' tarixinə qədər açıq qalır. Fikrini dəyişsən, bu tarixə qədər bərpa edə bilərsən.</div>';
    if (nextPlan && sub.status !== 'cancelled') notes += '<div class="note-box soft">Növbəti ödənişdən (' + A.esc(A.day(sub.next_charge_at || sub.current_period_end)) + ') ' +
      PLAN[nextPlan].toLowerCase() + ' plana keçəcəksən: ' + A.money(sub.prices && sub.prices[nextPlan]) + ' / ' + PER[nextPlan] + '.</div>';
    if (!card && sub.status !== 'cancelled') notes += '<div class="note-box warn">Yenilənmə üçün kart yoxdur. “Kart əlavə et” ilə kart əlavə et.</div>';

    var actions = sub.status === 'cancelled'
      ? '<button class="cta" type="button" data-act="resume">Abunəliyi bərpa et</button>'
      : '<button class="btn danger" type="button" data-act="cancel">Abunəliyi ləğv et</button>';

    var seg = '';
    if (sub.status !== 'cancelled' && sub.prices) {
      var effective = nextPlan || sub.plan;
      seg = '<h2 style="margin-top:22px">Planı dəyiş</h2><div class="seg" role="group" aria-label="Plan">' +
        ['monthly', 'yearly'].map(function (p) {
          return '<button type="button" data-plan="' + p + '" aria-pressed="' + (effective === p) + '"><b>' + PLAN[p] + '</b><small>' + A.money(sub.prices[p]) + ' / ' + PER[p] + '</small></button>';
        }).join('') + '</div><p class="empty" style="font-size:12.5px;margin-top:8px">Yeni plan növbəti ödənişdən qüvvəyə minir. Kampaniya qiyməti saxlanılır.</p>';
    }

    return '<section class="panel"><h2>Abunəlik <span class="pill ' + A.esc(sub.status) + '">' + A.esc(STATUS[sub.status] || sub.status) + '</span></h2>' +
      '<div class="plan-head"><div><b>' + PLAN[sub.plan] + ' Premium</b><small>anacan.az · Epoint · ' + (sub.status === 'cancelled' ? 'yenilənmir' : 'avtomatik yenilənir') + '</small></div></div>' +
      '<dl class="facts">' + rows + '</dl>' + notes + '<div class="actions">' + actions + '</div>' + seg + '</section>';
  }

  function maskText(mask) {
    if (!mask) return 'Kart';
    var digits = String(mask).replace(/[^0-9*]/g, '');
    return digits.length >= 8 ? digits.slice(0, 4) + ' •••• ' + digits.slice(-4) : String(mask);
  }

  // ── Cards panel ───────────────────────────────────────────────────────────────────────
  function cardsPanel() {
    var cards = state.cards || [];
    var list = cards.length ? '<ul class="cards">' + cards.map(function (c) {
      var pending = c.status === 'pending';
      var meta = [c.card_name, c.expiry ? 'bitmə ' + c.expiry : '', pending ? 'yoxlanılır…' : ''].filter(Boolean).join(' · ');
      return '<li class="cardrow" data-default="' + (c.is_default && !pending) + '"><span class="chip-card" aria-hidden="true"></span>' +
        '<div><b>' + A.esc(maskText(c.mask)) + '</b><small>' + A.esc(meta || 'Bank kartı') + '</small></div>' +
        '<div class="ops">' + (pending ? '' : c.is_default ? '<span class="badge-def pill active" style="font-size:11px">Əsas</span>'
          : '<button class="btn small" type="button" data-default="' + A.esc(c.id) + '">Əsas et</button>') +
        '<button class="btn small ghost" type="button" data-remove="' + A.esc(c.id) + '" aria-label="Kartı sil">Sil</button></div></li>';
    }).join('') + '</ul>' : '<p class="empty">Yadda saxlanmış kart yoxdur.</p>';
    return '<section class="panel"><h2>Kartlarım</h2>' + list +
      '<div class="actions"><button class="btn" type="button" data-act="add_card">+ Kart əlavə et</button></div>' +
      '<p class="empty" style="font-size:12.5px;margin-top:10px">Yenilənmə ödənişi əsas kartdan alınır. Kart məlumatları bankın səhifəsində daxil edilir; Anacan yalnız maskalı nömrəni saxlayır.</p></section>';
  }

  // ── History panel ─────────────────────────────────────────────────────────────────────
  function historyPanel() {
    var charges = state.charges || [];
    if (!charges.length) return '<section class="panel"><h2>Ödəniş tarixçəsi</h2><p class="empty">Hələ ödəniş yoxdur.</p></section>';
    var label = { paid: 'Ödənilib', failed: 'Alınmadı', pending: 'Gözləyir' };
    return '<section class="panel"><h2>Ödəniş tarixçəsi</h2><table class="history"><thead><tr><th>Tarix</th><th>Təsvir</th><th class="amt">Məbləğ</th></tr></thead><tbody>' +
      charges.map(function (c) {
        return '<tr><td>' + A.esc(A.day(c.paid_at || c.created_at)) + '</td><td>' + A.esc((c.kind === 'initial' ? 'Abunə' : 'Yenilənmə') + ' · ' + PLAN[c.plan]) +
          '<br><span class="st ' + A.esc(c.status) + '">' + A.esc(label[c.status] || c.status) + '</span></td><td class="amt">' + A.money(c.amount) + '</td></tr>';
      }).join('') + '</tbody></table></section>';
  }

  function render() {
    app.innerHTML = '<div class="grid"><div style="display:grid;gap:14px">' + subscriptionPanel() + historyPanel() + '</div><div style="display:grid;gap:14px">' + cardsPanel() + '</div></div>';
    app.querySelectorAll('[data-act]').forEach(function (b) { b.addEventListener('click', function () { act(b.getAttribute('data-act')); }); });
    app.querySelectorAll('[data-plan]').forEach(function (b) {
      b.addEventListener('click', function () { if (b.getAttribute('aria-pressed') !== 'true') run('change_plan', { plan: b.getAttribute('data-plan') }, 'Plan növbəti ödənişdən dəyişəcək.'); });
    });
    app.querySelectorAll('[data-default]').forEach(function (b) {
      if (b.tagName === 'BUTTON') b.addEventListener('click', function () { run('set_default_card', { card: b.getAttribute('data-default') }, 'Əsas kart dəyişdi.'); });
    });
    app.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        confirmBox('Kartı silək?', 'Bu kart yenilənmə ödənişləri üçün istifadə olunmayacaq.', 'Sil', function () {
          run('remove_card', { card: b.getAttribute('data-remove') }, 'Kart silindi.');
        });
      });
    });
  }

  function confirmBox(title, text, yes, onYes) {
    var wrap = document.createElement('div');
    wrap.className = 'modal';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">' + A.esc(title) + '</h3><p>' + A.esc(text) + '</p>' +
      '<div class="actions"><button class="btn" type="button" data-no>İmtina</button><button class="btn danger" type="button" data-yes>' + A.esc(yes) + '</button></div></div>';
    function close() { wrap.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    wrap.querySelector('[data-no]').addEventListener('click', close);
    wrap.querySelector('[data-yes]').addEventListener('click', function () { close(); onYes(); });
    document.addEventListener('keydown', key);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-no]').focus();
  }

  function act(action) {
    if (action === 'cancel') {
      var end = state.subscription ? A.day(state.subscription.current_period_end) : '';
      confirmBox('Abunəliyi ləğv edək?', 'Yeni ödəniş alınmayacaq. Premium ' + end + ' tarixinə qədər açıq qalacaq. Bu tarixə qədər bərpa edə bilərsən; sonra endirimli qiymət itir.',
        'Ləğv et', function () { run('cancel', {}, 'Abunəlik ləğv edildi.'); });
      return;
    }
    if (action === 'resume') { run('resume', {}, 'Abunəlik bərpa edildi.'); return; }
    if (action === 'add_card') { addCard(); }
  }

  async function addCard() {
    if (busy) return;
    busy = true;
    A.toast('Bank səhifəsi açılır…');
    try {
      var d = await A.call('add_card');
      if (d.ok && typeof d.redirect_url === 'string' && /^https:\/\/([a-z0-9-]+\.)+az(:443)?\//i.test(d.redirect_url)) { location.href = d.redirect_url; return; }
      A.toast(errorText(d.error), true);
    } catch (e) {
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      A.toast(errorText(e && e.code), true);
    }
    busy = false;
  }

  async function run(action, body, done) {
    if (busy) return;
    busy = true;
    try {
      var d = await A.call(action, body);
      if (!d.ok) { A.toast(errorText(d.error), true); }
      else { A.toast(done); }
    } catch (e) {
      if (e && e.code === 'unauthorized') { busy = false; await A.signOut(); return; }
      A.toast(errorText(e && e.code), true);
    }
    busy = false;
    await load();
  }

  async function load() {
    var mine = ++generation;
    try {
      var d = await A.call('status');
      if (mine !== generation) return;
      if (!d.ok) throw new Error(d.error || 'status');
      state = d;
      render();
    } catch (e) {
      if (mine !== generation) return;
      if (e && e.code === 'unauthorized') { await A.signOut(); return; }
      app.innerHTML = '<section class="panel"><h2>Məlumat yüklənmədi</h2><p class="empty">Bağlantını yoxlayıb yenidən cəhd et.</p><div class="actions"><button class="btn" type="button" id="retry">Yenidən yoxla</button></div></section>';
      $('retry').addEventListener('click', load);
    }
  }

  /** After a card registration: the signed callback activates the card; poll briefly so it appears. */
  async function waitForCard() {
    A.toast('Kart yoxlanılır…');
    for (var i = 0; i < 8; i++) {
      await load();
      var pending = (state && state.cards || []).some(function (c) { return c.status === 'pending'; });
      if (!pending) { A.toast('Kart yadda saxlanıldı.'); return; }
      await new Promise(function (r) { setTimeout(r, 3000); });
    }
  }

  async function boot() {
    generation++;
    var s = null;
    try { s = await A.session(); } catch (e) { s = null; }
    A.renderWho($('who'), s);
    if (!s) {
      $('lead').hidden = true;
      app.innerHTML = '<div class="panel" style="max-width:440px;margin:0 auto" id="login"></div>';
      A.renderLogin($('login'), { title: 'Daxil ol', subtitle: 'Premium abunəliyini idarə etmək üçün Anacan hesabınla daxil ol.' });
      return;
    }
    $('lead').hidden = false;
    if (await A.needsVerification()) {
      app.innerHTML = '<div class="panel" style="max-width:440px;margin:0 auto" id="verify"></div>';
      A.renderVerify($('verify'), s.user && s.user.email, boot);
      return;
    }
    if (cardReturn === 'ok') { cardReturn = null; await waitForCard(); return; }
    if (cardReturn === 'xeta') { cardReturn = null; A.toast('Kart əlavə olunmadı. Yenidən cəhd et.', true); }
    await load();
  }
  A.onChange(function () { boot(); });
  boot();
})();
