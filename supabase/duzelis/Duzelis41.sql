-- Duzelis41: Community şərh/cavab sisteminə (post_comments cədvəli) şəkil
-- dəstəyi əlavə edir. Redaktə (edit) üçün DB dəyişikliyinə ehtiyac YOXDUR —
-- RLS "Users can update own comments" (auth.uid() = user_id) artıq mövcuddur
-- (bax 20260122081705_...sql), yalnız yeni tətbiq kodu (useEditComment) lazımdır.
-- Idempotent — safe to re-run.

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.post_comments.image_url IS
  'Şərhə/cavaba əlavə olunan tək şəkil (community-media bucket-ında, postlarla eyni bucket/policy-lər istifadə olunur).';

-- "Şərh redaktə edildi" toast mətni — ru/tr/kk/de/ar overlay (az/en JSON fayllarında birbaşa əlavə olunub)
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('usecommunity_serh_redakte_edildi', 'ru', 'Комментарий отредактирован ✏️', 'common'),
  ('usecommunity_serh_redakte_edildi', 'tr', 'Yorum düzenlendi ✏️', 'common'),
  ('usecommunity_serh_redakte_edildi', 'kk', 'Пікір өңделді ✏️', 'common'),
  ('usecommunity_serh_redakte_edildi', 'de', 'Kommentar bearbeitet ✏️', 'common'),
  ('usecommunity_serh_redakte_edildi', 'ar', 'تم تعديل التعليق ✏️', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;

-- "Şəkil əlavə et" (comment/reply image-picker aria-label) — ru/tr/kk/de/ar overlay
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('postcard_sekil_elave_et', 'ru', 'Добавить фото', 'common'),
  ('postcard_sekil_elave_et', 'tr', 'Fotoğraf ekle', 'common'),
  ('postcard_sekil_elave_et', 'kk', 'Сурет қосу', 'common'),
  ('postcard_sekil_elave_et', 'de', 'Foto hinzufügen', 'common'),
  ('postcard_sekil_elave_et', 'ar', 'إضافة صورة', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
