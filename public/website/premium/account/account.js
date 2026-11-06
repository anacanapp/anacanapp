/* anacan.az Premium account (kampaniya + hesab pages).
   Session: supabase-js against https://api.anacan.az with the public anon key from /website/backend.json, stored in
   localStorage under its own key (no clash with anything else on anacan.az). The SSR website stays session-free:
   only these client pages read the session.
   Login methods are the app's: Google (OAuth, PKCE, back to this page), e-mail + password with the app's e-mail code
   (email_verification_state_v1 + email-verification function), and Apple through a bridge page on api.anacan.az
   (the only origin registered for Sign in with Apple JS); the bridge hands the session back with postMessage to
   https://anacan.az only. Tokens are never put in URLs or logs. */
(function () {
  'use strict';
  var API = 'https://api.anacan.az';
  var SITE = 'https://anacan.az';
  var STORAGE_KEY = 'anacan.web-premium.auth.v1';
  var APPLE_BRIDGE = API + '/website/premium/apple/index.html';
  var MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
  var clientPromise = null;
  var publishableKey = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function money(value) { var n = Number(value); return isFinite(n) ? n.toFixed(2).replace('.', ',') + ' ₼' : ''; }
  /** Date in Baku time (UTC+4, no DST): "7 dekabr 2026". */
  function day(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return '';
    var d = new Date(t + 4 * 3600e3);
    return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  var storage = {
    getItem: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    setItem: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    removeItem: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* private mode */ } },
  };

  function client() {
    if (!clientPromise) {
      clientPromise = fetch('/website/backend.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (cfg) {
        if (!window.supabase || typeof window.supabase.createClient !== 'function' || !cfg || typeof cfg.publishableKey !== 'string') throw new Error('config');
        publishableKey = cfg.publishableKey;
        return window.supabase.createClient(API, cfg.publishableKey, {
          auth: { storageKey: STORAGE_KEY, storage: storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
        });
      });
      clientPromise.catch(function () { clientPromise = null; });
    }
    return clientPromise;
  }

  /** Removes the OAuth return parameters (?code=…, error=…) after supabase-js has used them. */
  function cleanUrl() {
    try {
      var url = new URL(location.href);
      var changed = false;
      ['code', 'error', 'error_code', 'error_description', 'state'].forEach(function (k) { if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; } });
      if (url.hash && /access_token|error/.test(url.hash)) { url.hash = ''; changed = true; }
      if (changed) history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    } catch (e) { /* ignore */ }
  }
  var redirectError = null;
  (function () {
    try {
      var p = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
      if (p.get('error')) redirectError = p.get('error_description') || p.get('error');
    } catch (e) { /* ignore */ }
  })();

  async function session() {
    var c = await client();
    var res = await c.auth.getSession();
    cleanUrl();
    return res && res.data ? res.data.session : null;
  }

  function onChange(fn) {
    client().then(function (c) {
      c.auth.onAuthStateChange(function (event, s) {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') setTimeout(function () { fn(event, s); }, 0);
      });
    });
  }

  async function signOut() {
    var c = await client();
    try { await c.auth.signOut({ scope: 'local' }); } catch (e) { storage.removeItem(STORAGE_KEY); }
  }

  /** web-premium function. Business outcomes come back as {ok:false, error}; transport problems throw {code}. */
  async function call(action, body) {
    var c = await client();
    var res = await c.functions.invoke('web-premium', { body: Object.assign({ action: action }, body || {}) });
    if (res.error) {
      var status = res.error.context && res.error.context.status;
      var payload = null;
      try { payload = await res.error.context.json(); } catch (e) { payload = null; }
      var err = new Error('web_premium');
      err.code = status === 401 ? 'unauthorized' : (payload && payload.error) || 'unavailable';
      throw err;
    }
    return res.data || {};
  }

  async function needsVerification() {
    try {
      var c = await client();
      var res = await c.rpc('email_verification_state_v1');
      return !!(res.data && res.data.required === true);
    } catch (e) { return false; }
  }

  async function verification(body) {
    var c = await client();
    var res = await c.functions.invoke('email-verification', { body: Object.assign({ language: 'az' }, body) });
    var d = res.data;
    if (res.error) { try { d = await res.error.context.json(); } catch (e) { d = null; } }
    return d || { ok: false, error: 'send_failed' };
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────────────
  var toastTimer = null;
  function toast(text, isError) {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text;
    t.classList.toggle('err', !!isError);
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('on'); }, 3600);
  }

  // ── Login UI ──────────────────────────────────────────────────────────────────────────
  var GOOGLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.2-2.1 3.5-5.2 3.5-8.9z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>';
  var APPLE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.4 12.6c0-2.5 2.1-3.7 2.1-3.8-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.8zM14 5.3c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z"/></svg>';

  function authErrorText(error) {
    var m = String((error && (error.message || error.code)) || '').toLowerCase();
    var status = error && error.status;
    if (status === 429 || m.indexOf('rate') >= 0) return 'Çox cəhd edildi. Bir az sonra yenidən yoxla.';
    if (m.indexOf('invalid login') >= 0 || m.indexOf('invalid_credentials') >= 0) return 'E-poçt və ya şifrə yanlışdır.';
    if (m.indexOf('already registered') >= 0 || m.indexOf('already_exists') >= 0 || m.indexOf('user_already') >= 0) return 'Bu e-poçtla hesab artıq var. "Daxil ol" bölməsindən gir.';
    if (m.indexOf('password') >= 0 && (m.indexOf('least') >= 0 || m.indexOf('weak') >= 0 || m.indexOf('short') >= 0)) return 'Şifrə ən azı 6 simvol olmalıdır.';
    if (m.indexOf('email') >= 0 && m.indexOf('invalid') >= 0) return 'E-poçt ünvanını düzgün yaz.';
    if (m.indexOf('not confirmed') >= 0) return 'E-poçt hələ təsdiqlənməyib. Poçt qutunu yoxla.';
    return 'Daxil olmaq alınmadı. Yenidən cəhd et.';
  }

  /**
   * Renders the login card into `el`. opts: {title, subtitle}. Signing in fires onAuthStateChange (SIGNED_IN), which the
   * page handles; the card only shows progress and errors.
   */
  function renderLogin(el, opts) {
    opts = opts || {};
    var mode = 'login';
    var busy = false;
    function draw(message, kind) {
      var signup = mode === 'signup', forgot = mode === 'forgot';
      el.innerHTML =
        '<div class="auth">' +
        '<h2>' + esc(forgot ? 'Şifrəni bərpa et' : opts.title || 'Daxil ol') + '</h2>' +
        '<p class="sub">' + esc(forgot ? 'E-poçtuna şifrə bərpa linki göndərəcəyik.' : opts.subtitle || 'Anacan hesabınla daxil ol: tətbiqdəki eyni hesab.') + '</p>' +
        (message ? '<p class="msg ' + (kind || 'err') + '" role="alert">' + esc(message) + '</p>' : '') +
        (forgot ? '' :
          '<div class="social">' +
          '<button type="button" class="sbtn" data-google>' + GOOGLE_SVG + 'Google ilə davam et</button>' +
          '<button type="button" class="sbtn apple" data-apple>' + APPLE_SVG + 'Apple ilə davam et</button>' +
          '</div><div class="or">və ya e-poçt ilə</div>' +
          '<div class="tabs" role="tablist"><button type="button" role="tab" data-mode="login" aria-selected="' + (!signup) + '">Daxil ol</button>' +
          '<button type="button" role="tab" data-mode="signup" aria-selected="' + signup + '">Qeydiyyat</button></div>') +
        '<form novalidate>' +
        (signup ? '<label class="field"><span>Adın</span><input name="name" autocomplete="given-name" maxlength="80" required></label>' : '') +
        '<label class="field"><span>E-poçt</span><input name="email" type="email" inputmode="email" autocomplete="email" maxlength="254" required></label>' +
        (forgot ? '' : '<label class="field"><span>Şifrə</span><input name="password" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" minlength="6" maxlength="72" required></label>') +
        '<button class="cta" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? '<span class="spinner"></span>' : esc(forgot ? 'Link göndər' : signup ? 'Hesab yarat' : 'Daxil ol')) + '</button>' +
        '</form>' +
        '<div class="row" style="justify-content:center;margin-top:12px">' +
        (forgot ? '<button type="button" class="link" data-mode="login">Girişə qayıt</button>'
          : mode === 'login' ? '<button type="button" class="link" data-mode="forgot">Şifrəni unutmusan?</button>' : '') +
        '</div>' +
        '<p class="terms">Davam etməklə <a href="https://anacan.az/terms" target="_blank" rel="noopener">İstifadə şərtləri</a> və <a href="https://anacan.az/privacy" target="_blank" rel="noopener">Məxfilik siyasəti</a> ilə razılaşırsan.</p>' +
        '</div>';
      el.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); draw(); }); });
      var g = el.querySelector('[data-google]');
      if (g) g.addEventListener('click', google);
      var a = el.querySelector('[data-apple]');
      if (a) a.addEventListener('click', apple);
      el.querySelector('form').addEventListener('submit', submit);
    }

    async function google() {
      try {
        var c = await client();
        var res = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
        if (res.error) throw res.error;
      } catch (e) { draw('Google ilə giriş başlamadı. Yenidən cəhd et.'); }
    }

    function apple() {
      var nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      var width = 520, height = 700;
      var left = Math.max(0, (screen.width - width) / 2), top = Math.max(0, (screen.height - height) / 2);
      var popup = window.open(APPLE_BRIDGE + '?n=' + nonce, 'anacan-apple', 'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top);
      if (!popup) { draw('Brauzer yeni pəncərəni blokladı. Bu sayt üçün popup-lara icazə verib yenidən cəhd et.'); return; }
      var done = false;
      function finish() { done = true; window.removeEventListener('message', listen); clearInterval(watch); }
      async function listen(event) {
        if (event.origin !== API || event.source !== popup) return;
        var d = event.data;
        if (!d || typeof d !== 'object' || d.n !== nonce) return;
        if (d.type === 'anacan-apple-error') { finish(); draw(d.cancelled ? 'Apple ilə giriş ləğv edildi.' : 'Apple ilə giriş tamamlanmadı. Yenidən cəhd et.'); return; }
        if (d.type !== 'anacan-apple-session' || typeof d.access_token !== 'string' || typeof d.refresh_token !== 'string') return;
        finish();
        busy = true; draw();
        try {
          var c = await client();
          var res = await c.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
          if (res.error || !res.data.session) throw res.error || new Error('session');
        } catch (e) { busy = false; draw('Apple ilə giriş tamamlanmadı. Yenidən cəhd et.'); }
        try { popup.close(); } catch (e) { /* ignore */ }
      }
      window.addEventListener('message', listen);
      var watch = setInterval(function () { if (popup.closed && !done) finish(); }, 800);
    }

    async function submit(event) {
      event.preventDefault();
      if (busy) return;
      var form = event.target;
      var email = (form.email.value || '').trim().toLowerCase();
      var password = form.password ? form.password.value : '';
      var name = form.name && form.name.value ? form.name.value.trim().slice(0, 80) : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { draw('E-poçt ünvanını düzgün yaz.'); restore(); return; }
      if (mode !== 'forgot' && password.length < 6) { draw('Şifrə ən azı 6 simvol olmalıdır.'); restore(); return; }
      if (mode === 'signup' && name.length < 2) { draw('Adını yaz.'); restore(); return; }
      busy = true; draw(); restore();
      try {
        var c = await client();
        if (mode === 'forgot') {
          var r = await c.auth.resetPasswordForEmail(email, { redirectTo: API + '/reset-password' });
          if (r.error) throw r.error;
          busy = false; mode = 'login'; draw('Şifrə bərpa linki e-poçtuna göndərildi.', 'ok'); restore();
          return;
        }
        var res = mode === 'signup'
          ? await c.auth.signUp({ email: email, password: password, options: { data: { name: name, language: 'az' } } })
          : await c.auth.signInWithPassword({ email: email, password: password });
        if (res.error) throw res.error;
        if (!res.data.session) { busy = false; draw('Hesab yaradıldı. Davam etmək üçün e-poçtundakı linki aç.', 'ok'); return; }
        // Success: onAuthStateChange(SIGNED_IN) lets the page continue.
      } catch (e) {
        busy = false; draw(authErrorText(e)); restore();
      }
      function restore() { var f = el.querySelector('form'); if (f) { f.email.value = email; if (f.name) f.name.value = name; } }
    }

    draw(redirectError ? 'Giriş tamamlanmadı. Yenidən cəhd et.' : null);
    redirectError = null;
  }

  /** E-mail code step (the app's e-mail verification for new e-mail/password accounts). */
  function renderVerify(el, email, onDone) {
    var busy = false;
    function draw(message, kind) {
      el.innerHTML = '<div class="auth"><h2>E-poçtunu təsdiqlə</h2>' +
        '<p class="sub">' + (email ? '<b>' + esc(email) + '</b> ünvanına ' : 'E-poçtuna ') + '6 rəqəmli kod göndərdik.</p>' +
        (message ? '<p class="msg ' + (kind || 'err') + '" role="alert">' + esc(message) + '</p>' : '') +
        '<form novalidate><label class="field code"><span>Kod</span><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required></label>' +
        '<button class="cta" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? '<span class="spinner"></span>' : 'Təsdiqlə') + '</button></form>' +
        '<div class="row" style="justify-content:space-between;margin-top:12px"><button type="button" class="link" data-resend>Kodu yenidən göndər</button>' +
        '<button type="button" class="link" data-out>Başqa hesabla gir</button></div></div>';
      el.querySelector('[data-resend]').addEventListener('click', function () { send(true); });
      el.querySelector('[data-out]').addEventListener('click', function () { signOut(); });
      el.querySelector('form').addEventListener('submit', confirm);
      var input = el.querySelector('input[name="code"]');
      if (input) input.focus({ preventScroll: true });
    }
    async function send(manual) {
      var d = await verification({ action: 'send' });
      if (d.sent === true) { if (manual) draw('Yeni kod göndərildi.', 'ok'); return; }
      draw(d.error === 'rate_limited' ? 'Bir az gözlə və yenidən göndər' + (d.retry_in ? ' (' + d.retry_in + ' san).' : '.') : 'Kodu göndərmək alınmadı. Yenidən cəhd et.');
    }
    async function confirm(event) {
      event.preventDefault();
      var code = (event.target.code.value || '').replace(/\D/g, '');
      if (code.length !== 6) { draw('6 rəqəmli kodu yaz.'); return; }
      busy = true; draw();
      var d = await verification({ action: 'confirm', code: code });
      busy = false;
      if (d.verified === true) { onDone(); return; }
      draw(d.error === 'wrong_code' ? 'Kod yanlışdır.' : d.error === 'expired' ? 'Kodun vaxtı bitib. Yenisini göndər.'
        : d.error === 'too_many' ? 'Çox cəhd edildi. Yeni kod göndər.' : 'Təsdiqləmək alınmadı. Yenidən cəhd et.');
    }
    draw();
    send(false);
  }

  /** Header chip with the signed-in e-mail and a sign-out button. */
  function renderWho(el, s) {
    if (!el) return;
    if (!s) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    var email = (s.user && (s.user.email || (s.user.user_metadata && s.user.user_metadata.email))) || '';
    el.innerHTML = '<span class="email">' + esc(email) + '</span><button type="button">Çıxış</button>';
    el.querySelector('button').addEventListener('click', function () { signOut(); });
  }

  window.AnacanAccount = {
    API: API, SITE: SITE, client: client, session: session, onChange: onChange, signOut: signOut, call: call,
    needsVerification: needsVerification, renderLogin: renderLogin, renderVerify: renderVerify, renderWho: renderWho,
    toast: toast, esc: esc, money: money, day: day,
    key: function () { return publishableKey; },
  };
})();
