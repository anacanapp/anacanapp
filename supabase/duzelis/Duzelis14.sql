-- Duzelis14: Təpik Sayğacında (Kick Counter) əkiz/üçüz üçün İXTİYARİ mövqeyə-əsaslı
-- ayırma. Klinik reallıq: ana HANSI körpənin təpik atdığını dəqiq bilə bilməz —
-- yalnız MÖVQEYƏ görə (sol/sağ) təxmini ayıra bilər, bu da yalnız 3-cü trimestrdə
-- etibarlıdır (körpələr əvvəllər mövqe dəyişə bilir). Ona görə: (1) əsas metrik
-- HƏMİŞƏ ÜMUMİ say olaraq qalır (dəyişməz), (2) mövqe ancaq İXTİYARİ əlavə etiketdir,
-- (3) tək hamiləlikdə UI heç dəyişmir. Idempotent — safe to re-run.

ALTER TABLE public.kick_sessions
  ADD COLUMN IF NOT EXISTS position text;

COMMENT ON COLUMN public.kick_sessions.position IS 'İxtiyari mövqe etiketi (''left''|''right''|null) — əkiz/üçüz hamiləlikdə ana hansı tərəfdən təpik hiss etdiyini ayıra bilirsə. Kimlik (Körpə A/B) DEYİL, yalnız mövqedir. Əsas "ümumi təpik sayı" metrikasına təsir etmir.';

-- ============================================================
-- Yeni UI translation keys — DB overlay bütün 7 dil üçün
-- (lokal seed faylları da birbaşa yeniləndi).
-- ============================================================
INSERT INTO public.translations (key, lang, value, namespace) VALUES
  ('kickcounter_position_toggle_label', 'az', 'Mövqeyə görə qeyd et', 'tools'),
  ('kickcounter_position_toggle_label', 'en', 'Tag by position', 'tools'),
  ('kickcounter_position_toggle_label', 'ru', 'Отмечать по стороне', 'tools'),
  ('kickcounter_position_toggle_label', 'tr', 'Konuma göre etiketle', 'tools'),
  ('kickcounter_position_toggle_label', 'kk', 'Орналасуы бойынша белгілеу', 'tools'),
  ('kickcounter_position_toggle_label', 'de', 'Nach Position markieren', 'tools'),
  ('kickcounter_position_toggle_label', 'ar', 'وضع علامة حسب الموضع', 'tools'),

  ('kickcounter_position_toggle_desc', 'az', 'Hansı tərəfdən hiss etdiyinizi ayıra bilirsinizsə', 'tools'),
  ('kickcounter_position_toggle_desc', 'en', 'If you can tell which side you feel it from', 'tools'),
  ('kickcounter_position_toggle_desc', 'ru', 'Если можете различить, с какой стороны чувствуете', 'tools'),
  ('kickcounter_position_toggle_desc', 'tr', 'Hangi taraftan hissettiğinizi ayırt edebiliyorsanız', 'tools'),
  ('kickcounter_position_toggle_desc', 'kk', 'Қай жақтан сезінетініңізді ажырата алсаңыз', 'tools'),
  ('kickcounter_position_toggle_desc', 'de', 'Falls Sie unterscheiden können, von welcher Seite Sie es spüren', 'tools'),
  ('kickcounter_position_toggle_desc', 'ar', 'إذا كنت تستطيعين تمييز الجانب الذي تشعرين منه', 'tools'),

  ('kickcounter_position_left', 'az', 'Sol tərəf', 'tools'),
  ('kickcounter_position_left', 'en', 'Left side', 'tools'),
  ('kickcounter_position_left', 'ru', 'Левая сторона', 'tools'),
  ('kickcounter_position_left', 'tr', 'Sol taraf', 'tools'),
  ('kickcounter_position_left', 'kk', 'Сол жақ', 'tools'),
  ('kickcounter_position_left', 'de', 'Linke Seite', 'tools'),
  ('kickcounter_position_left', 'ar', 'الجانب الأيسر', 'tools'),

  ('kickcounter_position_right', 'az', 'Sağ tərəf', 'tools'),
  ('kickcounter_position_right', 'en', 'Right side', 'tools'),
  ('kickcounter_position_right', 'ru', 'Правая сторона', 'tools'),
  ('kickcounter_position_right', 'tr', 'Sağ taraf', 'tools'),
  ('kickcounter_position_right', 'kk', 'Оң жақ', 'tools'),
  ('kickcounter_position_right', 'de', 'Rechte Seite', 'tools'),
  ('kickcounter_position_right', 'ar', 'الجانب الأيمن', 'tools'),

  ('kickcounter_position_chip_left', 'az', '◀ Sol', 'tools'),
  ('kickcounter_position_chip_left', 'en', '◀ Left', 'tools'),
  ('kickcounter_position_chip_left', 'ru', '◀ Левая', 'tools'),
  ('kickcounter_position_chip_left', 'tr', '◀ Sol', 'tools'),
  ('kickcounter_position_chip_left', 'kk', '◀ Сол', 'tools'),
  ('kickcounter_position_chip_left', 'de', '◀ Links', 'tools'),
  ('kickcounter_position_chip_left', 'ar', 'يسار ◀', 'tools'),

  ('kickcounter_position_chip_right', 'az', 'Sağ ▶', 'tools'),
  ('kickcounter_position_chip_right', 'en', 'Right ▶', 'tools'),
  ('kickcounter_position_chip_right', 'ru', 'Правая ▶', 'tools'),
  ('kickcounter_position_chip_right', 'tr', 'Sağ ▶', 'tools'),
  ('kickcounter_position_chip_right', 'kk', 'Оң ▶', 'tools'),
  ('kickcounter_position_chip_right', 'de', 'Rechts ▶', 'tools'),
  ('kickcounter_position_chip_right', 'ar', '▶ يمين', 'tools'),

  ('kickcounter_multiples_info_title', 'az', 'Əkiz/üçüz hamiləlikdə təpiklər', 'tools'),
  ('kickcounter_multiples_info_title', 'en', 'Kicks in twin/triplet pregnancy', 'tools'),
  ('kickcounter_multiples_info_title', 'ru', 'Шевеления при беременности двойней/тройней', 'tools'),
  ('kickcounter_multiples_info_title', 'tr', 'İkiz/üçüz gebelikte tekmeler', 'tools'),
  ('kickcounter_multiples_info_title', 'kk', 'Егіз/үшем жүктілікте тебулер', 'tools'),
  ('kickcounter_multiples_info_title', 'de', 'Tritte bei Zwillings-/Drillingsschwangerschaft', 'tools'),
  ('kickcounter_multiples_info_title', 'ar', 'الركلات في حمل التوأم/الثلاثة توائم', 'tools'),

  ('kickcounter_multiples_info_desc', 'az', 'Hansı körpənin təpik atdığını dəqiq ayırmaq həmişə mümkün deyil. Buna görə ÜMUMİ hərəkət nümunənizə fikir verin — adi vəziyyətinizlə müqayisədə azalma hiss etsəniz, hansı tərəfdən asılı olmayaraq dərhal həkiminizlə əlaqə saxlayın.', 'tools'),
  ('kickcounter_multiples_info_desc', 'en', 'It is not always possible to tell exactly which baby is kicking. So pay attention to your OVERALL movement pattern — if you notice a decrease compared to your usual pattern, contact your doctor right away regardless of which side.', 'tools'),
  ('kickcounter_multiples_info_desc', 'ru', 'Не всегда можно точно определить, какой ребёнок шевелится. Поэтому обращайте внимание на ОБЩИЙ характер движений — при снижении по сравнению с обычным уровнем сразу обращайтесь к врачу, независимо от стороны.', 'tools'),
  ('kickcounter_multiples_info_desc', 'tr', 'Hangi bebeğin tekme attığını her zaman kesin olarak ayırt etmek mümkün değildir. Bu yüzden GENEL hareket düzeninize dikkat edin — normal düzeninize göre bir azalma fark ederseniz, hangi taraftan olduğuna bakılmaksızın hemen doktorunuzla iletişime geçin.', 'tools'),
  ('kickcounter_multiples_info_desc', 'kk', 'Қай баланың тебетінін дәл ажырату әрқашан мүмкін емес. Сондықтан ЖАЛПЫ қозғалыс үлгіңізге назар аударыңыз — әдеттегі деңгейіңізбен салыстырғанда азаюды байқасаңыз, қай жақтан екеніне қарамастан дереу дәрігеріңізбен байланысыңыз.', 'tools'),
  ('kickcounter_multiples_info_desc', 'de', 'Es ist nicht immer möglich, genau zu unterscheiden, welches Baby tritt. Achten Sie daher auf Ihr GESAMTES Bewegungsmuster — wenn Sie im Vergleich zu Ihrem üblichen Muster eine Abnahme bemerken, wenden Sie sich unabhängig von der Seite sofort an Ihren Arzt.', 'tools'),
  ('kickcounter_multiples_info_desc', 'ar', 'ليس من الممكن دائمًا تحديد أي طفل يركل بالضبط. لذا انتبهي لنمط حركتك العام — إذا لاحظتِ انخفاضًا مقارنة بنمطك المعتاد، تواصلي مع طبيبك فورًا بغض النظر عن الجانب.', 'tools')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value;
