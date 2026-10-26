/**
 * Seed faylını DB `translations` cədvəlinə yükləyir (seed-translations edge fn).
 *
 * NƏ ÜÇÜN: KÖHNƏ native buildlərdə yeni dilin (məs. uz) seed-i bundle-da YOXDUR,
 * amma i18n.ts `loadTranslations(lang)` DB-dən BÜTÜN açarları yükləyib keşləyir —
 * yəni bu yükləmədən sonra köhnə buildlər app update OLMADAN həmin dildə tam
 * işləyir (app_languages-də is_active=true olduqda siyahıda da görünür).
 *
 * İstifadə:
 *   CRON_SECRET=... node scripts/i18n/upload-seed-to-db.cjs uz
 *   CRON_SECRET=... node scripts/i18n/upload-seed-to-db.cjs uz --dry   (yalnız say)
 *
 * Qeyd: mövcud sətirlər upsert olunur (key,lang unikaldır) — admin düzəlişləri
 * seed dəyəri ilə ƏZİLİR; admin overlay-larını qorumaq lazımdırsa əvvəl DB-dən
 * fərqləri çıxarın. (uz üçün ilk yükləmədir — konflikt yoxdur.)
 */
const fs = require('fs');
const path = require('path');

const LANG = process.argv[2];
const DRY = process.argv.includes('--dry');
const SECRET = process.env.CRON_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tntbjulojatnrqmylorp.supabase.co';

if (!LANG) { console.error('İstifadə: CRON_SECRET=... node upload-seed-to-db.cjs <lang>'); process.exit(1); }
if (!SECRET && !DRY) { console.error('✗ CRON_SECRET env dəyişəni tələb olunur'); process.exit(1); }

const seedPath = LANG === 'en'
  ? path.join(__dirname, '..', '..', 'src', 'locales', 'en.json')
  : path.join(__dirname, `${LANG}.seed.json`);
if (!fs.existsSync(seedPath)) { console.error('✗ Seed tapılmadı:', seedPath); process.exit(1); }

const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
const rows = Object.entries(seed)
  .filter(([, v]) => typeof v === 'string' && v.trim())
  .map(([key, value]) => ({ key, lang: LANG, value, namespace: 'app' }));

console.log(`${LANG}: ${rows.length} açar hazırlanır (mənbə: ${path.basename(seedPath)})`);
if (DRY) process.exit(0);

(async () => {
  const BATCH = 500;
  let uploaded = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/seed-translations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-seed-secret': SECRET },
      body: JSON.stringify({ rows: slice }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.error) {
      console.error(`✗ batch ${i / BATCH + 1}: HTTP ${resp.status}`, data.error || '');
      process.exit(1);
    }
    uploaded += slice.length;
    process.stdout.write(`  ${uploaded}/${rows.length}\r`);
  }
  console.log(`\n✓ ${uploaded} açar DB-yə yükləndi (lang=${LANG})`);
})();
