/*!
 * Anacan Partner SDK v1 — sales tracking for Anacan partner stores.
 * https://app.anacan.az/sdk/anacan-partner.js · docs: docs/PARTNER_TRACKING_SDK.md
 *
 * 1. Every page (keeps the Anacan click for the attribution window):
 *    <script async src="https://app.anacan.az/sdk/anacan-partner.js" data-key="pk_…"></script>
 * 2. Thank-you page, after the order is created:
 *    <script>
 *      window.anacan = window.anacan || function () { (anacan.q = anacan.q || []).push(arguments); };
 *      anacan('order', { order_id: '100045', total: 31.98, currency: 'AZN',
 *                        items: [{ sku: '00-10023595', name: 'Siveno', quantity: 2, price: 15.99 }] });
 *    </script>
 * Optional: anacan('coupon', 'ANACAN10') before 'order', data-test="true" for test orders,
 *           anacan('click') returns the stored click token (for your server-to-server report).
 * No personal data is collected: only the click token, the order id, total and line items.
 */
(function () {
  'use strict';
  var ENDPOINT = 'https://api.anacan.az/functions/v1/partner-conversion';
  var PARAM = 'anacan_click';
  var STORE = '_anacan_click';
  var SENT = '_anacan_sent';
  var DAYS = 30;
  var TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

  var script = document.currentScript || (function () {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) if (/anacan-partner\.js/.test(all[i].src)) return all[i];
    return null;
  })();
  var key = script && script.getAttribute('data-key');
  var testMode = !!(script && script.getAttribute('data-test') === 'true');
  var coupon = null;

  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }

  // Cookie on the registrable domain (olivia.az, also for www. and sub-domains), localStorage as a backup.
  function rootDomain() {
    var parts = location.hostname.split('.');
    return parts.length > 2 ? parts.slice(-2).join('.') : location.hostname;
  }
  function writeClick(token) {
    var value = token + '.' + Date.now();
    safe(function () {
      document.cookie = STORE + '=' + value + ';max-age=' + DAYS * 86400 + ';path=/;SameSite=Lax' +
        (location.protocol === 'https:' ? ';Secure' : '') + (/\./.test(location.hostname) ? ';domain=' + rootDomain() : '');
    });
    safe(function () { localStorage.setItem(STORE, value); });
  }
  function readClick() {
    var raw = safe(function () {
      var m = document.cookie.match(new RegExp('(?:^|; )' + STORE + '=([^;]+)'));
      return m ? decodeURIComponent(m[1]) : null;
    }, null) || safe(function () { return localStorage.getItem(STORE); }, null);
    if (!raw) return null;
    var dot = raw.lastIndexOf('.');
    var token = dot > 0 ? raw.slice(0, dot) : raw;
    var at = dot > 0 ? Number(raw.slice(dot + 1)) : 0;
    if (!TOKEN.test(token) || (at && Date.now() - at > DAYS * 86400000)) return null;
    return token;
  }

  // The newest click wins (the visitor came back from Anacan again).
  var fromUrl = safe(function () { return new URLSearchParams(location.search).get(PARAM); }, null);
  if (fromUrl && TOKEN.test(fromUrl)) writeClick(fromUrl);

  function alreadySent(id) {
    return safe(function () { return (localStorage.getItem(SENT) || '').split('|').indexOf(id) >= 0; }, false);
  }
  function markSent(id) {
    safe(function () {
      var list = (localStorage.getItem(SENT) || '').split('|').filter(Boolean);
      list.push(id);
      localStorage.setItem(SENT, list.slice(-50).join('|'));
    });
  }

  function num(v) { var n = Number(String(v).replace(',', '.')); return isFinite(n) ? Math.round(n * 100) / 100 : undefined; }

  function sendOrder(order) {
    if (!key || !/^pk_[a-f0-9]{32}$/.test(key)) { if (window.console) console.warn('[anacan] data-key is missing or invalid'); return; }
    if (!order || order.order_id == null) return;
    var id = String(order.order_id).trim();
    var click = readClick();
    var code = order.coupon || coupon;
    if (!click && !code) return; // not a visitor from Anacan
    if (alreadySent(id)) return;
    var items = [];
    var list = Array.isArray(order.items) ? order.items.slice(0, 50) : [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i] || {};
      items.push({ sku: it.sku != null ? String(it.sku).slice(0, 64) : undefined, name: it.name != null ? String(it.name).slice(0, 160) : undefined,
        quantity: it.quantity != null ? Math.max(0, Math.floor(Number(it.quantity) || 0)) : undefined, price: it.price != null ? num(it.price) : undefined });
    }
    var body = JSON.stringify({ key: key, order: {
      order_id: id, total: num(order.total), currency: order.currency || 'AZN', items: items,
      click: click || undefined, coupon: code || undefined, test: testMode || !!order.test || undefined,
    } });
    markSent(id);
    // text/plain keeps this a "simple" request (no CORS preflight); keepalive lets it finish while the page unloads.
    var sent = safe(function () {
      fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, credentials: 'omit', mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
        .catch(function () { if (navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body); });
      return true;
    }, false);
    if (!sent && navigator.sendBeacon) navigator.sendBeacon(ENDPOINT, body);
  }

  function run(args) {
    var cmd = args[0];
    if (cmd === 'order') sendOrder(args[1]);
    else if (cmd === 'coupon' && typeof args[1] === 'string') coupon = args[1].trim().slice(0, 40);
    else if (cmd === 'click') return readClick();
    else if (cmd === 'key' && typeof args[1] === 'string') key = args[1];
  }

  var queued = window.anacan && window.anacan.q ? window.anacan.q : [];
  window.anacan = function () { return run(arguments); };
  window.anacan.version = '1.0.0';
  for (var i = 0; i < queued.length; i++) run(queued[i]);
})();
