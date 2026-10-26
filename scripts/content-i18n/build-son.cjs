/**
 * SON DELTA SQL — yalnız son mərhələnin dəyişikliklərini ayrıca fayllara yığır.
 * Çıxış: supabase/son/Son1.sql, Son2.sql, ... (hər biri ≤800KB, SQL editor üçün)
 *
 * Tərkib:
 *   Son1..N  — 15 yeni cədvəlin ru/tr tərcümələri (COALESCE, idempotent)
 *   Son(N+1) — baby_names_db lang sütunu (150020 ilə eyni)
 *   Son(N+2) — 400 TR/RU ad seed-i (150021 ilə eyni)
 *   Son(N+3) — tool təsviri OVERRIDE (COALESCE-siz — əvvəl yazılmış köhnə mətni düzəldir)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
const SON_DIR = path.join(ROOT, 'supabase', 'son');
const MAX_BYTES = 800 * 1024;

const DELTA_TABLES = [
  'zodiac_signs', 'place_categories', 'place_amenities', 'fairy_tale_themes',
  'healthcare_providers', 'mood_levels', 'noise_thresholds', 'mom_friendly_places',
  'play_inventory_items', 'baby_teeth_db', 'teething_care_tips', 'teething_symptoms',
  'vaccine_countries', 'vaccines', 'vaccine_schedules',
];

// Tip məlumatı (build-sql ilə eyni mənbə)
const FIELD_TYPES = {};
const extraPath = path.join(__dirname, 'registry-extra.json');
if (fs.existsSync(extraPath)) {
  const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
  for (const [t, cfg] of Object.entries(extra)) {
    FIELD_TYPES[t] = { arr: cfg.arr || [], json: cfg.json || [], arrText: cfg.arrText || [] };
  }
}
const esc = (s) => String(s).replace(/'/g, "''");
function sqlValue(table, field, value) {
  const t = FIELD_TYPES[table] || {};
  if ((t.arr || []).includes(field)) {
    const items = Array.isArray(value) ? value : [String(value)];
    return `ARRAY[${items.map((i) => `'${esc(i)}'`).join(', ')}]::text[]`;
  }
  if ((t.json || []).includes(field)) {
    const items = Array.isArray(value) ? value : [String(value)];
    return `'${esc(JSON.stringify(items))}'::jsonb`;
  }
  if ((t.arrText || []).includes(field)) {
    const items = Array.isArray(value) ? value : [String(value)];
    return `'${esc(JSON.stringify(items))}'`;
  }
  return `'${esc(String(value))}'`;
}

// ── 1) Delta cədvəllərin UPDATE-ləri ──
const lines = [];
let totalUpdates = 0;
for (const lang of ['ru', 'tr']) {
  const dir = path.join(OUT, lang);
  const tableData = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    let data; try { data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    const tables = f.startsWith('_') ? data : { [path.basename(f, '.json')]: data };
    for (const [table, rows] of Object.entries(tables)) {
      if (!DELTA_TABLES.includes(table)) continue;
      tableData[table] = tableData[table] || {};
      for (const [id, fobj] of Object.entries(rows)) tableData[table][id] = { ...(tableData[table][id] || {}), ...fobj };
    }
  }
  for (const [table, data] of Object.entries(tableData)) {
    lines.push(`-- ── ${table} → ${lang} (${Object.keys(data).length} sətir) ──`);
    for (const [id, fobj] of Object.entries(data)) {
      const sets = [];
      for (const [field, value] of Object.entries(fobj)) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'string' && !value.trim()) continue;
        const col = `${field}_${lang}`;
        sets.push(`${col} = COALESCE(${col}, ${sqlValue(table, field, value)})`);
      }
      if (!sets.length) continue;
      lines.push(`UPDATE public.${table} SET ${sets.join(', ')} WHERE id = '${esc(id)}';`);
      totalUpdates++;
    }
    lines.push('');
  }
}

// ── Hissələmə ──
fs.rmSync(SON_DIR, { recursive: true, force: true });
fs.mkdirSync(SON_DIR, { recursive: true });
const parts = [];
let cur = [], curB = 0;
for (const l of lines) {
  const b = Buffer.byteLength(l, 'utf8') + 1;
  if (curB + b > MAX_BYTES && cur.length) { parts.push(cur); cur = []; curB = 0; }
  cur.push(l); curB += b;
}
if (cur.length) parts.push(cur);

let n = 0;
const head = (title) => [`-- SON DELTA — ${title}`, '-- İdempotent; təkrar işlətmək təhlükəsizdir.', ''];
parts.forEach((p, i) => {
  n++;
  fs.writeFileSync(path.join(SON_DIR, `Son${n}.sql`), head(`15 yeni cədvəlin tərcümələri (hissə ${i + 1}/${parts.length})`).concat(p).join('\n'), 'utf8');
});

// ── 2) lang sütunu ──
n++;
fs.copyFileSync(path.join(ROOT, 'supabase', 'migrations', '20260813150020_baby_names_lang.sql'), path.join(SON_DIR, `Son${n}.sql`));

// ── 3) Ad seed-i ──
n++;
fs.copyFileSync(path.join(ROOT, 'supabase', 'migrations', '20260813150021_baby_names_tr_ru_seed.sql'), path.join(SON_DIR, `Son${n}.sql`));

// ── 4) Tool təsviri OVERRIDE (köhnə dəyərin üstünə yazır) ──
const chunks = JSON.parse(fs.readFileSync(path.join(__dirname, 'chunks', 'tool_configs.json'), 'utf8'));
const namesRow = chunks.find((r) => r.tool_id === 'names');
const matRow = chunks.find((r) => r.tool_id === 'maternity-calculator');
const overrides = [
  `-- SON DELTA — alət təsvirlərinin ölkə-adaptasiya düzəlişi (OVERRIDE, köhnə dəyəri əvəz edir)`,
  '',
  `UPDATE public.tool_configs SET description_ru = 'Русские и популярные имена со значениями' WHERE id = '${namesRow.id}';`,
  `UPDATE public.tool_configs SET description_tr = 'Türkçe ve popüler isimler arasından seçim yapın' WHERE id = '${namesRow.id}';`,
  `UPDATE public.tool_configs SET description_ru = 'Рассчитайте декретные выплаты по правилам выбранной страны' WHERE id = '${matRow.id}';`,
  `UPDATE public.tool_configs SET description_tr = 'Seçtiğiniz ülkenin kurallarına göre doğum izni ödeneğini hesaplayın' WHERE id = '${matRow.id}';`,
];
n++;
fs.writeFileSync(path.join(SON_DIR, `Son${n}.sql`), overrides.join('\n'), 'utf8');
// Migrasiya kimi də saxla (db push yolu üçün)
fs.writeFileSync(path.join(ROOT, 'supabase', 'migrations', '20260813150022_tool_desc_country_fix.sql'), overrides.join('\n'), 'utf8');

console.log(`✓ Delta: ${totalUpdates} UPDATE (15 cədvəl)`);
fs.readdirSync(SON_DIR).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).forEach((f) => {
  console.log(`   supabase/son/${f}  (${Math.round(fs.statSync(path.join(SON_DIR, f)).size / 1024)} KB)`);
});
