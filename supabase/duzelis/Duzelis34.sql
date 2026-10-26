-- Duzelis34: i18n audit tapıntıları
--  1) NotFound.tsx (404 səhifəsi) tamamilə ingiliscə idi, tr() ilə bağlı deyildi
--     — 2 yeni açar, 7 dildə.
--  1b) UserBadge.tsx (VerifiedTick aria-label) və MentalHealthTracker.tsx
--      (EPDS skoru "/ 30 bal") hardcode Azərbaycanca idi — bütün 7 dildə
--      istifadəçilərə AZ mətn göstərirdi. 2 yeni açar, 7 dildə.
--  2) adminpregnancycontent_ekiz_coxdollu_tovsiye açarının DƏYƏRİ köhnə "yalnız AZ"
--     mətnini göstərirdi (Duzelis30-da yaradılmışdı) — halbuki Duzelis32/33-dən
--     sonra bu sahə artıq 7 dilə tərcümə oluna bilər (translate-content aləti
--     ilə). Kodun tr() fallback mətni yenilənmişdi, amma translations
--     cədvəlindəki/JSON-dakı SAXLANMIŞ dəyər tr()-də ÜSTÜN olduğu üçün köhnə
--     mətn görünməyə davam edirdi — bu, dəyəri düzəldir.
-- Idempotent — safe to re-run.

INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('notfound_oops_page_not_found', 'az', 'Səhifə tapılmadı', 'common'),
  ('notfound_oops_page_not_found', 'en', 'Oops! Page not found', 'common'),
  ('notfound_oops_page_not_found', 'ru', 'Упс! Страница не найдена', 'common'),
  ('notfound_oops_page_not_found', 'tr', 'Hay aksi! Sayfa bulunamadı', 'common'),
  ('notfound_oops_page_not_found', 'kk', 'Ой! Бет табылмады', 'common'),
  ('notfound_oops_page_not_found', 'de', 'Hoppla! Seite nicht gefunden', 'common'),
  ('notfound_oops_page_not_found', 'ar', 'عفوًا! الصفحة غير موجودة', 'common'),
  ('notfound_return_to_home', 'az', 'Ana səhifəyə qayıt', 'common'),
  ('notfound_return_to_home', 'en', 'Return to Home', 'common'),
  ('notfound_return_to_home', 'ru', 'Вернуться на главную', 'common'),
  ('notfound_return_to_home', 'tr', 'Ana sayfaya dön', 'common'),
  ('notfound_return_to_home', 'kk', 'Басты бетке оралу', 'common'),
  ('notfound_return_to_home', 'de', 'Zurück zur Startseite', 'common'),
  ('notfound_return_to_home', 'ar', 'العودة إلى الصفحة الرئيسية', 'common'),
  ('userbadge_tesdiqlenmis_hesab', 'az', 'Təsdiqlənmiş hesab', 'common'),
  ('userbadge_tesdiqlenmis_hesab', 'en', 'Verified account', 'common'),
  ('userbadge_tesdiqlenmis_hesab', 'ru', 'Подтверждённый аккаунт', 'common'),
  ('userbadge_tesdiqlenmis_hesab', 'tr', 'Onaylı hesap', 'common'),
  ('userbadge_tesdiqlenmis_hesab', 'kk', 'Расталған аккаунт', 'common'),
  ('userbadge_tesdiqlenmis_hesab', 'de', 'Verifiziertes Konto', 'common'),
  ('userbadge_tesdiqlenmis_hesab', 'ar', 'حساب موثّق', 'common'),
  ('mentalhealthtracker_30_bal_suffix', 'az', '/ 30 bal', 'common'),
  ('mentalhealthtracker_30_bal_suffix', 'en', '/ 30 points', 'common'),
  ('mentalhealthtracker_30_bal_suffix', 'ru', '/ 30 баллов', 'common'),
  ('mentalhealthtracker_30_bal_suffix', 'tr', '/ 30 puan', 'common'),
  ('mentalhealthtracker_30_bal_suffix', 'kk', '/ 30 балл', 'common'),
  ('mentalhealthtracker_30_bal_suffix', 'de', '/ 30 Punkte', 'common'),
  ('mentalhealthtracker_30_bal_suffix', 'ar', '/ 30 نقطة', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'az', 'Əkiz/çoxdöllü hamiləlik üçün məsləhət (AZ — digər dillər ''Kontent Tərcüməsi (AI)'' alətindən tərcümə olunur, YALNIZ isMultiple istifadəçilərə göstərilir)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'en', 'Twin/multiple pregnancy tip (AZ — other languages are translated via the ''Content Translation (AI)'' tool, shown only to multiples users)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'ru', 'Совет для многоплодной беременности (AZ — остальные языки переводятся через инструмент «Перевод контента (ИИ)», показывается только пользователям с многоплодной беременностью)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'tr', 'İkiz/çoğul hamilelik için tavsiye (AZ — diğer diller ''İçerik Çevirisi (AI)'' aracıyla çevrilir, yalnızca çoğul kullanıcılara gösterilir)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'kk', 'Егіз/көп жүктілік үшін кеңес (AZ — басқа тілдер «Мазмұнды аудару (AI)» құралы арқылы аударылады, тек көп жүктілік пайдаланушыларына көрсетіледі)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'de', 'Tipp für Zwillings-/Mehrlingsschwangerschaft (AZ — andere Sprachen werden über das Tool „Inhaltsübersetzung (KI)" übersetzt, wird nur Mehrlings-Nutzerinnen angezeigt)', 'common'),
  ('adminpregnancycontent_ekiz_coxdollu_tovsiye', 'ar', 'نصيحة لحمل التوأم/المتعدد (بالأذربيجانية — تُترجم اللغات الأخرى عبر أداة ''ترجمة المحتوى (AI)''، تظهر فقط لمستخدمات الحمل المتعدد)', 'common')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
