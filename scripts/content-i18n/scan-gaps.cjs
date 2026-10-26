/**
 * Tətbiqin oxuduğu bütün tərcümə-xəritəli cədvəlləri aşkarlayır və DB-də ru/tr boşluqlarını sayır.
 * OpenAPI bağlı olduğu üçün sütunlar fərdi problarla yoxlanır.
 * Çıxış: gaps.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const envRaw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(envRaw.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(envRaw.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

function* walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!/node_modules|\.git/.test(p)) yield* walk(p); }
    else if (/\.(ts|tsx)$/.test(f)) yield p;
  }
}
const pairs = {};
for (const file of walk(path.join(ROOT, 'src'))) {
  const s = fs.readFileSync(file, 'utf8');
  const re = /mapRows?Translation\s*(?:<[^>]*>)?\(\s*[^,]+,\s*[^,]+,\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(s))) {
    const fields = [...m[1].matchAll(/['"]([A-Za-z0-9_]+)['"]/g)].map((x) => x[1]);
    if (!fields.length) continue;
    const before = s.slice(0, m.index);
    const fm = [...before.matchAll(/\.from\(\s*['"]([A-Za-z0-9_]+)['"]\s*\)/g)];
    if (!fm.length) continue;
    const table = fm[fm.length - 1][1];
    pairs[table] = pairs[table] || new Set();
    fields.forEach((f) => pairs[table].add(f));
  }
}

const get = (u, extraH = {}) => fetch(URL_ + '/rest/v1/' + u, { headers: { ...H, ...extraH } });

async function colExists(table, col) {
  const r = await get(`${table}?select=${col}&limit=1`);
  return r.ok;
}
async function colType(table, col) {
  // dolu nümunə
  const r = await get(`${table}?select=${col}&${col}=not.is.null&limit=1`);
  if (r.ok) {
    const d = await r.json();
    if (d.length) {
      const v = d[0][col];
      if (Array.isArray(v)) {
        // text[] vs jsonb: ov yalnız array üçün işləyir
        const r2 = await get(`${table}?select=id&${col}=ov.{}&limit=1`);
        return r2.ok ? 'arr' : 'json';
      }
      return 'text';
    }
  }
  // hamısı null → cs/ov trik
  const rcs = await get(`${table}?select=id&${col}=cs.{}&limit=1`);
  if (!rcs.ok) return 'text';
  const rov = await get(`${table}?select=id&${col}=ov.{}&limit=1`);
  return rov.ok ? 'arr' : 'json';
}
async function cnt(table, extra) {
  const r = await get(`${table}?select=id${extra}`, { Prefer: 'count=exact', Range: '0-0' });
  if (!r.ok) return -1;
  return Number((r.headers.get('content-range') || '').split('/')[1] ?? -1);
}

(async () => {
  const report = [];
  for (const [table, fieldSet] of Object.entries(pairs).sort()) {
    const total = await cnt(table, '');
    if (total < 0) { report.push({ table, error: 'oxuna bilmir (RLS/yoxdur)' }); continue; }
    const fields = [...fieldSet];
    const translatable = [];
    const fieldTypes = {};
    for (const f of fields) {
      if (await colExists(table, f + '_ru')) {
        translatable.push(f);
        fieldTypes[f] = await colType(table, f + '_ru');
      }
    }
    if (!translatable.length) { report.push({ table, total, fields, note: '_ru sütunu yoxdur' }); continue; }
    const orRu = '&or=(' + translatable.map((f) => `${f}_ru.is.null`).join(',') + ')';
    const orTr = '&or=(' + translatable.map((f) => `${f}_tr.is.null`).join(',') + ')';
    const missRu = await cnt(table, orRu);
    const missTr = await cnt(table, orTr);
    report.push({ table, total, missRu, missTr, fieldTypes });
  }
  fs.writeFileSync(path.join(__dirname, 'gaps.json'), JSON.stringify(report, null, 1), 'utf8');
  for (const r of report) {
    if (r.error) console.log(`✗ ${r.table}: ${r.error}`);
    else if (r.note) console.log(`- ${r.table.padEnd(28)} total:${String(r.total).padStart(5)}  ${r.note} (${r.fields.join(',')})`);
    else console.log(`${(r.missRu || r.missTr) ? '●' : '✓'} ${r.table.padEnd(28)} total:${String(r.total).padStart(5)}  ru boş:${String(r.missRu).padStart(5)}  tr boş:${String(r.missTr).padStart(5)}  [${Object.entries(r.fieldTypes).map(([f, t]) => f + (t !== 'text' ? ':' + t : '')).join(', ')}]`);
  }
})();
