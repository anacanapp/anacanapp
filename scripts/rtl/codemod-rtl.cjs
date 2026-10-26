/**
 * RTL Codemod — fiziki CSS-i logical-a çevirir (LTR-də vizual eynidir, RTL-də düzgün flip).
 *   1) Tailwind: ml/mr→ms/me, pl/pr→ps/pe, left-/right-→start-/end-, text-left/right→start/end,
 *      rounded-{tl,tr,bl,br,l,r}→{ss,se,es,ee,s,e}, border-l/r→border-s/e, space-x→+rtl:space-x-reverse
 *      İSTİSNA: left-1/2, right-1/2 (translate-x mərkəzləmə cütü — toxunulmur)
 *   2) Inline style: marginLeft→marginInlineStart, paddingRight→paddingInlineEnd,
 *      left:→insetInlineStart:, right:→insetInlineEnd:, textAlign left/right→start/end
 *      İSTİSNA: left: '50%' / right: '50%' (mərkəzləmə)
 *   3) İkonlar: ArrowLeft/ArrowRight/ChevronLeft/ChevronRight → className +"rtl:rotate-180"
 * İstifadə: node scripts/rtl/codemod-rtl.cjs [--dry]
 */
const fs = require('fs');
const path = require('path');

const DRY = process.argv.includes('--dry');
const stats = { files: 0, changed: 0, tw: 0, inline: 0, icons: 0 };

// ── Tailwind sinif çevirmələri (className string kontekstində) ──
function twTransform(s) {
  let n = 0;
  // QEYD: string rep birbaşa ötürülür ki, $1/$2 placeholder-lər işləsin
  const R = (re, rep) => {
    n += (s.match(re) || []).length;
    s = s.replace(re, rep);
  };

  // margin/padding: ml-2, -ml-2, ml-auto, ml-[10px], ml-px
  R(/(?<![\w-])(-?)ml-(?=(auto|px|\d|\[))/g, '$1ms-');
  R(/(?<![\w-])(-?)mr-(?=(auto|px|\d|\[))/g, '$1me-');
  R(/(?<![\w-])(-?)pl-(?=(px|\d|\[))/g, '$1ps-');
  R(/(?<![\w-])(-?)pr-(?=(px|\d|\[))/g, '$1pe-');

  // inset: left-0..., -left-2, left-[...], left-full, left-px — left-1/2 & right-1/2 İSTİSNA
  R(/(?<![\w-])(-?)left-(?!1\/2)(?=(px|full|\d|\[))/g, '$1start-');
  R(/(?<![\w-])(-?)right-(?!1\/2)(?=(px|full|\d|\[))/g, '$1end-');

  // text-align
  R(/(?<![\w-])text-left(?![\w-])/g, 'text-start');
  R(/(?<![\w-])text-right(?![\w-])/g, 'text-end');

  // rounded künclər (tl/tr/bl/br → ss/se/es/ee), sonra l/r → s/e
  R(/(?<![\w-])rounded-tl(?=[\s"'`-])/g, 'rounded-ss');
  R(/(?<![\w-])rounded-tr(?=[\s"'`-])/g, 'rounded-se');
  R(/(?<![\w-])rounded-bl(?=[\s"'`-])/g, 'rounded-es');
  R(/(?<![\w-])rounded-br(?=[\s"'`-])/g, 'rounded-ee');
  R(/(?<![\w-])rounded-l(?=[\s"'`-])/g, 'rounded-s');
  R(/(?<![\w-])rounded-r(?=[\s"'`-])/g, 'rounded-e');

  // border tərəfləri: border-l, border-l-2/4, border-r...
  R(/(?<![\w-])border-l(?=[\s"'`])/g, 'border-s');
  R(/(?<![\w-])border-r(?=[\s"'`])/g, 'border-e');
  R(/(?<![\w-])border-l-(?=\d)/g, 'border-s-');
  R(/(?<![\w-])border-r-(?=\d)/g, 'border-e-');

  // space-x → rtl reverse yoldaşı (artıq əlavə olunubsa təkrar yox)
  R(/(?<![\w-])space-x-(\d+)(?![\w-])(?![^"'`]*rtl:space-x-reverse)/g, 'space-x-$1 rtl:space-x-reverse');

  return [s, n];
}

// ── Inline style çevirmələri ──
function inlineTransform(s) {
  let n = 0;
  const R = (re, rep) => {
    n += (s.match(re) || []).length;
    s = s.replace(re, rep);
  };

  R(/\bmarginLeft(\s*:)/g, 'marginInlineStart$1');
  R(/\bmarginRight(\s*:)/g, 'marginInlineEnd$1');
  R(/\bpaddingLeft(\s*:)/g, 'paddingInlineStart$1');
  R(/\bpaddingRight(\s*:)/g, 'paddingInlineEnd$1');

  // textAlign: 'left'/'right' → 'start'/'end'
  R(/\btextAlign(\s*:\s*)'left'/g, "textAlign$1'start'");
  R(/\btextAlign(\s*:\s*)'right'/g, "textAlign$1'end'");
  R(/\btextAlign(\s*:\s*)"left"/g, 'textAlign$1"start"');
  R(/\btextAlign(\s*:\s*)"right"/g, 'textAlign$1"end"');

  // left:/right: obyekt açarları — yalnız style-vari kontekst: {, və ya , -dən sonra
  // İSTİSNA: '50%' dəyəri (mərkəzləmə + translateX cütü)
  R(/([{,]\s*)left(\s*:\s*)(?!'50%'|"50%")/g, '$1insetInlineStart$2');
  R(/([{,]\s*)right(\s*:\s*)(?!'50%'|"50%")/g, '$1insetInlineEnd$2');

  return [s, n];
}

// ── İkon flip ──
const ICONS = ['ArrowLeft', 'ArrowRight', 'ChevronLeft', 'ChevronRight'];
function iconTransform(s) {
  let n = 0;
  for (const icon of ICONS) {
    // Açılış taqını tap: <Icon ...attrs... /> və ya <Icon ...>
    const re = new RegExp(`<${icon}(\\s[^>]*?)?(/?)>`, 'g');
    s = s.replace(re, (full, attrs = '', selfClose) => {
      attrs = attrs || '';
      if (attrs.includes('rtl:rotate-180')) return full;
      n++;
      if (/className=\{?"/.test(attrs)) {
        // className="..." → əvvəlinə əlavə et
        const updated = attrs.replace(/className="([^"]*)"/, 'className="rtl:rotate-180 $1"');
        if (updated !== attrs) return `<${icon}${updated}${selfClose}>`;
        // className={`...`} template
        const updated2 = attrs.replace(/className=\{`([^`]*)`\}/, 'className={`rtl:rotate-180 $1`}');
        if (updated2 !== attrs) return `<${icon}${updated2}${selfClose}>`;
        n--; // dəyişə bilmədik (mürəkkəb ifadə) — əl siyahısına
        return full;
      }
      return `<${icon} className="rtl:rotate-180"${attrs}${selfClose}>`;
    });
  }
  return [s, n];
}

const complexIconFiles = new Set();

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.(tsx|ts)$/.test(f)) continue;
    if (p.includes('node_modules')) continue;
    stats.files++;
    const orig = fs.readFileSync(p, 'utf8');
    let s = orig;
    let [s1, n1] = twTransform(s);
    let [s2, n2] = inlineTransform(s1);
    let [s3, n3] = iconTransform(s2);
    if (/className=\{[^"`]/.test(s3) && new RegExp(`<(${ICONS.join('|')})\\s[^>]*className=\\{[^"\`]`).test(s3)) {
      complexIconFiles.add(p);
    }
    stats.tw += n1; stats.inline += n2; stats.icons += n3;
    if (s3 !== orig) {
      stats.changed++;
      if (!DRY) fs.writeFileSync(p, s3, 'utf8');
    }
  }
}
walk('src');

console.log(`Fayl: ${stats.files}, dəyişən: ${stats.changed}${DRY ? ' (DRY)' : ''}`);
console.log(`Tailwind çevirmə: ${stats.tw} | inline: ${stats.inline} | ikon flip: ${stats.icons}`);
if (complexIconFiles.size) {
  console.log('Mürəkkəb className-li ikonlar (əl yoxlaması):');
  [...complexIconFiles].slice(0, 15).forEach((f) => console.log('  ', f));
}
