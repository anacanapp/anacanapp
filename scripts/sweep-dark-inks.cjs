// Dark-mode kontrast sweep: hardcoded hue-ink hex-ləri CSS var-larla əvəzləyir.
// Light modda dəyərlər eynidir (var :root-da həmin hex-ə bərabərdir) → vizual dəyişiklik YOX.
// Dark modda var-lar açıq varianta keçir → tünd-üstə-tünd mətn problemi bitir.
const fs = require('fs');
const path = require('path');

const MAP = {
  '#8a4514': 'var(--a-accent-ink)',
  '#8A4514': 'var(--a-accent-ink)',
  '#1c5a80': 'var(--a-blue-ink)',
  '#1C5A80': 'var(--a-blue-ink)',
  '#b1275b': 'var(--a-pink-ink)',
  '#B1275B': 'var(--a-pink-ink)',
  '#a3355f': 'var(--a-berry-ink)',
  '#A3355F': 'var(--a-berry-ink)',
  '#1c7a4d': 'var(--a-green-ink)',
  '#1C7A4D': 'var(--a-green-ink)',
  '#946200': 'var(--a-yellow-ink)',
  '#7a1f34': 'var(--a-alert-ink)',
  '#7A1F34': 'var(--a-alert-ink)',
};

let files = 0, total = 0;
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (!/node_modules|integrations/.test(p)) walk(p);
    } else if (/\.(tsx|ts)$/.test(f)) {
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
