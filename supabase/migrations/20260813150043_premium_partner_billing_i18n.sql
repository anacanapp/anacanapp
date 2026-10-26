-- ============================================================
-- Son25: premium_features ru/tr, partner kateqoriya etiketləri,
--        partner_venues ölkə hədəfləməsi (+view), billing/hero açarları
-- ============================================================

-- 1) premium_features tərcümələri
UPDATE public.premium_features SET title_ru = 'AI-чат с доктором', title_tr = 'AI Doktor Sohbeti', description_ru = '10 сообщений в день', description_tr = 'Günde 10 mesaj' WHERE title = 'AI Doctor Chat';
UPDATE public.premium_features SET title_ru = 'Успокаивающие звуки', title_tr = 'Sakinleştirici Sesler', description_ru = 'Бесплатно 20 мин/день / Безлимит', description_tr = 'Ücretsiz günde 20 dk / Sınırsız' WHERE title = 'White Noise';
UPDATE public.premium_features SET title_ru = 'Фотосессия малыша', title_tr = 'Bebek Fotoğraf Çekimi', description_ru = 'Бесплатно 3 фото / Безлимит', description_tr = 'Ücretsiz 3 fotoğraf / Sınırsız' WHERE title = 'Baby Photoshoot';
UPDATE public.premium_features SET title_ru = 'Создай сказку', title_tr = 'Masal Oluştur', description_ru = 'Бесплатно 3 в день / Безлимит', description_tr = 'Ücretsiz günde 3 / Sınırsız' WHERE title = 'Fairy Tales';
UPDATE public.premium_features SET title_ru = 'Анализ плача', title_tr = 'Ağlama Analizi', description_ru = 'Бесплатно 3 в день / Безлимит', description_tr = 'Ücretsiz günde 3 / Sınırsız' WHERE title = 'Cry Translator';
UPDATE public.premium_features SET title_ru = 'Сканер подгузника', title_tr = 'Bez Tarayıcı', description_ru = 'Бесплатно 3 в день / Безлимит', description_tr = 'Ücretsiz günde 3 / Sınırsız' WHERE title = 'Poop Scanner';
UPDATE public.premium_features SET title_ru = 'Трекер питания', title_tr = 'Beslenme Takibi', description_ru = 'Только Premium', description_tr = 'Sadece Premium' WHERE title = 'Nutrition Tracking';
UPDATE public.premium_features SET title_ru = 'Программы упражнений', title_tr = 'Egzersiz Programları', description_ru = 'Только Premium', description_tr = 'Sadece Premium' WHERE title = 'Exercise Programs';
UPDATE public.premium_features SET title_ru = 'Карта для мам', title_tr = 'Anne Dostu Harita', description_ru = 'Только Premium', description_tr = 'Sadece Premium' WHERE title = 'Mom-Friendly Map';
UPDATE public.premium_features SET title_ru = 'Гороскоп', title_tr = 'Burç Yorumu', description_ru = 'Только Premium', description_tr = 'Sadece Premium' WHERE title = 'Horoscope';
UPDATE public.premium_features SET title_ru = 'Проверка безопасности', title_tr = 'Güvenlik Kontrolü', description_ru = 'Только Premium', description_tr = 'Sadece Premium' WHERE title = 'Safety Lookup';
UPDATE public.premium_features SET title_ru = 'Трекер сахара в крови', title_tr = 'Kan Şekeri Takibi', description_ru = 'Только Premium', description_tr = 'Sadece Premium' WHERE title = 'Blood Sugar Tracker';
UPDATE public.premium_features SET title_ru = 'Альбом беременности', title_tr = 'Hamilelik Albümü', description_ru = 'Только Premium', description_tr = 'Sadece Premium' WHERE title = 'Pregnancy Album';
UPDATE public.premium_features SET title_ru = 'Рецепты', title_tr = 'Tarifler', description_ru = '3 бесплатно в категории / Безлимит', description_tr = 'Kategoride 3 ücretsiz / Sınırsız' WHERE title = 'Recipes';
UPDATE public.premium_features SET title_ru = 'Без рекламы', title_tr = 'Reklamsız Deneyim', description_ru = 'Никакой рекламы', description_tr = 'Hiç reklam yok' WHERE title = 'Ad-Free Experience';
UPDATE public.premium_features SET title_ru = 'Приоритетная поддержка', title_tr = 'Öncelikli Destek', description_ru = 'Быстрая техподдержка', description_tr = 'Hızlı teknik destek' WHERE title = 'Priority Support';

-- 2) Partner kateqoriya etiketləri
UPDATE public.partner_venue_categories SET label_ru = 'Спа и массаж', label_tr = 'Spa & Masaj' WHERE key = 'spa';
UPDATE public.partner_venue_categories SET label_ru = 'Спортзал', label_tr = 'Spor Salonu' WHERE key = 'gym';
UPDATE public.partner_venue_categories SET label_ru = 'Пилатес и йога', label_tr = 'Pilates & Yoga' WHERE key = 'pilates';
UPDATE public.partner_venue_categories SET label_ru = 'Салон красоты', label_tr = 'Güzellik Salonu' WHERE key = 'beauty';
UPDATE public.partner_venue_categories SET label_ru = 'Клиника', label_tr = 'Klinik' WHERE key = 'clinic';
UPDATE public.partner_venue_categories SET label_ru = 'Другое', label_tr = 'Diğer' WHERE key = 'other';

-- 3) partner_venues ölkə hədəfləməsi (boş/null = qlobal)
ALTER TABLE public.partner_venues ADD COLUMN IF NOT EXISTS countries text[];

-- 4) Public view yenidən yaradılır (pin_hash GİZLİ qalır, countries əlavə olunur)
DROP VIEW IF EXISTS public.partner_venues_public;
CREATE VIEW public.partner_venues_public AS
SELECT id, name, name_en, slug, category_key, description, description_en,
       logo_url, cover_url, gallery_urls, address, address_en, city, city_en,
       district, district_en, latitude, longitude, phone, website, instagram,
       working_hours, discount_label, discount_label_en, discount_terms,
       discount_terms_en, discount_value, redemption_cooldown_hours,
       redemption_lifetime_limit, qr_ttl_seconds, is_active, is_featured,
       sort_order, countries, created_at, updated_at
FROM public.partner_venues
WHERE is_active = true;

GRANT SELECT ON public.partner_venues_public TO anon, authenticated;

-- 5) Açarlar (yenilər idempotent)
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('billingscreen_abunelik_berpa_edildi_1b680a', 'ru', 'Subscription restored', 'common'),
  ('billingscreen_abunelik_berpa_edildi_1b680a', 'tr', 'Subscription restored', 'common'),
  ('billingscreen_abunelik_berpa_edildi_1b680a', 'en', 'Subscription restored', 'common'),
  ('billingscreen_abunelik_legv_edildi_0023e9', 'ru', 'Subscription cancelled', 'common'),
  ('billingscreen_abunelik_legv_edildi_0023e9', 'tr', 'Subscription cancelled', 'common'),
  ('billingscreen_abunelik_legv_edildi_0023e9', 'en', 'Subscription cancelled', 'common'),
  ('billingscreen_abuneliyi_berpa_etmek_mumkun_olmadi_3a4a58', 'ru', 'Could not restore subscription.', 'common'),
  ('billingscreen_abuneliyi_berpa_etmek_mumkun_olmadi_3a4a58', 'tr', 'Could not restore subscription.', 'common'),
  ('billingscreen_abuneliyi_berpa_etmek_mumkun_olmadi_3a4a58', 'en', 'Could not restore subscription.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_istediyin_8c90e4', 'ru', 'Are you sure you want to unsubscribe? You will be able to use Premium features until the end of the current period.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_istediyin_8c90e4', 'tr', 'Are you sure you want to unsubscribe? You will be able to use Premium features until the end of the current period.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_istediyin_8c90e4', 'en', 'Are you sure you want to unsubscribe? You will be able to use Premium features until the end of the current period.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_mumkun_olmadi_413b1f', 'ru', 'Could not cancel subscription.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_mumkun_olmadi_413b1f', 'tr', 'Could not cancel subscription.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_mumkun_olmadi_413b1f', 'en', 'Could not cancel subscription.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_ucun_app__ee8b2a', 'ru', 'You will be redirected to the App Store / Google Play subscription management page to cancel the subscription.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_ucun_app__ee8b2a', 'tr', 'You will be redirected to the App Store / Google Play subscription management page to cancel the subscription.', 'common'),
  ('billingscreen_abuneliyi_legv_etmek_ucun_app__ee8b2a', 'en', 'You will be redirected to the App Store / Google Play subscription management page to cancel the subscription.', 'common'),
  ('billingscreen_avtomatik_yenilenme_251a6c', 'ru', 'Automatic renewal', 'common'),
  ('billingscreen_avtomatik_yenilenme_251a6c', 'tr', 'Automatic renewal', 'common'),
  ('billingscreen_avtomatik_yenilenme_251a6c', 'en', 'Automatic renewal', 'common'),
  ('billingscreen_ayliq_premium_45f3bf', 'ru', 'Monthly Premium', 'common'),
  ('billingscreen_ayliq_premium_45f3bf', 'tr', 'Monthly Premium', 'common'),
  ('billingscreen_ayliq_premium_45f3bf', 'en', 'Monthly Premium', 'common'),
  ('billingscreen_cari_dovrun_sonuna_qeder_premium_istifad_e3e35c', 'ru', 'You can use Premium until the end of the current period.', 'common'),
  ('billingscreen_cari_dovrun_sonuna_qeder_premium_istifad_e3e35c', 'tr', 'You can use Premium until the end of the current period.', 'common'),
  ('billingscreen_cari_dovrun_sonuna_qeder_premium_istifad_e3e35c', 'en', 'You can use Premium until the end of the current period.', 'common'),
  ('billingscreen_esas_izleme_aletleri_d7a341', 'ru', 'Basic tracking tools', 'common'),
  ('billingscreen_esas_izleme_aletleri_d7a341', 'tr', 'Basic tracking tools', 'common'),
  ('billingscreen_esas_izleme_aletleri_d7a341', 'en', 'Basic tracking tools', 'common'),
  ('billingscreen_gundelik_limitli_ai_cat_cde61e', 'ru', 'Daily limited AI chat', 'common'),
  ('billingscreen_gundelik_limitli_ai_cat_cde61e', 'tr', 'Daily limited AI chat', 'common'),
  ('billingscreen_gundelik_limitli_ai_cat_cde61e', 'en', 'Daily limited AI chat', 'common'),
  ('billingscreen_i_lk_alis_2f33af', 'ru', 'First purchase', 'common'),
  ('billingscreen_i_lk_alis_2f33af', 'tr', 'First purchase', 'common'),
  ('billingscreen_i_lk_alis_2f33af', 'en', 'First purchase', 'common'),
  ('billingscreen_illik_premium', 'ru', 'Yearly Premium', 'common'),
  ('billingscreen_illik_premium', 'tr', 'Yearly Premium', 'common'),
  ('billingscreen_illik_premium', 'en', 'Yearly Premium', 'common'),
  ('billingscreen_novbeti_yenilenme_0ab0fe', 'ru', 'Next update', 'common'),
  ('billingscreen_novbeti_yenilenme_0ab0fe', 'tr', 'Next update', 'common'),
  ('billingscreen_novbeti_yenilenme_0ab0fe', 'en', 'Next update', 'common'),
  ('billingscreen_planlari_muqayise_edin_13fb70', 'ru', 'Compare plans', 'common'),
  ('billingscreen_planlari_muqayise_edin_13fb70', 'tr', 'Compare plans', 'common'),
  ('billingscreen_planlari_muqayise_edin_13fb70', 'en', 'Compare plans', 'common'),
  ('billingscreen_planli_74dfd2', 'ru', 'Scheduled', 'common'),
  ('billingscreen_planli_74dfd2', 'tr', 'Scheduled', 'common'),
  ('billingscreen_planli_74dfd2', 'en', 'Scheduled', 'common'),
  ('billingscreen_premium_a_yukseldin_d29d79', 'ru', 'Upgrade to Premium!', 'common'),
  ('billingscreen_premium_a_yukseldin_d29d79', 'tr', 'Upgrade to Premium!', 'common'),
  ('billingscreen_premium_a_yukseldin_d29d79', 'en', 'Upgrade to Premium!', 'common'),
  ('billingscreen_premium_abuneliyiniz_yeniden_aktivdir_2f1843', 'ru', 'Your Premium subscription is active again.', 'common'),
  ('billingscreen_premium_abuneliyiniz_yeniden_aktivdir_2f1843', 'tr', 'Your Premium subscription is active again.', 'common'),
  ('billingscreen_premium_abuneliyiniz_yeniden_aktivdir_2f1843', 'en', 'Your Premium subscription is active again.', 'common'),
  ('billingscreen_premium_ile_neler_elde_edeceyinizi_gorun_5b1bd7', 'ru', 'See what you get with Premium', 'common'),
  ('billingscreen_premium_ile_neler_elde_edeceyinizi_gorun_5b1bd7', 'tr', 'See what you get with Premium', 'common'),
  ('billingscreen_premium_ile_neler_elde_edeceyinizi_gorun_5b1bd7', 'en', 'See what you get with Premium', 'common'),
  ('billingscreen_pulsuz_plana_daxildir_77c152', 'ru', 'Included in free plan', 'common'),
  ('billingscreen_pulsuz_plana_daxildir_77c152', 'tr', 'Included in free plan', 'common'),
  ('billingscreen_pulsuz_plana_daxildir_77c152', 'en', 'Included in free plan', 'common'),
  ('billingscreen_reklam_ile_istifade_6445ef', 'ru', 'Use with ads', 'common'),
  ('billingscreen_reklam_ile_istifade_6445ef', 'tr', 'Use with ads', 'common'),
  ('billingscreen_reklam_ile_istifade_6445ef', 'en', 'Use with ads', 'common'),
  ('billingscreen_sinirsiz_imkanlar_elde_edin_8ffea5', 'ru', 'Get unlimited possibilities', 'common'),
  ('billingscreen_sinirsiz_imkanlar_elde_edin_8ffea5', 'tr', 'Get unlimited possibilities', 'common'),
  ('billingscreen_sinirsiz_imkanlar_elde_edin_8ffea5', 'en', 'Get unlimited possibilities', 'common'),
  ('billingscreen_tam_tarixceni_magazada_ac_946d4d', 'ru', 'Open the full history in the store →', 'common'),
  ('billingscreen_tam_tarixceni_magazada_ac_946d4d', 'tr', 'Open the full history in the store →', 'common'),
  ('billingscreen_tam_tarixceni_magazada_ac_946d4d', 'en', 'Open the full history in the store →', 'common'),
  ('billingscreen_topluluk_girisi_4f806d', 'ru', 'Community access', 'common'),
  ('billingscreen_topluluk_girisi_4f806d', 'tr', 'Community access', 'common'),
  ('billingscreen_topluluk_girisi_4f806d', 'en', 'Community access', 'common'),
  ('billingscreen_xeta_3cdbb6', 'ru', 'Error', 'common'),
  ('billingscreen_xeta_3cdbb6', 'tr', 'Error', 'common'),
  ('billingscreen_xeta_3cdbb6', 'en', 'Error', 'common'),
  ('billingscreen_yenile_570ce2', 'ru', 'Refresh', 'common'),
  ('billingscreen_yenile_570ce2', 'tr', 'Refresh', 'common'),
  ('billingscreen_yenile_570ce2', 'en', 'Refresh', 'common'),
  ('adminanalytics_aglama_analizi_0713b3', 'ru', 'Анализ плача', 'common'),
  ('adminanalytics_aglama_analizi_0713b3', 'tr', 'Ağlama Analizi', 'common'),
  ('adminanalytics_aglama_analizi_0713b3', 'en', 'Cry Analysis', 'common'),
  ('pdf_notes_ph', 'ru', 'Напишите дополнительные заметки для врача...', 'common'),
  ('pdf_notes_ph', 'tr', 'Doktorunuz için ek notlar yazın...', 'common'),
  ('pdf_notes_ph', 'en', 'Write additional notes for your doctor...', 'common')
ON CONFLICT (key, lang) DO NOTHING;

-- 6) Hero headline — "böyüyür" → "həyatınızdadır" (DO UPDATE)
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('mommy_hero_headline', 'ru', '{name} уже {days} дней с вами', 'common'),
  ('mommy_hero_headline', 'tr', '{days} gündür {name} hayatınızda', 'common'),
  ('mommy_hero_headline', 'en', '{name} has been in your life for {days} days', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
