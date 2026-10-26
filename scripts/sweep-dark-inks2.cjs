// Sweep 2: qalan hue hex-ləri var-lara keçir (dark-da hamısı ağ olacaq)
const fs = require('fs');
const path = require('path');
const MAP = {
  '#7a5200': 'var(--a-warn-ink)',
  '#7A5200': 'var(--a-warn-ink)',
  '#5c3417': 'var(--a-cta-ink)',
  '#5C3417': 'var(--a-cta-ink)',
  '#4b2f8a': 'var(--a-lav-ink)',
  '#4B2F8A': 'var(--a-lav-ink)',
};
let files = 0, total = 0;
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!/node_modules|integrations/.test(p)) walk(p); }
    else if (/\.(tsx|ts)$/.test(f)) {
      let s = fs.readFileSync(p, 'utf8');
      let n = 0;
      for (const [hex, v] of Object.entries(MAP)) {
        const c = s.split(hex).length - 1;
        if (c) { s = s.split(hex).join(v); n += c; }
      }
      if (n) { fs.writeFileSync(p, s); files++; total += n; }
    }
  }
}
walk('src');
console.log(`✓ ${files} faylda ${total} əvəzləmə`);
