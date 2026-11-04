/* anacan.az shop — PDF books (/az/kitablar/) and cakes (/az/tortlar/). Azerbaijani only.
   Catalogue: public read-only REST. Checkout: web-shop function → Epoint payment page.
   Prices are always recomputed on the server; this file only shows them. */
(function () {
  'use strict';
  var root = document.getElementById('anacan-shop');
  if (!root) return;
  var KIND = root.getAttribute('data-kind') === 'cakes' ? 'cakes' : 'books';
  var FN = 'https://api.anacan.az/functions/v1/web-shop';
  var CART_KEY = 'anacan_web_cart_' + KIND;
  var state = { items: [], filter: 'all', ready: false, cart: loadCart(), backend: null };

  // ---------- helpers ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function money(v) { var n = Math.round(v * 100) / 100; return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' ₼'; }
  function loadCart() { try { var v = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) { /* private mode */ } }
  function params() { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } }
  function lockScroll(on) { document.documentElement.style.overflow = on ? 'hidden' : ''; }

  // ---------- books ----------
  var AGES = [['all', 'Hamısı'], ['6m', '6 ay+'], ['1y', '1 yaş'], ['2y', '2 yaş'], ['3y', '3 yaş'], ['4y', '4 yaş'], ['5y', '5 yaş'], ['6y', '6 yaş']];
  function ageLabel(a) { for (var i = 0; i < AGES.length; i++) if (AGES[i][0] === a) return AGES[i][1]; return a; }
  function bookUnit(n) { return n >= 10 ? 2 : n >= 5 ? 2.6 : n >= 3 ? 3 : 4; }
  function bookTotal(n) { return Math.round(bookUnit(n) * n * 100) / 100; }
  function nextTier(n) { var t = [3, 5, 10]; for (var i = 0; i < t.length; i++) if (n < t[i]) return t[i]; return null; }
  function coverUrl(b) { var name = String(b.cover_path || '').split('/').pop(); return state.backend.url + '/storage/v1/object/public/book-covers/' + encodeURIComponent(name); }

  // ---------- cakes ----------
  var CATS = [['all', 'Hamısı'], ['month', 'Aylıq'], ['milestone', 'Xüsusi günlər'], ['pregnancy', 'Hamiləlik'], ['family', 'Ailə və bayram']];
  var FLAVORS = ['Vanil', 'Şokolad', 'Çiyələk', 'Karamel'];
  var PHOTO_BOX = { extra: 18, image: 'https://api.anacan.az/storage/v1/object/public/assets/cakes/cake-1793813000-pkg-foto-qutusu.jpg' };
  function catOf(c) { return ['month', 'milestone', 'pregnancy', 'family'].indexOf(c.category) >= 0 ? c.category : 'milestone'; }
  function isBento(c) { return c.category === 'month' || /bento/i.test(c.name || ''); }
  function cakeTag(c) { return c.category === 'month' && c.month_number ? (c.month_number === 12 ? '1 yaş' : c.month_number + '-ci ay') : (c.milestone_label || ''); }
  function specs(d) {
    var t = d || '', out = [];
    var s = t.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*sm\b/i); if (s) out.push(['ölçü', s[1].replace(/\s+/g, '') + ' sm']);
    var w = t.match(/(~?\s*\d+(?:[.,]\d+)?)\s*(kq|q)\b/i); if (w) out.push(['çəki', w[1].replace(/\s+/g, '') + ' ' + w[2]]);
    var p = t.match(/(\d+(?:\s*[–-]\s*\d+)?)\s*nəfər/i); if (p) out.push(['nəfərlik', p[1].replace(/\s+/g, '')]);
    return out;
  }
  function cakeUnit(line) { return Number(line.price) + (line.photo_box ? PHOTO_BOX.extra : 0); }
  function cartTotal() {
    if (KIND === 'books') return bookTotal(state.cart.length);
    return state.cart.reduce(function (s, l) { return s + cakeUnit(l) * l.qty; }, 0);
  }
  function cartCount() { return KIND === 'books' ? state.cart.length : state.cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  // ---------- data ----------
  function load() {
    return fetch('/website/backend.json', { credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (backend) {
      state.backend = backend;
      var q = KIND === 'books'
        ? '/rest/v1/book_catalog?select=id,age_group,title,subtitle,about,skills,pages,size_mb,cover_path&active=eq.true&order=sort_order'
        : '/rest/v1/cakes?select=id,name,description,price,image_url,category,month_number,milestone_label,milestone_type,has_custom_fields,custom_field_labels&is_active=eq.true&order=sort_order';
      var readiness = fetch(FN, { method: 'GET', credentials: 'omit' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      var items = fetch(backend.url + q, { credentials: 'omit', headers: { apikey: backend.publishableKey, Authorization: 'Bearer ' + backend.publishableKey } }).then(function (r) { return r.json(); });
      return Promise.all([items, readiness]);
    }).then(function (res) {
      state.items = Array.isArray(res[0]) ? res[0] : [];
      state.ready = !!(res[1] && res[1][KIND] && res[1][KIND].ready);
      var known = {}; state.items.forEach(function (i) { known[i.id] = i; });
      state.cart = state.cart.filter(function (l) { return KIND === 'books' ? known[l] : known[l.cake_id]; });
      if (KIND === 'cakes') state.cart.forEach(function (l) { var c = known[l.cake_id]; l.price = c.price; l.name = c.name; l.image_url = c.image_url; });
      saveCart(); render();
    }).catch(function () {
      root.textContent = '';
      root.appendChild(h('div', { class: 'shop-note bad' }, 'Kataloq yüklənmədi. Səhifəni yeniləyin və ya bir az sonra yenidən yoxlayın.'));
    });
  }

  // ---------- render ----------
  function hero() {
    var p = params(), status = p.get('odenis');
    var banner = status === 'ugurlu'
      ? h('div', { class: 'shop-note ok', role: 'status' }, KIND === 'books' ? 'Ödəniş qəbul olundu. PDF linkləri e-poçtunuza göndərildi; spam qovluğunu da yoxlayın.' : 'Ödəniş qəbul olundu. Qənnadı sifarişi təsdiqləyib sizə zəng edəcək.')
      : status === 'xeta' ? h('div', { class: 'shop-note bad', role: 'status' }, 'Ödəniş tamamlanmadı. Səbətiniz saxlanılıb, yenidən cəhd edə bilərsiniz.') : null;
    if (KIND === 'books') {
      var covers = state.items.slice(0, 3);
      return h('section', { class: 'shop-hero' },
        h('div', null,
          h('p', { class: 'site-eyebrow' }, 'Çap üçün PDF kitablar'),
          h('h1', null, 'Uşağınızın yaşına uyğun ', h('em', null, 'çap kitabları')),
          h('p', { class: 'lead' }, '6 aydan 6 yaşa qədər ' + state.items.length + ' kitab: boyama, say, hərflər, məntiq və nitq oyunları. Ödənişdən sonra PDF linkləri e-poçtunuza gəlir, evdə A4 vərəqə çap edirsiniz.'),
          h('div', { class: 'shop-tiers' },
            tier('1 kitab', '4 ₼'), tier('3 kitab', '3 ₼ / kitab'), tier('5 kitab', '2,60 ₼ / kitab'), tier('10+ kitab', '2 ₼ / kitab', true)),
          h('div', { class: 'shop-facts' }, h('span', null, 'A4, rəngli və ya ağ-qara'), h('span', null, 'Dərhal e-poçtla'), h('span', null, 'Kartla təhlükəsiz ödəniş')),
          banner),
        h('div', { class: 'shop-hero-art', 'aria-hidden': 'true' }, covers.map(function (b, i) {
          var img = h('img', { src: coverUrl(b), alt: '', loading: i ? 'lazy' : 'eager' });
          img.style.cssText = ['width:42%;left:8%;top:14%;transform:rotate(-6deg)', 'width:42%;left:30%;top:8%;z-index:2', 'width:42%;left:52%;top:16%;transform:rotate(6deg)'][i];
          return img;
        })));
    }
    var pics = state.items.filter(function (c) { return c.image_url; }).slice(0, 3);
    return h('section', { class: 'shop-hero' },
      h('div', null,
        h('p', { class: 'site-eyebrow' }, 'Anacan tortları'),
        h('h1', null, 'Körpənin hər ayı üçün ', h('em', null, 'bir tort')),
        h('p', { class: 'lead' }, 'Aylıq bento tortlar, 40 gün, ilk diş, 1 yaş və gender reveal tortları. Hamısı Anacan qutusunda, əl işi, pastel kremlə. Bakı daxili çatdırılma.'),
        h('div', { class: 'shop-facts' }, h('span', null, 'Ən azı 48 saat qabaqcadan'), h('span', null, '4 dad seçimi'), h('span', null, 'Çatdırılma və ya özün götür')),
        banner),
      h('div', { class: 'shop-hero-art', 'aria-hidden': 'true' }, pics.map(function (c, i) {
        var img = h('img', { src: c.image_url, alt: '', loading: i ? 'lazy' : 'eager' });
        img.style.cssText = ['width:52%;left:4%;top:8%;aspect-ratio:1', 'width:44%;right:4%;top:30%;aspect-ratio:1;z-index:2', 'width:36%;left:22%;bottom:4%;aspect-ratio:1'][i];
        return img;
      })));
  }
  function tier(a, b, best) { return h('div', { class: 'shop-tier' + (best ? ' best' : '') }, h('b', null, b), h('span', null, a)); }

  function filters() {
    var list = KIND === 'books' ? AGES : CATS.filter(function (c) { return c[0] === 'all' || state.items.some(function (i) { return catOf(i) === c[0]; }); });
    return h('div', { class: 'shop-chips', role: 'group', 'aria-label': KIND === 'books' ? 'Yaş' : 'Kateqoriya' }, list.map(function (f) {
      return h('button', { type: 'button', class: 'shop-chip' + (state.filter === f[0] ? ' on' : ''), 'aria-pressed': state.filter === f[0] ? 'true' : 'false', onclick: function () { state.filter = f[0]; render(); } }, f[1]);
    }));
  }

  function bookCard(b) {
    var inCart = state.cart.indexOf(b.id) >= 0;
    return h('article', { class: 'shop-card book' },
      h('button', { type: 'button', class: 'open', 'aria-label': b.title, onclick: function () { openBook(b); } },
        h('img', { src: coverUrl(b), alt: '', loading: 'lazy' }), h('span', { class: 'shop-tag' }, ageLabel(b.age_group))),
      h('div', { class: 'shop-card-body' },
        h('h3', null, b.title), b.subtitle ? h('p', null, b.subtitle) : null,
        h('div', { class: 'shop-card-foot' }, h('span', { class: 'shop-price' }, b.pages + ' səh.'),
          h('button', { type: 'button', class: 'shop-btn' + (inCart ? ' on' : ''), 'aria-pressed': inCart ? 'true' : 'false', onclick: function () { toggleBook(b.id); } }, inCart ? 'Səbətdə ✓' : 'Səbətə'))));
  }
  function cakeCard(c) {
    return h('article', { class: 'shop-card' },
      h('button', { type: 'button', class: 'open', 'aria-label': c.name, onclick: function () { openCake(c); } },
        c.image_url ? h('img', { src: c.image_url, alt: '', loading: 'lazy' }) : h('span', { class: 'shop-skeleton', style: 'display:block;min-height:220px' }),
        cakeTag(c) ? h('span', { class: 'shop-tag' }, cakeTag(c)) : null),
      h('div', { class: 'shop-card-body' },
        h('h3', null, c.name),
        h('div', { class: 'shop-card-foot' }, h('span', { class: 'shop-price' }, money(Number(c.price))),
          h('button', { type: 'button', class: 'shop-btn', onclick: function () { openCake(c); } }, 'Seç'))));
  }

  function render() {
    root.textContent = '';
    var list = state.items.filter(function (i) { return state.filter === 'all' || (KIND === 'books' ? i.age_group === state.filter : catOf(i) === state.filter); });
    var bar = h('div', { class: 'shop-bar' },
      h('h2', null, KIND === 'books' ? 'Kataloq' : 'Tortlar'), filters());
    var actions = null;
    if (KIND === 'books' && state.filter !== 'all') {
      var missing = list.filter(function (b) { return state.cart.indexOf(b.id) < 0; });
      if (missing.length) actions = h('div', { style: 'margin:-4px 0 16px' }, h('button', { type: 'button', class: 'shop-btn ghost', onclick: function () { missing.forEach(function (b) { state.cart.push(b.id); }); saveCart(); render(); } },
        ageLabel(state.filter) + ' kolleksiyası: ' + missing.length + ' kitabı əlavə et · ' + money(bookTotal(state.cart.length + missing.length) - bookTotal(state.cart.length))));
    }
    root.appendChild(h('div', { class: 'shop' }, hero(), bar, actions,
      list.length ? h('div', { class: 'shop-grid' }, list.map(KIND === 'books' ? bookCard : cakeCard)) : h('div', { class: 'shop-empty' }, 'Bu bölmədə hələ məhsul yoxdur.')));
    cartBar();
  }

  function cartBar() {
    var old = document.getElementById('shop-cartbar'); if (old) old.remove();
    var n = cartCount(); if (!n) return;
    var hint = '';
    if (KIND === 'books') { var t = nextTier(n); hint = t ? (t - n) + ' kitab da əlavə edin, hər biri ' + money(bookUnit(t)) + ' olsun' : 'Ən sərfəli qiymət: kitabı 2 ₼'; }
    else hint = 'Çatdırılma tarixi növbəti addımda seçilir';
    document.body.appendChild(h('div', { class: 'shop-cartbar', id: 'shop-cartbar' }, h('div', null,
      h('span', { class: 'sum' }, h('b', null, (KIND === 'books' ? n + ' kitab' : n + ' tort') + ' · ' + money(cartTotal())), h('small', null, hint)),
      h('button', { type: 'button', class: 'shop-btn', onclick: openCheckout }, 'Sifarişə keç'))));
  }

  function toggleBook(id) { var i = state.cart.indexOf(id); if (i >= 0) state.cart.splice(i, 1); else state.cart.push(id); saveCart(); render(); }

  // ---------- sheets ----------
  function sheet(title, content) {
    var close = function () { overlay.remove(); lockScroll(false); document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    var overlay = h('div', { class: 'shop-overlay', onclick: function (e) { if (e.target === overlay) close(); } },
      h('div', { class: 'shop-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'shop-sheet-head' }, h('h2', null, title), h('button', { type: 'button', class: 'shop-x', 'aria-label': 'Bağla', onclick: function () { close(); } }, '×')),
        content));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay); lockScroll(true);
    var first = overlay.querySelector('button, input'); if (first) first.focus();
    return close;
  }

  function openBook(b) {
    var inCart = state.cart.indexOf(b.id) >= 0, close;
    close = sheet(b.title, h('div', { class: 'shop-detail' },
      h('img', { src: coverUrl(b), alt: b.title }),
      h('div', null,
        h('p', { style: 'margin:0;color:var(--site-muted)' }, ageLabel(b.age_group) + (b.subtitle ? ' · ' + b.subtitle : '')),
        h('div', { class: 'shop-specs' }, h('span', null, h('b', null, b.pages + ' səhifə')), h('span', null, 'A4 PDF'), b.size_mb ? h('span', null, Math.round(b.size_mb) + ' MB') : null),
        b.about ? h('p', { style: 'line-height:1.6;margin:0 0 12px' }, b.about) : null,
        Array.isArray(b.skills) && b.skills.length ? h('div', { class: 'shop-chips', style: 'margin-bottom:16px' }, b.skills.map(function (s) { return h('span', { class: 'shop-chip', style: 'cursor:default' }, s); })) : null,
        h('button', { type: 'button', class: 'shop-btn wide' + (inCart ? ' on' : ''), onclick: function () { toggleBook(b.id); close(); } }, inCart ? 'Səbətdən çıxar' : 'Səbətə əlavə et'))));
  }

  function openCake(c) {
    var labels = c.has_custom_fields && Array.isArray(c.custom_field_labels) ? c.custom_field_labels : [];
    var pick = { flavor: FLAVORS[0], photo_box: false, qty: 1, fields: {} }, close;
    var priceBtn = h('button', { type: 'button', class: 'shop-btn wide' });
    function update() { priceBtn.textContent = 'Səbətə əlavə et · ' + money((Number(c.price) + (pick.photo_box ? PHOTO_BOX.extra : 0)) * pick.qty); }
    var flavorRow = h('div', { class: 'shop-chips' });
    function drawFlavors() { flavorRow.textContent = ''; FLAVORS.forEach(function (f) { flavorRow.appendChild(h('button', { type: 'button', class: 'shop-chip' + (pick.flavor === f ? ' on' : ''), onclick: function () { pick.flavor = f; drawFlavors(); } }, f)); }); }
    drawFlavors();
    var img = h('img', { src: c.image_url || '', alt: c.name });
    var upsell = isBento(c) ? h('button', { type: 'button', class: 'shop-upsell', 'aria-pressed': 'false', onclick: function () {
      pick.photo_box = !pick.photo_box; upsell.className = 'shop-upsell' + (pick.photo_box ? ' on' : ''); upsell.setAttribute('aria-pressed', String(pick.photo_box));
      img.src = pick.photo_box ? PHOTO_BOX.image : (c.image_url || ''); update(); } },
      h('img', { src: PHOTO_BOX.image, alt: '' }), h('span', { style: 'flex:1' }, h('b', { style: 'display:block' }, 'Foto qutusuna çevir'), h('span', { style: 'font-size:13px;color:var(--site-muted)' }, 'Bento + 6 kapkeyk bir pəncərəli qutuda')), h('b', null, '+' + money(PHOTO_BOX.extra))) : null;
    var qtyText = h('b', { style: 'min-width:24px;text-align:center' }, '1');
    var qty = h('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:14px' }, h('span', { class: 'shop-label', style: 'flex:1' }, 'Say'),
      h('button', { type: 'button', class: 'shop-btn ghost', 'aria-label': 'Azalt', onclick: function () { pick.qty = Math.max(1, pick.qty - 1); qtyText.textContent = pick.qty; update(); } }, '−'), qtyText,
      h('button', { type: 'button', class: 'shop-btn ghost', 'aria-label': 'Artır', onclick: function () { pick.qty = Math.min(5, pick.qty + 1); qtyText.textContent = pick.qty; update(); } }, '+'));
    var fieldEls = labels.map(function (label, i) {
      var id = 'shop-f-' + i, secret = /gizli/i.test(label);
      return h('div', { class: 'shop-field' }, h('label', { for: id }, label), h('input', { id: id, class: 'shop-input', type: secret ? 'password' : 'text', maxlength: '60', autocomplete: 'off', oninput: function (e) { pick.fields[label] = e.target.value; } }));
    });
    var story = String(c.description || '').replace(/\s*\d+(?:\s*[–-]\s*\d+)?\s*sm,?\s*~?\s*[\d.,]*\s*(?:kq|q)?,?\s*\d*(?:\s*[–-]\s*\d+)?\s*nəfərlik\.?/i, '').trim();
    priceBtn.addEventListener('click', function () {
      state.cart.push({ cake_id: c.id, name: c.name, price: c.price, image_url: c.image_url, flavor: pick.flavor, photo_box: pick.photo_box, qty: pick.qty, fields: pick.fields });
      saveCart(); close(); render();
    });
    update();
    close = sheet(c.name, h('div', { class: 'shop-detail' }, img,
      h('div', null,
        h('p', { class: 'shop-price', style: 'margin:0' }, money(Number(c.price))),
        h('div', { class: 'shop-specs' }, specs(c.description).map(function (s) { return h('span', null, h('b', null, s[1]), ' ' + s[0]); })),
        story ? h('p', { style: 'line-height:1.55;margin:0 0 12px;color:var(--site-muted)' }, story) : null,
        h('span', { class: 'shop-label' }, 'Dad'), flavorRow, fieldEls, upsell, qty,
        h('div', { style: 'margin-top:16px' }, priceBtn))));
  }

  function openCheckout() {
    var form = { name: '', email: '', phone: '', address: '', notes: '', mode: 'delivery', slot: '10:00–13:00', date: '' };
    var WD = ['B.', 'B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.'];
    var days = []; for (var i = 2; i < 14; i++) { var d = new Date(Date.now() + 4 * 3600000 + i * 86400000); days.push(d.toISOString().slice(0, 10)); }
    form.date = days[0];
    var list = h('div', null), total = h('div', { class: 'shop-total' }), msg = h('div', { role: 'status' });
    var pay = h('button', { type: 'button', class: 'shop-btn wide' });
    function drawList() {
      list.textContent = '';
      if (!state.cart.length) { close(); render(); return; }
      if (KIND === 'books') state.cart.forEach(function (id) {
        var b = state.items.filter(function (x) { return x.id === id; })[0]; if (!b) return;
        list.appendChild(h('div', { class: 'shop-row' }, h('img', { src: coverUrl(b), alt: '' }), h('div', { class: 't' }, h('b', null, b.title), h('span', null, ageLabel(b.age_group) + ' · ' + b.pages + ' səh.')),
          h('button', { type: 'button', class: 'shop-x', 'aria-label': 'Sil', onclick: function () { toggleBook(id); drawList(); } }, '×')));
      });
      else state.cart.forEach(function (l, idx) {
        var extra = [l.flavor, l.photo_box ? 'Foto qutusu' : null].concat(Object.keys(l.fields || {}).map(function (k) { return /gizli/i.test(k) ? '••••' : l.fields[k]; })).filter(Boolean).join(' · ');
        list.appendChild(h('div', { class: 'shop-row' }, l.image_url ? h('img', { src: l.image_url, alt: '' }) : null, h('div', { class: 't' }, h('b', null, l.name + ' ×' + l.qty), h('span', null, extra)),
          h('b', null, money(cakeUnit(l) * l.qty)), h('button', { type: 'button', class: 'shop-x', 'aria-label': 'Sil', onclick: function () { state.cart.splice(idx, 1); saveCart(); drawList(); render(); } }, '×')));
      });
      total.textContent = ''; total.appendChild(h('span', null, 'Cəmi')); total.appendChild(h('span', null, money(cartTotal())));
      pay.textContent = 'Kartla ödə · ' + money(cartTotal());
      pay.disabled = false;
    }
    function input(id, label, key, type, extra) {
      return h('div', { class: 'shop-field' }, h('label', { for: id }, label), h(type === 'textarea' ? 'textarea' : 'input', Object.assign({ id: id, class: 'shop-input', type: type === 'textarea' ? null : type, oninput: function (e) { form[key] = e.target.value; } }, extra || {})));
    }
    var cakeBlock = null;
    if (KIND === 'cakes') {
      var dayRow = h('div', { class: 'shop-days' }), slotRow = h('div', { class: 'shop-chips', style: 'margin-top:10px' }), modeRow = h('div', { class: 'shop-chips', style: 'margin-top:14px' });
      var addr = input('shop-addr', 'Çatdırılma ünvanı', 'address', 'text', { autocomplete: 'street-address', maxlength: '200' });
      var drawCake = function () {
        dayRow.textContent = ''; days.forEach(function (v) { var dt = new Date(v + 'T12:00:00Z'); dayRow.appendChild(h('button', { type: 'button', class: 'shop-day' + (form.date === v ? ' on' : ''), 'aria-pressed': String(form.date === v), onclick: function () { form.date = v; drawCake(); } }, h('b', null, String(dt.getUTCDate())), WD[dt.getUTCDay()])); });
        slotRow.textContent = ''; ['10:00–13:00', '14:00–18:00'].forEach(function (s) { slotRow.appendChild(h('button', { type: 'button', class: 'shop-chip' + (form.slot === s ? ' on' : ''), onclick: function () { form.slot = s; drawCake(); } }, s)); });
        modeRow.textContent = ''; [['delivery', 'Çatdırılma'], ['pickup', 'Özüm götürəcəm']].forEach(function (m) { modeRow.appendChild(h('button', { type: 'button', class: 'shop-chip' + (form.mode === m[0] ? ' on' : ''), onclick: function () { form.mode = m[0]; drawCake(); } }, m[1])); });
        addr.style.display = form.mode === 'delivery' ? '' : 'none';
      };
      drawCake();
      cakeBlock = h('div', null, h('p', { class: 'shop-label', style: 'margin:18px 0 8px' }, 'Nə vaxt?'), dayRow, slotRow, modeRow, addr);
    }
    pay.addEventListener('click', function () {
      msg.textContent = '';
      var body = { kind: KIND, name: form.name, email: form.email, phone: form.phone };
      if (KIND === 'books') body.book_ids = state.cart.slice();
      else { body.items = state.cart.map(function (l) { return { cake_id: l.cake_id, qty: l.qty, flavor: l.flavor, photo_box: !!l.photo_box, fields: l.fields || {} }; }); body.delivery_date = form.date; body.slot = form.slot; body.mode = form.mode; body.address = form.address; body.notes = form.notes; }
      if (!state.ready) { msg.appendChild(h('div', { class: 'shop-note bad' }, 'Ödəniş sistemi hələ aktiv deyil. Səbətiniz saxlanılıb; kart ödənişi aktivləşən kimi sifarişi tamamlaya bilərsiniz.')); return; }
      var problem = form.name.trim().length < 2 ? 'Adınızı yazın.' : !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(form.email.trim()) ? 'E-poçt ünvanını düzgün yazın.' : (KIND === 'cakes' && !/^\+?[0-9 ()-]{7,20}$/.test(form.phone.trim())) ? 'Telefon nömrəsini yazın.' : (KIND === 'cakes' && form.mode === 'delivery' && form.address.trim().length < 5) ? 'Çatdırılma ünvanını yazın.' : '';
      if (problem) { msg.appendChild(h('div', { class: 'shop-note bad' }, problem)); return; }
      pay.disabled = true; pay.textContent = 'Ödəniş səhifəsi açılır…';
      fetch(FN, { method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); })
        .then(function (res) {
          if (res.ok && res.body && /^https:\/\/([a-z0-9-]+\.)*epoint\.az\//.test(res.body.checkout_url || '')) { location.href = res.body.checkout_url; return; }
          var code = res.body && res.body.error;
          var text = code === 'payments_unavailable' || res.status === 503 ? 'Kartla ödəniş hələ aktiv deyil. Səbətiniz saxlanılıb.' : code === 'too_many_requests' ? 'Çox sayda sifariş cəhdi oldu. Bir saat sonra yenidən yoxlayın.' : code === 'invalid_date' ? 'Başqa tarix seçin (ən azı 48 saat sonra).' : 'Ödəniş başlamadı. Bir az sonra yenidən cəhd edin.';
          msg.appendChild(h('div', { class: 'shop-note bad' }, text)); drawList();
        })
        .catch(function () { msg.appendChild(h('div', { class: 'shop-note bad' }, 'Bağlantı alınmadı. İnterneti yoxlayıb yenidən cəhd edin.')); drawList(); });
    });
    var close = sheet('Sifariş', h('div', null, list, cakeBlock,
      input('shop-name', 'Adınız', 'name', 'text', { autocomplete: 'name', maxlength: '80' }),
      input('shop-email', KIND === 'books' ? 'E-poçt (PDF linkləri bura gələcək)' : 'E-poçt', 'email', 'email', { autocomplete: 'email', maxlength: '254' }),
      input('shop-phone', KIND === 'cakes' ? 'Telefon' : 'Telefon (istəyə bağlı)', 'phone', 'tel', { autocomplete: 'tel', maxlength: '24', placeholder: '+994 XX XXX XX XX' }),
      KIND === 'cakes' ? input('shop-notes', 'Qeyd (allergiya, xüsusi istək)', 'notes', 'textarea', { maxlength: '500' }) : null,
      total, msg, pay,
      h('p', { class: 'shop-fine' }, KIND === 'books'
        ? 'Ödəniş Epoint vasitəsilə. PDF-lər yalnız şəxsi istifadə üçündür. Eyni e-poçtla Anacan hesabınız varsa, kitablar tətbiqdə "Kitablarım"da da görünəcək.'
        : 'Ödəniş Epoint vasitəsilə. Ödənişdən sonra qənnadı sifarişi təsdiqləyib sizə zəng edəcək. 48 saatdan əvvəl ləğv pulsuzdur.')));
    drawList();
  }

  root.appendChild(h('div', { class: 'shop' }, h('div', { class: 'shop-skeleton', style: 'margin-top:40px;min-height:360px' })));
  load();
})();
