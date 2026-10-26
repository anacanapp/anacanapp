-- ============================================================
-- Duzelis29: Əkiz/çoxdöllü hamiləlik üçün əlavə (additive) məzmun sütunu.
--
-- Mənbə: ACOG (American College of Obstetricians and Gynecologists) rəsmi
-- "Multiple Pregnancy" FAQ sənədi (acog.org/womens-health/faqs/multiple-pregnancy,
-- son yenilənmə 2025) — canlı olaraq oxunub, aşağıdakı faktlar oradan
-- tərcümə/adaptasiya edilib: xorionluğun əhəmiyyəti, TTTS monitorinqi,
-- skrininq testlərinin çoxdöllü hamiləlikdə az dəqiqliyi, diskordant böyümə,
-- hər körpə üçün əlavə ~300 kkal tələbatı, preeklampsiya/hestasiya diabeti
-- riskinin yüksəkliyi, 36-37-ci həftələrdə erkən (amma NORMAL) doğuş halları,
-- seziryyə ehtimalının yüksəkliyi, doğuşdansonrakı depressiya riski.
--
-- Yalnız SADƏCƏ ƏKİZ/ÇOXDÖLLÜ analara göstərilir (Dashboard.tsx-də
-- isMultiple yoxlaması ilə) — tək hamiləlik istifadəçilərinə HEÇ TƏSİR ETMİR.
-- Hələlik YALNIZ Azərbaycan dilində (istifadəçinin öz tələbi ilə) —
-- tərcümələr sonrakı ayrı mərhələdə əlavə olunacaq.
--
-- Sütun mövcud 294 sətrin hamısında NULL-dan başlayır, yalnız aşağıdakı
-- ~12 "mərhələ" üçün doldurulur (hər mərhələ öz həftəsinin bütün 7 günündə
-- eyni mətnlə təkrarlanır ki, gündəlik sorğu məntiqi dəyişməsin).
-- İdempotent: ALTER ... IF NOT EXISTS + şərtli UPDATE-lər, təkrar işlədilməsi
-- zərərsizdir.
-- ============================================================

ALTER TABLE public.pregnancy_daily_content ADD COLUMN IF NOT EXISTS multiples_tip_az TEXT;

-- Həftə 6-7 (gün 36-49): Xorionluğun (plasenta növünün) təyini
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Əkiz/çoxdöllü hamiləlikdə ilk vacib addım — xorionluğun (plasenta növünün) müəyyən edilməsidir: körpələriniz ayrı-ayrı plasentaya (dixorionik) sahibdirmi, yoxsa ortaq plasentanı (monoxorionik) paylaşırlar? Bu, sonrakı bütün monitorinq planını müəyyənləşdirir — erkən USM-də həkiminiz bunu dəqiqləşdirməlidir. Profil bölməsində xorionluq məlumatını USM-dən sonra yeniləyə bilərsiniz.'
WHERE pregnancy_day BETWEEN 36 AND 49;

-- Həftə 8-9 (gün 50-63): Simptomların daha güclü keçməsi normaldır
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Çoxdöllü hamiləlikdə səhər ürəkbulanması və döş həssaslığı adətən tək hamiləlikdən daha güclü keçir — bu normaldır, daha yüksək hormon səviyyəsi ilə əlaqəlidir. Kifayət qədər istirahət edin və gün ərzində kiçik-kiçik, tez-tez yeyin.'
WHERE pregnancy_day BETWEEN 50 AND 63;

-- Həftə 11-13 (gün 71-91): Skrininq testlərinin dəqiqliyi
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Bu həftələrdə edilən qan testi əsaslı skrininqlər (NT/kombinə test) çoxdöllü hamiləlikdə tək hamiləlikdəki qədər dəqiq olmaya bilər — nəticə "risk yüksəkdir" çıxsa belə, hər iki körpədə problem olmaya bilər. Dəqiq diaqnoz üçün əlavə USM və ya invaziv testlər (CVS/amniosentez) həkiminizlə müzakirə oluna bilər.'
WHERE pregnancy_day BETWEEN 71 AND 91;

-- Həftə 16 (gün 106-112): Monoxorionik olarsa TTTS monitorinqi başlayır
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Əgər körpələriniz ortaq plasentanı paylaşırsa (monoxorionik), bu həftədən etibarən TTTS (əkiz-əkizə transfuziya sindromu) riskinə görə USM-lər adətən hər 2 həftədə bir təyin olunur. Ayrı-ayrı plasentalı (dixorionik) əkizlərdə tezlik fərqli ola bilər — həkiminiz sizə uyğun cədvəl təyin edəcək.'
WHERE pregnancy_day BETWEEN 106 AND 112;

-- Həftə 18-20 (gün 120-140): Anatomiya USM-si, hər körpənin ayrı izlənməsi
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Bu mərhələdə hər körpənin ətraflı anatomiya USM-si aparılır və artıq hər körpənin ölçüsü AYRI-AYRI izlənilməyə başlayır. Kiçik ölçü fərqləri bu mərhələdə tamamilə normaldır — narahat olmayın, həkiminiz zaman keçdikcə trendə baxacaq.'
WHERE pregnancy_day BETWEEN 120 AND 140;

-- Həftə 24 (gün 162-168): Yaşayabilirlik həddi + diskordantlıq izləməsi
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Bu, körpələrin doğuş yaşayabilirlik həddinə çatdığı vacib mərhələdir. Çoxdöllü hamiləlikdə körpələr arasında ölçü fərqi (diskordantlıq) bu mərhələdən etibarən daha diqqətlə izlənilir — adətən normal haldır, amma 20%-dən çox fərq əlavə yoxlama tələb edə bilər (Fetal Böyümə Tracker alətindən istifadə edə bilərsiniz).'
WHERE pregnancy_day BETWEEN 162 AND 168;

-- Həftə 28 (gün 190-196): 3-cü trimester, GDM/preeklampsiya riski
UPDATE public.pregnancy_daily_content SET multiples_tip_az = '3-cü trimester başlayır. Çoxdöllü hamiləlikdə hestasiya diabeti və preeklampsiya (yüksək qan təzyiqi) riski tək hamiləlikdən daha yüksəkdir və adətən daha erkən başlaya bilər — həkim görüşləriniz indi daha tez-tez olacaq, bu tamamilə gözləniləndir, narahatlıq səbəbi deyil.'
WHERE pregnancy_day BETWEEN 190 AND 196;

-- Həftə 30-32 (gün 204-224): Qidalanma, idman, böyümə USM-ləri
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Hər körpə üçün gündə təxminən əlavə 300 kkal lazımdır (əkizdə ümumilikdə ~600 kkal əlavə) — bu kalorilər keyfiyyətli qidalardan gəlsin. İntensiv idmandan çəkinin, gəzinti/üzgüçülük/prenatal yoqa kimi yüngül fəaliyyətlər daha uyğundur. Böyümə USM-ləri artıq daha tez-tez ola bilər.'
WHERE pregnancy_day BETWEEN 204 AND 224;

-- Həftə 34 (gün 232-238): Doğuş planlaşdırılması, artan monitorinq
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Doğuş planlaşdırılması söhbətləri bu mərhələdə başlaya bilər — çoxdöllü doğuşlarda seziryyə ehtimalı tək hamiləlikdən yüksəkdir, amma körpələrin sayı, mövqeyi və sağlamlığından asılı olaraq təbii doğuş da mümkündür. Monitorinq tezliyi artmağa davam edir.'
WHERE pregnancy_day BETWEEN 232 AND 238;

-- Həftə 36 (gün 246-252): Çoxu əkiz doğuşu bu ətrafda baş verir
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Diqqət: sadə (ağırlaşmasız) əkiz hamiləliklərin çoxu 36-37-ci həftələr arasında doğulur — bu, tək hamiləlikdəki 40 həftədən erkəndir və TAMAMİLƏ NORMAL sayılır, problem deyil. Doğuş çantanızı indi hazırlaya bilərsiniz.'
WHERE pregnancy_day BETWEEN 246 AND 252;

-- Həftə 37-38 (gün 253-266): Əkizlər üçün "tam vaxtında" mərhələ
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Əkiz hamiləlik üçün bu, artıq "tam vaxtında" (full-term) sayılan mərhələdir — tək hamiləlikdəki 40 həftə anlayışı birbaşa əkizlərə tətbiq olunmur. Doğuş istənilən vaxt başlaya bilər, həkiminizlə son planı dəqiqləşdirin.'
WHERE pregnancy_day BETWEEN 253 AND 266;

-- Həftə 39+ (gün 267-294): Əmizdirmə hazırlığı + doğuşdansonrakı depressiya
UPDATE public.pregnancy_daily_content SET multiples_tip_az = 'Əkiz körpələri əmizdirmək mümkündür, sadəcə bir az təcrübə tələb edir — süd təchizatınız hər iki körpəyə uyğun artacaq. Çoxdöllü doğuşdan sonra doğuşdansonrakı depressiya riski bir qədər yüksəkdir — özünüzü davamlı yorğun, narahat və ya kədərli hiss etsəniz, bunu partnyorunuzla və ya həkiminizlə paylaşmaqdan çəkinməyin.'
WHERE pregnancy_day BETWEEN 267 AND 294;
