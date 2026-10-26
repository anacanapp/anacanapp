/**
 * Content i18n — Fable pipeline, addım 3: SQL SEED.
 *
 * out/{ru,tr}/{table}.json  ({ "<row-id>": { field: dəyər, ... } })  →
 * guarded UPDATE-lərdən ibarət migration (COALESCE — mövcud dəyərlərə toxunmur,
 * ona görə fayl idempotentdir və gələcək inkrementlərlə təkrar generasiya təhlükəsizdir).
 *
 * İşlətmə:
 *   node scripts/content-i18n/build-sql.cjs                      → default migration adı
 *   node scripts/content-i18n/build-sql.cjs 20260814090000       → yeni timestamp (inkrement üçün)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');

// Sahə tipi təsnifatı (edge function registry ilə sinxron)
const FIELD_TYPES = {
  pregnancy_daily_content: { arr: ['foods_to_avoid', 'mother_symptoms', 'recommended_exercises', 'recommended_foods', 'tests_to_do'] },
  weekly_tips: { json: ['tips'] },
  admin_recipes: { arr: ['tags'], json: ['ingredients', 'instructions'] },
  baby_crisis_periods: { arrText: ['symptoms', 'tips'] },
  vitamins: { arr: ['benefits', 'food_sources'] },
};

// registry-extra.json-dan tip məlumatını birləşdir ({table:{text:[],arr:[],json:[]}})
const extraPath = path.join(__dirname, 'registry-extra.json');
if (fs.existsSync(extraPath)) {
  const extra = JSON.parse(fs.readFileSync(extraPath, 'utf8'));
  for (const [t, cfg] of Object.entries(extra)) {
    if (cfg.arr?.length || cfg.json?.length || cfg.arrText?.length) {
      FIELD_TYPES[t] = FIELD_TYPES[t] || {};
      if (cfg.arr?.length) FIELD_TYPES[t].arr = [...new Set([...(FIELD_TYPES[t].arr || []), ...cfg.arr])];
      if (cfg.json?.length) FIELD_TYPES[t].json = [...new Set([...(FIELD_TYPES[t].json || []), ...cfg.json])];
      if (cfg.arrText?.length) FIELD_TYPES[t].arrText = [...new Set([...(FIELD_TYPES[t].arrText || []), ...cfg.arrText])];
    }
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

(async () => {
  const stamp = process.argv[2] || '20260813150000';
  // SQL editor "request entity too large" limitinə görə hissələmə (default ~800KB/hissə)
  const maxIdx = process.argv.indexOf('--max-kb');
  const MAX_BYTES = (maxIdx >= 0 ? Number(process.argv[maxIdx + 1]) : 800) * 1024;

  const header = (part, totalNote) => [
    '-- ============================================================',
    `-- Content Seed${part ? ` — HİSSƏ ${part}` : ''}: DB kontentinin ru/tr tərcümələri`,
    '-- COALESCE + guarded UPDATE — mövcud/əl tərcümələri qorunur (idempotent).',
    '-- Hissələri istənilən ardıcıllıqla, istənilən qədər təkrar işlətmək təhlükəsizdir.',
    totalNote ? `-- ${totalNote}` : '-- Mənbə pipeline: scripts/content-i18n/',
    '-- ============================================================',
    '',
  ];

  const lines = [];

  let totalUpdates = 0;
  const perTable = {};

  for (const lang of ['ru', 'tr']) {
    const dir = path.join(OUT, lang);
    if (!fs.existsSync(dir)) continue;
    // Fayl formatları:
    //   {table}.json          → { "<id>": {field: value} }
    //   _batchN.json (multi)  → { "<table>": { "<id>": {field: value} } }
    const tableData = {}; // table -> { id -> fields }
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const mergeRows = (table, rows) => {
        tableData[table] = tableData[table] || {};
        for (const [id, fieldsObj] of Object.entries(rows)) {
          // id-səviyyəsində DƏRİN birləşdirmə: sonrakı batch əvvəlki sahələri silmir
          tableData[table][id] = { ...(tableData[table][id] || {}), ...fieldsObj };
        }
      };
      if (path.basename(f).startsWith('_')) {
        for (const [table, rows] of Object.entries(data)) mergeRows(table, rows);
      } else {
        mergeRows(path.basename(f, '.json'), data);
      }
    }
    for (const [table, data] of Object.entries(tableData)) {
      const ids = Object.keys(data);
      if (!ids.length) continue;
      lines.push(`-- ── ${table} → ${lang} (${ids.length} sətir) ──`);
      for (const id of ids) {
        const fieldsObj = data[id];
        const sets = [];
        for (const [field, value] of Object.entries(fieldsObj)) {
          if (value === null || value === undefined) continue;
          if (typeof value === 'string' && !value.trim()) continue;
          const col = `${field}_${lang}`;
          sets.push(`${col} = COALESCE(${col}, ${sqlValue(table, field, value)})`);
        }
        if (!sets.length) continue;
        lines.push(`UPDATE public.${table} SET ${sets.join(', ')} WHERE id = '${esc(id)}';`);
        totalUpdates++;
        perTable[`${table}/${lang}`] = (perTable[`${table}/${lang}`] || 0) + 1;
      }
      lines.push('');
    }
  }

  // ── Hissələmə: statement sərhədində, MAX_BYTES-i keçməyən fayllar ──
  const migDir = path.join(ROOT, 'supabase', 'migrations');
  // Köhnə tək faylı və əvvəlki part fayllarını təmizlə (təkrar generasiya təmiz qalsın)
  for (const f of fs.readdirSync(migDir)) {
    if (f.startsWith(stamp.slice(0, 12)) && f.includes('content_ru_tr_seed_fable')) {
      fs.unlinkSync(path.join(migDir, f));
    }
  }

  const parts = [];
  let cur = [];
  let curBytes = 0;
  for (const line of lines) {
    const b = Buffer.byteLength(line, 'utf8') + 1;
    if (curBytes + b > MAX_BYTES && cur.length) {
      parts.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(line);
    curBytes += b;
  }
  if (cur.length) parts.push(cur);

  const base = Number(stamp);
  const files = [];
  parts.forEach((partLines, i) => {
    const partStamp = String(base + i); // 20260813150000, ...0001, ... (160000-dan əvvəl qalır)
    const name = parts.length === 1
      ? `${stamp}_content_ru_tr_seed_fable.sql`
      : `${partStamp}_content_ru_tr_seed_fable_part${String(i + 1).padStart(2, '0')}.sql`;
    const p = path.join(migDir, name);
    const head = header(parts.length > 1 ? `${i + 1}/${parts.length}` : '', `Cəmi: ${totalUpdates} UPDATE, ${parts.length} hissə`);
    fs.writeFileSync(p, head.concat(partLines).join('\n'), 'utf8');
    files.push({ name, kb: Math.round(fs.statSync(p).size / 1024) });
  });

  console.log(`✓ ${totalUpdates} UPDATE → ${parts.length} fayl (max ${Math.round(MAX_BYTES / 1024)} KB):`);
  files.forEach((f) => console.log(`   ${f.name}  (${f.kb} KB)`));
  Object.entries(perTable).forEach(([k, v]) => console.log('  ', k.padEnd(40), v));
})();
