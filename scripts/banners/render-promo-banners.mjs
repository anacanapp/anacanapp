#!/usr/bin/env node
/**
 * Renders in-app promo banners (image banners for the `banners` table) from a JSON spec.
 *
 *   node scripts/banners/render-promo-banners.mjs <spec.json> <outDir>
 *
 * Output: one 1200x500 (2.4:1) PNG per banner (upload converts to WebP), plus contact.png (all banners on a
 * phone-width preview). The app's ImageBanner renders `w-full h-auto` inside a rounded,
 * shadowed button, so creatives are full-bleed (no own corners or border) and keep text
 * large enough for a 343px-wide phone column (scale ~0.29: 72px title ~ 21px on screen).
 *
 * Spec: { "banners": [ { "id", "layout": "split"|"trio"|"fan"|"row"|"card"|"bold"|"scene",
 *   "bg", "ink", "accent", "badge", "focus", "veil": [solid%, clear%], "eyebrow", "title", "sub", "cta", "images": [url-or-path, ...] } ] }
 * Images may be https URLs (fetched by Node, so hosts the browser cannot reach still work)
 * or local paths; they are inlined as data URIs. See docs/APP_PROMO_BANNERS.md.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [specPath, outDir] = process.argv.slice(2);
if (!specPath || !outDir) { console.error('usage: render-promo-banners.mjs <spec.json> <outDir>'); process.exit(2); }
const W = 1200, H = 500;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const spec = JSON.parse(await readFile(specPath, 'utf8'));
await mkdir(outDir, { recursive: true });

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
async function dataUri(source) {
  if (/^https:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`image ${response.status}: ${source}`);
    const type = response.headers.get('content-type') || MIME[extname(new URL(source).pathname).toLowerCase()] || 'image/jpeg';
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
  }
  const path = resolve(dirname(specPath), source);
  return `data:${MIME[extname(path).toLowerCase()] || 'application/octet-stream'};base64,${(await readFile(path)).toString('base64')}`;
}
const font = async (file) => dataUri(join(root, 'public/website/fonts', file));
const fonts = `
@font-face{font-family:Jakarta;font-weight:200 800;src:url(${await font('jakarta-normal-latin.woff2')}) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:Jakarta;font-weight:200 800;src:url(${await font('jakarta-normal-latin-ext.woff2')}) format('woff2')}
@font-face{font-family:Switzer;font-weight:400;src:url(${await font('switzer-400.woff2')}) format('woff2')}
@font-face{font-family:Switzer;font-weight:500;src:url(${await font('switzer-500.woff2')}) format('woff2')}`;
const mark = await dataUri(join(root, 'public/website/brand-mark-coral.png'));
const esc = (text = '') => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function art(layout, imgs, banner = {}) {
  const i = (n, cls) => imgs[n] ? `<img class="${cls}" src="${imgs[n]}" alt="">` : '';
  if (layout === 'split' || layout === 'bold') return `<div class="art split">${i(0, 'photo')}</div>`;
  if (layout === 'trio') return `<div class="art trio">${i(0, 't0')}${i(1, 't1')}${i(2, 't2')}</div>`;
  if (layout === 'fan') return `<div class="art fan">${i(0, 'f0')}${i(2, 'f2')}${i(1, 'f1')}</div>`;
  if (layout === 'scene') return `<img class="scene-img" src="${imgs[0]}" alt=""><div class="veil"></div>`;
  if (layout === 'card') return `<div class="art card"><span class="halo"></span>${i(0, 'c0')}</div>`;
  if (layout === 'row') return `<div class="art row">${imgs.slice(0, 4).map((src) => `<img src="${src}" alt="">`).join('')}</div>`;
  throw new Error('unknown layout ' + layout);
}
const hexa = (hex, alpha) => { const n = parseInt(String(hex).replace('#', ''), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`; };
function page(banner, imgs) {
  const bold = banner.layout === 'bold';
  const bg = banner.bg || (bold ? '#ff5a5f' : '#fff3ef'), ink = banner.ink || (bold ? '#ffffff' : '#2f2724'), accent = banner.accent || (bold ? '#ffffff' : '#d8434a');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{background:${bg};color:${ink};font-family:Switzer,sans-serif;position:relative}
.copy{position:absolute;left:64px;top:0;bottom:0;width:${banner.layout === 'row' ? 600 : 640}px;display:flex;flex-direction:column;justify-content:center;gap:0;z-index:2}
.brand{display:flex;align-items:center;gap:12px;font:600 30px/1 Jakarta,sans-serif;letter-spacing:-.04em;color:${bold ? '#fff' : '#ff5a5f'};margin-bottom:26px}
.brand img{width:40px;height:40px}
.eyebrow{font:500 30px/1.2 Switzer,sans-serif;color:${bold ? 'rgba(255,255,255,.85)' : banner.ink ? hexa(ink, .75) : '#8a7a72'};margin-bottom:12px}
h1{font:600 74px/1.04 Jakarta,sans-serif;letter-spacing:-.045em;text-wrap:balance}
h1 em{font-style:normal;color:${accent}}
.sub{margin-top:18px;font:400 38px/1.25 Switzer,sans-serif;color:${bold ? 'rgba(255,255,255,.92)' : banner.ink ? hexa(ink, .82) : '#6f625b'}}
.cta{margin-top:30px;align-self:flex-start;display:inline-flex;align-items:center;gap:14px;padding:18px 34px;border-radius:999px;font:500 36px/1 Switzer,sans-serif;background:${bold ? '#fff' : '#ff5a5f'};color:${bold ? '#c23a41' : '#fff'}}
.cta::after{content:"";width:16px;height:16px;border-top:4px solid currentColor;border-right:4px solid currentColor;transform:rotate(45deg);margin-left:-2px}
.art{position:absolute;top:0;right:0;bottom:0;width:${W - 700}px}
.split .photo{position:absolute;right:0;top:0;width:100%;height:100%;object-fit:cover;${bold ? '' : 'border-radius:0 0 0 0;'}-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 22%);mask-image:linear-gradient(90deg,transparent 0,#000 22%)}
.trio img{position:absolute;width:280px;height:280px;object-fit:cover;border-radius:50%;border:10px solid ${bg};box-shadow:0 24px 40px -24px rgba(60,25,20,.45)}
.trio .t0{right:250px;top:30px}.trio .t1{right:40px;top:110px;width:310px;height:310px;z-index:2}.trio .t2{right:330px;bottom:10px;width:200px;height:200px}
.fan img{position:absolute;width:250px;border-radius:18px;box-shadow:0 26px 44px -22px rgba(60,25,20,.5)}
.fan .f0{right:300px;top:70px;transform:rotate(-8deg)}.fan .f1{right:150px;top:40px;z-index:3;width:270px}.fan .f2{right:20px;top:80px;transform:rotate(8deg)}
.row{display:flex;align-items:center;justify-content:flex-end;gap:18px;padding-right:48px;width:${W - 660}px}
.card .halo{position:absolute;right:70px;top:50%;width:360px;height:360px;margin-top:-180px;border-radius:50%;background:rgba(255,255,255,.7)}.card .c0{position:absolute;right:120px;top:50%;width:270px;transform:translateY(-50%) rotate(4deg);border-radius:18px;box-shadow:0 30px 50px -24px rgba(60,25,20,.55)}
.scene-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${banner.focus || 'right center'}}
.veil{position:absolute;inset:0;background:linear-gradient(90deg,${bg} 0%,${bg} ${(banner.veil || [34, 66])[0]}%,${hexa(bg, .75)} ${((banner.veil || [34, 66])[0] + (banner.veil || [34, 66])[1]) / 2}%,${hexa(bg, 0)} ${(banner.veil || [34, 66])[1]}%)}
.badge{align-self:flex-start;display:inline-flex;align-items:center;gap:10px;padding:9px 18px 9px 14px;border-radius:999px;margin-bottom:20px;font:600 26px/1 Jakarta,sans-serif;letter-spacing:.02em;color:#7a4b00;background:linear-gradient(135deg,#ffe7a3,#f6c453)}
.badge svg{width:26px;height:26px}
.row img{width:136px;border-radius:14px;box-shadow:0 18px 30px -18px rgba(60,25,20,.45)}
.row img:nth-child(odd){transform:translateY(-22px)}.row img:nth-child(even){transform:translateY(22px)}
</style></head><body>
<div class="copy">
  ${banner.badge ? '' : `<div class="brand">${bold ? '' : `<img src="${mark}" alt="">`}anacan</div>`}
  ${banner.badge ? `<span class="badge"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z"/></svg>${esc(banner.badge)}</span>` : ''}
  ${banner.eyebrow ? `<p class="eyebrow">${esc(banner.eyebrow)}</p>` : ''}
  <h1>${esc(banner.title).replace(/\*(.+?)\*/g, '<em>$1</em>')}</h1>
  ${banner.sub ? `<p class="sub">${esc(banner.sub)}</p>` : ''}
  ${banner.cta ? `<span class="cta">${esc(banner.cta)}</span>` : ''}
</div>
${art(banner.layout, imgs, banner)}
</body></html>`;
}

// Uses the repo's Playwright; PLAYWRIGHT_CHROMIUM may point at a preinstalled browser binary.
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const results = [];
for (const banner of spec.banners) {
  const imgs = await Promise.all((banner.images || []).map(dataUri));
  const tab = await context.newPage();
  await tab.setContent(page(banner, imgs), { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const overflow = await tab.evaluate(() => { const c = document.querySelector('.copy'); return c.scrollHeight > c.clientHeight + 1 || [...c.children].some((el) => el.scrollWidth > el.clientWidth + 1); });
  if (overflow) console.warn(`WARN ${banner.id}: text overflows its box, shorten the copy`);
  const png = join(outDir, `${banner.id}.png`);
  await tab.screenshot({ path: png, type: 'png' });
  results.push({ id: banner.id, png });
  await tab.close();
}
// Contact sheet: every banner as it appears in a 375pt phone column (343px wide, rounded, shadowed).
const sheet = await browser.newPage({ viewport: { width: 375, height: 200 }, deviceScaleFactor: 2 });
const cards = await Promise.all(results.map(async (r) => `<figure><img src="${await dataUri(r.png)}"><figcaption>${esc(r.id)}</figcaption></figure>`));
await sheet.setContent(`<!doctype html><html><head><style>${fonts}body{margin:0;padding:16px;background:#faf7f5;font:500 12px Switzer,sans-serif;color:#6f625b}figure{margin:0 0 18px}img{display:block;width:343px;border-radius:16px;box-shadow:0 10px 15px -3px rgba(0,0,0,.1),0 4px 6px -4px rgba(0,0,0,.1)}figcaption{margin-top:6px}</style></head><body>${cards.join('')}</body></html>`, { waitUntil: 'load' });
await sheet.screenshot({ path: join(outDir, 'contact.png'), fullPage: true });
await browser.close();
await writeFile(join(outDir, 'banners.json'), JSON.stringify(results.map((r) => ({ id: r.id, file: `${r.id}.png`, width: W, height: H })), null, 2));
console.log(JSON.stringify({ rendered: results.length, outDir }));
