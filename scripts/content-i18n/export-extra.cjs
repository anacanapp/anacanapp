/**
 * gaps.json əsasında yeni/qismən cədvəlləri chunks/-a export edir (select=*, paginated)
 * və registry-extra.json yaradır (azure-translate + build-sql üçün tip məlumatı).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const envRaw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const URL_ = clean(envRaw.match(/VITE_SUPABASE_URL=(.+)/)[1]);
const KEY = clean(envRaw.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/)[1]);
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

// Yeni cədvəllər (tam) — gaps skanından
const NEW_TABLES = [
  'ai_suggested_questions', 'baby_milestones_db', 'baby_month_illustrations',
  'common_foods', 'default_shopping_items', 'flow_symptoms_db', 'maternity_guidelines',
  'meal_types', 'mood_options', 'nutrition_targets', 'photoshoot_image_styles',
  'premium_plans', 'recipe_categories', 'safety_categories', 'safety_items',
  'shop_categories', 'support_categories', 'surprise_ideas', 'symptoms',
  'tool_configs', 'weight_recommendations', 'white_noise_sounds',
];
// Qismən sahə boşluğu olanlar — chunk select=* ilə YENİLƏNİR (köhnə chunk dar idi)
const REEXPORT = ['vitamins', 'exercises', 'baby_names_db'];

(async () => {
  const gaps = JSON.parse(fs.readFileSync(path.join(__dirname, 'gaps.json'), 'utf8'));
  const registryExtra = {};

  for (const g of gaps) {
    if (!NEW_TABLES.includes(g.table) || g.error || g.note) continue;
    const cfg = { text: [], arr: [], json: [] };
    for (const [f, t] of Object.entries(g.fieldTypes)) {
      (t === 'arr' ? cfg.arr : t === 'json' ? cfg.json : cfg.text).push(f);
    }
    registryExtra[g.table] = cfg;
  }
  fs.writeFileSync(path.join(__dirname, 'registry-extra.json'), JSON.stringify(registryExtra, null, 1), 'utf8');
  console.log('✓ registry-extra.json:', Object.keys(registryExtra).length, 'cədvəl');

  for (const table of [...NEW_TABLES, ...REEXPORT]) {
    const rows = [];
    for (let off = 0; ; off += 1000) {
      const r = await fetch(`${URL_}/rest/v1/${table}?select=*&order=id.asc&limit=1000&offset=${off}`, { headers: H });
      if (!r.ok) { console.log(`✗ ${table}: HTTP ${r.status}`); break; }
      const d = await r.json();
      rows.push(...d);
      if (d.length < 1000) break;
    }
    if (rows.length) {
      fs.writeFileSync(path.join(__dirname, 'chunks', `${table}.json`), JSON.stringify(rows, null, 1), 'utf8');
      console.log(`✓ chunk: ${table} (${rows.length} sətir)`);
    }
  }
})();
