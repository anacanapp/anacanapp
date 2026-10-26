/**
 * Content tərcüməsi — BÜTÜN reyestr cədvəllərini ardıcıl işlədir (istənilən dil).
 * Hər cədvəl üçün azure-translate.cjs <table> <lang> çağırır (resume/dedupe daxilində var).
 * İstifadə: node scripts/content-i18n/run-kk-all.cjs [--lang kk] [--conc 2]
 * Log-a yazır, sonda xülasə çap edir. Təkrar işə salmaq təhlükəsizdir.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const getOpt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? String(args[i + 1]) : dflt; };
const CONC = getOpt('--conc', '2');
const LANG = getOpt('--lang', 'kk');

// Prioritet sırası: istifadəçiyə ən çox görünən kiçik cədvəllər əvvəl, nəhənglər sonda
const ORDER = [
  // ── kiçik/kritik ──
  'intro_slides', 'onboarding_stages', 'premium_plans', 'weekly_tips', 'trimester_tips',
  'nutrition_tips', 'development_tips', 'partner_daily_tips', 'faqs', 'blog_categories',
  'flow_insights', 'flow_phase_tips', 'epds_questions', 'hospital_bag_templates',
  'first_aid_scenarios', 'first_aid_steps', 'baby_crisis_periods', 'mental_health_resources',
  'breathing_exercises', 'cakes', 'exercises', 'vitamins',
  // ── extra reyestr (kiçik) ──
  'ai_suggested_questions', 'baby_milestones_db', 'baby_month_illustrations', 'common_foods',
  'default_shopping_items', 'flow_symptoms_db', 'maternity_guidelines', 'meal_types',
  'mood_options', 'mood_levels', 'nutrition_targets', 'recipe_categories', 'safety_categories',
  'shop_categories', 'support_categories', 'surprise_ideas', 'symptoms', 'weight_recommendations',
  'white_noise_sounds', 'zodiac_signs', 'place_categories', 'place_amenities', 'fairy_tale_themes',
  'noise_thresholds', 'play_inventory_items', 'baby_teeth_db', 'teething_care_tips',
  'teething_symptoms', 'photoshoot_image_styles', 'photoshoot_backgrounds', 'photoshoot_outfits',
  'photoshoot_eye_colors', 'photoshoot_hair_colors', 'photoshoot_hair_styles',
  'legal_documents', 'mom_friendly_places', 'play_activities', 'admin_recipes', 'tool_configs',
  'healthcare_providers', 'vaccine_countries',
  // ── orta ──
  // scheduled_notifications ƏVVƏL SİYAHIDA YOX İDİ → statik pushlar bütün
  // dillərdə AZ gedirdi (kk istifadəçi şikayəti). İndi daxildir.
  'scheduled_notifications',
  'pregnancy_day_notifications', 'safety_items', 'baby_names_db', 'vaccines', 'vaccine_schedules',
  // ── nəhənglər ──
  'blog_posts', 'pregnancy_daily_content', 'mommy_daily_messages', 'baby_daily_info',
  'mommy_day_notifications',
];

// Böyük sətirli cədvəllər üçün xüsusi --rows
const ROWS_OVERRIDE = {
  blog_posts: '1',
  pregnancy_daily_content: '3',
  legal_documents: '1',
  admin_recipes: '3',
};

const chunksDir = path.join(__dirname, 'chunks');
const summary = [];
const t0 = Date.now();

for (const table of ORDER) {
  const chunkPath = path.join(chunksDir, `${table}.json`);
  if (!fs.existsSync(chunkPath) || fs.statSync(chunkPath).size < 10) {
    summary.push(`${table}: chunk yoxdur/boş — ötürüldü`);
    continue;
  }
  console.log(`\n════════ ${table} → ${LANG} ════════`);
  const rows = ROWS_OVERRIDE[table] || '6';
  const r = spawnSync('node', [
    path.join(__dirname, 'azure-translate.cjs'), table, LANG,
    '--conc', CONC, '--rows', rows,
  ], { stdio: 'inherit' });
  summary.push(`${table}: exit=${r.status}`);
}

console.log(`\n══════ XÜLASƏ (${Math.round((Date.now() - t0) / 60000)} dəq) ══════`);
summary.forEach((s) => console.log(' ', s));
console.log('Sonra: node scripts/content-i18n/build-qazax-sql.cjs');
