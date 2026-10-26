/**
 * ru/tr seed-də çatışmayan istifadəçi-üzlü tr() açarlarını tapır.
 * Həmçinin AZ-hərfli hardcoded JSX literallarını (tr()-siz) heuristik aşkarlayır.
 */
const fs = require('fs');
const path = require('path');

const keys = new Map(); // key -> {az, files:[], adminOnly:bool}

function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.(ts|tsx)$/.test(f)) continue;
    const s = fs.readFileSync(p, 'utf8');
    const isAdmin = /[\\/]admin[\\/]/.test(p) || /Admin[A-Z]/.test(path.basename(p));
    const re = /\btr\(\s*["']([^"']+)["']\s*,\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
    let m;
    while ((m = re.exec(s))) {
      const k = m[1];
      const fallback = m[2].slice(1, -1);
      if (!keys.has(k)) keys.set(k, { az: fallback, files: [], adminOnly: true });
      const e = keys.get(k);
      if (!e.files.includes(p)) e.files.push(p);
      if (!isAdmin) e.adminOnly = false;
    }
  }
}
walk('src');

const az = JSON.parse(fs.readFileSync('src/locales/az.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('scripts/i18n/ru.seed.json', 'utf8'));
const trSeed = JSON.parse(fs.readFileSync('scripts/i18n/tr.seed.json', 'utf8'));

const missing = [];
for (const [k, v] of keys) {
  if (v.adminOnly) continue;
  if (k.startsWith('admin')) continue;
  if (!ru[k] || !trSeed[k]) {
    missing.push({ key: k, az: v.az, file: v.files.map((f) => path.relative('src', f)).join(', ') });
  }
}
console.log('non-admin tr() açar sayı:', [...keys.values()].filter((v) => !v.adminOnly).length);
console.log('ru/tr seed-də OLMAYAN:', missing.length);
missing.forEach((m) => console.log(' -', m.key, '|', String(m.az).slice(0, 80), '|', m.file));
fs.writeFileSync(path.join(__dirname, 'missing-keys.json'), JSON.stringify(missing, null, 1), 'utf8');

// Hardcoded AZ JSX literalları (tr()-siz) — heuristika: AZ-spesifik hərf saxlayan >...< mətnləri
const AZ_RE = /[əğışçöüƏĞİŞÇÖÜ]/;
const hard = [];
function walk2(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk2(p); continue; }
    if (!/\.tsx$/.test(f)) continue;
    if (/[\\/]admin[\\/]/.test(p) || /Admin[A-Z]/.test(path.basename(p))) continue;
    const s = fs.readFileSync(p, 'utf8');
    const re = />\s*([^<>{}]*[əğışçöüƏĞİŞÇÖÜ][^<>{}]*?)\s*</g;
    let m;
    while ((m = re.exec(s))) {
      const txt = m[1].trim();
      if (!txt || txt.length < 3) continue;
      if (!AZ_RE.test(txt)) continue;
      hard.push({ file: path.relative('src', p), text: txt.slice(0, 90) });
    }
  }
}
walk2('src');
console.log('\nHardcoded AZ JSX literalları (tr()-siz):', hard.length);
const byFile = {};
hard.forEach((h) => { (byFile[h.file] = byFile[h.file] || []).push(h.text); });
Object.entries(byFile).forEach(([f, ts]) => { console.log(' *', f); ts.slice(0, 6).forEach((t) => console.log('    ', t)); });
fs.writeFileSync(path.join(__dirname, 'hardcoded-az.json'), JSON.stringify(byFile, null, 1), 'utf8');
