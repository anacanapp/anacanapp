-- Duzelis37: Nağıl generatoru "yüklənir" mətni "sehr" (magic) mövzusundan
-- "nağıl" (story) mövzusuna dəyişdirildi — bütün 7 dildə.
-- QEYD: translations cədvəli ru/tr/kk/de/ar üçün overlay kimi seed
-- fayllarından ÜSTÜNDÜR (bax src/lib/i18n.ts loadTranslations) — bu
-- sətirlər yazılmasa, kod/seed dəyişikliyinə baxmayaraq həmin 5 dildə
-- köhnə "sehr/magic" mətni göstərilməyə davam edəcəkdi.
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('fairytalegenerator_sehr_hazirlanir_04519a', 'az', 'Nağıl hazırlanır...', 'common'),
  ('fairytalegenerator_sehr_hazirlanir_04519a', 'en', 'Your story is being prepared...', 'common'),
  ('fairytalegenerator_sehr_hazirlanir_04519a', 'ru', 'Сказка готовится...', 'common'),
  ('fairytalegenerator_sehr_hazirlanir_04519a', 'tr', 'Masal hazırlanıyor...', 'common'),
  ('fairytalegenerator_sehr_hazirlanir_04519a', 'kk', 'Ертегі дайындалуда...', 'common'),
  ('fairytalegenerator_sehr_hazirlanir_04519a', 'de', 'Die Geschichte wird vorbereitet...', 'common'),
  ('fairytalegenerator_sehr_hazirlanir_04519a', 'ar', 'القصة قيد التحضير...', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
