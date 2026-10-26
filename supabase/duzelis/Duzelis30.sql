-- Duzelis30: Dashboard-dakı yeni "Əkiz Hamiləliyiniz üçün" kartının başlığı
-- + admin panelindəki yeni sahənin etiketi (hər ikisi 7 dildə — bunlar qısa
-- UI etiketləridir, Duzelis29.sql-dəki əsas gündəlik məzmunun özü isə
-- istəyə uyğun hələlik yalnız AZ qalır).
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('dashboard_ekiz_hameleliyiniz_ucun', 'az', 'Əkiz Hamiləliyiniz üçün', 'common'),
  ('dashboard_ekiz_hameleliyiniz_ucun', 'en', 'For Your Twin Pregnancy', 'common'),
  ('dashboard_ekiz_hameleliyiniz_ucun', 'ru', 'Для вашей двойни', 'common'),
  ('dashboard_ekiz_hameleliyiniz_ucun', 'tr', 'İkiz Hamileliğiniz İçin', 'common'),
  ('dashboard_ekiz_hameleliyiniz_ucun', 'kk', 'Егіз жүктілігіңіз үшін', 'common'),
  ('dashboard_ekiz_hameleliyiniz_ucun', 'de', 'Für Ihre Zwillingsschwangerschaft', 'common'),
  ('dashboard_ekiz_hameleliyiniz_ucun', 'ar', 'لحملك بتوأم', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'az', 'Əkiz/çoxdöllü hamiləlik üçün məsləhət (yalnız AZ — YALNIZ isMultiple istifadəçilərə göstərilir)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'en', 'Twin/multiple pregnancy tip (AZ only — shown only to multiples users)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'ru', 'Совет для многоплодной беременности (только AZ — показывается только пользователям с многоплодной беременностью)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'tr', 'İkiz/çoğul hamilelik için tavsiye (yalnızca AZ — yalnızca çoğul kullanıcılara gösterilir)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'kk', 'Егіз/көп жүктілік үшін кеңес (тек AZ — тек көп жүктілік пайдаланушыларына көрсетіледі)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'de', 'Tipp für Zwillings-/Mehrlingsschwangerschaft (nur AZ — wird nur Mehrlings-Nutzerinnen angezeigt)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'ar', 'نصيحة لحمل التوأم/المتعدد (بالأذربيجانية فقط — تظهر فقط لمستخدمات الحمل المتعدد)', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
