// teething_symptoms.relief_tips_{ru,tr,kk,de,ar} vergüllə ayrılmış PLAIN STRING kimi
// saxlanılıb (relief_tips_en isə düzgün JSON-array-string idi) — mapRowTranslation-ın
// JSON.parse-i buna görə fail olur və səssizcə əsas (EN) massivə geri qayıdır. Bu skript
// canlı sətirləri oxuyub vergüllə bölür və düzgün JSON massiv sətrinə çevirən UPDATE SQL yaradır.
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(env.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);

const LANGS = ['ru', 'tr', 'kk', 'de', 'ar'];
const esc = (s) => String(s).replace(/'/g, "''");

(async () => {
  const su = await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'diag_' + Date.now() + '@anacan-test.dev', password: 'Test1234!diag' }) });
  const d = await su.json();
  const H = { apikey: KEY, Authorization: 'Bearer ' + d.access_token };
  const cols = ['id', ...LANGS.map((l) => `relief_tips_${l}`)].join(',');
  const r = await fetch(`${URL_}/rest/v1/teething_symptoms?select=${cols}&order=sort_order.asc`, { headers: H });
  const rows = await r.json();
  if (!Array.isArray(rows)) { console.error('XƏTA:', JSON.stringify(rows)); process.exit(1); }
  console.log(`teething_symptoms: ${rows.length} sətir`);

  const stmts = [];
  let fixedCount = 0;
  for (const row of rows) {
    const sets = [];
    for (const lang of LANGS) {
      const field = `relief_tips_${lang}`;
      const val = row[field];
      if (typeof val !== 'string' || !val.trim()) continue;
      // Artıq düzgün JSON massiv-sətridirsə (["a","b"] formatında) toxunma
      let alreadyOk = false;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) alreadyOk = true;
      } catch { /* JSON deyil — vergüllə bölünmüş plain string deməkdir */ }
      if (alreadyOk) continue;

      const items = val.split(',').map((s) => s.trim()).filter(Boolean);
      const jsonArrayStr = JSON.stringify(items); // məs: ["a","b","c"]
      sets.push(`${field} = '${esc(jsonArrayStr)}'`);
      fixedCount++;
    }
    if (sets.length) {
      stmts.push(`UPDATE public.teething_symptoms SET ${sets.join(', ')} WHERE id = '${row.id}';`);
    }
  }

  const body = [
    '-- ============================================================',
    '-- Duzelis1 — teething_symptoms.relief_tips_{ru,tr,kk,de,ar} bug fix',
    '-- Bu sütunlar vergüllə ayrılmış PLAIN STRING kimi saxlanılmışdı (relief_tips_en',
    '-- düzgün JSON-array-string idi) — mapRowTranslation-ın JSON.parse-i fail olub',
    '-- səssizcə əsas (İngilis) massivə geri qayıdırdı (bu, "Wipe drool frequently",',
    '-- "Gentle massage", "Extra cuddles" kimi mətnlərin BÜTÜN dillərdə görünmə bug-udur).',
    '-- Bu fayl mövcud tərcümə MƏZMUNUNU dəyişmir, YALNIZ formatını (comma-string → JSON array).',
    '-- İdempotentdir (artıq düzgün olanlara toxunmur).',
    '-- ============================================================',
    '',
    stmts.join('\n'),
    '',
  ].join('\n');
  const outPath = path.join(__dirname, '..', '..', 'supabase', 'duzelis', 'Duzelis1.sql');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, body, 'utf8');
  console.log(`✓ supabase/duzelis/Duzelis1.sql — ${stmts.length} UPDATE (${fixedCount} sahə)`);
})();
