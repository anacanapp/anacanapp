-- Duzelis12: HealthVitals custom native plugin (çəki/qan təzyiqi/qan şəkəri
-- ölçmələrinin Apple Health / Health Connect-ə YAZILMASI — HealthCyclePlugin
-- ilə eyni nümunə). Bu duzeliş yalnız yeni UI mətnləri üçün DB overlay-dır,
-- heç bir cədvəl/sütun dəyişikliyi yoxdur (lokal seed faylları da birbaşa
-- yeniləndi: src/locales/az.json, en.json, scripts/i18n/{ru,tr,kk,de,ar}.seed.json).
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('vitals_write_title', 'az', 'Ölçmələrimi Health-ə yaz', 'health'),
  ('vitals_write_title', 'en', 'Write my vitals to Health', 'health'),
  ('vitals_write_title', 'ru', 'Записывать мои показатели в Health', 'health'),
  ('vitals_write_title', 'tr', 'Ölçümlerimi Health''e yaz', 'health'),
  ('vitals_write_title', 'kk', 'Көрсеткіштерімді Health-ке жаз', 'health'),
  ('vitals_write_title', 'de', 'Meine Werte in Health schreiben', 'health'),
  ('vitals_write_title', 'ar', 'كتابة قياساتي في Health', 'health'),

  ('vitals_write_desc', 'az', 'Çəki, qan təzyiqi və qan şəkəri qeydləriniz Apple Health / Health Connect-ə əlavə olunur', 'health'),
  ('vitals_write_desc', 'en', 'Your weight, blood pressure and blood sugar entries are added to Apple Health / Health Connect', 'health'),
  ('vitals_write_desc', 'ru', 'Ваши записи веса, давления и сахара в крови добавляются в Apple Health / Health Connect', 'health'),
  ('vitals_write_desc', 'tr', 'Kilo, tansiyon ve kan şekeri kayıtlarınız Apple Health / Health Connect''e eklenir', 'health'),
  ('vitals_write_desc', 'kk', 'Салмақ, қан қысымы және қандағы қант жазбаларыңыз Apple Health / Health Connect-ке қосылады', 'health'),
  ('vitals_write_desc', 'de', 'Ihre Gewichts-, Blutdruck- und Blutzuckereinträge werden zu Apple Health / Health Connect hinzugefügt', 'health'),
  ('vitals_write_desc', 'ar', 'تُضاف سجلات الوزن وضغط الدم وسكر الدم إلى Apple Health / Health Connect', 'health'),

  ('vitals_write_on_desc', 'az', 'Çəki, qan təzyiqi və qan şəkəri qeydləriniz bundan sonra Health-ə yazılacaq', 'health'),
  ('vitals_write_on_desc', 'en', 'Your weight, blood pressure and blood sugar entries will now be written to Health', 'health'),
  ('vitals_write_on_desc', 'ru', 'Ваши записи веса, давления и сахара в крови теперь будут записываться в Health', 'health'),
  ('vitals_write_on_desc', 'tr', 'Kilo, tansiyon ve kan şekeri kayıtlarınız artık Health''e yazılacak', 'health'),
  ('vitals_write_on_desc', 'kk', 'Салмақ, қан қысымы және қандағы қант жазбаларыңыз бұдан былай Health-ке жазылады', 'health'),
  ('vitals_write_on_desc', 'de', 'Ihre Gewichts-, Blutdruck- und Blutzuckereinträge werden ab jetzt in Health geschrieben', 'health'),
  ('vitals_write_on_desc', 'ar', 'ستتم الآن كتابة سجلات الوزن وضغط الدم وسكر الدم في Health', 'health')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
