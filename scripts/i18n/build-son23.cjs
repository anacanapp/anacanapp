// Son23: blog_posts ölkə sütunları + mini oyun açarlarının DB tərcümələri
// Oyun açarları seed-lərdə var idi, amma heç vaxt DB translations-a düşməmişdi.
const fs = require('fs');

// 1) Oyun fayllarında istifadə olunan tr() açarlarını topla
const files = [
  'src/components/games/MiniGamesHub.tsx',
  'src/components/games/saglam-sebet/SaglamSebetGame.tsx',
  'src/components/games/saglam-sebet/SaglamSebetLevels.tsx',
  'src/components/games/saglam-sebet/levelConfig.ts',
  'src/components/games/birlesdir/BirlesdirGame.tsx',
  'src/components/games/birlesdir/BirlesdirLevels.tsx',
  'src/components/games/birlesdir/levelConfig.ts',
  'src/components/games/birlesdir/tileDefs.ts',
  'src/components/games/Leaderboard.tsx',
  'src/components/games/GameLevelSelectGrid.tsx',
  'src/components/games/tierLabels.ts',
];
const used = new Set();
for (const f of files) {
  try {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/tr\(\s*['"]([\w.]+)['"]/g)) used.add(m[1]);
  } catch { /* yoxdur */ }
}

const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const ru = JSON.parse(fs.readFileSync('scripts/i18n/ru.seed.json', 'utf8'));
const trs = JSON.parse(fs.readFileSync('scripts/i18n/tr.seed.json', 'utf8'));

const esc = (s) => String(s).replace(/'/g, "''");
const rows = [];
let cnt = 0;
for (const k of [...used].sort()) {
  if (ru[k]) rows.push(`  ('${k}', 'ru', '${esc(ru[k])}', 'common')`);
  if (trs[k]) rows.push(`  ('${k}', 'tr', '${esc(trs[k])}', 'common')`);
  if (en[k]) rows.push(`  ('${k}', 'en', '${esc(en[k])}', 'common')`);
  cnt++;
}

const sql = [
  '-- ============================================================',
  '-- Son23: 1) blog_posts ölkə hədəfləməsi (admin include/exclude)',
  `--        2) mini oyun açarlarının tərcümələri (${cnt} açar — DB-yə heç düşməmişdi)`,
  '-- ============================================================',
  '',
  'ALTER TABLE public.blog_posts',
  '  ADD COLUMN IF NOT EXISTS countries_include text[],',
  '  ADD COLUMN IF NOT EXISTS countries_exclude text[];',
  '',
  "COMMENT ON COLUMN public.blog_posts.countries_include IS 'Boş deyilsə: yalnız bu ISO ölkə kodlarına görünür';",
  "COMMENT ON COLUMN public.blog_posts.countries_exclude IS 'Bu ölkələrdə gizlənir';",
  '',
  '-- Mini oyun UI açarları (idempotent)',
  'INSERT INTO public.translations (key, lang, value, namespace) VALUES',
  rows.join(',\n'),
  'ON CONFLICT (key, lang) DO NOTHING;',
  '',
].join('\n');

fs.writeFileSync('supabase/son/Son23.sql', sql);
fs.writeFileSync('supabase/migrations/20260813150041_blog_countries_and_game_keys.sql', sql);
console.log(`✓ Son23.sql: ${cnt} açar, ${rows.length} sətir + blog sütunları`);
