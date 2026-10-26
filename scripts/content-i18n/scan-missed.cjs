/** Qaçırılmış cədvəllər: prob (sütun/tip/boşluq) + chunk export + registry-extra yeniləmə */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const envRaw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(envRaw.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(envRaw.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const get = (u, eh = {}) => fetch(URL_ + '/rest/v1/' + u, { headers: { ...H, ...eh } });

const CANDIDATES = {
  affiliate_products: ['name', 'description', 'category', 'review_summary'],
  zodiac_signs: ['name', 'characteristics'],
  zodiac_compatibility: ['description'],
  place_categories: ['label'],
  place_amenities: ['label'],
  fairy_tale_themes: ['name', 'description'],
  healthcare_providers: ['name', 'specialty', 'description', 'address'],
  mood_levels: ['label'],
  noise_thresholds: ['label', 'description'],
  mom_friendly_places: ['name', 'description', 'address'],
  payment_methods: ['label', 'description'],
  fruit_images: ['fruit_name'],
  play_inventory_items: ['name'],
  baby_teeth_db: ['name', 'description'],
  teething_care_tips: ['title', 'content'],
  teething_symptoms: ['name', 'description', 'relief_tips'],
  vaccine_countries: ['name'],
  vaccines: ['name', 'short_description', 'full_description', 'disease', 'route', 'side_effects', 'contraindications'],
  vaccine_schedules: ['dose_label', 'age_label', 'notes'],
};

async function colExists(t, c) { return (await get(`${t}?select=${c}&limit=1`)).ok; }
async function colType(t, c) {
  const r = await get(`${t}?select=${c}&${c}=not.is.null&limit=1`);
  if (r.ok) { const d = await r.json(); if (d.length) { const v = d[0][c]; if (Array.isArray(v)) { const r2 = await get(`${t}?select=id&${c}=ov.{}&limit=1`); return r2.ok ? 'arr' : 'json'; } return 'text'; } }
  const rcs = await get(`${t}?select=id&${c}=cs.{}&limit=1`); if (!rcs.ok) return 'text';
  const rov = await get(`${t}?select=id&${c}=ov.{}&limit=1`); return rov.ok ? 'arr' : 'json';
}
async function cnt(t, extra) { const r = await get(`${t}?select=id${extra}`, { Prefer: 'count=exact', Range: '0-0' }); if (!r.ok) return -1; return Number((r.headers.get('content-range') || '').split('/')[1] ?? -1); }

(async () => {
  const reg = JSON.parse(fs.readFileSync(path.join(__dirname, 'registry-extra.json'), 'utf8'));
  const toTranslate = [];
  for (const [table, fields] of Object.entries(CANDIDATES)) {
    const total = await cnt(table, '');
    if (total < 0) { console.log(`✗ ${table}: oxuna bilmir`); continue; }
    if (total === 0) { console.log(`- ${table}: boş cədvəl`); continue; }
    const cfg = { text: [], arr: [], json: [] };
    const ok = [];
    for (const f of fields) {
      if (await colExists(table, f + '_ru')) { ok.push(f); const t = await colType(table, f + '_ru'); (t === 'arr' ? cfg.arr : t === 'json' ? cfg.json : cfg.text).push(f); }
    }
    if (!ok.length) { console.log(`- ${table}: _ru sütunu yoxdur (${fields.join(',')})`); continue; }
    const missRu = await cnt(table, '&or=(' + ok.map((f) => `${f}_ru.is.null`).join(',') + ')');
    const missTr = await cnt(table, '&or=(' + ok.map((f) => `${f}_tr.is.null`).join(',') + ')');
    console.log(`${missRu || missTr ? '●' : '✓'} ${table.padEnd(24)} total:${String(total).padStart(4)} ru boş:${String(missRu).padStart(4)} tr boş:${String(missTr).padStart(4)} [${ok.join(', ')}]`);
    if (missRu || missTr) {
      reg[table] = cfg;
      const rows = [];
      for (let off = 0; ; off += 1000) { const r = await get(`${table}?select=*&order=id.asc&limit=1000&offset=${off}`); const d = await r.json(); rows.push(...d); if (d.length < 1000) break; }
      fs.writeFileSync(path.join(__dirname, 'chunks', `${table}.json`), JSON.stringify(rows, null, 1), 'utf8');
      toTranslate.push(table);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'registry-extra.json'), JSON.stringify(reg, null, 1), 'utf8');
  console.log('TƏRCÜMƏ LAZIM:', toTranslate.join(' '));
})();
