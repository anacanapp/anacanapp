// Generates minimal 1200x630 JPEG covers for the news items in src/website/news.ts into public/website/news/.
// Run: PW_CHROMIUM=/opt/pw-browsers/chromium npx tsx scripts/website/news-covers.mjs  (re-run after adding news).
import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
// Partner covers (logos only) are shared by all languages; art covers carry a caption, so translated items also
// get public/website/news/<lang>/<localized-slug>.jpg (see newsCover in news.ts).
import {NEWS,NEWS_LANGUAGES,PARTNERS,newsCover} from '../../src/website/news.ts';

const root=join(import.meta.dirname,'../..');
const pub=join(root,'public');
const dataUri=async(rel)=>{const buf=await readFile(join(pub,rel));const ext=rel.split('.').pop();
  return `data:${ext==='svg'?'image/svg+xml':ext==='png'?'image/png':'image/webp'};base64,${buf.toString('base64')}`;};

// Brand glyph only (no circle): the white transparent mark used as a mask, filled with coral.
const mark=await dataUri('brand-mark-white.png');
const glyph=(cls)=>`<span class="${cls}" style="-webkit-mask:url(${mark}) center/contain no-repeat;mask:url(${mark}) center/contain no-repeat"></span>`;
const css=`*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;overflow:hidden;font-family:Inter,system-ui,sans-serif;background:#FFF4EF;position:relative}
.c1{position:absolute;width:760px;height:760px;border-radius:50%;background:#FFE7E1;right:-260px;top:-330px}
.c2{position:absolute;width:420px;height:420px;border-radius:50%;background:#FFEDE7;left:-160px;bottom:-230px}
.dot{position:absolute;width:18px;height:18px;border-radius:50%;background:#FF5A5F;opacity:.85}
.tag{position:absolute;left:64px;top:60px;padding:10px 20px;border-radius:999px;background:#fff;color:#BD353D;font-weight:700;font-size:22px;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 2px 10px rgba(158,43,46,.06)}
.brand{position:absolute;left:64px;bottom:56px;display:flex;align-items:center;gap:12px;color:#333;font-weight:800;font-size:26px;letter-spacing:-.01em}
.brand .g{width:40px;height:40px;background:#FF5A5F;display:inline-block}
.card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(1.35);display:flex;align-items:center;justify-content:center;gap:44px;padding:56px 72px;min-width:560px}
.card .mk{width:120px;height:120px;background:#FF5A5F;display:inline-block;flex:none}
.x{font-size:44px;color:#C9B8B1;font-weight:300}
.logo{display:flex;align-items:center;gap:18px;font-weight:700;font-size:44px;color:#2b2b2b}
.logo{white-space:nowrap}.logo img{height:96px;width:auto;max-width:360px;object-fit:contain}.logo.wide img{height:104px}
.logo.icon img{height:96px}
.big{font-weight:800;font-size:150px;line-height:.9;color:#FF5A5F;letter-spacing:-.04em}
.sub{font-weight:700;font-size:34px;color:#333;line-height:1.15}
.char{height:250px}`;

const html=async(c)=>{
  let inner='';
  if(c.kind==='partner'){const p=PARTNERS[c.partner];const src=await dataUri(p.src.replace(/^\//,''));
    inner=`${glyph('mk')}<span class="x">×</span><span class="logo ${p.shape}"><img src="${src}">${p.shape==='icon'?`<span>${p.name}</span>`:''}</span>`;}
  else{const ch=await dataUri(`website/characters/${c.character}.webp`);
    inner=`<img class="char" src="${ch}"><div><div class="big">${c.big}</div><div class="sub">${c.sub}</div></div>`;}
  // Plain cover: only the logos (or character + number) on a flat soft background, nothing else.
  return `<!doctype html><meta charset="utf-8"><style>${css}</style><div class="card">${inner}</div>`;
};

const covers=new Map();
for(const item of NEWS)for(const language of NEWS_LANGUAGES)if(language==='az'||item[language]){const c=newsCover(item,language);covers.set(c.src,c);}
const browser=await chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});const page=await browser.newPage({viewport:{width:1200,height:630}});
for(const c of covers.values()){await page.setContent(await html(c),{waitUntil:'load'});
  const out=join(pub,c.src.replace(/^\//,''));await mkdir(dirname(out),{recursive:true});await page.screenshot({path:out,type:'jpeg',quality:86});console.log(out);}
await browser.close();
