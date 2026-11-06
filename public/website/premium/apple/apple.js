/* Apple sign-in bridge for anacan.az. Sign in with Apple JS (Services ID com.atlasoon.anacan.signin) is registered
   only for https://api.anacan.az, so anacan.az opens this page (served from api.anacan.az) in a popup. Here the
   Apple popup returns an ID token (nonce-bound, state-checked, exactly like src/lib/apple-web-auth.ts), GoTrue
   exchanges it (signInWithIdToken), and the resulting access + refresh token go back to the opener with
   postMessage, addressed to https://anacan.az only. Nothing is stored on this origin (persistSession: false), so
   the app's own session on api.anacan.az is untouched; tokens never appear in URLs or logs. */
(function () {
  'use strict';
  var API = 'https://api.anacan.az';
  var OPENER_ORIGIN = 'https://anacan.az';
  var CLIENT_ID = 'com.atlasoon.anacan.signin';
  var REDIRECT_URI = API + '/auth/apple/callback';
  var SDK_URL = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
  var $ = function (id) { return document.getElementById(id); };
  var nonceParam = new URLSearchParams(location.search).get('n') || '';
  var opener = window.opener;
  var prepared = null;
  var running = false;

  function fail(text) { var e = $('error'); e.textContent = text; e.hidden = false; }
  function hex(bytes) { return Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
  function post(message) {
    // targetOrigin pins the receiver: if the opener is not anacan.az the browser drops the message.
    try { opener.postMessage(Object.assign({ n: nonceParam }, message), OPENER_ORIGIN); } catch (e) { /* opener gone */ }
  }

  if (location.origin !== API || !opener || opener === window || !/^[0-9a-f]{32}$/.test(nonceParam)) {
    fail('Bu səhifəni anacan.az saytındakı “Apple ilə davam et” düyməsi ilə aç.');
    $('label').textContent = 'Apple ilə davam et';
    return;
  }

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      if (window.AppleID && window.AppleID.auth) { resolve(); return; }
      var s = document.createElement('script');
      s.src = SDK_URL; s.async = true; s.referrerPolicy = 'no-referrer';
      var timer = setTimeout(function () { reject(new Error('sdk')); }, 15000);
      s.onload = function () { clearTimeout(timer); window.AppleID && window.AppleID.auth ? resolve() : reject(new Error('sdk')); };
      s.onerror = function () { clearTimeout(timer); reject(new Error('sdk')); };
      document.head.appendChild(s);
    });
  }

  async function prepare() {
    var cfg = await fetch('/website/backend.json', { cache: 'no-cache' }).then(function (r) { return r.json(); });
    if (!cfg || typeof cfg.publishableKey !== 'string' || !window.supabase) throw new Error('config');
    await loadSdk();
    var raw = hex(crypto.getRandomValues(new Uint8Array(32)));
    var hashed = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))));
    var client = window.supabase.createClient(API, cfg.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'anacan.apple-bridge.v1' },
    });
    prepared = { raw: raw, hashed: hashed, state: hex(crypto.getRandomValues(new Uint8Array(32))), client: client };
  }

  async function signIn() {
    if (running || !prepared) return;
    running = true;
    $('apple').disabled = true;
    $('error').hidden = true;
    var attempt = prepared;
    prepared = null; // one state / nonce per attempt
    try {
      window.AppleID.auth.init({ clientId: CLIENT_ID, redirectURI: REDIRECT_URI, scope: 'name email', state: attempt.state, nonce: attempt.hashed, usePopup: true });
      // No await before this call: the click's user activation must reach window.open().
      var response = await window.AppleID.auth.signIn();
      var auth = response && response.authorization;
      if (!auth || auth.state !== attempt.state || typeof auth.id_token !== 'string' || !auth.id_token || auth.id_token.length > 16384) throw new Error('response');
      $('label').textContent = 'Daxil olunur…';
      var res = await attempt.client.auth.signInWithIdToken({ provider: 'apple', token: auth.id_token, nonce: attempt.raw });
      if (res.error || !res.data || !res.data.session) throw new Error('exchange');
      var session = res.data.session;
      // Like the app: Apple sends the name only on the first login; it may fill the default profile name only.
      var name = [response.user && response.user.name && response.user.name.firstName, response.user && response.user.name && response.user.name.lastName]
        .filter(function (p) { return typeof p === 'string' && p.trim(); }).map(function (p) { return p.trim(); }).join(' ').slice(0, 150);
      if (name) {
        try { await attempt.client.from('profiles').update({ name: name }).eq('user_id', session.user.id).eq('name', 'İstifadəçi'); } catch (e) { /* optional */ }
      }
      post({ type: 'anacan-apple-session', access_token: session.access_token, refresh_token: session.refresh_token });
      $('text').textContent = 'Hazırdır. anacan.az səhifəsinə qayıdırsan…';
      $('apple').hidden = true;
      setTimeout(function () { window.close(); }, 400);
    } catch (e) {
      var code = e && e.error;
      var cancelled = code === 'popup_closed_by_user' || code === 'user_cancelled_authorize' || code === 'user_trigger_new_signin_flow';
      if (code === 'popup_blocked_by_browser') fail('Brauzer Apple pəncərəsini blokladı. Popup-lara icazə verib yenidən toxun.');
      else if (cancelled) fail('Apple ilə giriş ləğv edildi.');
      else fail('Apple ilə giriş tamamlanmadı. Yenidən cəhd et.');
      running = false;
      $('label').textContent = 'Hazırlanır…';
      prepare().then(ready, notReady);
    }
  }

  function ready() { $('apple').disabled = false; $('label').textContent = 'Apple ilə davam et'; }
  function notReady() { fail('Apple girişi hazırlana bilmədi. Bağlantını yoxlayıb səhifəni yenilə.'); }
  $('apple').addEventListener('click', signIn);
  // Errors stay here so the person can retry; closing the window tells anacan.az the attempt was cancelled.
  window.addEventListener('beforeunload', function () { if (!running) post({ type: 'anacan-apple-error', cancelled: true }); });
  prepare().then(ready, notReady);
})();
