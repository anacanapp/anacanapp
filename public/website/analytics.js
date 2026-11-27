/* Google Analytics 4 for anacan.az (G-QR8KPLJFBE) with Google Consent Mode v2.
   Owner decision 2026-11-14: website analytics is on by default (legitimate interest, opt-out), so every visit and
   App Store / Google Play click is counted. Visitors in the EEA, UK and Switzerland (by device time zone) still need
   consent: analytics_storage stays denied there until they press "Accept" (privacy policy §5, v1.1).
   "Only necessary" (or the Global Privacy Control signal) turns analytics off; the choice is shared by every
   anacan.az page via localStorage. Advertising storage is always denied (no ads on the website).
   window.anacanAnalytics.track(name, params) is the single entry point for events. */
(function () {
  'use strict';
  if (window.anacanAnalytics) return;
  var ID = 'G-QR8KPLJFBE', KEY = 'anacan_consent_v1';
  var SIX_MONTHS = 183 * 24 * 3600 * 1000;
  // Stored as "granted|<ms>" / "denied|<ms>"; a choice older than 6 months is asked again (privacy policy §5).
  var read = function () {
    try {
      var raw = localStorage.getItem(KEY); if (!raw) return null;
      var parts = raw.split('|'), at = Number(parts[1] || 0);
      if (!at || Date.now() - at > SIX_MONTHS) { localStorage.removeItem(KEY); return null; }
      return parts[0];
    } catch (e) { return null; }
  };
  var write = function (value) { try { localStorage.setItem(KEY, value + '|' + Date.now()); } catch (e) { /* private mode */ } };
  // Global Privacy Control: treated as refusing non-essential cookies (no banner, analytics stays denied).
  if (navigator.globalPrivacyControl === true && !read()) write('denied');
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  var choice = read();
  // EEA (EU + IS, LI, NO), United Kingdom and Switzerland: consent first. Detected from the device time zone, because
  // gtag's region-specific consent defaults were applied to every visitor in testing (2026-11-14).
  var CONSENT_FIRST_TZ = ['Europe/Vienna', 'Europe/Brussels', 'Europe/Sofia', 'Europe/Zagreb', 'Asia/Nicosia', 'Asia/Famagusta',
    'Europe/Nicosia', 'Europe/Prague', 'Europe/Copenhagen', 'Europe/Tallinn', 'Europe/Helsinki', 'Europe/Mariehamn', 'Europe/Paris',
    'Europe/Berlin', 'Europe/Busingen', 'Europe/Athens', 'Europe/Budapest', 'Europe/Dublin', 'Europe/Rome', 'Europe/Riga',
    'Europe/Vilnius', 'Europe/Luxembourg', 'Europe/Malta', 'Europe/Amsterdam', 'Europe/Warsaw', 'Europe/Lisbon', 'Atlantic/Madeira',
    'Atlantic/Azores', 'Europe/Bucharest', 'Europe/Bratislava', 'Europe/Ljubljana', 'Europe/Madrid', 'Africa/Ceuta',
    'Atlantic/Canary', 'Europe/Stockholm', 'Atlantic/Reykjavik', 'Europe/Vaduz', 'Europe/Oslo', 'Arctic/Longyearbyen',
    'Europe/London', 'Europe/Belfast', 'Europe/Guernsey', 'Europe/Jersey', 'Europe/Isle_of_Man', 'Europe/Zurich'];
  var zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
  var consentFirst = CONSENT_FIRST_TZ.indexOf(zone) !== -1;
  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: choice === 'granted' ? 'granted' : choice === 'denied' || consentFirst ? 'denied' : 'granted',
    functionality_storage: 'granted', security_storage: 'granted', wait_for_update: 500,
  });
  gtag('set', 'ads_data_redaction', true);
  gtag('set', 'url_passthrough', false);
  gtag('js', new Date());
  gtag('config', ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);

  // SPA navigation on the website: report each client-side route change once.
  var last = location.pathname + location.search;
  var report = function () {
    var now = location.pathname + location.search;
    if (now === last) return; last = now;
    gtag('event', 'page_view', { page_location: location.href, page_path: now, page_title: document.title });
  };
  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    history[name] = function () { var result = original.apply(this, arguments); setTimeout(report, 0); return result; };
  });
  window.addEventListener('popstate', report);

  var TEXT = {
    az: ['Saytı yaxşılaşdırmaq üçün analitik kukilərdən istifadə edirik. Razısınız?', 'Qəbul et', 'Yalnız zəruri', 'Ətraflı'],
    en: ['We use analytics cookies to improve the site. Do you agree?', 'Accept', 'Only necessary', 'Details'],
    ru: ['Мы используем аналитические cookie, чтобы улучшать сайт. Вы согласны?', 'Принять', 'Только необходимые', 'Подробнее'],
    tr: ['Siteyi geliştirmek için analitik çerezler kullanıyoruz. Kabul ediyor musunuz?', 'Kabul et', 'Yalnızca gerekli', 'Ayrıntılar'],
    kk: ['Сайтты жақсарту үшін аналитикалық cookie файлдарын қолданамыз. Келісесіз бе?', 'Қабылдау', 'Тек қажеттілері', 'Толығырақ'],
    de: ['Wir verwenden Analyse-Cookies, um die Website zu verbessern. Sind Sie einverstanden?', 'Akzeptieren', 'Nur notwendige', 'Details'],
    ar: ['نستخدم ملفات تعريف الارتباط التحليلية لتحسين الموقع. هل توافق؟', 'قبول', 'الضرورية فقط', 'التفاصيل'],
    uz: ['Saytni yaxshilash uchun analitik cookie fayllaridan foydalanamiz. Rozimisiz?', 'Qabul qilish', 'Faqat zarurlari', 'Batafsil'],
    ka: ['საიტის გასაუმჯობესებლად ვიყენებთ ანალიტიკურ ქუქი-ფაილებს. ეთანხმებით?', 'მიღება', 'მხოლოდ აუცილებელი', 'დეტალები'],
    zh: ['我们使用分析 Cookie 来改进网站。您同意吗？', '接受', '仅必要', '详情'],
    id: ['Kami menggunakan cookie analitik untuk meningkatkan situs. Apakah Anda setuju?', 'Terima', 'Hanya yang penting', 'Detail'],
    fr: ['Nous utilisons des cookies analytiques pour améliorer le site. Acceptez-vous ?', 'Accepter', 'Uniquement nécessaires', 'Détails'],
    es: ['Usamos cookies analíticas para mejorar el sitio. ¿Está de acuerdo?', 'Aceptar', 'Solo necesarias', 'Detalles'],
    pt: ['Usamos cookies analíticos para melhorar o site. Você concorda?', 'Aceitar', 'Somente necessários', 'Detalhes'],
    vi: ['Chúng tôi dùng cookie phân tích để cải thiện trang web. Bạn có đồng ý không?', 'Chấp nhận', 'Chỉ cần thiết', 'Chi tiết'],
    hi: ['साइट को बेहतर बनाने के लिए हम एनालिटिक्स कुकीज़ का उपयोग करते हैं। क्या आप सहमत हैं?', 'स्वीकार करें', 'केवल आवश्यक', 'विवरण'],
    ja: ['サイト改善のため分析用 Cookie を使用しています。同意しますか？', '同意する', '必要なもののみ', '詳細'],
    ko: ['사이트 개선을 위해 분석 쿠키를 사용합니다. 동의하시겠습니까?', '동의', '필수만', '자세히'],
    pl: ['Używamy analitycznych plików cookie, aby ulepszać stronę. Czy się zgadzasz?', 'Akceptuję', 'Tylko niezbędne', 'Szczegóły'],
    nl: ['We gebruiken analytische cookies om de site te verbeteren. Gaat u akkoord?', 'Accepteren', 'Alleen noodzakelijk', 'Details'],
    sv: ['Vi använder analyscookies för att förbättra webbplatsen. Godkänner du?', 'Godkänn', 'Endast nödvändiga', 'Detaljer'],
  };
  var PRIVACY = { az: '/az/mexfilik-siyaseti/', en: '/en/privacy-policy/' };
  function decide(value) {
    write(value);
    gtag('consent', 'update', { analytics_storage: value === 'granted' ? 'granted' : 'denied' });
    var bar = document.getElementById('anacan-consent'); if (bar) bar.remove();
  }
  function banner() {
    if (read() || document.getElementById('anacan-consent')) return;
    var lang = (document.documentElement.lang || 'az').slice(0, 2), t = TEXT[lang] || TEXT.en;
    var bar = document.createElement('div');
    bar.id = 'anacan-consent'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-live', 'polite');
    bar.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:560px;margin:0 auto;background:#fff;color:#333;border:1px solid rgba(51,51,51,.12);border-radius:18px;box-shadow:0 18px 40px -18px rgba(0,0,0,.35);padding:14px 16px;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-wrap:wrap;align-items:center;gap:10px';
    var p = document.createElement('p'); p.style.cssText = 'margin:0;flex:1 1 260px';
    p.textContent = t[0] + ' ';
    var a = document.createElement('a'); a.href = PRIVACY[lang] || '/' + lang + '/'; a.textContent = t[3]; a.style.cssText = 'color:#bd353d;font-weight:600';
    if (PRIVACY[lang]) p.appendChild(a);
    var actions = document.createElement('div'); actions.style.cssText = 'display:flex;gap:8px;flex:0 0 auto;margin-left:auto';
    var btn = function (label, primary, value) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.style.cssText = 'cursor:pointer;border-radius:999px;padding:9px 16px;font:600 13px system-ui,sans-serif;border:1px solid ' + (primary ? '#ff5a5f;background:#ff5a5f;color:#fff' : 'rgba(51,51,51,.2);background:#fff;color:#333');
      b.addEventListener('click', function () { decide(value); }); return b;
    };
    actions.appendChild(btn(t[2], false, 'denied')); actions.appendChild(btn(t[1], true, 'granted'));
    bar.appendChild(p); bar.appendChild(actions); document.body.appendChild(bar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(banner, 600); });
  else setTimeout(banner, 600);

  // Store links with install attribution (2026-11-14). Static pages mark links with data-store="ios|android" and
  // data-store-placement="<where>"; the href gets the App Store campaign (ct, pt) or Google Play referrer (utm_*),
  // and every click sends GA4 `store_click`. Same scheme as src/website/store-links.ts.
  var APPLE_PROVIDER_TOKEN = '';
  var storeCampaign = function (placement) {
    var slug = String(placement || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
    return ('web_' + slug).slice(0, 80);
  };
  var storeLang = function () { return (document.documentElement.lang || 'az').slice(0, 2); };
  var storeUrl = function (store, placement, lang) {
    var campaign = storeCampaign(placement);
    if (store === 'ios') return 'https://apps.apple.com/app/anacan/id6758301924?' + (APPLE_PROVIDER_TOKEN ? 'pt=' + APPLE_PROVIDER_TOKEN + '&' : '') + 'ct=' + campaign + '&mt=8';
    var ref = 'utm_source=anacan.az&utm_medium=website&utm_campaign=' + campaign + '&utm_content=' + encodeURIComponent(lang || storeLang());
    return 'https://play.google.com/store/apps/details?id=com.atlasoon.anacan&referrer=' + encodeURIComponent(ref);
  };
  var decorate = function (link) {
    var store = link.getAttribute('data-store'), placement = link.getAttribute('data-store-placement');
    if ((store !== 'ios' && store !== 'android') || !placement) return null;
    link.href = storeUrl(store, placement);
    return { store: store, placement: placement };
  };
  var decorateAll = function () { try { Array.prototype.forEach.call(document.querySelectorAll('a[data-store][data-store-placement]'), decorate); } catch (e) { /* old browser */ } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorateAll); else decorateAll();
  var onStoreClick = function (event) {
    var link = event.target && event.target.closest ? event.target.closest('a[data-store][data-store-placement]') : null;
    if (!link) return;
    var info = decorate(link); if (!info) return;
    gtag('event', 'store_click', { store: info.store, link_campaign: storeCampaign(info.placement), placement: info.placement,
      page_type: 'static', language: storeLang(), link_url: link.href, transport_type: 'beacon' });
  };
  document.addEventListener('click', onStoreClick, true);
  document.addEventListener('auxclick', onStoreClick, true);

  window.anacanAnalytics = {
    storeUrl: storeUrl,
    decorateStoreLinks: decorateAll,
    track: function (name, params) { try { gtag('event', name, params || {}); } catch (e) { /* never break the page */ } },
    consent: function () { return read(); },
    reopen: function () { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } banner(); },
  };
})();
