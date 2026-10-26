/**
 * Content i18n — Fable pipeline, addım 1: EXPORT.
 *
 * Remote Supabase-dən (anon key, yalnız public-read) registry cədvəllərinin
 * ru/tr hədəfi boş olan sətirlərini çəkib chunks/ qovluğuna yazır.
 * Sonra Claude Fable bu chunk-ları sessiyada tərcümə edir (out/{lang}/...),
 * build-sql.cjs isə guarded UPDATE migration-u yaradır.
 *
 * İşlətmə:
 *   node scripts/content-i18n/export.cjs --probe          # yalnız say/həcm
 *   node scripts/content-i18n/export.cjs                  # hamısını export et
 *   node scripts/content-i18n/export.cjs weekly_tips faqs # seçilmiş cədvəllər
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(__dirname, 'chunks');

const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
const URL_ = env.match(/VITE_SUPABASE_URL="([^"]+)"/)[1];
const KEY = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"/)[1];

// translate-content edge function registry-si ilə sinxron
// text: string; arr: string[]; json: jsonb(string[]); arrText: mənbə string[] (hədəf TEXT)
const REGISTRY = {
  pregnancy_daily_content: {
    text: ['baby_development', 'baby_message', 'baby_size_fruit', 'body_changes', 'daily_tip',
      'doctor_visit_tip', 'emotional_tip', 'exercise_tip', 'mother_tips', 'mother_warnings',
      'nutrition_tip', 'partner_tip'],
    arr: ['foods_to_avoid', 'mother_symptoms', 'recommended_exercises', 'recommended_foods', 'tests_to_do'],
    order: 'pregnancy_day',
  },
  weekly_tips: { text: ['title', 'content'], json: ['tips'], order: 'week_number' },
  baby_daily_info: { text: ['info'], order: 'day_number' },
  mommy_daily_messages: { text: ['message'], order: 'day_number' },
  admin_recipes: { text: ['title', 'description', 'category'], arr: ['tags'], json: ['ingredients', 'instructions'] },
  nutrition_tips: { text: ['title', 'content'] },
  trimester_tips: { text: ['tip_text'], order: 'trimester' },
  blog_posts: { text: ['title', 'excerpt', 'content'] },
  blog_categories: { text: ['name', 'description'] },
  faqs: { text: ['question', 'answer'] },
  development_tips: { text: ['title', 'content'] },
  partner_daily_tips: { text: ['tip_text'] },
  flow_insights: { text: ['title', 'content'] },
  flow_phase_tips: { text: ['tip_text'] },
  epds_questions: { text: ['question_text'] },
  hospital_bag_templates: { text: ['item_name', 'notes'] },
  onboarding_stages: { text: ['title', 'subtitle', 'description'] },
  first_aid_scenarios: { text: ['title', 'description'] },
  first_aid_steps: { text: ['title', 'instruction'] },
  play_activities: { text: ['title', 'description', 'instructions'] },
  baby_crisis_periods: { text: ['title', 'description'], arrText: ['symptoms', 'tips'], order: 'leap_number' },
  mental_health_resources: { text: ['name', 'description'] },
  breathing_exercises: { text: ['name', 'description'] },
  vitamins: { text: ['dosage', 'importance'], arr: ['benefits', 'food_sources'] },
  exercises: { text: ['description'] },
  intro_slides: { text: ['title', 'subtitle', 'description'] },
  products: { text: ['name', 'description', 'category'] },
  cakes: { text: ['name', 'description', 'milestone_label'] },
  baby_names_db: { text: ['origin'] },
};

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function fetchAll(table, select) {
  const rows = [];
  const page = 500;
  let from = 0;
  for (;;) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${select}`, {
      headers: { ...H, Range: `${from}-${from + page - 1}` },
    });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status} ${await r.text()}`);
    const data = await r.json();
    rows.push(...data);
    if (data.length < page) break;
    from += page;
  }
  return rows;
}

async function count(table) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=id&limit=1`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  const cr = r.headers.get('content-range');
  return { status: r.status, total: cr ? Number(cr.split('/')[1]) : null };
}

(async () => {
  const args = process.argv.slice(2);
  const probe = args.includes('--probe');
  const pick = args.filter((a) => !a.startsWith('--'));
  const tables = pick.length ? pick : Object.keys(REGISTRY);

  if (probe) {
    let grand = 0;
    for (const t of tables) {
      const cfg = REGISTRY[t];
      const { status, total } = await count(t);
      if (status !== 200 && status !== 206) { console.log(t.padEnd(28), `HTTP ${status} (RLS bağlı ola bilər)`); continue; }
      // AZ mətn həcmini təxmin et: ilk 30 sətirin sahə uzunluqları
      const fields = [...(cfg.text || []), ...(cfg.arr || []), ...(cfg.json || []), ...(cfg.arrText || [])];
      let sample = [];
      try { sample = await fetchAll(`${t}?limit=30`.split('?')[0] + '', encodeURIComponent(fields.join(',')) ) } catch { /* ignore */ }
      let avg = 0;
      try {
        const r = await fetch(`${URL_}/rest/v1/${t}?select=${fields.join(',')}&limit=30`, { headers: H });
        if (r.ok) {
          const data = await r.json();
          const lens = data.map((row) => JSON.stringify(row).length);
          avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0;
        }
      } catch { /* ignore */ }
      const estKB = Math.round((avg * (total || 0)) / 1024);
      grand += estKB;
      console.log(t.padEnd(28), `sətir: ${String(total).padStart(5)}   ~orta sətir: ${avg}b   ~AZ həcm: ${estKB} KB`);
    }
    console.log('CƏMİ təxmini AZ həcm:', grand, 'KB');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = [];
  for (const t of tables) {
    const cfg = REGISTRY[t];
    if (!cfg) { console.log('naməlum cədvəl:', t); continue; }
    const fields = [...(cfg.text || []), ...(cfg.arr || []), ...(cfg.json || []), ...(cfg.arrText || [])];
    const langCols = [];
    for (const f of fields) langCols.push(`${f}_ru`, `${f}_tr`);
    const select = ['id', cfg.order, ...fields, ...fields.map((f) => `${f}_az`), ...langCols]
      .filter(Boolean)
      .join(',');
    let rows;
    try {
      rows = await fetchAll(t, select);
    } catch (e) {
      // _az sütunu olmayan cədvəllər üçün selecti sadələşdir
      try {
        rows = await fetchAll(t, ['id', cfg.order, ...fields, ...langCols].filter(Boolean).join(','));
      } catch (e2) {
        console.log(`✗ ${t}: ${String(e2.message).slice(0, 140)}`);
        continue;
      }
    }
    const items = [];
    for (const row of rows) {
      const src = {};
      const need = { ru: false, tr: false };
      for (const f of fields) {
        const base = row[f] ?? row[`${f}_az`];
        if (base === null || base === undefined) continue;
        if (typeof base === 'string' && !base.trim()) continue;
        if (Array.isArray(base) && base.length === 0) continue;
        src[f] = base;
        for (const lang of ['ru', 'tr']) {
          const tgt = row[`${f}_${lang}`];
          if (tgt === null || tgt === undefined || String(tgt).length === 0) need[lang] = true;
        }
      }
      if (Object.keys(src).length === 0) continue;
      if (!need.ru && !need.tr) continue;
      items.push({ id: row.id, _o: cfg.order ? row[cfg.order] : undefined, ...src });
    }
    const file = path.join(OUT_DIR, `${t}.json`);
    fs.writeFileSync(file, JSON.stringify(items, null, 1), 'utf8');
    const kb = Math.round(fs.statSync(file).size / 1024);
    manifest.push({ table: t, rows: items.length, kb });
    console.log(`✓ ${t.padEnd(28)} ${String(items.length).padStart(5)} sətir  ${kb} KB`);
  }
  fs.writeFileSync(path.join(OUT_DIR, '_manifest.json'), JSON.stringify(manifest, null, 1), 'utf8');
  console.log('Export tamam →', OUT_DIR);
})();
