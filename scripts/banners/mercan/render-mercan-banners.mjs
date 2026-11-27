#!/usr/bin/env node
// Mərcan Cümə banners (2026-11-23): three designs × every page language, in the app size (1200×500, the in-app
// ImageBanner) and the website wide size (2240×320, shown 1120×160). No photos and no dark fields (owner feedback):
// brand coral, peach and white, the three characters and big type.
//   coral : coral field, white type, white CTA, characters on a peach hill, white −67% sticker
//   peach : peach field, charcoal type with coral accent, big coral price, coral CTA, characters
//   light : white field, big coral circle with −67% and the yearly price, coral CTA
// Copy: public/website/premium/mercan/copy/<lang>.json (b_tag, b_title with *accent*, b_sub_y, b_until, b_cta, sticker).
//   node scripts/banners/mercan/render-mercan-banners.mjs <outDir> [lang ...]
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const out = process.argv[2] || join(root, 'tmp-mercan-banners');
const copyDir = join(root, 'public/website/premium/mercan/copy');
const LANGS = ['az', 'en', 'ru', 'tr', 'kk', 'de', 'ar', 'uz', 'ka', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv'];
const langs = (process.argv.slice(3).length ? process.argv.slice(3) : LANGS).filter((l) => existsSync(join(copyDir, `${l}.json`)));
mkdirSync(out, { recursive: true });

const b64 = (p, type) => `data:${type};base64,${readFileSync(p).toString('base64')}`;
const ch = (n) => b64(join(root, 'public/website/characters', `${n}.webp`), 'image/webp');
const ART = { ritm: ch('ritm-success'), tum: ch('tumurcuq-success'), qucaq: ch('qucaq-success') };
const NOTO = { ru: 'Noto+Sans', kk: 'Noto+Sans', ka: 'Noto+Sans+Georgian', ar: 'Noto+Sans+Arabic', hi: 'Noto+Sans+Devanagari', zh: 'Noto+Sans+SC', ja: 'Noto+Sans+JP', ko: 'Noto+Sans+KR' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const P = { y: '$9.99', m: '$1.99', yw: '$29.99' };
const fill = (s) => String(s).replace(/\{(\w+)\}/g, (m, k) => P[k] ?? m);
// Prices and percentages stay left-to-right inside Arabic text.
const ltr = (html) => html.replace(/(\$[\d.]+|−\d+%)/g, '<bdi dir="ltr">$1</bdi>').replace(/(<bdi dir="ltr">\$[\d.]+<\/bdi> · <bdi dir="ltr">−\d+%<\/bdi>)/g, '<span class="nw">$1</span>');
const accent = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

const CORAL = '#ff5a5f', PEACH = '#ffe7e1', SEFTALI = '#fcdab0', INK = '#2a1f20', SOFT = '#786b63', CREAM = '#fff8f3';

function page(lang, design, wide) {
  const c = JSON.parse(readFileSync(join(copyDir, `${lang}.json`), 'utf8'));
  const rtl = lang === 'ar';
  const W = wide ? 2240 : 1200, H = wide ? 320 : 500;
  const side = rtl ? 'left' : 'right', start = rtl ? 'right' : 'left';
  const font = `'Plus Jakarta Sans'${NOTO[lang] ? `, '${NOTO[lang].replace(/\+/g, ' ')}'` : ''}, sans-serif`;
  const href = `https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800${NOTO[lang] ? `&family=${NOTO[lang]}:wght@500;600;700;800` : ''}&display=block`;
  const th = {
    coral: { bg: CORAL, ink: '#ffffff', em: SEFTALI, tagBg: 'rgba(255,255,255,.2)', tagInk: '#ffffff', ctaBg: '#ffffff', ctaInk: CORAL, sub: '#ffffff', until: 'rgba(255,255,255,.88)' },
    peach: { bg: PEACH, ink: INK, em: CORAL, tagBg: '#ffffff', tagInk: CORAL, ctaBg: CORAL, ctaInk: '#ffffff', sub: INK, until: SOFT },
    light: { bg: CREAM, ink: INK, em: CORAL, tagBg: PEACH, tagInk: '#c9333b', ctaBg: CORAL, ctaInk: '#ffffff', sub: INK, until: SOFT },
  }[design];
  const arrow = rtl ? '←' : '→';
  const price = `<p class="big"><b>${P.y}</b><s>${P.yw}</s></p>`;
  let art = '';
  if (design === 'coral') {
    art = `<div class="hill"></div><div class="trio"><img src="${ART.ritm}"><img class="mid" src="${ART.qucaq}"><img src="${ART.tum}"></div>
      <div class="stick"><b>−67%</b><span>${esc(c.sticker)}</span></div>`;
  } else if (design === 'peach') {
    art = `<div class="trio loose"><img src="${ART.ritm}"><img class="mid" src="${ART.tum}"><img src="${ART.qucaq}"></div>
      <div class="stick coral"><b>−67%</b><span>${esc(c.sticker)}</span></div>`;
  } else {
    art = `<div class="disc"><div class="disc-in"><b>−67%</b><span>${esc(c.sticker)} · <bdi dir="ltr">${P.y}</bdi></span></div></div>`;
  }
  const body = wide
    ? `<div class="copy wide"><div class="col"><span class="tag">${esc(c.b_tag)}</span><h1>${accent(c.b_title)}</h1></div>
        <div class="col mid">${design === 'peach' ? price : `<p class="sub">${ltr(esc(fill(c.b_sub_y)))}</p>`}<p class="until">${esc(c.b_until)}</p></div>
        <span class="cta">${esc(c.b_cta)} <i>${arrow}</i></span></div>`
    : `<div class="copy"><span class="tag">${esc(c.b_tag)}</span><h1>${accent(c.b_title)}</h1>
        ${design === 'peach' ? price : `<p class="sub">${ltr(esc(fill(c.b_sub_y)))}</p>`}
        <div class="row"><span class="cta">${esc(c.b_cta)} <i>${arrow}</i></span><span class="until">${esc(c.b_until)}</span></div></div>`;
  const artW = design === 'coral' ? (wide ? 780 : 560) : design === 'peach' ? (wide ? 720 : 500) : (wide ? 520 : 470);
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><link rel="stylesheet" href="${href}"><style>
*{box-sizing:border-box;margin:0}html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;background:${th.bg};color:${th.ink};font-family:${font};-webkit-font-smoothing:antialiased}
.hill{position:absolute;${side}:${wide ? -60 : -140}px;bottom:${wide ? -170 : -210}px;width:${wide ? 900 : 760}px;height:${wide ? 330 : 420}px;border-radius:50%;background:${PEACH}}
.trio{position:absolute;${side}:${wide ? 120 : 40}px;bottom:${wide ? -14 : -18}px;display:flex;align-items:flex-end;flex-direction:${rtl ? 'row-reverse' : 'row'}}
.trio img{width:190px;height:auto;margin:0 -16px}.trio img.mid{width:232px;position:relative;z-index:1}
.trio.loose{${side}:${wide ? 150 : 30}px}.trio.loose img{width:${wide ? 170 : 176}px;margin:0 -6px}.trio.loose img.mid{width:${wide ? 210 : 216}px}
.stick{position:absolute;${side}:${wide ? 30 : 34}px;top:${wide ? 22 : 30}px;width:${wide ? 128 : 136}px;height:${wide ? 128 : 136}px;border-radius:50%;background:#fff;color:${CORAL};display:grid;place-items:center;align-content:center;transform:rotate(${rtl ? -10 : 10}deg);text-align:center;z-index:3;box-shadow:0 10px 24px -14px rgba(201,51,59,.6)}
.stick.coral{background:${CORAL};color:#fff}
.stick b{display:block;font-size:${wide ? 42 : 44}px;font-weight:800;letter-spacing:-.05em;line-height:1;direction:ltr}.stick span{font-size:14px;font-weight:800;letter-spacing:.06em}
.disc{position:absolute;${side}:${wide ? 110 : 60}px;top:50%;transform:translateY(-50%);width:${wide ? 260 : 360}px;height:${wide ? 260 : 360}px;border-radius:50%;background:${CORAL};display:grid;place-items:center;box-shadow:0 0 0 ${wide ? 14 : 20}px ${PEACH}}
.disc-in{text-align:center;color:#fff}.disc-in b{display:block;font-size:${wide ? 86 : 116}px;font-weight:800;letter-spacing:-.06em;line-height:.9;direction:ltr}.disc-in span{display:block;margin-top:8px;font-size:${wide ? 22 : 28}px;font-weight:800;letter-spacing:.04em;direction:ltr}
.copy{position:absolute;${start}:${wide ? 72 : 64}px;${side}:${artW}px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:16px;z-index:2}
.tag{display:inline-flex;align-items:center;min-height:40px;padding:0 18px;border-radius:999px;background:${th.tagBg};color:${th.tagInk};font-size:22px;font-weight:700}
h1{font-size:${wide ? 76 : 96}px;font-weight:800;letter-spacing:-.06em;line-height:.92}h1 em{font-style:normal;color:${th.em};display:inline-block}
.sub{font-size:${wide ? 34 : 36}px;font-weight:700;letter-spacing:-.02em;line-height:1.15;color:${th.sub}}
.big{display:flex;align-items:baseline;gap:16px;direction:ltr}.big b{font-size:${wide ? 72 : 84}px;font-weight:800;letter-spacing:-.05em;color:${CORAL};line-height:.9}.big s{font-size:30px;color:${SOFT}}
.row{display:flex;align-items:center;gap:10px 16px;margin-top:6px;flex-wrap:wrap}
.cta{display:inline-flex;align-items:center;gap:10px;min-height:${wide ? 76 : 68}px;padding:0 30px;border-radius:999px;background:${th.ctaBg};color:${th.ctaInk};font-size:${wide ? 32 : 30}px;font-weight:800;white-space:nowrap;box-shadow:0 12px 26px -16px rgba(201,51,59,.7)}.cta i{font-style:normal}
.until{font-size:22px;font-weight:700;color:${th.until};white-space:nowrap}
.copy.wide{flex-direction:row;align-items:center;justify-content:space-between;gap:44px}
.copy.wide .col{display:flex;flex-direction:column;gap:12px;align-items:flex-start;max-width:820px}.copy.wide .col.mid{flex:1;min-width:380px}
.copy.wide .tag{font-size:20px;min-height:36px}.copy.wide .sub{font-size:30px}.copy.wide .col.mid{flex:1 1 auto;min-width:0}.copy.wide .cta{flex:none}.nw{white-space:nowrap}
</style></head><body>${art}${body}</body></html>`;
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium' });
const designs = ['coral', 'peach', 'light'];
const warnings = [];
for (const wide of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: wide ? 2240 : 1200, height: wide ? 320 : 500 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  for (const lang of langs) for (const d of designs) {
    await p.setContent(page(lang, d, wide), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    // Copy must not overflow the canvas or run into the art.
    const over = await p.evaluate(() => { const c = document.querySelector('.copy'); const r = c.getBoundingClientRect();
      return [...c.querySelectorAll('h1,.sub,.cta,.tag,.big,.until')].some((e) => { const b = e.getBoundingClientRect(); return b.right > r.right + 2 || b.left < r.left - 2 || b.bottom > innerHeight || b.top < 0; }) || c.scrollHeight > c.clientHeight + 2; });
    if (over) warnings.push(`${d}-${lang}${wide ? '-wide' : ''}`);
    await p.screenshot({ path: join(out, `${d}-${lang}${wide ? '-wide' : ''}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log('rendered', langs.length * designs.length * 2, 'banners to', out);
if (warnings.length) console.log('OVERFLOW:', warnings.join(' '));
