-- Duzelis35: ProfileEditScreen-də uşaq redaktəsi xəta bildirişi (7 dil).
-- Əvvəllər user_children sync uğursuz olsa belə sükutla keçilirdi (yalnız
-- console.warn) — indi real xəta göstərilir (bax ProfileEditScreen.tsx
-- handleSave, useChildren().updateChild/addChild-in geri qaytardığı false).
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('profileeditscreen_korpe_melumati_yenilenmedi', 'az', 'Körpə məlumatı yenilənmədi — yenidən cəhd edin', 'common'),
  ('profileeditscreen_korpe_melumati_yenilenmedi', 'en', 'Baby info wasn''t updated — please try again', 'common'),
  ('profileeditscreen_korpe_melumati_yenilenmedi', 'ru', 'Информация о ребёнке не обновилась — попробуйте снова', 'common'),
  ('profileeditscreen_korpe_melumati_yenilenmedi', 'tr', 'Bebek bilgisi güncellenmedi — lütfen tekrar deneyin', 'common'),
  ('profileeditscreen_korpe_melumati_yenilenmedi', 'kk', 'Бөпе туралы ақпарат жаңартылмады — қайталап көріңіз', 'common'),
  ('profileeditscreen_korpe_melumati_yenilenmedi', 'de', 'Babyinformationen wurden nicht aktualisiert — bitte erneut versuchen', 'common'),
  ('profileeditscreen_korpe_melumati_yenilenmedi', 'ar', 'لم يتم تحديث معلومات الطفل — يرجى المحاولة مرة أخرى', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
