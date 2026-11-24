/**
 * Store screenshots v2 (owner request 2026-11-16): one continuous coral panorama, sliced into nine 1290×2796 slides
 * (or 1080×1920 for Google Play with FORMAT=android). Big Plus Jakarta Sans headlines with a butter-yellow highlight,
 * real app screens (shots/<lang>/*.png from real-app/capture.sh) in a phone frame, Nano Banana Pro art (art/: mother
 * and newborn, Baku skyline, clay objects) and glass stat chips whose numbers match the screen shown.
 *
 *   node scripts/store-screenshots/v2/render.mjs az            → v2/out/az/01-hero.png … 09-tools.png
 *   FORMAT=android node scripts/store-screenshots/v2/render.mjs az → v2/out-android/az/
 * Texts: v2/copy/<lang>.json. CHROMIUM_PATH overrides the browser binary.
 */
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const lang = process.argv[2] || 'az';
const android = process.env.FORMAT === 'android';
/* COPY=cpp-pregnancy reads copy/<lang>-cpp-pregnancy.json (custom product pages) and writes out/<lang>-cpp-pregnancy/. */
const variant = process.env.COPY ? `${lang}-${process.env.COPY}` : lang;
const copy = JSON.parse(await readFile(join(here, 'copy', `${variant}.json`), 'utf8'));
const shots = process.env.SHOTS_DIR || join(here, '..', 'shots', lang);
const theme = process.env.THEME || 'coral';
/* Hero image: 'photo' (default, Nano Banana Pro photograph) or 'illustration'. */
const heroKind = process.env.HERO || 'photo';
const heroFile = copy.hero ? copy.hero : heroKind === 'illustration' ? 'hero.jpg' : theme === 'cream' ? 'hero-photo-cream.jpg' : 'hero-photo-coral.jpg';
const W = android ? 432 : 430, H = android ? 768 : 932, SCALE = android ? 2.5 : 3, N = copy.slides.length;
const url = p => pathToFileURL(p).href;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const art = n => url(join(here, 'art', n));
const font = n => url(join(here, 'fonts', n));

/* Decorative clay objects: [file, slide index, x within slide, y, size, rotation]. Some sit on slide borders on purpose. */
const OBJECTS = [['obj-heart.png', 0.88, 0, 470, 80, -12], ['obj-moon.png', 1.97, 0, 790, 74, 8], ['obj-star.png', 2.97, 0, 600, 62, 0],
  ['obj-bottle.png', 4.02, 0, 640, 76, 14], ['obj-pacifier.png', 5.96, 0, 650, 74, -18], ['obj-socks.png', 6.98, 0, 620, 80, 10], ['obj-star.png', 8.04, 0, 700, 58, 18]];

const phone = (shot, tilt) => `<div class="phone" style="transform:rotate(${tilt}deg)"><div class="screen"><img src="${url(join(shots, shot + '.png'))}" alt=""></div><span class="island"></span></div>`;
function slide(s, i) {
  const tilt = theme === 'cream' ? 0 : [0, -4, 3, -3, 4, -3, 3, -4, 0][i] || 0;
  const title = `${s.title.map(t => `<span>${esc(t)}</span>`).join('')}<span class="hl">${esc(s.hl)}</span>`;
  const chips = (s.chips || []).map((c, j) => `<div class="chip chip${j}"><b>${esc(c[0])}</b><span>${esc(c[1])}</span></div>`).join('');
  const cta = s.cta ? `<div class="cta"><div class="cta-btn">${esc(s.cta)}</div><span>${esc(s.ctaSub)}</span></div>` : '';
  if (s.proof) {
    const p = s.proof;
    const stats = p.stats.map(([n, l]) => `<div class="pstat"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('');
    const reviews = p.reviews.map(([t, who], j) => `<div class="review r${j}"><div class="stars">★★★★★</div><p>${esc(t)}</p><span>${esc(who)}</span></div>`).join('');
    return `<section class="slide proof" style="left:${i * W}px"><p class="eyebrow">${esc(s.eyebrow)}</p><h1>${title}</h1><p class="sub">${esc(s.sub)}</p>
      <div class="rating"><b>${esc(p.rating)}</b><div><div class="stars big">★★★★★</div><span>${esc(p.ratingSub)}</span></div></div>
      <div class="pstats">${stats}</div><div class="reviews">${reviews}</div>${cta}</section>`;
  }
  if (!s.shot) return `<section class="slide hero" style="left:${i * W}px">
    <div class="brand"><img src="${url(join(here, '..', '..', '..', 'public', 'website', 'brand-glyph-coral.png'))}" alt=""><span>anacan</span></div>
    <p class="eyebrow">${esc(s.eyebrow)}</p><h1>${title}</h1><p class="sub">${esc(s.sub)}</p>
    <img class="mother${heroKind === 'photo' ? ' photo' : ''}" src="${art(heroFile)}" alt="">${cta}<p class="badge">${esc(copy.badge)}</p></section>`;
  return `<section class="slide" style="left:${i * W}px"><p class="eyebrow">${esc(s.eyebrow)}</p><h1>${title}</h1><p class="sub">${esc(s.sub)}</p>
    <div class="stage">${phone(s.shot, tilt)}${chips}</div>${cta}</section>`;
}
const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face{font-family:J;font-weight:500;src:url(${font('jakarta-n500.ttf')})}
@font-face{font-family:J;font-weight:700;src:url(${font('jakarta-n700.ttf')})}
@font-face{font-family:J;font-weight:800;src:url(${font('jakarta-n800.ttf')})}
@font-face{font-family:J;font-weight:800;font-style:italic;src:url(${font('jakarta-i800.ttf')})}
:root{--coral:#fe6054;--deep:#d93a40;--ink:#2b1f1d;--cream:#fff4ee;--peach:#ffb8a3;--butter:#ffd66b}
*{box-sizing:border-box;margin:0;padding:0}
body{width:${W * N}px;height:${H}px;overflow:hidden;font-family:J,system-ui,sans-serif;-webkit-font-smoothing:antialiased;color:#fff;
  background:linear-gradient(180deg,#ff6a5c 0%,var(--coral) 38%,#f24c4f 100%)}
.pano{position:absolute;inset:0;overflow:hidden}
.skyline{position:absolute;left:0;bottom:0;width:${W * 3.4}px;opacity:.5;mix-blend-mode:multiply;-webkit-mask-image:linear-gradient(to top,#000 45%,transparent 92%);mask-image:linear-gradient(to top,#000 45%,transparent 92%)}
.skyline.r{left:auto;right:0;width:${W * 3}px;transform:scaleX(-1);opacity:.4}
.ribbon{position:absolute;left:0;top:0;width:${W * N}px;height:${H}px}
.obj{position:absolute;filter:drop-shadow(0 14px 18px rgba(120,20,20,.28));z-index:6}
.slide{position:absolute;top:0;width:${W}px;height:${H}px;padding:${android ? 34 : 58}px 30px 0;z-index:4}
.eyebrow{display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35);
  font-weight:700;font-size:${android ? 13 : 14}px;letter-spacing:.02em}
h1{margin-top:14px;font-weight:800;white-space:nowrap;font-size:${android ? 40 : 47}px;line-height:.98;letter-spacing:-.035em;display:flex;flex-direction:column}
h1 span{display:block;width:max-content;max-width:none}
h1 .hl{color:var(--butter);font-style:italic}
.sub{margin-top:12px;font-weight:500;font-size:${android ? 15 : 16.5}px;line-height:1.35;color:rgba(255,255,255,.88);max-width:340px}
.stage{position:absolute;left:0;right:0;bottom:${android ? -150 : -40}px;height:${android ? 560 : 640}px;display:grid;place-items:center}
.phone{position:relative;width:${android ? 262 : 300}px;height:${android ? 568 : 650}px;border-radius:50px;background:#16171b;padding:9px;
  box-shadow:0 40px 60px -20px rgba(90,10,10,.55),0 0 0 2px rgba(255,255,255,.08) inset}
.screen{width:100%;height:100%;border-radius:42px;overflow:hidden;background:#fff}
.screen img{width:100%;display:block}
.island{position:absolute;top:20px;left:50%;width:86px;height:25px;margin-left:-43px;border-radius:20px;background:#0b0b0d}
.chip{position:absolute;z-index:5;display:flex;flex-direction:column;padding:12px 16px;border-radius:20px;min-width:118px;
  background:#fff;color:var(--ink);box-shadow:0 22px 34px -16px rgba(90,10,10,.55)}
.chip b{font-weight:800;font-size:30px;letter-spacing:-.03em;line-height:1;color:var(--deep)}
.chip span{font-weight:700;font-size:12.5px;color:#6b5652;margin-top:4px}
.chip0{left:4px;top:${android ? 110 : 150}px;transform:rotate(-5deg)}
.chip1{right:2px;top:${android ? 260 : 330}px;transform:rotate(4deg)}
.cta{position:absolute;left:30px;right:30px;bottom:${android ? 26 : 44}px;z-index:7;display:flex;align-items:center;gap:14px;padding:12px 12px 12px 12px;border-radius:26px;
  background:rgba(43,31,29,.88);box-shadow:0 20px 34px -14px rgba(60,10,10,.55)}
.cta-btn{padding:14px 22px;border-radius:18px;background:var(--cream);color:var(--deep);font-weight:800;font-size:18px}
.cta span{font-weight:700;font-size:14px}
.proof .rating{margin-top:${android ? 16 : 24}px;display:flex;align-items:center;gap:14px;padding:${android ? 12 : 16}px 18px;border-radius:24px;background:#fff;color:var(--ink);box-shadow:0 22px 34px -16px rgba(90,10,10,.55)}
.proof .rating>b{font-weight:800;font-size:${android ? 44 : 54}px;letter-spacing:-.04em;color:var(--deep);line-height:1}
.proof .rating span{display:block;font-weight:700;font-size:13px;color:#6b5652;margin-top:2px}
.stars{color:#ffb400;letter-spacing:2px;font-size:14px}.stars.big{font-size:${android ? 22 : 26}px}
.pstats{display:flex;gap:10px;margin-top:12px}
.pstat{flex:1;padding:10px 12px;border-radius:18px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.35)}
.pstat b{display:block;font-weight:800;font-size:${android ? 22 : 26}px;letter-spacing:-.03em;color:var(--butter)}
.pstat span{font-weight:700;font-size:12px;color:rgba(255,255,255,.9)}
.reviews{display:flex;flex-direction:column;gap:${android ? 8 : 12}px;margin-top:${android ? 12 : 16}px}
.review{padding:${android ? 10 : 14}px 16px;border-radius:20px;background:var(--cream);color:var(--ink);box-shadow:0 18px 28px -16px rgba(90,10,10,.5)}
.review.r0{transform:rotate(-1.2deg)}.review.r1{transform:rotate(1deg);margin-left:14px}
.review p{font-weight:600;font-size:${android ? 12.5 : 14}px;line-height:1.35;margin-top:4px}
.review span{display:block;margin-top:6px;font-weight:700;font-size:11.5px;color:#9a7f79}
.hero h1{font-size:${android ? (copy.heroH1Android || 46) : (copy.heroH1 || 56)}px;margin-top:16px}
.hero .mother{position:absolute;left:${android ? 40 : 18}px;right:0;bottom:${android ? 90 : 110}px;width:${android ? 330 : 400}px;
  -webkit-mask-image:radial-gradient(ellipse 72% 70% at 50% 58%,#000 62%,transparent 100%);mask-image:radial-gradient(ellipse 72% 70% at 50% 58%,#000 62%,transparent 100%);z-index:-1}
.brand{display:flex;align-items:center;gap:8px;margin-bottom:${android ? 16 : 26}px;font-weight:800;font-size:22px;letter-spacing:-.02em}
.brand img{width:34px;height:34px;border-radius:10px;background:#fff;padding:4px}
.badge{position:absolute;right:30px;top:${android ? 36 : 62}px;font-weight:700;font-size:13px;padding:6px 12px;border-radius:999px;background:var(--butter);color:var(--ink)}


.hero .mother.photo{left:0;width:${W}px;bottom:${android ? 70 : 96}px;-webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 22%,#000 78%,transparent 100%),linear-gradient(to right,transparent 0%,#000 14%,#000 86%,transparent 100%);-webkit-mask-composite:source-in;mask-image:linear-gradient(to bottom,transparent 0%,#000 22%,#000 78%,transparent 100%),linear-gradient(to right,transparent 0%,#000 14%,#000 86%,transparent 100%);mask-composite:intersect}
${theme === 'cream' ? `
body{color:var(--ink);background:linear-gradient(180deg,#fff6f2 0%,#fff1ea 45%,#ffe4dc 100%)}
.eyebrow{background:#ffe1d9;border-color:#ffc9bb;color:var(--deep)}
h1 .hl{color:var(--deep)}
.sub{color:#6b5652}
.skyline{opacity:.16!important}
.ribbon path:first-child{stroke:#ffb8a3;opacity:.45}.ribbon path:last-child{stroke:#ff8a7a}
.phone{box-shadow:0 40px 60px -24px rgba(150,50,40,.35)}
.chip{box-shadow:0 18px 30px -14px rgba(150,50,40,.35);border:1px solid #ffe1d9}
.cta{background:var(--deep)}.cta span{color:#fff}
.badge{background:var(--deep);color:#fff}
.brand{color:var(--ink)}.brand img{box-shadow:0 4px 10px rgba(150,50,40,.2)}` : ''}
</style></head><body><div class="pano">
<img class="skyline" src="${art('skyline.jpg')}" alt=""><img class="skyline r" src="${art('skyline.jpg')}" alt="">
<svg class="ribbon" viewBox="0 0 ${W * N} ${H}" preserveAspectRatio="none" aria-hidden="true">
  <path d="M -40 ${H * .82} C ${W * .8} ${H * .62}, ${W * 1.4} ${H * .98}, ${W * 2.2} ${H * .74} S ${W * 3.6} ${H * .5}, ${W * 4.4} ${H * .78} S ${W * 6} ${H * .98}, ${W * 6.8} ${H * .7} S ${W * 8.4} ${H * .55}, ${W * N + 40} ${H * .8}"
    fill="none" stroke="#ffd2c4" stroke-width="${android ? 54 : 70}" stroke-linecap="round" opacity=".55"/>
  <path d="M -40 ${H * .82} C ${W * .8} ${H * .62}, ${W * 1.4} ${H * .98}, ${W * 2.2} ${H * .74} S ${W * 3.6} ${H * .5}, ${W * 4.4} ${H * .78} S ${W * 6} ${H * .98}, ${W * 6.8} ${H * .7} S ${W * 8.4} ${H * .55}, ${W * N + 40} ${H * .8}"
    fill="none" stroke="#fff4ee" stroke-width="3" stroke-dasharray="14 16" opacity=".8"/>
</svg>
${OBJECTS.filter(([, at]) => !copy.slides.some((sl, k) => sl.proof && at > k - 0.15 && at < k + 1.15)).map(([f, at, , y, size, rot]) => `<img class="obj" src="${art(f)}" style="left:${at * W - size / 2}px;top:${android ? y * .82 : y}px;width:${size}px;transform:rotate(${rot}deg)" alt="">`).join('')}
${copy.slides.map(slide).join('')}
</div></body></html>`;

const require = createRequire(join(here, '..', '..', '..', 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: W * N, height: H }, deviceScaleFactor: SCALE });
const htmlFile = join(here, `.render-${variant}${android ? '-android' : ''}.html`);
await writeFile(htmlFile, html);
await page.goto(url(htmlFile), { waitUntil: 'load' });
// Fit each headline line to the slide width.
await page.evaluate(() => { for (const h of document.querySelectorAll('h1')) { let size = parseFloat(getComputedStyle(h).fontSize); while ([...h.children].some(c => c.scrollWidth > h.clientWidth) && size > 30) { size -= 1; h.style.fontSize = size + 'px'; } } });
await page.evaluate(() => document.fonts.ready);
const outDir = join(here, (android ? 'out-android' : 'out') + (theme === 'cream' ? '-cream' : ''), variant);
await mkdir(outDir, { recursive: true });
for (let i = 0; i < N; i++) {
  const file = join(outDir, `${String(i + 1).padStart(2, '0')}-${copy.slides[i].key}.png`);
  await page.screenshot({ path: file, clip: { x: i * W, y: 0, width: W, height: H } });
  console.log(file);
}
await page.screenshot({ path: join(outDir, 'panorama.jpg'), type: 'jpeg', quality: 70, scale: 'css' });
await browser.close();
await rm(htmlFile, { force: true });
