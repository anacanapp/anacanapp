-- anacan-aptek-store (2026-10-27): Anacan Aptek on the existing shop tables.
--
--   * products gains catalogue columns (sku, brand, kind, age, volume, images, tags, sales,
--     source) and 52 baby-feeding products from the aloe.az export, upserted by sku;
--   * orders gains delivery slot, payment method (cash / card on delivery), phone and a
--     server-computed price breakdown; the legacy client insert path keeps working;
--   * place_aptek_order() re-prices every line, bundle and coupon on the server, writes the
--     order and its items, consumes the coupon, decrements stock and clears those cart lines;
--   * app_settings 'aptek_config' (disabled by default) is read through get_aptek_config(),
--     so the public app-setting allowlist is left untouched;
--   * coupon ANACAN10 (10 %, applicable_to 'aptek').
--
-- Applied by /home/anacan-runner/run-sql.py (psql as supabase_admin, ON_ERROR_STOP). Every
-- changed relation must already be CDC/writer-guard enrolled; the migration refuses otherwise.
-- No new table, cron or timer. Product images ship with the app under /aptek/*.webp.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ── Changed relations must already be guarded ───────────────────────────────────
DO $$
BEGIN
  IF to_regclass('_anacan_gcp_migration.guarded_relations') IS NULL THEN
    RAISE EXCEPTION 'APTEK_GUARD_CATALOG_MISSING';
  END IF;
  IF (SELECT count(*) FROM _anacan_gcp_migration.guarded_relations WHERE schema_name = 'public'
      AND table_name IN ('products','orders','order_items','cart_items','coupons','app_settings')) <> 6
     OR (SELECT count(DISTINCT c.relname) FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND tg.tgname = 'anacan_gcp_writer_guard'
           AND c.relname IN ('products','orders','order_items','cart_items','coupons','app_settings')) <> 6 THEN
    RAISE EXCEPTION 'APTEK_GUARD_ENROLLMENT_INCOMPLETE';
  END IF;
END $$;

-- ── Catalogue columns ───────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS store text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS min_age_months smallint,
  ADD COLUMN IF NOT EXISTS volume text,
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_url text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_min_age_months_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_min_age_months_check CHECK (min_age_months IS NULL OR min_age_months BETWEEN 0 AND 72);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON public.products (sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_store_idx ON public.products (store, is_active) WHERE store IS NOT NULL;

-- ── Order columns ───────────────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS store text,
  ADD COLUMN IF NOT EXISTS delivery_slot text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_fee numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash','card_on_delivery'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS orders_store_created_idx ON public.orders (store, created_at DESC) WHERE store IS NOT NULL;

-- ── Seed: aloe.az baby-feeding catalogue (prices refresh, admin activation is kept) ──
INSERT INTO public.products
  (sku, name, name_en, name_ru, category, category_en, category_ru, price, original_price, image_url, images,
   brand, kind, min_age_months, volume, tags, sales_count, source_url, store, source, stock, is_active)
SELECT v.sku, v.name, v.name_en, v.name_ru, v.category, v.category_en, v.category_ru, v.price, v.original_price, v.image_url, v.images,
       v.brand, v.kind, v.min_age_months, v.volume, v.tags, v.sales_count, v.source_url, 'aptek', 'aloe.az', 100, true
FROM (VALUES
('55308', 'Anti-colic, AirFree klapanlı Qidalanma üçün polipropilen qab 125 ml 1+ aydan', 'Anti-colic AirFree feeding bottle 125 ml, 1 m+', 'Антиколиковая бутылочка AirFree 125 мл, 1 мес+', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 15.3, 21.8, '/aptek/55308_0.webp', ARRAY['/aptek/55308_0.webp','/aptek/55308_1.webp']::text[], 'Philips Avent', 'bowls', 1, '125 ml', '{}'::text[], 84, 'https://aloe.az/anti-colic-airfree-klapanli-qidalanma-ucun-polipropilen-qab-125-ml-1-aydan'),
('40115', 'Canpol Babies qidalanma üçün Naxışlı şüşə butulka 240 ml', 'Canpol Babies patterned glass feeding bottle 240 ml', 'Стеклянная бутылочка Canpol Babies с узором 240 мл', 'Butulka', 'Bottles', 'Бутылочки', 4.8, 6.8, '/aptek/40115_0.webp', ARRAY['/aptek/40115_0.webp']::text[], 'Canpol Babies', 'bottles', NULL, '240 ml', '{}'::text[], 272, 'https://aloe.az/canpol-babies-qidalanma-ucun-naxisli-suse-butulka-240-ml'),
('6206', 'Vakuumlu kasa', 'Suction bowl', 'Миска на присоске', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 8.4, 12.0, '/aptek/6206_0.webp', ARRAY['/aptek/6206_0.webp']::text[], 'Canpol Babies', 'bowls', NULL, NULL, '{}'::text[], 6, 'https://aloe.az/vakuumlu-kasa'),
('67808', 'Natural Yavaş axınlı əmzikli, 260 ml, 1 ay+ üçün nəzərdə tutulmuş 2 qidalanma butulkası dəsti', 'Natural slow-flow bottles 260 ml, 1 m+, set of 2', 'Бутылочки Natural с медленным потоком 260 мл, 1 мес+, набор из 2', 'Butulka', 'Bottles', 'Бутылочки', 29.7, 42.4, '/aptek/67808_0.webp', ARRAY['/aptek/67808_0.webp']::text[], 'Philips Avent', 'bottles', NULL, NULL, '{}'::text[], 1, 'https://aloe.az/natural-yavas-axinli-emzikli-260-ml-1-ay-ucun-nezerde-tutulmus-2-qidalanma-butulkasi-desti'),
('45621', 'Buxarlayıcı-blender "2-si 1-də", buxarlayıcı - 850ml, qarışdırıcı - 450ml', '2-in-1 steamer-blender, 850 ml steamer, 450 ml jar', 'Пароварка-блендер 2 в 1, 850 мл и 450 мл', 'Texnika', 'Appliances', 'Техника', 215.8, 308.2, '/aptek/45621_0.webp', ARRAY['/aptek/45621_0.webp']::text[], 'Philips Avent', 'appliances', NULL, NULL, '{}'::text[], 0, 'https://aloe.az/buxarlayici-blender-2-si-1-de-buxarlayici-850ml-qarisdirici-450ml'),
('45908', 'Sıyıq dəstgahı 1 əd', 'Porridge maker', 'Кашеварка', 'Texnika', 'Appliances', 'Техника', 13.9, NULL, '/aptek/45908_0.webp', ARRAY['/aptek/45908_0.webp']::text[], 'Sweet Baby', 'appliances', NULL, NULL, '{}'::text[], 0, 'https://aloe.az/siyiq-destgahi-1-ed'),
('45630', 'Sippy fincan 12 aydan 260 ml', 'Sippy cup 260 ml, 12 m+', 'Поильник 260 мл, 12 мес+', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 11.7, 16.6, '/aptek/45630_0.webp', ARRAY['/aptek/45630_0.webp']::text[], 'Philips Avent', 'cups', 12, '260 ml', '{}'::text[], 5, 'https://aloe.az/sippy-fincan-12-aydan-260-ml'),
('24933', 'Mini butulka + öyrədici qurtumlu fincan 30 ml', 'Mini bottle + training sippy cup 30 ml', 'Мини-бутылочка + обучающий поильник 30 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 5.4, NULL, '/aptek/24933_0.webp', ARRAY['/aptek/24933_0.webp']::text[], 'Digər', 'cups', NULL, '30 ml', '{}'::text[], 3, 'https://aloe.az/mini-butulka-oyredici-qurtumlu-fincan-30-ml'),
('55304', 'Sippy fincan dəsti 9 aylıq 260 ml', 'Sippy cup set 260 ml, 9 m+', 'Набор поильников 260 мл, 9 мес+', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 17.0, 24.2, '/aptek/55304_0.webp', ARRAY['/aptek/55304_0.webp']::text[], 'Philips Avent', 'cups', 9, NULL, '{}'::text[], 2, 'https://aloe.az/sippy-fincan-desti-9-ayliq-260-ml'),
('45586', 'Qapaqlı uşaq qidalarının saxlanması üçün qablar dəsti 240 ml 5 əd', 'Baby food storage pots with lids 240 ml, 5 pcs', 'Контейнеры для детского питания с крышками 240 мл, 5 шт', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 16.0, 22.9, '/aptek/45586_0.webp', ARRAY['/aptek/45586_0.webp','/aptek/45586_1.webp']::text[], 'Philips Avent', 'bowls', NULL, '240 ml', '{}'::text[], 1, 'https://aloe.az/qapaqli-usaq-qidalarinin-saxlanmasi-ucun-qablar-desti-240-ml-5-ed'),
('55305', 'Sippy fincan Bee 9 aylıq 260 ml', 'Sippy cup Bee 260 ml, 9 m+', 'Поильник Bee 260 мл, 9 мес+', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 17.0, 24.2, '/aptek/55305_0.webp', ARRAY['/aptek/55305_0.webp']::text[], 'Philips Avent', 'cups', 9, '260 ml', '{}'::text[], 2, 'https://aloe.az/sippy-fincan-bee-9-ayliq-260-ml'),
('46958', 'Qaşıq, səyahət qutusunda çəngəl 12+ aydan', 'Travel spoon and fork in a case, 12 m+', 'Ложка и вилка в дорожном футляре, 12 мес+', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 16.4, NULL, '/aptek/46958_0.webp', ARRAY['/aptek/46958_0.webp']::text[], 'Philips Avent', 'cutlery', 12, NULL, '{}'::text[], 2, 'https://aloe.az/qasiq-seyahet-qutusunda-cengel-12-aydan'),
('49500', 'Butulka 240ml', 'Feeding bottle 240 ml', 'Бутылочка 240 мл', 'Butulka', 'Bottles', 'Бутылочки', 13.3, NULL, '/aptek/49500_0.webp', ARRAY['/aptek/49500_0.webp']::text[], 'Canpol Babies', 'bottles', NULL, NULL, '{}'::text[], 0, 'https://aloe.az/butulka-240ml'),
('33657', 'Fincan 120ml', 'Cup 120 ml', 'Чашка 120 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 9.8, NULL, '/aptek/33657_0.webp', ARRAY['/aptek/33657_0.webp']::text[], 'Canpol Babies', 'cups', NULL, '120 ml', '{}'::text[], 0, 'https://aloe.az/fincan-120ml'),
('33652', 'Geniş Boyunlu Antikolik Şüşə', 'Wide-neck anti-colic bottle', 'Антиколиковая бутылочка с широким горлышком', 'Butulka', 'Bottles', 'Бутылочки', 7.3, NULL, '/aptek/33652_0.webp', ARRAY['/aptek/33652_0.webp']::text[], 'Canpol Babies', 'bottles', NULL, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/genis-boyunlu-antikolik-suse'),
('49499', 'Geniş Boyunlu Yaşıl Antikolik Şüşə "Oyuncaqlar" 240 ml', 'Wide-neck anti-colic bottle "Toys", green, 240 ml', 'Антиколиковая бутылочка с широким горлышком «Игрушки», зелёная, 240 мл', 'Butulka', 'Bottles', 'Бутылочки', 8.4, NULL, '/aptek/49499_0.webp', ARRAY['/aptek/49499_0.webp']::text[], 'Canpol Babies', 'bottles', NULL, '240 ml', ARRAY['anti_colic']::text[], 0, 'https://aloe.az/genis-boyunlu-yasil-antikolik-suse-oyuncaqlar-240-ml'),
('85746', 'Baboo silikonlu qaşıq, narıncı', 'Baboo silicone spoon, orange', 'Силиконовая ложка Baboo, оранжевая', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 6.6, NULL, '/aptek/85746_0.webp', ARRAY['/aptek/85746_0.webp']::text[], 'Baboo', 'cutlery', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-qasiq-narinci'),
('85745', 'Baboo Silikonlu qaşıq, göy', 'Baboo silicone spoon, blue', 'Силиконовая ложка Baboo, голубая', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 6.6, NULL, '/aptek/85745_0.webp', ARRAY['/aptek/85745_0.webp']::text[], 'Baboo', 'cutlery', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-qasiq-goy'),
('85752', 'Baboo Yumşaq qaşıq və çənqəl dəsti, şaftalə rənqı', 'Baboo soft spoon and fork set, peach', 'Набор мягких ложки и вилки Baboo, персиковый', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 8.1, NULL, '/aptek/85752_0.webp', ARRAY['/aptek/85752_0.webp']::text[], 'Baboo', 'cutlery', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-yumsaq-qasiq-ve-cenqel-desti-saftale-renqi'),
('85753', 'Baboo Yumşaq qaşıq və çənqəl dəsti, yaşıl', 'Baboo soft spoon and fork set, green', 'Набор мягких ложки и вилки Baboo, зелёный', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 8.1, NULL, '/aptek/85753_0.webp', ARRAY['/aptek/85753_0.webp']::text[], 'Baboo', 'cutlery', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-yumsaq-qasiq-ve-cenqel-desti-yasil'),
('85751', 'Baboo Yumşaq qaşıq və çənqəl dəsti', 'Baboo soft spoon and fork set', 'Набор мягких ложки и вилки Baboo', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 8.1, NULL, '/aptek/85751_0.webp', ARRAY['/aptek/85751_0.webp']::text[], 'Baboo', 'cutlery', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-yumsaq-qasiq-ve-cenqel-desti'),
('85704', 'Baboo Anti-kolik qidalanma üçün əmzik Peachy Keen', 'Baboo anti-colic feeding bottle, Peachy Keen', 'Антиколиковая бутылочка Baboo, Peachy Keen', 'Butulka', 'Bottles', 'Бутылочки', 8.9, NULL, '/aptek/85704_0.webp', ARRAY['/aptek/85704_0.webp']::text[], 'Baboo', 'bottles', 0, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/baboo-anti-kolik-qidalanma-ucun-emzik-peachy-keen'),
('85703', 'Baboo Anti-kolik qidalanma üçün əmzik, Au Naturale', 'Baboo anti-colic feeding bottle, Au Naturale', 'Антиколиковая бутылочка Baboo, Au Naturale', 'Butulka', 'Bottles', 'Бутылочки', 8.9, NULL, '/aptek/85703_0.webp', ARRAY['/aptek/85703_0.webp']::text[], 'Baboo', 'bottles', 0, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/baboo-anti-kolik-qidalanma-ucun-emzik-au-naturale'),
('85705', 'Baboo Anti-kolik qidalanma üçün əmzik, Lagoon Fiesta', 'Baboo anti-colic feeding bottle, Lagoon Fiesta', 'Антиколиковая бутылочка Baboo, Lagoon Fiesta', 'Butulka', 'Bottles', 'Бутылочки', 10.4, NULL, '/aptek/85705_0.webp', ARRAY['/aptek/85705_0.webp']::text[], 'Baboo', 'bottles', 3, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/baboo-anti-kolik-qidalanma-ucun-emzik-lagoon-fiesta'),
('85706', 'Baboo Anti-kolik qidalanma üçün əmzik, Blue Haze', 'Baboo anti-colic feeding bottle, Blue Haze', 'Антиколиковая бутылочка Baboo, Blue Haze', 'Butulka', 'Bottles', 'Бутылочки', 10.4, NULL, '/aptek/85706_0.webp', ARRAY['/aptek/85706_0.webp']::text[], 'Baboo', 'bottles', 3, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/baboo-anti-kolik-qidalanma-ucun-emzik-blue-haze'),
('85711', 'Baboo Anti-kolik qidalanma üçün şüşəli əmzik, nazik boğaz', 'Baboo anti-colic glass bottle, narrow neck', 'Антиколиковая стеклянная бутылочка Baboo, узкое горлышко', 'Butulka', 'Bottles', 'Бутылочки', 10.4, NULL, '/aptek/85711_0.webp', ARRAY['/aptek/85711_0.webp']::text[], 'Baboo', 'bottles', 0, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/baboo-anti-kolik-qidalanma-ucun-suseli-emzik-nazik-bogaz'),
('85742', 'Baboo Yapışan qab, qabaq və qaşıq ilə, Blue Haze', 'Baboo suction bowl with lid and spoon, Blue Haze', 'Миска Baboo на присоске с крышкой и ложкой, Blue Haze', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 10.8, NULL, '/aptek/85742_0.webp', ARRAY['/aptek/85742_0.webp']::text[], 'Baboo', 'cutlery', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-yapisan-qab-qabaq-ve-qasiq-ile-blue-haze'),
('85741', 'Baboo Yapışan qab, qabaq və qaşıq ilə, Lagoon Fiesta', 'Baboo suction bowl with lid and spoon, Lagoon Fiesta', 'Миска Baboo на присоске с крышкой и ложкой, Lagoon Fiesta', 'Qaşıq və çəngəl', 'Spoons & forks', 'Ложки и вилки', 10.8, NULL, '/aptek/85741_0.webp', ARRAY['/aptek/85741_0.webp']::text[], 'Baboo', 'cutlery', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-yapisan-qab-qabaq-ve-qasiq-ile-lagoon-fiesta'),
('85773', 'Baboo Silikonlu ağız ilə su qabı, nanəli', 'Baboo water bottle with silicone spout, mint', 'Поильник Baboo с силиконовым носиком, мятный', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 11.1, NULL, '/aptek/85773_0.webp', ARRAY['/aptek/85773_0.webp']::text[], 'Baboo', 'cups', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-su-qabi-naneli'),
('85774', 'Baboo Silikonlu ağız ilə su qabı, göy', 'Baboo water bottle with silicone spout, blue', 'Поильник Baboo с силиконовым носиком, голубой', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 11.1, NULL, '/aptek/85774_0.webp', ARRAY['/aptek/85774_0.webp']::text[], 'Baboo', 'cups', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-su-qabi-goy'),
('85775', 'Baboo Silikonlu trubka ilə su qabı, yaşıl, 360 ml', 'Baboo straw bottle, green, 360 ml', 'Поильник Baboo с трубочкой, зелёный, 360 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 11.9, NULL, '/aptek/85775_0.webp', ARRAY['/aptek/85775_0.webp']::text[], 'Baboo', 'cups', 9, '360 ml', '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-trubka-ile-su-qabi-yasil-360-ml'),
('85763', 'Baboo Silikonlu ağız ilə fıncan, Sea Life, narıncı', 'Baboo cup with silicone spout, Sea Life, orange', 'Чашка Baboo с силиконовым носиком, Sea Life, оранжевая', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 12.6, NULL, '/aptek/85763_0.webp', ARRAY['/aptek/85763_0.webp']::text[], 'Baboo', 'cups', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-fincan-sea-life-narinci'),
('85713', 'Baboo Anti-kolik qidalanma üçün şüşəli əmzik, geniş boğaz', 'Baboo anti-colic glass bottle, wide neck', 'Антиколиковая стеклянная бутылочка Baboo, широкое горлышко', 'Butulka', 'Bottles', 'Бутылочки', 14.9, NULL, '/aptek/85713_0.webp', ARRAY['/aptek/85713_0.webp']::text[], 'Baboo', 'bottles', 0, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/baboo-anti-kolik-qidalanma-ucun-suseli-emzik-genis-bogaz'),
('85767', 'Baboo cup 360° Su qabı, yaşıl, 300 ml', 'Baboo 360° cup, green, 300 ml', 'Чашка-непроливайка Baboo 360°, зелёная, 300 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 14.9, NULL, '/aptek/85767_0.webp', ARRAY['/aptek/85767_0.webp']::text[], 'Baboo', 'cups', 6, '300 ml', '{}'::text[], 0, 'https://aloe.az/baboo-cup-360-su-qabi-yasil-300-ml'),
('85766', 'Baboo Cup 360° Su qabı, narıncı, 300 ml', 'Baboo 360° cup, orange, 300 ml', 'Чашка-непроливайка Baboo 360°, оранжевая, 300 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 14.9, NULL, '/aptek/85766_0.webp', ARRAY['/aptek/85766_0.webp']::text[], 'Baboo', 'cups', 6, '300 ml', '{}'::text[], 0, 'https://aloe.az/baboo-cup-360-su-qabi-narinci-300-ml'),
('85764', 'Baboo Silikonlu ağız ilə flncan, Sea Life, narıncı, 300 ml', 'Baboo cup with silicone spout, Sea Life, orange, 300 ml', 'Чашка Baboo с силиконовым носиком, Sea Life, оранжевая, 300 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 14.9, NULL, '/aptek/85764_0.webp', ARRAY['/aptek/85764_0.webp']::text[], 'Baboo', 'cups', 9, '300 ml', '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-flncan-sea-life-narinci-300-ml'),
('85765', 'Baboo Silikonlu ağız ilə fıncan, Marine, yaşıl, 300 ml', 'Baboo cup with silicone spout, Marine, green, 300 ml', 'Чашка Baboo с силиконовым носиком, Marine, зелёная, 300 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 14.9, NULL, '/aptek/85765_0.webp', ARRAY['/aptek/85765_0.webp']::text[], 'Baboo', 'cups', 9, '300 ml', '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-fincan-marine-yasil-300-ml'),
('85769', 'Baboo Silikonlu ağız ilə su qabı, Peachy Keen, yaşıl, 260 ml', 'Baboo water bottle with silicone spout, Peachy Keen, 260 ml', 'Поильник Baboo с силиконовым носиком, Peachy Keen, 260 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 17.9, NULL, '/aptek/85769_0.webp', ARRAY['/aptek/85769_0.webp']::text[], 'Baboo', 'cups', 6, '260 ml', '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-su-qabi-peachy-keen-yasil-260-ml'),
('85770', 'Baboo Silikonlu ağız ilə su qabı, Au Naturale, kakao, 260 ml', 'Baboo water bottle with silicone spout, Au Naturale, 260 ml', 'Поильник Baboo с силиконовым носиком, Au Naturale, 260 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 17.9, NULL, '/aptek/85770_0.webp', ARRAY['/aptek/85770_0.webp']::text[], 'Baboo', 'cups', 9, '260 ml', '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-su-qabi-au-naturale-kakao-260-ml'),
('85771', 'Baboo Silikonlu ağız ilə su qabı, Lagoon Fiesta, yaşıl, 260 ml', 'Baboo water bottle with silicone spout, Lagoon Fiesta, 260 ml', 'Поильник Baboo с силиконовым носиком, Lagoon Fiesta, 260 мл', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 17.9, NULL, '/aptek/85771_0.webp', ARRAY['/aptek/85771_0.webp']::text[], 'Baboo', 'cups', 9, '260 ml', '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-agiz-ile-su-qabi-lagoon-fiesta-yasil-260-ml'),
('85738', 'Baboo Silikonlu yapışan qab, Au Naturale, kakao', 'Baboo silicone suction bowl, Au Naturale', 'Силиконовая миска Baboo на присоске, Au Naturale', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 18.6, NULL, '/aptek/85738_0.webp', ARRAY['/aptek/85738_0.webp']::text[], 'Baboo', 'bowls', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-yapisan-qab-au-naturale-kakao'),
('85736', 'Baboo Silikonlu yapışan qab, Lagoon Fiesta, nanəli', 'Baboo silicone suction bowl, Lagoon Fiesta', 'Силиконовая миска Baboo на присоске, Lagoon Fiesta', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 18.6, NULL, '/aptek/85736_0.webp', ARRAY['/aptek/85736_0.webp']::text[], 'Baboo', 'bowls', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-yapisan-qab-lagoon-fiesta-naneli'),
('85735', 'Baboo Silikonlu yapışan qab, Peachy Keen, yaşıl', 'Baboo silicone suction bowl, Peachy Keen', 'Силиконовая миска Baboo на присоске, Peachy Keen', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 18.6, NULL, '/aptek/85735_0.webp', ARRAY['/aptek/85735_0.webp']::text[], 'Baboo', 'bowls', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-yapisan-qab-peachy-keen-yasil'),
('85740', 'Baboo Silikonlu yapışan qab', 'Baboo silicone suction bowl', 'Силиконовая миска Baboo на присоске', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 18.6, NULL, '/aptek/85740_0.webp', ARRAY['/aptek/85740_0.webp']::text[], 'Baboo', 'bowls', 6, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-silikonlu-yapisan-qab'),
('85779', 'Baboo sürüşməyən su qabı Blue Haze, göy', 'Baboo non-slip water bottle, Blue Haze', 'Нескользящий поильник Baboo, Blue Haze', 'Fincan və su qabı', 'Cups & sippies', 'Поильники и чашки', 6.4, NULL, '/aptek/85779_0.webp', ARRAY['/aptek/85779_0.webp']::text[], 'Baboo', 'cups', 12, NULL, '{}'::text[], 0, 'https://aloe.az/baboo-surusmeyen-su-qabi-blue-haze-goy'),
('14960', 'Plastik qab oğlan və qız üçün', 'Plastic bowl for boys and girls', 'Пластиковая миска для мальчиков и девочек', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 3.1, 4.3, '/aptek/14960_0.webp', ARRAY['/aptek/14960_0.webp']::text[], 'Canpol Babies', 'bowls', NULL, NULL, '{}'::text[], 0, 'https://aloe.az/plastik-qab-oglan-ve-qiz-ucun'),
('65897', 'Anti-kolik şüşə Yeni doğulmuş körpə, 60 ml', 'Anti-colic newborn bottle 60 ml', 'Антиколиковая бутылочка для новорождённых 60 мл', 'Butulka', 'Bottles', 'Бутылочки', 3.9, 5.5, '/aptek/65897_0.webp', ARRAY['/aptek/65897_0.webp']::text[], 'Canpol Babies', 'bottles', 0, '60 ml', ARRAY['anti_colic']::text[], 0, 'https://aloe.az/anti-kolik-suse-yeni-dogulmus-korpe-60-ml'),
('14957', 'Plastik boşqab oğlan və qız', 'Plastic plate for boys and girls', 'Пластиковая тарелка для мальчиков и девочек', 'Qab və boşqab', 'Bowls & plates', 'Миски и тарелки', 3.1, 4.4, '/aptek/14957_0.webp', ARRAY['/aptek/14957_0.webp']::text[], 'Canpol Babies', 'bowls', NULL, NULL, '{}'::text[], 1, 'https://aloe.az/plastik-bosqab-oglan-ve-qiz'),
('49498', 'Canpol 35/221 Geniş boyunlu mavi antikolik butulka "Oyuncaqlar", 240 ml', 'Canpol wide-neck anti-colic bottle "Toys", blue, 240 ml', 'Антиколиковая бутылочка Canpol с широким горлышком «Игрушки», голубая, 240 мл', 'Butulka', 'Bottles', 'Бутылочки', 13.3, NULL, '/aptek/49498_0.webp', ARRAY['/aptek/49498_0.webp']::text[], 'Canpol Babies', 'bottles', NULL, '240 ml', ARRAY['anti_colic']::text[], 0, 'https://aloe.az/canpol-35221-genis-boyunlu-mavi-antikolik-butulka-oyuncaqlar-240-ml'),
('54692', 'Avent Süd qarışığı dozatoru', 'Avent formula dispenser', 'Дозатор для смеси Avent', 'Texnika', 'Appliances', 'Техника', 11.1, 15.8, '/aptek/54692_0.webp', ARRAY['/aptek/54692_0.webp']::text[], 'Philips Avent', 'appliances', NULL, NULL, '{}'::text[], 0, 'https://aloe.az/avent-sud-qarisigi-dozatoru'),
('49495', 'Canpol 35/220 Geniş boyunlu antikolik butulka "Oyuncaqlar", mavi, 120 ml', 'Canpol wide-neck anti-colic bottle "Toys", blue, 120 ml', 'Антиколиковая бутылочка Canpol с широким горлышком «Игрушки», голубая, 120 мл', 'Butulka', 'Bottles', 'Бутылочки', 11.2, NULL, '/aptek/49495_0.webp', ARRAY['/aptek/49495_0.webp']::text[], 'Canpol Babies', 'bottles', NULL, NULL, ARRAY['anti_colic']::text[], 0, 'https://aloe.az/canpol-35220-genis-boyunlu-antikolik-butulka-oyuncaqlar-mavi-120-ml'),
('60956', 'Kabrita 1 Gold keçi südü əsaslı qarışıq, 0–6 ay, 800 q', 'Kabrita 1 Gold goat milk formula, 0–6 m, 800 g', 'Смесь Kabrita 1 Gold на козьем молоке, 0–6 мес, 800 г', 'Uşaq qidası', 'Baby food', 'Детское питание', 65.9, 67.9, '/aptek/60956_0.webp', ARRAY['/aptek/60956_0.webp','/aptek/60956_1.webp','/aptek/60956_2.webp','/aptek/60956_3.webp']::text[], 'Kabrita', 'food', 0, '800 q', ARRAY['infant_formula']::text[], 163, 'https://aloe.az/kabrita-1-gold-usaq-qidasi-0-6-ay-800-q')
) AS v(sku, name, name_en, name_ru, category, category_en, category_ru, price, original_price, image_url, images,
       brand, kind, min_age_months, volume, tags, sales_count, source_url)
ON CONFLICT (sku) WHERE sku IS NOT NULL DO UPDATE SET
  name = EXCLUDED.name, name_en = EXCLUDED.name_en, name_ru = EXCLUDED.name_ru,
  category = EXCLUDED.category, category_en = EXCLUDED.category_en, category_ru = EXCLUDED.category_ru,
  price = EXCLUDED.price, original_price = EXCLUDED.original_price, image_url = EXCLUDED.image_url, images = EXCLUDED.images,
  brand = EXCLUDED.brand, kind = EXCLUDED.kind, min_age_months = EXCLUDED.min_age_months, volume = EXCLUDED.volume,
  tags = EXCLUDED.tags, sales_count = EXCLUDED.sales_count, source_url = EXCLUDED.source_url, store = 'aptek', source = 'aloe.az',
  updated_at = now();

-- ── Coupon ──────────────────────────────────────────────────────────────────────
INSERT INTO public.coupons (code, description, description_en, discount_type, discount_value, applicable_to, is_active)
VALUES ('ANACAN10', 'Anacan Aptek: ilk sifarişə 10% endirim', 'Anacan Aptek: 10% off', 'percentage', 10, ARRAY['aptek'], true)
ON CONFLICT (code) DO NOTHING;

-- ── Config (off until the operator enables it) ──────────────────────────────────
INSERT INTO public.app_settings (key, value, description)
VALUES ('aptek_config', jsonb_build_object(
  'enabled', false,
  'countries', jsonb_build_array('AZ'),
  'free_shipping_min', 30,
  'shipping_fee', 3,
  'bundle_discount_pct', 10,
  'slots', jsonb_build_array('today_evening', 'tomorrow_morning', 'tomorrow_evening', 'day_after'),
  'bundles', jsonb_build_array(
    jsonb_build_object('id', 'newborn', 'skus', jsonb_build_array('65897', '85713', '54692'), 'tone', 'c-blue'),
    jsonb_build_object('id', 'weaning', 'skus', jsonb_build_array('85742', '85752', '85767'), 'tone', 'c-peach'),
    jsonb_build_object('id', 'cups', 'skus', jsonb_build_array('55305', '85775', '85764'), 'tone', 'c-green'),
    jsonb_build_object('id', 'night', 'skus', jsonb_build_array('85704', '85711', '85705'), 'tone', 'c-lav')),
  'placements', jsonb_build_object('home', true, 'feeding', true, 'colic', true, 'weaning', true, 'cups', true,
    'newborn', true, 'bag', true, 'search', true)),
  'Anacan Aptek: açar, çatdırılma, dəstlər və təklif yerləşmələri')
ON CONFLICT (key) DO NOTHING;

-- ── Public config reader (only this key; the allowlist RPC is not redefined) ───
CREATE OR REPLACE FUNCTION public.get_aptek_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  -- The admin settings hook may store values JSON-encoded as a string; unwrap those.
  SELECT CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END
  FROM public.app_settings WHERE key = 'aptek_config';
$$;
REVOKE ALL ON FUNCTION public.get_aptek_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_aptek_config() TO anon, authenticated;

-- ── Server-priced checkout ──────────────────────────────────────────────────────
-- p_items: [{"product_id": uuid, "quantity": 1..20}], 1..50 distinct lines.
CREATE OR REPLACE FUNCTION public.place_aptek_order(
  p_items jsonb,
  p_coupon text,
  p_slot text,
  p_payment text,
  p_address jsonb,
  p_phone text,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cfg jsonb;
  v_lines int;
  v_subtotal numeric(10,2) := 0;
  v_bundle_off numeric(10,2) := 0;
  v_coupon_off numeric(10,2) := 0;
  v_ship numeric(10,2) := 0;
  v_total numeric(10,2);
  v_bundle jsonb;
  v_pct numeric;
  v_coupon public.coupons%ROWTYPE;
  v_code text := nullif(upper(btrim(coalesce(p_coupon, ''))), '');
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'APTEK_AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;

  SELECT CASE WHEN jsonb_typeof(value) = 'string' THEN (value #>> '{}')::jsonb ELSE value END
    INTO v_cfg FROM public.app_settings WHERE key = 'aptek_config';
  IF v_cfg IS NULL OR coalesce((v_cfg->>'enabled')::boolean, false) IS NOT TRUE THEN
    IF NOT public.has_role(v_uid, 'admin') THEN RAISE EXCEPTION 'APTEK_DISABLED'; END IF;
  END IF;

  IF p_payment NOT IN ('cash', 'card_on_delivery') THEN RAISE EXCEPTION 'APTEK_BAD_PAYMENT'; END IF;
  IF p_slot IS NULL OR NOT (coalesce(v_cfg->'slots', '[]'::jsonb) ? p_slot) THEN RAISE EXCEPTION 'APTEK_BAD_SLOT'; END IF;
  IF p_phone IS NULL OR btrim(p_phone) !~ '^\+?[0-9][0-9 ()-]{6,19}$' THEN RAISE EXCEPTION 'APTEK_BAD_PHONE'; END IF;
  IF p_address IS NULL OR jsonb_typeof(p_address) <> 'object' OR char_length(btrim(coalesce(p_address->>'line', ''))) NOT BETWEEN 5 AND 300
     OR pg_column_size(p_address) > 2048 THEN
    RAISE EXCEPTION 'APTEK_BAD_ADDRESS';
  END IF;
  IF p_notes IS NOT NULL AND char_length(p_notes) > 500 THEN RAISE EXCEPTION 'APTEK_BAD_NOTES'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'APTEK_BAD_ITEMS'; END IF;

  -- Lines are locked and priced from the catalogue; client prices are never read.
  CREATE TEMP TABLE IF NOT EXISTS _aptek_lines (product_id uuid PRIMARY KEY, sku text, name text, unit numeric(10,2), qty int) ON COMMIT DROP;
  TRUNCATE _aptek_lines;
  INSERT INTO _aptek_lines (product_id, sku, name, unit, qty)
  SELECT p.id, p.sku, p.name, p.price, i.qty
  FROM (SELECT (e->>'product_id')::uuid AS product_id, sum((e->>'quantity')::int) AS qty
        FROM jsonb_array_elements(p_items) e GROUP BY 1) i
  JOIN public.products p ON p.id = i.product_id AND p.store = 'aptek' AND p.is_active IS TRUE
  WHERE i.qty BETWEEN 1 AND 20;
  GET DIAGNOSTICS v_lines = ROW_COUNT;
  IF v_lines = 0 OR v_lines > 50
     OR v_lines <> (SELECT count(DISTINCT e->>'product_id') FROM jsonb_array_elements(p_items) e) THEN
    RAISE EXCEPTION 'APTEK_BAD_ITEMS';
  END IF;
  PERFORM 1 FROM public.products p JOIN _aptek_lines l ON l.product_id = p.id ORDER BY p.id FOR UPDATE OF p;
  IF EXISTS (SELECT 1 FROM public.products p JOIN _aptek_lines l ON l.product_id = p.id WHERE p.stock IS NOT NULL AND p.stock < l.qty) THEN
    RAISE EXCEPTION 'APTEK_OUT_OF_STOCK';
  END IF;

  SELECT coalesce(sum(unit * qty), 0) INTO v_subtotal FROM _aptek_lines;

  -- Each complete bundle in the cart takes bundle_discount_pct off one unit of each of its items.
  v_pct := least(greatest(coalesce((v_cfg->>'bundle_discount_pct')::numeric, 0), 0), 50);
  FOR v_bundle IN SELECT * FROM jsonb_array_elements(coalesce(v_cfg->'bundles', '[]'::jsonb)) LOOP
    IF jsonb_array_length(coalesce(v_bundle->'skus', '[]'::jsonb)) > 0
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(v_bundle->'skus') s(sku)
                       WHERE NOT EXISTS (SELECT 1 FROM _aptek_lines l WHERE l.sku = s.sku)) THEN
      v_bundle_off := v_bundle_off + round((SELECT sum(l.unit) FROM _aptek_lines l
        WHERE l.sku IN (SELECT jsonb_array_elements_text(v_bundle->'skus'))) * v_pct / 100, 2);
    END IF;
  END LOOP;

  IF v_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM public.coupons WHERE upper(code) = v_code FOR UPDATE;
    IF NOT FOUND OR v_coupon.is_active IS NOT TRUE
       OR NOT (v_coupon.applicable_to && ARRAY['aptek', 'all'])
       OR (v_coupon.starts_at IS NOT NULL AND v_coupon.starts_at > now())
       OR (v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now())
       OR (v_coupon.max_uses IS NOT NULL AND coalesce(v_coupon.used_count, 0) >= v_coupon.max_uses)
       OR (v_coupon.min_order_amount IS NOT NULL AND v_subtotal < v_coupon.min_order_amount) THEN
      RAISE EXCEPTION 'APTEK_BAD_COUPON';
    END IF;
    v_coupon_off := CASE WHEN v_coupon.discount_type = 'percentage'
      THEN round((v_subtotal - v_bundle_off) * least(v_coupon.discount_value, 100) / 100, 2)
      ELSE least(v_coupon.discount_value, v_subtotal - v_bundle_off) END;
  END IF;

  v_ship := CASE WHEN v_subtotal - v_bundle_off - v_coupon_off >= coalesce((v_cfg->>'free_shipping_min')::numeric, 0)
                 THEN 0 ELSE coalesce((v_cfg->>'shipping_fee')::numeric, 0) END;
  v_total := greatest(v_subtotal - v_bundle_off - v_coupon_off, 0) + v_ship;

  INSERT INTO public.orders (user_id, order_number, status, total_amount, shipping_address, notes, store, delivery_slot,
                             payment_method, phone, subtotal, discount_amount, shipping_fee, coupon_code)
  VALUES (v_uid, '', 'pending', v_total, p_address, nullif(btrim(coalesce(p_notes, '')), ''), 'aptek', p_slot,
          p_payment, btrim(p_phone), v_subtotal, v_bundle_off + v_coupon_off, v_ship, v_coupon.code)
  RETURNING * INTO v_order;

  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  SELECT v_order.id, l.product_id, l.name, l.qty, l.unit, l.unit * l.qty FROM _aptek_lines l;

  UPDATE public.products p SET stock = p.stock - l.qty, sales_count = p.sales_count + l.qty
  FROM _aptek_lines l WHERE p.id = l.product_id AND p.stock IS NOT NULL;
  IF v_coupon.id IS NOT NULL THEN
    UPDATE public.coupons SET used_count = coalesce(used_count, 0) + 1 WHERE id = v_coupon.id;
  END IF;
  DELETE FROM public.cart_items c USING _aptek_lines l WHERE c.user_id = v_uid AND c.product_id = l.product_id;

  RETURN jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'subtotal', v_subtotal,
    'discount', v_bundle_off + v_coupon_off, 'shipping', v_ship, 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text) TO authenticated;

-- ── Ownership: same owner as the other guarded objects ──────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgadmin') THEN
    EXECUTE 'ALTER FUNCTION public.get_aptek_config() OWNER TO pgadmin';
    EXECUTE 'ALTER FUNCTION public.place_aptek_order(jsonb, text, text, text, jsonb, text, text) OWNER TO pgadmin';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
