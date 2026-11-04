-- anacan-printable-books (2026-11-04): printable PDF activity books for children, sold on the web (Epoint).
--
--   * book_catalog: 70 books in 7 age groups (6m, 1y..6y), public read; PDFs live in the private
--     storage bucket `book-pdfs` (path = pdf_path) and are only ever served through signed URLs.
--   * book_orders: one row per Epoint checkout; price is computed by the book-checkout function
--     (4 / 3 / 2.60 / 2 AZN per book for 1-2 / 3-4 / 5-9 / 10+ books). Written only by service role.
--   * book_entitlements: books a person owns; granted only by the signed Epoint result callback.
--   * my_books_v1(): the signed-in person's owned books (for "Kitablarım").
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP).
-- New relations are registered for CDC / writer guard. No cron or timer is added.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.book_catalog (
  id text PRIMARY KEY CHECK (id ~ '^[0-9]m?_[0-9]{2}$'),
  age_group text NOT NULL CHECK (age_group IN ('6m', '1y', '2y', '3y', '4y', '5y', '6y')),
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  about text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  pages integer NOT NULL CHECK (pages BETWEEN 1 AND 200),
  pdf_path text NOT NULL,
  cover_path text NOT NULL,
  size_mb numeric(6,1) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.book_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  book_ids text[] NOT NULL CHECK (cardinality(book_ids) BETWEEN 1 AND 100),
  unit_price numeric(8,2) NOT NULL CHECK (unit_price >= 0),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'AZN' CHECK (currency = 'AZN'),
  language text NOT NULL DEFAULT 'az',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')),
  provider text NOT NULL DEFAULT 'epoint' CHECK (provider IN ('epoint', 'admin')),
  granted_by uuid,
  admin_note text,
  provider_transaction text,
  provider_status text,
  download_token_hash text,
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_orders_user_idx ON public.book_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.book_entitlements (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  book_id text NOT NULL REFERENCES public.book_catalog (id),
  order_id uuid NOT NULL REFERENCES public.book_orders (id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.book_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads active books" ON public.book_catalog;
CREATE POLICY "Anyone reads active books" ON public.book_catalog FOR SELECT TO anon, authenticated USING (active);
DROP POLICY IF EXISTS "Owners read own book orders" ON public.book_orders;
CREATE POLICY "Owners read own book orders" ON public.book_orders FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Owners read own books" ON public.book_entitlements;
CREATE POLICY "Owners read own books" ON public.book_entitlements FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.book_catalog, public.book_orders, public.book_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.book_catalog TO anon, authenticated;
-- The download token hash and provider details stay server-side.
GRANT SELECT (id, book_ids, unit_price, amount, currency, status, created_at, paid_at) ON public.book_orders TO authenticated;
GRANT SELECT ON public.book_entitlements TO authenticated;
GRANT ALL ON public.book_catalog, public.book_orders, public.book_entitlements TO service_role;

CREATE OR REPLACE FUNCTION public.my_books_v1()
RETURNS TABLE (book_id text, granted_at timestamptz, order_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT e.book_id, e.granted_at, e.order_id FROM public.book_entitlements e
   WHERE e.user_id = auth.uid() ORDER BY e.granted_at DESC, e.book_id;
$$;
REVOKE ALL ON FUNCTION public.my_books_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_books_v1() TO authenticated;

INSERT INTO public.book_catalog (id, age_group, title, subtitle, about, skills, pages, pdf_path, cover_path, size_mb, sort_order) VALUES
  ('1_01', '1y', 'Fermada', 'İnək, qoyun, toyuq və dostları', 'Ferma heyvanları bir yaşlı uşaqların ən sevdiyi mövzulardandır. Bu kitabda uşaq heyvanların adlarını və səslərini öyrənir, onları kölgələri ilə tanıyır, 1-dən 3-ə qədər sayır və ilk boyamasını edir. Hər səhifə valideynlə birlikdə danışmaq, göstərmək və təqlid etmək üçün imkan yaradır. Bu oyunlar nitqi, diqqəti və ilk məntiq bacarıqlarını inkişaf etdirir.', ARRAY['Heyvanlar','Nitq','Say 1–3','Diqqət','Rəngləmə']::text[], 14, 'pdf/1-yas/1_01_fermada.pdf', 'covers/1_01_fermada.jpg', 5.0, 1),
  ('1_02', '1y', 'Meyvələr və tərəvəzlər', 'Dadlı, rəngli və faydalı', 'Bu kitab uşağı ən çox rast gəldiyi meyvə və tərəvəzlərlə tanış edir. Uşaq onların adlarını öyrənir, kölgələrini tapır, sayır və ilk dəfə meyvələri tərəvəzlərdən ayırmağa çalışır. Bu oyunlar diqqəti, ilk təsnifat bacarığını və lüğəti inkişaf etdirir. Kitab həm də sağlam qidaya maraq oyatmaq üçün gözəl fürsətdir.', ARRAY['Lüğət','Təsnifat','Diqqət','İncə motorika','Sağlam qida']::text[], 14, 'pdf/1-yas/1_02_meyveler-ve-terevezler.pdf', 'covers/1_02_meyveler-ve-terevezler.jpg', 6.8, 2),
  ('1_03', '1y', 'Bip-bip! Nəqliyyat', 'Maşın, avtobus, qatar, təyyarə, gəmi', 'Uşaqlar hərəkət edən hər şeyə böyük maraq göstərir. Bu kitab ən tanış nəqliyyat vasitələrini və onların səslərini tanıdır: maşın, avtobus, qatar, təyyarə və gəmi. Səsləri təqlid etmək nitqi, kölgə tapmaq və ölçüləri müqayisə etmək diqqəti və məntiqi inkişaf etdirir. Küçədə gördüyünüz nəqliyyatı kitabdakı şəkillərlə müqayisə edin.', ARRAY['Nəqliyyat','Nitq','Diqqət','Müqayisə','Rəngləmə']::text[], 14, 'pdf/1-yas/1_03_bip-bip-neqliyyat.pdf', 'covers/1_03_bip-bip-neqliyyat.jpg', 5.7, 3),
  ('1_04', '1y', 'Rənglər və formalar', 'Dairə, kvadrat, üçbucaq', 'Formalar və rənglər uşağın ətraf aləmi anlamasının əsasıdır. Bu kitabda uşaq dairə, kvadrat və üçbucaqla tanış olur, onları kölgələri ilə tapır və əşyaları rənginə görə ayırır. Bu oyunlar vizual qavrayışı, müqayisə və təsnifat bacarığını inkişaf etdirir. Evdə hər gün formaları və rəngləri adlandırmaq öyrənməni asanlaşdırır.', ARRAY['Formalar','Rənglər','Təsnifat','Diqqət','İncə motorika']::text[], 14, 'pdf/1-yas/1_04_rengler-ve-formalar.pdf', 'covers/1_04_rengler-ve-formalar.jpg', 4.4, 4),
  ('1_05', '1y', 'Bir, iki, üç', 'İlk saymağım', 'Saymaq bir yaşlı uşaq üçün hələ oyundur, amma bu oyun riyazi düşüncənin ilk addımıdır. Kitabda uşaq “bir”, “iki”, “üç” sözlərini əşyalarla əlaqələndirir. Əşyalara toxunaraq ucadan saymaq miqdar anlayışını formalaşdırır. Gündəlik həyatda da tez-tez sayın: pilləkənləri, qaşıqları, ayaqqabıları.', ARRAY['Say 1–3','Miqdar','Diqqət','Nitq']::text[], 14, 'pdf/1-yas/1_05_bir-iki-uc.pdf', 'covers/1_05_bir-iki-uc.jpg', 4.0, 5),
  ('1_06', '1y', 'Mənim günüm', 'Oyanıram, yeyirəm, oynayıram, yatıram', 'Gündəlik rejim uşağa təhlükəsizlik və sabitlik hissi verir. Bu kitab uşağın gününü sadə addımlarla göstərir: oyanmaq, səhər yeməyi, oyun, gəzinti, çimmək və yuxu. Tanış hadisələri şəkillərdə görmək uşağa ardıcıllığı anlamağa və növbəti addımı gözləməyə kömək edir. Gün ərzində kitabdakı şəkilləri xatırladın.', ARRAY['Gündəlik rejim','Ardıcıllıq','Nitq','Müstəqillik']::text[], 14, 'pdf/1-yas/1_06_menim-gunum.pdf', 'covers/1_06_menim-gunum.jpg', 8.2, 6),
  ('1_07', '1y', 'Balaca dostlar', 'Salamlaşırıq, paylaşırıq, qucaqlaşırıq', 'Bir yaşlı uşaqlar başqa uşaqlara maraq göstərməyə başlayır. Bu kitab dostluğun ilk addımlarını sadə hekayələrlə göstərir: salamlaşmaq, paylaşmaq, qucaqlaşmaq, birlikdə oynamaq və dostuna təsəlli vermək. Bu yaşda paylaşmaq hələ çətindir, amma nümunə görmək və mehriban sözlər eşitmək sosial-emosional inkişafın təməlini qoyur.', ARRAY['Dostluq','Paylaşmaq','Emosiyalar','Ünsiyyət']::text[], 14, 'pdf/1-yas/1_07_balaca-dostlar.pdf', 'covers/1_07_balaca-dostlar.jpg', 6.4, 7),
  ('1_08', '1y', 'Böyük və kiçik', 'Dolu və boş: ilk əks anlayışlar', 'Əks anlayışlar uşağın dünyanı müqayisə etməyi öyrəndiyi ilk addımlardandır. Bu kitab “böyük – kiçik” və “dolu – boş” anlayışlarını sadə şəkillər və oyunlarla tanıdır. Müqayisə etmək məntiqi düşüncəni, diqqəti və nitqi inkişaf etdirir. Kəs-yapışdır oyununda uşaq “dolu” və “boş” sözlərini əyani şəkildə görür.', ARRAY['Müqayisə','Məntiq','Nitq','İncə motorika']::text[], 14, 'pdf/1-yas/1_08_boyuk-ve-kicik.pdf', 'covers/1_08_boyuk-ve-kicik.jpg', 6.1, 8),
  ('1_09', '1y', 'İlk boyama kitabım', 'Böyük və sadə şəkillər', 'Bir yaşda uşaq qələmi ilk dəfə əlinə alıb kağızda iz buraxmağı kəşf edir. Bu kitabdakı şəkillər çox böyük və sadədir, qalın xətlərlə çəkilib. Cızma-qara və rəngləmə əlin əzələlərini gücləndirir, göz-əl koordinasiyasını inkişaf etdirir və gələcəkdə yazmağa hazırlayır. Qalın mum karandaşlardan istifadə edin və hər cəhdi tərifləyin.', ARRAY['İncə motorika','Rəngləmə','Göz-əl koordinasiyası','Yaradıcılıq']::text[], 13, 'pdf/1-yas/1_09_ilk-boyama-kitabim.pdf', 'covers/1_09_ilk-boyama-kitabim.jpg', 2.9, 9),
  ('1_10', '1y', 'Bağçada', 'Çiçək, kəpənək, arı və ilbiz', 'Bağça uşaq üçün canlı bir kəşf məkanıdır. Bu kitabda uşaq çiçək, kəpənək, arı, ilbiz və uğur böcəyi ilə tanış olur, onları sayır, kölgələrini tapır və ölçülərini müqayisə edir. Təbiətə maraq, diqqət və müşahidə bacarığı belə sadə oyunlarla inkişaf edir. Kitabı oxuduqdan sonra bağçaya və ya parka çıxıb əsl kiçik canlıları axtarın.', ARRAY['Təbiət','Nitq','Say 1–3','Diqqət','Müşahidə']::text[], 14, 'pdf/1-yas/1_10_bagcada.pdf', 'covers/1_10_bagcada.jpg', 6.3, 10),
  ('2_01', '2y', 'Rəqəmlər 1-dən 5-ə', 'Say, izlə və rənglə', 'Bu kitab uşağınızı 1-dən 5-ə qədər rəqəmlərlə tanış edir. İki yaşda uşaq əşyaları barmaqla göstərərək saymağı öyrənir və miqdar anlayışı yaranmağa başlayır. Rəqəmləri barmaqla və karandaşla izləmək əl-göz koordinasiyasını inkişaf etdirir. Hər səhifəni oyun kimi keçirin, tələsməyin.', ARRAY['Say','Rəqəmlər','İncə motorika','Diqqət']::text[], 15, 'pdf/2-yas/2_01_reqemler-1-den-5-e.pdf', 'covers/2_01_reqemler-1-den-5-e.jpg', 3.3, 11),
  ('2_02', '2y', 'Meşə dostları', 'Dələ, kirpi, dovşan və ayıcıqla oyna', 'Meşə heyvanları uşaqların çox sevdiyi qəhrəmanlardır. Bu kitabda uşağınız heyvanları tanıyacaq, onların nə yediyini öyrənəcək, sayacaq və rəngləyəcək. Kölgə və fərqlini tapmaq oyunları diqqəti və müşahidəni gücləndirir. Heyvanların səslərini və hərəkətlərini təqlid edərək kitabı daha əyləncəli edin.', ARRAY['Heyvanlar','Diqqət','Say','İncə motorika']::text[], 14, 'pdf/2-yas/2_02_mese-dostlari.pdf', 'covers/2_02_mese-dostlari.jpg', 5.2, 12),
  ('2_03', '2y', 'Formalar ölkəsi', 'Dairə, kvadrat, üçbucaq və ulduz', 'Formaları tanımaq riyazi təfəkkürün ilk addımıdır. Bu kitabda uşağınız dairə, kvadrat, üçbucaq və ulduzla tanış olacaq və onları ətrafdakı əşyalarda görməyi öyrənəcək. Uyğunlaşdırma, ardıcıllıq və çeşidləmə oyunları məntiqi və diqqəti inkişaf etdirir. Evdə də formalar axtarın: boşqab dairədir, pəncərə kvadratdır.', ARRAY['Formalar','Məntiq','Diqqət','İncə motorika']::text[], 14, 'pdf/2-yas/2_03_formalar-olkesi.pdf', 'covers/2_03_formalar-olkesi.jpg', 3.7, 13),
  ('2_04', '2y', 'Dəniz dünyası', 'Balıqlar, ahtapot və dəniz ulduzu', 'Dəniz uşaqlar üçün sirli və maraqlı bir dünyadır. Bu kitabda uşağınız dəniz heyvanlarını tanıyacaq, onları rəngləyəcək, sayacaq və kölgələrini tapacaq. Boyama və xətt izləmə əl əzələlərini gələcək yazıya hazırlayır. Kitabı Xəzər sahilində, çimərlikdə oxumaq da əyləncəli olar.', ARRAY['Dəniz heyvanları','Boyama','İncə motorika','Diqqət']::text[], 14, 'pdf/2-yas/2_04_deniz-dunyasi.pdf', 'covers/2_04_deniz-dunyasi.jpg', 4.4, 14),
  ('2_05', '2y', 'Əks anlayışlar', 'Dolu və boş, isti və soyuq, böyük və kiçik', 'Əks anlayışlar uşağın dünyanı müqayisə etməyi öyrəndiyi vacib mərhələdir. Bu kitabda dolu və boş, isti və soyuq, böyük və kiçik anlayışları oyunla öyrənilir. Kəsib yapışdırma tapşırıqları həm əl bacarığını, həm də anlayışların möhkəmlənməsini təmin edir. Gündəlik həyatda da bu sözləri tez-tez işlədin.', ARRAY['Anlayışlar','Nitq','Məntiq','Kəsib-yapışdırma']::text[], 13, 'pdf/2-yas/2_05_eks-anlayislar.pdf', 'covers/2_05_eks-anlayislar.jpg', 5.6, 15),
  ('2_06', '2y', 'Ailəmlə bir gün', 'Səhərdən axşama qədər birlikdə', 'Gündəlik rejim iki yaşlı uşağa təhlükəsizlik və rahatlıq hissi verir. Bu kitabda balaca qəhrəman ailəsi ilə səhərdən axşama qədər bir gün keçirir. Hekayələr nitqi zənginləşdirir, tapşırıqlar isə diqqət və məntiqi inkişaf etdirir. Oxuyarkən öz gününüzü də müqayisə edin: "Biz də səhər dişlərimizi fırçalayırıq!"', ARRAY['Gündəlik rejim','Nitq','Ailə','Diqqət']::text[], 13, 'pdf/2-yas/2_06_ailemle-bir-gun.pdf', 'covers/2_06_ailemle-bir-gun.jpg', 8.1, 16),
  ('2_07', '2y', 'Dörd fəsil', 'Qış, yaz, yay və payız', 'Fəsillər uşağın ətraf aləmi anlamasına kömək edir: hava dəyişir, paltarlar dəyişir, təbiət dəyişir. Bu kitabda uşağınız dörd fəsli tanıyacaq və hər fəsildə nə geyindiyimizi öyrənəcək. Uşağı geyindirmək oyunu müstəqilliyi və məntiqi inkişaf etdirir. Pəncərədən baxıb indiki fəsli birlikdə müzakirə edin.', ARRAY['Fəsillər','Təbiət','Məntiq','Kəsib-yapışdırma']::text[], 14, 'pdf/2-yas/2_07_dord-fesil.pdf', 'covers/2_07_dord-fesil.jpg', 6.5, 17),
  ('2_08', '2y', 'Dadlı və faydalı', 'Meyvələr, tərəvəzlər və mətbəx', 'Sağlam qidalanma vərdişləri erkən yaşdan formalaşır. Bu kitabda uşağınız meyvə və tərəvəzləri tanıyacaq, onları sayacaq, çeşidləyəcək və faydalı qidanı seçməyi öyrənəcək. Mətbəxdə birlikdə vaxt keçirmək uşağın yeni dadlara marağını artırır. Kitabdakı meyvələri evdə dadmağı təklif edin.', ARRAY['Sağlam qida','Say','Çeşidləmə','Diqqət']::text[], 14, 'pdf/2-yas/2_08_dadli-ve-faydali.pdf', 'covers/2_08_dadli-ve-faydali.jpg', 6.6, 18),
  ('2_09', '2y', 'Kölgəni tap', 'Diqqət və məntiq oyunları', 'Bu kitab uşağın diqqətini, müşahidəsini və məntiqi təfəkkürünü inkişaf etdirən oyunlardan ibarətdir. Kölgəni tapmaq, fərqlini seçmək və ardıcıllığı davam etdirmək gələcək riyazi bacarıqların əsasıdır. Tapşırıqlar sadədən çətinə doğru düzülüb. Uşaq yorulanda dayanın: qısa və şən oyun uzun və məcburi oyundan daha faydalıdır.', ARRAY['Diqqət','Məntiq','Müşahidə','Müqayisə']::text[], 14, 'pdf/2-yas/2_09_kolgeni-tap.pdf', 'covers/2_09_kolgeni-tap.jpg', 6.5, 19),
  ('2_10', '2y', 'Dostluq və hisslər', 'Şad, kədərli, hirsli və qorxmuş', 'İki yaşda uşaq güclü hisslər yaşayır, amma onları adlandırmağı hələ bilmir. Bu kitab şadlıq, kədər, hirs və qorxu hisslərini tanımağa, həmçinin paylaşmaq və dostluq etmək kimi ilk sosial bacarıqlara kömək edir. Hissləri adlandırmaq uşağın özünü idarə etməsinin ilk addımıdır. Kitabı oxuyarkən üz ifadələrini birlikdə təqlid edin.', ARRAY['Hisslər','Dostluq','Nitq','Empatiya']::text[], 13, 'pdf/2-yas/2_10_dostluq-ve-hissler.pdf', 'covers/2_10_dostluq-ve-hissler.jpg', 6.3, 20),
  ('3_01', '3y', 'Rəqəmlər 1-dən 10-a', 'Say, izlə və yaz', 'Üç yaşda uşaq 10-a qədər saymağa və rəqəmləri tanımağa hazır olur. Bu kitabda hər rəqəm ayrıca səhifədə öyrənilir: uşaq əvvəlcə əşyaları sayır, sonra rəqəmi izləyərək yazır. Rəqəmi saydığı miqdarla əlaqələndirmək riyazi düşüncənin təməlidir. Gündə bir-iki səhifə kifayətdir, sonra öyrəndiyiniz rəqəmi evdə əşyalarla təkrarlayın.', ARRAY['Say','Rəqəmlər','Yazıya hazırlıq','İncə motorika']::text[], 15, 'pdf/3-yas/3_01_reqemler-1-den-10-a.pdf', 'covers/3_01_reqemler-1-den-10-a.jpg', 3.9, 21),
  ('3_02', '3y', 'Hisslərim', 'Hisslərimi tanıyıram və adlandırıram', 'Üç yaşlı uşaq hissləri daha dərin yaşayır, amma onları sözlə ifadə etməyi yenicə öyrənir. Bu kitab şadlıq, kədər, hirs, qorxu, təəccüb və yorğunluq hisslərini tanımağa kömək edir. Hekayələr və tapşırıqlar uşağa hisslərin normal olduğunu və onlarla necə bacarmağı göstərir. Emosional zəka gələcəkdə dostluq və məktəb uğurunun əsasıdır.', ARRAY['Hisslər','Empatiya','Nitq','Özünü idarə']::text[], 13, 'pdf/3-yas/3_02_hisslerim.pdf', 'covers/3_02_hisslerim.jpg', 7.5, 22),
  ('3_03', '3y', 'Toxumdan çiçəyə', 'Bitkilər necə böyüyür?', 'Bitkinin böyüməsini izləmək uşaq üçün əsl möcüzədir. Bu kitab toxumun cücərməsindən çiçək açmasına qədər olan yolu sadə şəkildə göstərir. Ardıcıllıq tapşırıqları səbəb-nəticə anlayışını, boyama və nöqtə birləşdirmə isə incə motorikanı inkişaf etdirir. Kitabla yanaşı evdə bir saksıda lobya əkib birlikdə izləyin.', ARRAY['Təbiət','Ardıcıllıq','İncə motorika','Say']::text[], 14, 'pdf/3-yas/3_03_toxumdan-ciceye.pdf', 'covers/3_03_toxumdan-ciceye.jpg', 9.0, 23),
  ('3_04', '3y', 'Vəhşi təbiət', 'Cəngəllik və savanna heyvanları', 'Fil, zürafə, şir və zebra uşaqların maraqla öyrəndiyi heyvanlardır. Bu kitabda uşağınız vəhşi heyvanları tanıyacaq, onların balalarını tapacaq, sayacaq və kölgələrini müqayisə edəcək. Labirint və ardıcıllıq tapşırıqları məntiq və diqqəti inkişaf etdirir. Heyvanların səslərini və yerişlərini birlikdə təqlid edin.', ARRAY['Heyvanlar','Məntiq','Say','Diqqət']::text[], 14, 'pdf/3-yas/3_04_vehsi-tebiet.pdf', 'covers/3_04_vehsi-tebiet.jpg', 7.7, 24),
  ('3_05', '3y', 'Balaca dahi', 'Məntiq oyunları', 'Bu kitab üç yaşlı uşağın məntiqi təfəkkürünü inkişaf etdirən müxtəlif oyunlardan ibarətdir: fərqlini tapmaq, ardıcıllığı davam etdirmək, kölgəni tanımaq, labirint və ölçü müqayisəsi. Belə tapşırıqlar diqqəti, yaddaşı və problem həll etmə bacarığını gücləndirir. Uşaq çətinlik çəkəndə cavabı deməyin, sual verərək ona yol göstərin.', ARRAY['Məntiq','Diqqət','Yaddaş','Müqayisə','Problem həlli']::text[], 14, 'pdf/3-yas/3_05_balaca-dahi.pdf', 'covers/3_05_balaca-dahi.jpg', 5.7, 25),
  ('3_06', '3y', 'Kosmosa səyahət', 'Raketlər, planetlər və ulduzlar', 'Kosmos uşaqların təxəyyülünü oyadan böyük sirrdir. Bu kitabda uşağınız raket, astronavt, Ay və planetlərlə tanış olacaq. Saymaq, nöqtə birləşdirmək, labirint və axtarış tapşırıqları riyazi və məntiqi bacarıqları inkişaf etdirir. Axşam pəncərədən birlikdə Aya və ulduzlara baxın.', ARRAY['Kosmos','Texnologiya','Say','Məntiq','Diqqət']::text[], 14, 'pdf/3-yas/3_06_kosmosa-seyahet.pdf', 'covers/3_06_kosmosa-seyahet.jpg', 6.4, 26),
  ('3_07', '3y', 'Peşələr', 'Böyüyəndə kim olacağam?', 'Peşələr haqqında danışmaq uşağa ətrafındakı insanların necə kömək etdiyini anlamağa imkan verir. Bu kitabda uşağınız həkim, müəllim, yanğınsöndürən, aşpaz, inşaatçı və polislə tanış olacaq və onların alətlərini öyrənəcək. Rollu oyunlar nitqi və sosial bacarıqları inkişaf etdirir. Ailə üzvlərinin peşələri haqqında da danışın.', ARRAY['Peşələr','Nitq','Məntiq','Kəsib-yapışdırma']::text[], 14, 'pdf/3-yas/3_07_peseler.pdf', 'covers/3_07_peseler.jpg', 7.8, 27),
  ('3_08', '3y', 'Yolda təhlükəsizlik', 'Svetofor, piyada keçidi və nəqliyyat', 'Yol qaydalarını öyrənməyə erkən yaşdan başlamaq lazımdır. Bu kitabda uşağınız svetoforun rənglərini, piyada keçidini və yolda böyüklərin əlindən tutmağın vacibliyini öyrənəcək. Nəqliyyat vasitələri ilə bağlı oyunlar diqqəti və məntiqi inkişaf etdirir. Hər gəzintidə öyrəndiklərinizi real həyatda təkrarlayın.', ARRAY['Təhlükəsizlik','Nəqliyyat','Diqqət','Ardıcıllıq']::text[], 14, 'pdf/3-yas/3_08_yolda-tehlukesizlik.pdf', 'covers/3_08_yolda-tehlukesizlik.jpg', 8.5, 28),
  ('3_09', '3y', 'Böyük heyvan boyaması', 'Rənglə, birləşdir və çək', 'Boyama uşaq üçün həm əyləncə, həm də inkişafdır. Bu kitab müxtəlif heyvanların böyük və sadə boyama şəkillərindən, nöqtə birləşdirmə və xətt izləmə tapşırıqlarından ibarətdir. Boyama karandaşı düzgün tutmağı, əl hərəkətlərini idarə etməyi və diqqəti cəmləməyi öyrədir. Uşağın rəng seçiminə qarışmayın: bənövşəyi fil də gözəldir!', ARRAY['Boyama','İncə motorika','Yaradıcılıq','Rənglər']::text[], 14, 'pdf/3-yas/3_09_boyuk-heyvan-boyamasi.pdf', 'covers/3_09_boyuk-heyvan-boyamasi.jpg', 5.9, 29),
  ('3_10', '3y', 'Nənəmin bağı', 'Nar ağacı, toyuqlar və şirin çay', 'Nənə və baba ilə keçən vaxt uşağın ən isti xatirələrindən olur. Bu kitabda balaca qəhrəman nənəsinin bağında nar dərir, toyuqları yemləyir və bağdakı həyatı öyrənir. Hekayələr ailə bağlarını və təbiətə sevgini gücləndirir, tapşırıqlar isə say, ardıcıllıq və diqqəti inkişaf etdirir. Kitabı nənə-baba ilə birlikdə oxumaq xüsusilə gözəl olar.', ARRAY['Ailə','Təbiət','Say','Ardıcıllıq','Diqqət']::text[], 14, 'pdf/3-yas/3_10_nenemin-bagi.pdf', 'covers/3_10_nenemin-bagi.jpg', 8.4, 30),
  ('4_01', '4y', 'Əlifba 1: A-dan Ə-yə', 'A, B, C, Ç, D, E, Ə hərflərini öyrən və yaz', 'Bu kitab uşağınızı Azərbaycan əlifbasının ilk yeddi hərfi ilə tanış edir. Hər səhifədə bir hərf, onunla başlayan söz və şəkil var. Uşaq əvvəlcə böyük hərfi barmağı ilə, sonra karandaşla izləyir. Hərfin səsini sözlə əlaqələndirmək gələcək oxu bacarığının təməlidir. Tələsməyin: gündə bir-iki hərf kifayətdir.', ARRAY['Hərflər','Səslər','Yazıya hazırlıq','İncə motorika','Söz ehtiyatı']::text[], 14, 'pdf/4-yas/4_01_elifba-1-a-dan-e-ye.pdf', 'covers/4_01_elifba-1-a-dan-e-ye.jpg', 3.7, 31),
  ('4_02', '4y', 'Hesablayıram!', 'Şəkillərlə 10-a qədər toplama', 'Dörd yaşlı uşaq artıq əşyaları saya bilir və "daha çox" anlayışını başa düşür. Bu kitab toplamanı şəkillərlə, oyun kimi təqdim edir: iki dəstəni birləşdirib saymaq. Uşaq rəqəmləri yazır, məsələni hekayə ilə həll edir və kəsib-yapışdırma ilə miqdarı əllə hiss edir. Belə konkret təcrübə riyazi düşüncənin ən sağlam başlanğıcıdır.', ARRAY['Say','Toplama','Rəqəmlər','Məntiq','İncə motorika']::text[], 14, 'pdf/4-yas/4_02_hesablayiram.pdf', 'covers/4_02_hesablayiram.jpg', 3.1, 32),
  ('4_03', '4y', 'Labirintlər və tapmacalar', 'Yolu tap, düşün, tap!', 'Labirintlər və tapmacalar uşağın diqqətini, planlaşdırmasını və səbrini inkişaf etdirir. Uşaq yolu gözü ilə əvvəlcədən axtarmağı, səhvdə dayanıb yenidən başlamağı öyrənir. Kölgə, artıq əşya və ardıcıllıq oyunları məntiqi və vizual qavrayışı gücləndirir. Bu bacarıqlar məktəbdə oxu və riyaziyyat üçün çox vacibdir.', ARRAY['Diqqət','Məntiq','Planlaşdırma','Vizual qavrayış','Səbr']::text[], 14, 'pdf/4-yas/4_03_labirintler-ve-tapmacalar.pdf', 'covers/4_03_labirintler-ve-tapmacalar.jpg', 5.4, 33),
  ('4_04', '4y', 'Dinozavrlar aləmi', 'Nəhəng dostlarla say, tap və rənglə', 'Dinozavrlar uşaqların ən sevdiyi mövzulardan biridir və marağı öyrənməyə yaxşı körpü olur. Bu kitabda uşaq dinozavrları sayır, ölçüləri müqayisə edir, kölgələri tapır və balaca dinozavrın yumurtadan çıxmasını ardıcıllıqla düzür. Hər səhifə təbiət, zaman və canlıların həyatı haqqında sual verməyə imkan yaradır.', ARRAY['Say','Müqayisə','Ardıcıllıq','Diqqət','Təbiət']::text[], 15, 'pdf/4-yas/4_04_dinozavrlar-alemi.pdf', 'covers/4_04_dinozavrlar-alemi.jpg', 7.3, 34),
  ('4_05', '4y', 'Dəniz altında', 'Sualtı dünyanın sirlərini kəşf et', 'Dəniz dünyası uşağın təxəyyülünü oyadır və canlıların müxtəlifliyi ilə tanış edir. Bu kitabda uşaq balıqları sayır, toplayır, dəniz heyvanlarını quru heyvanlarından ayırır və mərcan rifində gizlənənləri axtarır. Tapşırıqlar diqqəti, say bacarığını və təsnifat qabiliyyətini inkişaf etdirir. Xəzər dənizini də xatırlayıb birlikdə danışın.', ARRAY['Təbiət','Təsnifat','Say','Diqqət','Rənglər']::text[], 14, 'pdf/4-yas/4_05_deniz-altinda.pdf', 'covers/4_05_deniz-altinda.jpg', 6.5, 35),
  ('4_06', '4y', 'Robotlar və texnologiya', 'Ağıllı maşınlarla oyna və öyrən', 'Uşaqlar ətrafdakı texnologiyaya çox maraqlıdır: telefon, kompüter, robot. Bu kitab texnologiyanı ekran qarşısında deyil, kağız üzərində kəşf etməyə imkan verir. Uşaq robot qurmağın ardıcıllığını düzür, cihazları müqayisə edir və öz robotunu xəyal edir. Belə tapşırıqlar mühəndis düşüncəsini, yaradıcılığı və məntiqi inkişaf etdirir.', ARRAY['Texnologiya','Məntiq','Ardıcıllıq','Yaradıcılıq','Diqqət']::text[], 15, 'pdf/4-yas/4_06_robotlar-ve-texnologiya.pdf', 'covers/4_06_robotlar-ve-texnologiya.jpg', 5.7, 36),
  ('4_07', '4y', 'Sağlam vərdişlər', 'Təmiz, güclü və gümrah ol!', 'Gigiyena və sağlam həyat vərdişləri məhz bu yaşda formalaşır. Bu kitabda uşaq dişlərini və əllərini düzgün yumağın addımlarını düzür, faydalı və az yeyilməli qidaları ayırır, gündəlik rejim haqqında danışır. Vərdişləri oyunla öyrənən uşaq onları məcburiyyət kimi deyil, öz seçimi kimi qəbul edir.', ARRAY['Gigiyena','Sağlam qidalanma','Ardıcıllıq','Müstəqillik','Diqqət']::text[], 14, 'pdf/4-yas/4_07_saglam-verdisler.pdf', 'covers/4_07_saglam-verdisler.jpg', 7.0, 37),
  ('4_08', '4y', 'Dostluq hekayəsi', 'Nərmin və Elvin dost olurlar', 'Bu kitab yeni dost tapmaq haqqında sadə və isti bir hekayədir. Nərmin həyətdə tək oynayan Elvinlə tanış olur, oyuncağını paylaşır və onlar dost olurlar. Hekayə uşağa paylaşmağı, başqasının hisslərini anlamağı və kömək etməyi öyrədir. Hekayədən sonrakı oyunlar diqqət, say və ardıcıllıq bacarıqlarını inkişaf etdirir.', ARRAY['Dostluq','Empatiya','Nitq','Ardıcıllıq','Diqqət']::text[], 14, 'pdf/4-yas/4_08_dostluq-hekayesi.pdf', 'covers/4_08_dostluq-hekayesi.jpg', 8.9, 38),
  ('4_09', '4y', 'Hava və fəsillər', 'Yaz, yay, payız, qış', 'Dörd yaşlı uşaq zamanın dəyişdiyini, fəsillərin bir-birini əvəz etdiyini anlamağa başlayır. Bu kitabda uşaq fəsilləri tanıyır, havaya uyğun geyim seçir, ağacın il boyu necə dəyişdiyini ardıcıllıqla düzür. Pəncərədən baxaraq hər gün havanı birlikdə müzakirə etmək bu biliyi möhkəmləndirəcək.', ARRAY['Təbiət','Ardıcıllıq','Təsnifat','Nitq','Diqqət']::text[], 14, 'pdf/4-yas/4_09_hava-ve-fesiller.pdf', 'covers/4_09_hava-ve-fesiller.jpg', 9.8, 39),
  ('4_10', '4y', 'Böcəklər aləmi', 'Balaca, amma çox maraqlı!', 'Böcəklər uşağın təbiəti ilk dəfə yaxından müşahidə etdiyi canlılardır. Bu kitabda uşaq uğur böcəklərini sayır, arını pətəyə aparır, kəpənəyin necə yarandığını öyrənir və çəmənlikdə gizlənən böcəkləri axtarır. Tapşırıqlar say, diqqət və simmetriya bacarıqlarını inkişaf etdirir, eyni zamanda canlılara qayğı və hörmət aşılayır.', ARRAY['Təbiət','Say','Diqqət','Ardıcıllıq','Simmetriya']::text[], 14, 'pdf/4-yas/4_10_bocekler-alemi.pdf', 'covers/4_10_bocekler-alemi.jpg', 5.3, 40),
  ('5_01', '5y', 'Əlifba 2: F-dən K-ya', 'F, G, Ğ, H, X, I, İ, J, K hərflərini yaz', 'Bu kitab Azərbaycan əlifbasının növbəti doqquz hərfini öyrədir. Uşaq hər hərfi böyük və kiçik formada izləyir, onunla bağlı sözü və şəkli tanıyır. Ğ, I və İ kimi çətin hərflərə xüsusi diqqət ayrılıb: Ğ sözün əvvəlində gəlmir, I ilə İ isə nöqtə ilə fərqlənir. Səsləri sözlərdə eşitmək oxumağa hazırlığın əsas addımıdır.', ARRAY['Hərflər','Səslər','Yazıya hazırlıq','Söz ehtiyatı','İncə motorika']::text[], 15, 'pdf/5-yas/5_01_elifba-2-f-den-k-ya.pdf', 'covers/5_01_elifba-2-f-den-k-ya.jpg', 4.5, 41),
  ('5_02', '5y', 'Toplama və çıxma', '10-a qədər topla, çıx, düşün', 'Beş yaşlı uşaq artıq toplamağı başa düşür və çıxmanı da öyrənməyə hazırdır. Bu kitabda o, şəkillər vasitəsilə 10-a qədər toplayır və çıxır, gündəlik həyatdan məsələlər həll edir, əşyaları bərabər bölməyi sınayır. "Gəldi" toplamadır, "getdi" isə çıxma. Konkret şəkillərlə işləmək rəqəmlərin mənasını dərindən anlamağa kömək edir.', ARRAY['Toplama','Çıxma','Say','Məntiq','Məsələ həlli']::text[], 14, 'pdf/5-yas/5_02_toplama-ve-cixma.pdf', 'covers/5_02_toplama-ve-cixma.jpg', 3.4, 42),
  ('5_03', '5y', 'Zaman və saat', 'Səhər, günorta, axşam, gecə', 'Zaman anlayışı uşaq üçün mücərrəddir, ona görə onu gündəlik işlərlə bağlamaq lazımdır. Bu kitabda uşaq günün hissələrini tanıyır, gündüz və gecəni ayırır, "əvvəl" və "sonra" anlayışlarını ardıcıllıqlarla öyrənir. Bu bacarıq günü planlamağa, gözləməyə və rejimə alışmağa kömək edir. Gün ərzində "indi səhərdir", "nahardan sonra" kimi ifadələri tez-tez işlədin.', ARRAY['Zaman','Ardıcıllıq','Nitq','Məntiq','Rejim']::text[], 14, 'pdf/5-yas/5_03_zaman-ve-saat.pdf', 'covers/5_03_zaman-ve-saat.jpg', 7.5, 43),
  ('5_04', '5y', 'Diqqət və yaddaş', 'Bax, tap, yadda saxla!', 'Diqqət və yaddaş məktəbdə uğurun açarıdır. Bu kitabdakı tapşırıqlar uşağı diqqətlə baxmağa, fərqləri görməyə, qanunauyğunluqları tapmağa və gördüklərini yadda saxlamağa öyrədir. Hər səhifədən sonra kiçik yaddaş oyunu oynayın: şəkli bağlayıb nə gördüyünü soruşun. Qısa, amma müntəzəm məşqlər ən yaxşı nəticəni verir.', ARRAY['Diqqət','Yaddaş','Məntiq','Vizual qavrayış','Səbr']::text[], 14, 'pdf/5-yas/5_04_diqqet-ve-yaddas.pdf', 'covers/5_04_diqqet-ve-yaddas.jpg', 6.9, 44),
  ('5_05', '5y', 'Planetlər və ulduzlar', 'Günəş sisteminə səyahət', 'Kosmos uşağın təxəyyülünü oyadır və böyük suallar verməyə həvəsləndirir. Bu kitabda uşaq Günəş sisteminin planetləri ilə tanış olur, ulduzları sayır, raketi Aya aparır və planetləri ölçüsünə görə müqayisə edir. Kitab elmə marağı, say və müqayisə bacarıqlarını inkişaf etdirir. Axşam birlikdə səmaya baxıb Ayı və ulduzları müşahidə edin.', ARRAY['Elm','Say','Müqayisə','Ardıcıllıq','Təxəyyül']::text[], 15, 'pdf/5-yas/5_05_planetler-ve-ulduzlar.pdf', 'covers/5_05_planetler-ve-ulduzlar.jpg', 7.2, 45),
  ('5_06', '5y', 'Təbiəti qoruyaq', 'Təmiz yer, sağlam gələcək', 'Təbiətə qayğı erkən yaşda başlayır. Bu kitabda uşaq zibili növünə görə çeşidləməyi, ağac əkməyin addımlarını, heyvanların evlərini və təbiətdə nəyin artıq olduğunu öyrənir. Bu tapşırıqlar təsnifat və məntiq bacarıqlarını inkişaf etdirir, eyni zamanda məsuliyyət hissi aşılayır. Evdə zibili birlikdə çeşidləmək ən yaxşı davamıdır.', ARRAY['Ekologiya','Təsnifat','Məsuliyyət','Ardıcıllıq','Məntiq']::text[], 14, 'pdf/5-yas/5_06_tebieti-qoruyaq.pdf', 'covers/5_06_tebieti-qoruyaq.jpg', 10.5, 46),
  ('5_07', '5y', 'Azərbaycanın təbiəti', 'Dağlar, göllər, dəniz və heyvanlar', 'Bu kitab uşağı doğma diyarın təbiəti ilə tanış edir: Şahdağın qarlı zirvələri, Göygölün mavi suyu, Xəzər dənizi, ceyran, nar və xarıbülbül. Uşaq vətənini tanıdıqca onu sevməyi və qorumağı öyrənir. Hekayələr, say, labirint və müqayisə tapşırıqları bilik və bacarıqları birləşdirir. Səyahətlərinizdə gördüyünüz yerləri bu kitabla xatırlayın.', ARRAY['Vətən','Təbiət','Söz ehtiyatı','Say','Diqqət']::text[], 14, 'pdf/5-yas/5_07_azerbaycanin-tebieti.pdf', 'covers/5_07_azerbaycanin-tebieti.jpg', 5.6, 47),
  ('5_08', '5y', 'Balaca proqramçı', 'Addım-addım düşün, robotu idarə et', 'Proqramlaşdırma kompüterdən əvvəl düşüncədə başlayır. Bu kitabda uşaq hər işin addımlardan ibarət olduğunu, addımların düzgün ardıcıllığını, təkrarlanan sıraları və yol planlamağı öyrənir. Bunlar alqoritmik düşüncənin əsaslarıdır. Evdə uşağa "robot" olun: o sizə əmr versin, siz yalnız dediyi addımları atın.', ARRAY['Alqoritm','Ardıcıllıq','Məntiq','Planlaşdırma','Qanunauyğunluq']::text[], 14, 'pdf/5-yas/5_08_balaca-proqramci.pdf', 'covers/5_08_balaca-proqramci.jpg', 6.7, 48),
  ('5_09', '5y', 'Hisslər və dostluq', 'Hisslərimi tanıyıram, dostlarımı anlayıram', 'Emosional intellekt uşağın gələcək uğurunda bilik qədər vacibdir. Bu kitabda uşaq əsas hissləri tanıyır, onların səbəblərini anlayır, yaxşı və pis əməlləri ayırır, dostuna kömək etməyi öyrənir. Hekayələr üzərində danışarkən uşağı mühakimə etməyin; hər hissin normal olduğunu, önəmli olanın onu necə ifadə etmək olduğunu izah edin.', ARRAY['Emosiyalar','Empatiya','Dostluq','Nitq','Ardıcıllıq']::text[], 14, 'pdf/5-yas/5_09_hissler-ve-dostluq.pdf', 'covers/5_09_hissler-ve-dostluq.jpg', 9.6, 49),
  ('5_10', '5y', 'Balaca alim', 'Sadə təcrübələr, böyük kəşflər', 'Beş yaşlı uşaq kiçik alimdir: hər şeyə "niyə?" deyə soruşur. Bu kitab maqnitlər, su, işıq və bitkilər haqqında sadə suallara cavab axtarır. Uşaq nəyin batıb nəyin üzdüyünü təxmin edir, maqnitin nəyi çəkdiyini tapır, buzun necə əridiyini izləyir. Kitabdakı hər təcrübəni evdə də birlikdə edin: əvvəl təxmin, sonra yoxlama.', ARRAY['Elm','Müşahidə','Təxmin','Təsnifat','Ardıcıllıq']::text[], 15, 'pdf/5-yas/5_10_balaca-alim.pdf', 'covers/5_10_balaca-alim.jpg', 8.7, 50),
  ('6_01', '6y', 'Əlifba 3: Q, L, M, N, O, Ö, P, R', 'Hərfləri yaz, səsləri tanı, sözləri oxu', 'Bu kitab Azərbaycan əlifbasının səkkiz hərfini – Q, L, M, N, O, Ö, P və R hərflərini öyrədir. Hər səhifədə uşaq böyük və kiçik hərfi izləyir, sonra onu təkbaşına yazmağa çalışır. Hərfin səsi tanış bir sözlə bağlanır, bu isə səs-hərf əlaqəsini və gələcək oxu bacarığını gücləndirir. Oyun səhifələri sözün ilk səsini eşitməyi və diqqəti inkişaf etdirir. Hər gün bir-iki hərf kifayətdir – tələsməyin, uşağın hər uğurunu tərifləyin.', ARRAY['Hərflər','Səs-hərf əlaqəsi','Yazı hazırlığı','İncə motorika','Diqqət']::text[], 15, 'pdf/6-yas/6_01_elifba-3-q-l-m-n-o-o-p-r.pdf', 'covers/6_01_elifba-3-q-l-m-n-o-o-p-r.jpg', 5.8, 51),
  ('6_02', '6y', 'Əlifba 4: S, Ş, T, U, Ü, V, Y, Z', 'Son hərfləri öyrən, əlifbanı tamamla', 'Bu kitabla uşaq Azərbaycan əlifbasının daha səkkiz hərfini – S, Ş, T, U, Ü, V, Y və Z hərflərini öyrənir. Hər hərf izlənir, sonra müstəqil yazılır və tanış bir sözlə əlaqələndirilir. S–Ş, U–Ü kimi oxşar hərf cütlərini ayırd etmək eşitmə diqqətini və gözlə fərqləndirmə bacarığını inkişaf etdirir. Sonda söz oyunları, nöqtə birləşdirmə və rəsm tapşırığı öyrənilənləri möhkəmləndirir. Bu, məktəbdə oxu və yazıya rahat başlamaq üçün gözəl hazırlıqdır.', ARRAY['Hərflər','Fonematik eşitmə','Yazı hazırlığı','İncə motorika','Söz ehtiyatı']::text[], 15, 'pdf/6-yas/6_02_elifba-4-s-s-t-u-u-v-y-z.pdf', 'covers/6_02_elifba-4-s-s-t-u-u-v-y-z.jpg', 4.6, 52),
  ('6_03', '6y', 'Riyaziyyat 1–20', 'Say, topla, çıx və məsələ həll et', 'Bu kitab uşağı 20-yə qədər saymağa və 10 daxilində toplama-çıxma əməllərinə hazırlayır. Səhifələrdə şəkilli misallar, “onluğu tamamla” tapşırıqları, kiçik mətnli məsələlər və labirint var. Uşaq rəqəmləri yalnız əzbərləmir, əşyalara baxaraq onların mənasını anlayır. Mətnli məsələlər məntiqi düşünməyi və nitqi inkişaf etdirir. Hər səhifədən sonra uşağınızla real əşyalarla – düymələr, qaşıqlar, meyvələr – eyni misalları təkrar edin.', ARRAY['Say 1–20','Toplama','Çıxma','Onluq anlayışı','Məntiq','Məsələ həlli']::text[], 14, 'pdf/6-yas/6_03_riyaziyyat-1-20.pdf', 'covers/6_03_riyaziyyat-1-20.jpg', 7.6, 53),
  ('6_04', '6y', 'Məktəbə hazırıq!', 'Birinci sinfə şən və inamlı addım', 'Bu kitab uşağı məktəb həyatına sevinclə və inamla hazırlayır. O, məktəb əşyalarını tanıyır, səhər qaydasını ardıcıllıqla düzür, çantasını yığmağı öyrənir və yazıya hazırlıq xətləri çəkir. Labirint, naxışlar və “artıq olanı tap” tapşırıqları diqqəti, məntiqi və səbri inkişaf etdirir. Hekayə səhifəsi uşağın məktəb haqqında hisslərini danışması üçün imkan yaradır. Məktəbə hazırlıq təkcə bilik deyil, həm də müstəqillik və özünəinamdır.', ARRAY['Müstəqillik','Diqqət','Yazı hazırlığı','Məntiq','Ardıcıllıq','Söz ehtiyatı']::text[], 15, 'pdf/6-yas/6_04_mektebe-haziriq.pdf', 'covers/6_04_mektebe-haziriq.jpg', 8.2, 54),
  ('6_05', '6y', 'İnsan bədəni', 'Bədənimi tanıyıram, sağlamlığımı qoruyuram', 'Bu kitab uşağa öz bədənini tanımağı və onu qorumağı öyrədir. O, bədən üzvlərinin adlarını, beş hiss orqanının nə iş gördüyünü, ürəyin necə döyündüyünü öyrənir. Sağlam qida seçimi, əl yuma qaydası və dişlərin qayğısı kimi gündəlik vərdişlər oyun şəklində möhkəmləndirilir. Kölgə, axtarış və labirint tapşırıqları isə diqqəti inkişaf etdirir. Bədənini tanıyan uşaq özünə daha yaxşı qulluq edir və öz hisslərini daha asan ifadə edir.', ARRAY['Bədən üzvləri','Hiss orqanları','Sağlam vərdişlər','Gigiyena','Diqqət']::text[], 15, 'pdf/6-yas/6_05_insan-bedeni.pdf', 'covers/6_05_insan-bedeni.jpg', 9.8, 55),
  ('6_06', '6y', 'Qitələr və heyvanlar', 'Dünyanı gəz, heyvanlarla tanış ol', 'Bu kitab uşağı dünya səyahətinə çıxarır. O, Yer kürəsində yeddi qitə olduğunu öyrənir və hər qitənin məşhur heyvanları ilə tanış olur. İsti və soyuq yerlərdə yaşayan heyvanları çeşidləmək, heyvanı vətəni ilə birləşdirmək və savanna səhnəsində axtarış etmək təsnifat bacarığını, diqqəti və məntiqi inkişaf etdirir. Bu mövzu uşaqda təbiətə maraq və dünyanı öyrənmək həvəsi oyadır. Mümkünsə, evdə qlobus və ya xəritə ilə birlikdə baxın.', ARRAY['Dünya haqqında bilik','Heyvanlar','Təsnifat','Diqqət','Məntiq']::text[], 15, 'pdf/6-yas/6_06_qiteler-ve-heyvanlar.pdf', 'covers/6_06_qiteler-ve-heyvanlar.jpg', 8.6, 56),
  ('6_07', '6y', 'Böyük məntiq kitabı', 'Çətin labirintlər, naxışlar və tapmacalar', 'Bu kitab altı yaşlı uşaqlar üçün məntiq və diqqət məşqləridir. Böyük labirintlər planlamağı və səbri, üç sıralı naxışlar qanunauyğunluğu tapmağı öyrədir. “Artıq olanı tap”, kölgə, ölçü və cütlük tapşırıqları müqayisə və təsnifat bacarığını gücləndirir. Simmetrik rəsm və nöqtə birləşdirmə isə göz-əl koordinasiyasını inkişaf etdirir. Bu bacarıqlar məktəbdə riyaziyyat və oxu üçün möhkəm təməldir.', ARRAY['Məntiq','Diqqət','Planlama','Təsnifat','Simmetriya','Səbr']::text[], 15, 'pdf/6-yas/6_07_boyuk-mentiq-kitabi.pdf', 'covers/6_07_boyuk-mentiq-kitabi.jpg', 11.8, 57),
  ('6_08', '6y', 'Pul və alış-veriş', 'Qəpik say, al, sat və qənaət et', 'Bu kitab uşağa pulun nə olduğunu, alış-verişin necə edildiyini və qənaət etməyi öyrədir. O, qəpikləri sayır, şəkilli misallarla toplayıb çıxır, məhsulları uyğun dükanlara çeşidləyir və alış-verişin ardıcıllığını düzür. Kumbara haqqında hekayə səbri və gələcəyi planlamağı öyrədir. Pul anlayışı riyazi düşüncəni həyatla bağlayır və uşağa məsuliyyət hissi aşılayır. Kitabdan sonra mağazada uşağa kiçik bir alışı özü etməyə imkan verin.', ARRAY['Say','Toplama və çıxma','Maliyyə savadı','Təsnifat','Ardıcıllıq','Planlama']::text[], 15, 'pdf/6-yas/6_08_pul-ve-alis-veris.pdf', 'covers/6_08_pul-ve-alis-veris.jpg', 8.5, 58),
  ('6_09', '6y', 'Peşələr və gələcəyim', 'Böyüyəndə kim olacağam?', 'Bu kitab uşağı müxtəlif peşələrlə tanış edir və onu öz arzuları haqqında düşünməyə ruhlandırır. O, həkimin, müəllimin, aşpazın, inşaatçının və başqalarının nə iş gördüyünü, hansı alətlərdən istifadə etdiyini öyrənir. Uyğunlaşdırma, kölgə, naxış və axtarış tapşırıqları diqqəti və məntiqi inkişaf etdirir. Hekayə və rəsm səhifələri isə uşağın xəyal gücünü və özünü ifadə bacarığını gücləndirir. Hər peşənin dəyərli olduğunu və insanlara kömək etdiyini vurğulayın.', ARRAY['Peşələr','Söz ehtiyatı','Məntiq','Diqqət','Xəyal gücü','Nitq']::text[], 15, 'pdf/6-yas/6_09_peseler-ve-geleceyim.pdf', 'covers/6_09_peseler-ve-geleceyim.jpg', 10.1, 59),
  ('6_10', '6y', 'Su dövranı və hava', 'Damcının səyahəti və havanın sirləri', 'Bu kitab uşağa təbiətin ən maraqlı sirlərindən birini – suyun dövranını sadə dillə izah edir. O, günəşin suyu necə qızdırdığını, buxarın buluda, buludun isə yağışa necə çevrildiyini öyrənir. Hava hadisələrini tanımaq, hər havaya uyğun geyim seçmək və naxışları tamamlamaq müşahidəni və məntiqi inkişaf etdirir. Səbəb-nəticə əlaqəsini anlamaq elmi düşüncənin ilk addımıdır. Kitabdan sonra pəncərədən birlikdə havanı müşahidə edin.', ARRAY['Təbiət elmləri','Səbəb-nəticə','Müşahidə','Ardıcıllıq','Məntiq']::text[], 15, 'pdf/6-yas/6_10_su-dovrani-ve-hava.pdf', 'covers/6_10_su-dovrani-ve-hava.jpg', 9.0, 60),
  ('6m_01', '6m', 'Qara-Ağ Dünyam', 'Körpənin gözləri üçün ilk kitab', 'Bu kitab körpənin görmə qabiliyyətini inkişaf etdirmək üçün hazırlanıb. Qara, ağ və qırmızı rənglərin kəskin ziddiyyəti körpənin diqqətini asanlıqla cəlb edir. Sadə formalar, üzlər və heyvanlar gözlə izləmə bacarığını, diqqəti və beynin inkişafını dəstəkləyir. Kitabı körpənin üzündən 25–30 sm aralıda tutun və hər şəkli sakit səslə adlandırın.', ARRAY['Görmə','Diqqət','Gözlə izləmə','İlk sözlər']::text[], 14, 'pdf/6-ay/6m_01_qara-ag-dunyam.pdf', 'covers/6m_01_qara-ag-dunyam.jpg', 3.0, 61),
  ('6m_02', '6m', 'İlk sözlərim', 'Ana, ata, top və digər ilk sözlər', 'Körpələr danışmazdan çox əvvəl sözləri dinləyib yadda saxlayırlar. Bu kitabda körpənin həyatındakı ən vacib ilk sözlər toplanıb: ana, ata, top, su, süd və başqaları. Hər şəkli adlandırmaq, səsləri təkrar etmək və ətrafdakı əşyalarla müqayisə etmək nitqin inkişafını sürətləndirir. Hər gün bir neçə səhifəyə baxmaq kifayətdir.', ARRAY['Nitq','Lüğət','Dinləmə','Ünsiyyət']::text[], 14, 'pdf/6-ay/6m_02_ilk-sozlerim.pdf', 'covers/6m_02_ilk-sozlerim.jpg', 7.2, 62),
  ('6m_03', '6m', 'Kim necə səs çıxarır?', 'Miyav, hav-hav, mö-ö! Səsli heyvanlar', 'Heyvan səsləri körpələrin ən çox sevdiyi ilk “sözlər”dir. Sadə və təkrarlanan səslər (miyav, hav-hav, mö-ö) körpənin danışmağa ilk addımlarını asanlaşdırır. Valideynin səsləri təqlid etməsi körpəni güldürür, dinləmə və diqqət bacarığını inkişaf etdirir. Hər səhifədə heyvanın adını və səsini oynaq şəkildə deyin.', ARRAY['Nitq','Dinləmə','Səsləri təqlid','Heyvanlar']::text[], 14, 'pdf/6-ay/6m_03_kim-nece-ses-cixarir.pdf', 'covers/6m_03_kim-nece-ses-cixarir.jpg', 7.0, 63),
  ('6m_04', '6m', 'Mənim ailəm', 'Ana, ata, nənə, baba və mən', 'Ailə körpənin ilk və ən vacib dünyasıdır. Bu kitab körpəni yaxın insanların adları ilə tanış edir: ana, ata, nənə, baba, bacı, qardaş. Tanış üzlərə baxmaq və onların adlarını eşitmək körpədə güvən hissi yaradır, emosional bağlılığı və nitqi inkişaf etdirir. Kitaba baxarkən ailənizin əsl fotolarını da göstərə bilərsiniz.', ARRAY['Ailə','Nitq','Emosiyalar','Bağlılıq']::text[], 13, 'pdf/6-ay/6m_04_menim-ailem.pdf', 'covers/6m_04_menim-ailem.jpg', 7.7, 64),
  ('6m_05', '6m', 'Rəngli dünya', 'İlk rənglərimlə tanışlıq', 'Altı aylıqdan sonra körpələr rəngləri daha aydın görməyə başlayır. Bu kitabda hər səhifə bir rəngə həsr olunub və o rəngdə tanış bir əşya göstərilir. Parlaq rənglər körpənin görmə qavrayışını inkişaf etdirir, rəng adlarını eşitmək isə gələcəkdə rəngləri öyrənməyin təməlini qoyur. Hər rəngi ətrafınızdakı əşyalarla müqayisə edin.', ARRAY['Rənglər','Görmə','Nitq','Diqqət']::text[], 14, 'pdf/6-ay/6m_05_rengli-dunya.pdf', 'covers/6m_05_rengli-dunya.jpg', 4.9, 65),
  ('6m_06', '6m', 'Gecən xeyrə, balaca', 'Sakit yuxu nağılı və layla', 'Hər axşam təkrarlanan sakit ritual körpənin rahat yuxuya getməsinə kömək edir. Bu kitab yumşaq rənglər, qısa cümlələr və laylalarla körpəni gecəyə hazırlayır. Valideynin sakit səsi, eyni sözlərin təkrarı və yavaş ritm körpədə təhlükəsizlik hissi yaradır. Kitabı hər axşam yuxudan əvvəl, işıqları azaldaraq oxuyun.', ARRAY['Yuxu rejimi','Sakitləşmə','Dinləmə','Bağlılıq']::text[], 13, 'pdf/6-ay/6m_06_gecen-xeyre-balaca.pdf', 'covers/6m_06_gecen-xeyre-balaca.jpg', 6.5, 66),
  ('6m_07', '6m', 'Çimmək vaxtı', 'Köpüklər, ördəkcik və isti dəsmal', 'Çimmək körpə üçün həm gigiyena, həm də əyləncəli oyun vaxtıdır. Bu kitab çimmə ritualını addım-addım göstərir: su, sabun, köpüklər, ördəkcik və isti dəsmal. Tanış ardıcıllıq körpənin suya alışmasını asanlaşdırır, yeni sözlər isə nitqi zənginləşdirir. Kitabı çimmədən əvvəl baxıb, sonra əsl əşyaları göstərə bilərsiniz.', ARRAY['Gündəlik rejim','Gigiyena','Nitq','Hisslər']::text[], 13, 'pdf/6-ay/6m_07_cimmek-vaxti.pdf', 'covers/6m_07_cimmek-vaxti.jpg', 3.8, 67),
  ('6m_08', '6m', 'Bədənim', 'Göz, burun, qulaq, əl, ayaq', 'Körpələr öz bədənlərini kəşf etməyi çox sevirlər. Bu kitab əsas bədən hissələrini sadə şəkillər və oynaq cümlələrlə tanıdır. Şəkli göstərib eyni hissəyə körpənin bədənində toxunmaq onun özünü dərk etməsini, nitqini və sizinlə bağlılığını gücləndirir. Hər səhifə həm də kiçik bir oyundur.', ARRAY['Bədən hissələri','Nitq','Toxunma','Özünüdərk']::text[], 13, 'pdf/6-ay/6m_08_bedenim.pdf', 'covers/6m_08_bedenim.jpg', 4.8, 68),
  ('6m_09', '6m', 'Təbiətin səsləri', 'Yağış, külək, quş və dəniz', 'Təbiət körpə üçün böyük bir kəşf dünyasıdır. Bu kitab yağışın, küləyin, quşların və dənizin səsləri ilə körpəni təbiətə yaxınlaşdırır. Səsləri təqlid etmək dinləmə bacarığını və nitqi inkişaf etdirir, təbiət şəkilləri isə sakitləşdirici təsir göstərir. Gəzintilərdə əsl səsləri dinləyin və kitabı xatırladın.', ARRAY['Dinləmə','Təbiət','Nitq','Hisslər']::text[], 14, 'pdf/6-ay/6m_09_tebietin-sesleri.pdf', 'covers/6m_09_tebietin-sesleri.jpg', 7.9, 69),
  ('6m_10', '6m', 'Ku-ku! Kim gizləndi?', 'Gizlənqaç oyunu ilə heyvanlar', '“Ku-ku” oyunu körpələrin ən sevdiyi oyunlardandır. Bu oyun körpəyə gözdən itən əşyanın yox olmadığını, yenidən görünəcəyini öyrədir. Bu, yaddaşın və düşüncənin inkişafında vacib mərhələdir. Kitabda hər heyvan əvvəlcə gizlənir, sonrakı səhifədə isə “Ku-ku!” deyə görünür. Səhifəni çevirməzdən əvvəl bir az gözləyin və sürpriz yaradın.', ARRAY['Yaddaş','Diqqət','Emosiyalar','Gözlə izləmə']::text[], 14, 'pdf/6-ay/6m_10_ku-ku-kim-gizlendi.pdf', 'covers/6m_10_ku-ku-kim-gizlendi.jpg', 3.1, 70)
ON CONFLICT (id) DO UPDATE SET age_group = EXCLUDED.age_group, title = EXCLUDED.title, subtitle = EXCLUDED.subtitle,
  about = EXCLUDED.about, skills = EXCLUDED.skills, pages = EXCLUDED.pages, pdf_path = EXCLUDED.pdf_path,
  cover_path = EXCLUDED.cover_path, size_mb = EXCLUDED.size_mb, sort_order = EXCLUDED.sort_order, updated_at = now();


-- ── Admin: dashboard, orders, catalog (admins only) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_book_dashboard_v1(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'BOOKS_ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  WITH o AS (SELECT * FROM public.book_orders WHERE created_at >= v_since),
  paid AS (SELECT * FROM o WHERE status = 'paid' AND provider = 'epoint'),
  sold AS (SELECT p.id AS order_id, p.unit_price, unnest(p.book_ids) AS book_id FROM paid p)
  SELECT jsonb_build_object(
    'days', p_days,
    'revenue', coalesce((SELECT sum(amount) FROM paid), 0),
    'paid_orders', (SELECT count(*) FROM paid),
    'buyers', (SELECT count(DISTINCT user_id) FROM paid),
    'repeat_buyers', (SELECT count(*) FROM (SELECT user_id FROM paid GROUP BY user_id HAVING count(*) > 1) r),
    'books_sold', (SELECT count(*) FROM sold),
    'avg_order', coalesce((SELECT round(avg(amount), 2) FROM paid), 0),
    'avg_books', coalesce((SELECT round(avg(cardinality(book_ids)), 2) FROM paid), 0),
    'avg_unit', coalesce((SELECT round(sum(amount) / nullif(sum(cardinality(book_ids)), 0), 2) FROM paid), 0),
    'checkouts', (SELECT count(*) FROM o WHERE provider = 'epoint'),
    'pending', (SELECT count(*) FROM o WHERE status = 'pending'),
    'failed', (SELECT count(*) FROM o WHERE status IN ('failed', 'cancelled')),
    'refunded', (SELECT count(*) FROM o WHERE status = 'refunded'),
    'gifted', (SELECT count(*) FROM o WHERE provider = 'admin'),
    'emails_missing', (SELECT count(*) FROM paid WHERE email_sent_at IS NULL),
    'all_time_revenue', coalesce((SELECT sum(amount) FROM public.book_orders WHERE status = 'paid' AND provider = 'epoint'), 0),
    'by_day', coalesce((SELECT jsonb_agg(jsonb_build_object('day', d, 'revenue', r, 'orders', n) ORDER BY d)
       FROM (SELECT date_trunc('day', paid_at)::date AS d, sum(amount) AS r, count(*) AS n FROM paid GROUP BY 1) x), '[]'::jsonb),
    'by_bundle', coalesce((SELECT jsonb_agg(jsonb_build_object('bucket', b, 'orders', n, 'revenue', r) ORDER BY b)
       FROM (SELECT CASE WHEN cardinality(book_ids) >= 10 THEN '10+' WHEN cardinality(book_ids) >= 5 THEN '5-9'
                         WHEN cardinality(book_ids) >= 3 THEN '3-4' ELSE '1-2' END AS b, count(*) AS n, sum(amount) AS r FROM paid GROUP BY 1) x), '[]'::jsonb),
    'by_age', coalesce((SELECT jsonb_agg(jsonb_build_object('age', age_group, 'books', n, 'revenue', r) ORDER BY age_group)
       FROM (SELECT c.age_group, count(*) AS n, sum(s.unit_price) AS r FROM sold s JOIN public.book_catalog c ON c.id = s.book_id GROUP BY 1) x), '[]'::jsonb),
    'top_books', coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title, 'age', age_group, 'sold', n, 'revenue', r) ORDER BY n DESC, title)
       FROM (SELECT c.id, c.title, c.age_group, count(*) AS n, sum(s.unit_price) AS r FROM sold s JOIN public.book_catalog c ON c.id = s.book_id
             GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 10) x), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_book_orders_v1(p_status text DEFAULT NULL, p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, user_id uuid, name text, email text, book_ids text[], amount numeric, unit_price numeric, status text, provider text,
  language text, created_at timestamptz, paid_at timestamptz, email_sent_at timestamptz, provider_transaction text, admin_note text, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'BOOKS_ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT o.id, o.user_id, pr.name, o.email, o.book_ids, o.amount, o.unit_price, o.status, o.provider, o.language,
         o.created_at, o.paid_at, o.email_sent_at, o.provider_transaction, o.admin_note, count(*) OVER ()
    FROM public.book_orders o
    LEFT JOIN public.profiles pr ON pr.user_id = o.user_id
   WHERE (p_status IS NULL OR o.status = p_status)
     AND (p_search IS NULL OR o.email ILIKE '%' || p_search || '%' OR coalesce(pr.name, '') ILIKE '%' || p_search || '%' OR o.id::text = p_search)
   ORDER BY o.created_at DESC
   LIMIT greatest(1, least(coalesce(p_limit, 50), 200)) OFFSET greatest(0, coalesce(p_offset, 0));
END $$;

CREATE OR REPLACE FUNCTION public.admin_book_catalog_v1()
RETURNS TABLE (id text, age_group text, title text, pages integer, pdf_path text, active boolean, has_pdf boolean, sold bigint, revenue numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, storage, pg_temp
AS $$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'BOOKS_ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.id, c.age_group, c.title, c.pages, c.pdf_path, c.active,
         EXISTS (SELECT 1 FROM storage.objects so WHERE so.bucket_id = 'book-pdfs' AND so.name = c.pdf_path),
         coalesce(s.n, 0), coalesce(s.r, 0)
    FROM public.book_catalog c
    LEFT JOIN (SELECT b.book_id, count(*) AS n, sum(o.unit_price) AS r
                 FROM public.book_orders o CROSS JOIN LATERAL unnest(o.book_ids) AS b(book_id)
                WHERE o.status = 'paid' AND o.provider = 'epoint' GROUP BY b.book_id) s ON s.book_id = c.id
   ORDER BY c.sort_order;
END $$;
REVOKE ALL ON FUNCTION public.admin_book_dashboard_v1(integer), public.admin_book_orders_v1(text, text, integer, integer), public.admin_book_catalog_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_book_dashboard_v1(integer), public.admin_book_orders_v1(text, text, integer, integer), public.admin_book_catalog_v1() TO authenticated;

-- Book sales stay off until an admin switches them on (admin → PDF kitablar).
INSERT INTO public.app_settings (key, value, description)
SELECT 'books_payments_enabled', 'false'::jsonb, 'PDF çap kitablarının Epoint ilə satışı (true/false)'
 WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'books_payments_enabled');

-- ── CDC / writer guard (Google) ──────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'BOOKS_GUARD_CATALOG_MISSING';
  END IF;
  INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
  SELECT 'public', 'book_catalog', ARRAY['id'] WHERE NOT EXISTS (
    SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'book_catalog');
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.book_catalog;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.book_catalog;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.book_catalog;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.book_catalog
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.book_catalog
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.book_catalog
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
  SELECT 'public', 'book_orders', ARRAY['id'] WHERE NOT EXISTS (
    SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'book_orders');
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.book_orders;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.book_orders;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.book_orders;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.book_orders
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.book_orders
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.book_orders
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  INSERT INTO _anacan_gcp_migration.guarded_relations (schema_name, table_name, primary_key)
  SELECT 'public', 'book_entitlements', ARRAY['user_id','book_id'] WHERE NOT EXISTS (
    SELECT 1 FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public' AND table_name = 'book_entitlements');
  DROP TRIGGER IF EXISTS anacan_gcp_writer_guard ON public.book_entitlements;
  DROP TRIGGER IF EXISTS anacan_gcp_change ON public.book_entitlements;
  DROP TRIGGER IF EXISTS anacan_gcp_truncate ON public.book_entitlements;
  CREATE TRIGGER anacan_gcp_writer_guard BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.book_entitlements
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.guard_write();
  CREATE TRIGGER anacan_gcp_change AFTER INSERT OR DELETE OR UPDATE ON public.book_entitlements
    FOR EACH ROW EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
  CREATE TRIGGER anacan_gcp_truncate AFTER TRUNCATE ON public.book_entitlements
    FOR EACH STATEMENT EXECUTE FUNCTION _anacan_gcp_migration.capture_change();
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER TABLE public.book_catalog OWNER TO pgadmin';
    EXECUTE 'ALTER TABLE public.book_orders OWNER TO pgadmin';
    EXECUTE 'ALTER TABLE public.book_entitlements OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.my_books_v1() OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.admin_book_dashboard_v1(integer) OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.admin_book_orders_v1(text, text, integer, integer) OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.admin_book_catalog_v1() OWNER TO pgadmin';
  END IF;
END $$;

-- Private PDF bucket (signed URLs only) and public cover bucket.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('book-pdfs', 'book-pdfs', false, 52428800, ARRAY['application/pdf'])
      ON CONFLICT (id) DO UPDATE SET public = false;
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('book-covers', 'book-covers', true, 5242880, ARRAY['image/jpeg', 'image/webp'])
      ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

COMMIT;
