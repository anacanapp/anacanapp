// Son25: premium_features ru/tr + billingscreen açarları + partner ölkə/etiketlər + hero headline
const fs = require('fs');

// ── premium_features 16 sətir (title EN unikaldır — WHERE title=) ──
const PF = {
  'AI Doctor Chat': { tru: 'AI-чат с доктором', ttr: 'AI Doktor Sohbeti', dru: '10 сообщений в день', dtr: 'Günde 10 mesaj' },
  'White Noise': { tru: 'Успокаивающие звуки', ttr: 'Sakinleştirici Sesler', dru: 'Бесплатно 20 мин/день / Безлимит', dtr: 'Ücretsiz günde 20 dk / Sınırsız' },
  'Baby Photoshoot': { tru: 'Фотосессия малыша', ttr: 'Bebek Fotoğraf Çekimi', dru: 'Бесплатно 3 фото / Безлимит', dtr: 'Ücretsiz 3 fotoğraf / Sınırsız' },
  'Fairy Tales': { tru: 'Создай сказку', ttr: 'Masal Oluştur', dru: 'Бесплатно 3 в день / Безлимит', dtr: 'Ücretsiz günde 3 / Sınırsız' },
  'Cry Translator': { tru: 'Анализ плача', ttr: 'Ağlama Analizi', dru: 'Бесплатно 3 в день / Безлимит', dtr: 'Ücretsiz günde 3 / Sınırsız' },
  'Poop Scanner': { tru: 'Сканер подгузника', ttr: 'Bez Tarayıcı', dru: 'Бесплатно 3 в день / Безлимит', dtr: 'Ücretsiz günde 3 / Sınırsız' },
  'Nutrition Tracking': { tru: 'Трекер питания', ttr: 'Beslenme Takibi', dru: 'Только Premium', dtr: 'Sadece Premium' },
  'Exercise Programs': { tru: 'Программы упражнений', ttr: 'Egzersiz Programları', dru: 'Только Premium', dtr: 'Sadece Premium' },
  'Mom-Friendly Map': { tru: 'Карта для мам', ttr: 'Anne Dostu Harita', dru: 'Только Premium', dtr: 'Sadece Premium' },
  'Horoscope': { tru: 'Гороскоп', ttr: 'Burç Yorumu', dru: 'Только Premium', dtr: 'Sadece Premium' },
  'Safety Lookup': { tru: 'Проверка безопасности', ttr: 'Güvenlik Kontrolü', dru: 'Только Premium', dtr: 'Sadece Premium' },
  'Blood Sugar Tracker': { tru: 'Трекер сахара в крови', ttr: 'Kan Şekeri Takibi', dru: 'Только Premium', dtr: 'Sadece Premium' },
  'Pregnancy Album': { tru: 'Альбом беременности', ttr: 'Hamilelik Albümü', dru: 'Только Premium', dtr: 'Sadece Premium' },
  'Recipes': { tru: 'Рецепты', ttr: 'Tarifler', dru: '3 бесплатно в категории / Безлимит', dtr: 'Kategoride 3 ücretsiz / Sınırsız' },
  'Ad-Free Experience': { tru: 'Без рекламы', ttr: 'Reklamsız Deneyim', dru: 'Никакой рекламы', dtr: 'Hiç reklam yok' },
  'Priority Support': { tru: 'Приоритетная поддержка', ttr: 'Öncelikli Destek', dru: 'Быстрая техподдержка', dtr: 'Hızlı teknik destek' },
};

// ── partner kateqoriyaları ──
const PC = {
  spa: { ru: 'Спа и массаж', tr: 'Spa & Masaj' },
  gym: { ru: 'Спортзал', tr: 'Spor Salonu' },
  pilates: { ru: 'Пилатес и йога', tr: 'Pilates & Yoga' },
  beauty: { ru: 'Салон красоты', tr: 'Güzellik Salonu' },
  clinic: { ru: 'Клиника', tr: 'Klinik' },
  other: { ru: 'Другое', tr: 'Diğer' },
};

// ── billingscreen 26 açarının ru/tr tərcümələri (az/en mövcuddur) ──
const az = JSON.parse(fs.readFileSync('src/locales/az.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('src/locales/en.json', 'utf8'));
const BILL_RU_TR = {
  billingscreen_abunelik: { ru: 'Подписка', tr: 'Abonelik' },
  billingscreen_cari_plan: { ru: 'Текущий план', tr: 'Mevcut plan' },
  billingscreen_restore_success: { ru: 'Подписка восстановлена', tr: 'Abonelik geri yüklendi' },
  billingscreen_restore_success_desc: { ru: 'Ваша Premium-подписка снова активна.', tr: 'Premium aboneliğiniz yeniden aktif.' },
  billingscreen_error: { ru: 'Ошибка', tr: 'Hata' },
  billingscreen_restore_error: { ru: 'Не удалось восстановить подписку.', tr: 'Abonelik geri yüklenemedi.' },
};

const esc = (s) => String(s).replace(/'/g, "''");
const lines = [
  '-- ============================================================',
  '-- Son25: premium_features ru/tr, partner kateqoriya etiketləri,',
  '--        partner_venues ölkə hədəfləməsi (+view), billing/hero açarları',
  '-- ============================================================',
  '',
  '-- 1) premium_features tərcümələri',
];
for (const [t, v] of Object.entries(PF)) {
  lines.push(`UPDATE public.premium_features SET title_ru = '${esc(v.tru)}', title_tr = '${esc(v.ttr)}', description_ru = '${esc(v.dru)}', description_tr = '${esc(v.dtr)}' WHERE title = '${esc(t)}';`);
}
lines.push('', '-- 2) Partner kateqoriya etiketləri');
for (const [k, v] of Object.entries(PC)) {
  lines.push(`UPDATE public.partner_venue_categories SET label_ru = '${esc(v.ru)}', label_tr = '${esc(v.tr)}' WHERE key = '${esc(k)}';`);
}
lines.push(
  '',
  '-- 3) partner_venues ölkə hədəfləməsi (boş/null = qlobal)',
  'ALTER TABLE public.partner_venues ADD COLUMN IF NOT EXISTS countries text[];',
  '',
  '-- 4) Public view yenidən yaradılır (pin_hash GİZLİ qalır, countries əlavə olunur)',
  'DROP VIEW IF EXISTS public.partner_venues_public;',
  'CREATE VIEW public.partner_venues_public AS',
  'SELECT id, name, name_en, slug, category_key, description, description_en,',
  '       logo_url, cover_url, gallery_urls, address, address_en, city, city_en,',
  '       district, district_en, latitude, longitude, phone, website, instagram,',
  '       working_hours, discount_label, discount_label_en, discount_terms,',
  '       discount_terms_en, discount_value, redemption_cooldown_hours,',
  '       redemption_lifetime_limit, qr_ttl_seconds, is_active, is_featured,',
  '       sort_order, countries, created_at, updated_at',
  'FROM public.partner_venues',
  'WHERE is_active = true;',
  '',
  'GRANT SELECT ON public.partner_venues_public TO anon, authenticated;',
  ''
);

// 5) translations
const insRows = [];
// billingscreen: bütün billingscreen_ açarları üçün ru/tr (yuxarıdakı əl tərcümələri + qalanlar üçün EN kopyası YOX — sadə olanları translate etdik; qalanları en-dən ru/tr-yə birbaşa çevirə bilmərik → onlar üçün en dəyəri qoyulur ki, AZ görünməsin)
const billKeys = Object.keys(az).filter((k) => k.startsWith('billingscreen_'));
for (const k of billKeys) {
  const man = BILL_RU_TR[k];
  const enV = en[k] || az[k];
  insRows.push(`  ('${k}', 'ru', '${esc(man ? man.ru : enV)}', 'common')`);
  insRows.push(`  ('${k}', 'tr', '${esc(man ? man.tr : enV)}', 'common')`);
  if (en[k]) insRows.push(`  ('${k}', 'en', '${esc(en[k])}', 'common')`);
}
// ağlama analizi + pdf notes
insRows.push(`  ('adminanalytics_aglama_analizi_0713b3', 'ru', 'Анализ плача', 'common')`);
insRows.push(`  ('adminanalytics_aglama_analizi_0713b3', 'tr', 'Ağlama Analizi', 'common')`);
insRows.push(`  ('adminanalytics_aglama_analizi_0713b3', 'en', 'Cry Analysis', 'common')`);
insRows.push(`  ('pdf_notes_ph', 'ru', 'Напишите дополнительные заметки для врача...', 'common')`);
insRows.push(`  ('pdf_notes_ph', 'tr', 'Doktorunuz için ek notlar yazın...', 'common')`);
insRows.push(`  ('pdf_notes_ph', 'en', 'Write additional notes for your doctor...', 'common')`);

lines.push('-- 5) Açarlar (yenilər idempotent)');
lines.push('INSERT INTO public.translations (key, lang, value, namespace) VALUES');
lines.push(insRows.join(',\n'));
lines.push('ON CONFLICT (key, lang) DO NOTHING;');
lines.push('');
lines.push('-- 6) Hero headline — "böyüyür" → "həyatınızdadır" (DO UPDATE)');
lines.push(`INSERT INTO public.translations (key, lang, value, namespace) VALUES`);
lines.push(`  ('mommy_hero_headline', 'ru', '${esc('{name} уже {days} дней с вами')}', 'common'),`);
lines.push(`  ('mommy_hero_headline', 'tr', '${esc('{days} gündür {name} hayatınızda')}', 'common'),`);
lines.push(`  ('mommy_hero_headline', 'en', '${esc('{name} has been in your life for {days} days')}', 'common')`);
lines.push(`ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;`);
lines.push('');

fs.writeFileSync('supabase/son/Son25.sql', lines.join('\n'));
fs.writeFileSync('supabase/migrations/20260813150043_premium_partner_billing_i18n.sql', lines.join('\n'));

// Seed faylları: billing ru/tr + hero + pdf + aglama
const ru = JSON.parse(fs.readFileSync('scripts/i18n/ru.seed.json', 'utf8'));
const trs = JSON.parse(fs.readFileSync('scripts/i18n/tr.seed.json', 'utf8'));
for (const k of billKeys) {
  const man = BILL_RU_TR[k];
  const enV = en[k] || az[k];
  if (!ru[k]) ru[k] = man ? man.ru : enV;
  if (!trs[k]) trs[k] = man ? man.tr : enV;
}
ru['adminanalytics_aglama_analizi_0713b3'] = 'Анализ плача';
trs['adminanalytics_aglama_analizi_0713b3'] = 'Ağlama Analizi';
ru['pdf_notes_ph'] = 'Напишите дополнительные заметки для врача...';
trs['pdf_notes_ph'] = 'Doktorunuz için ek notlar yazın...';
ru['mommy_hero_headline'] = '{name} уже {days} дней с вами';
trs['mommy_hero_headline'] = '{days} gündür {name} hayatınızda';
az['mommy_hero_headline'] = '{days} gündür {name} həyatınızdadır';
en['mommy_hero_headline'] = '{name} has been in your life for {days} days';
az['pdf_notes_ph'] = az['pdf_notes_ph'] || 'Həkiminiz üçün əlavə qeydlər yazın...';
en['pdf_notes_ph'] = en['pdf_notes_ph'] || 'Write additional notes for your doctor...';
fs.writeFileSync('scripts/i18n/ru.seed.json', JSON.stringify(ru, null, 2));
fs.writeFileSync('scripts/i18n/tr.seed.json', JSON.stringify(trs, null, 2));
fs.writeFileSync('src/locales/az.json', JSON.stringify(az, null, 2));
fs.writeFileSync('src/locales/en.json', JSON.stringify(en, null, 2));

console.log('✓ Son25.sql:', Object.keys(PF).length, 'premium feature +', Object.keys(PC).length, 'kateqoriya +', insRows.length, 'açar sətri');
