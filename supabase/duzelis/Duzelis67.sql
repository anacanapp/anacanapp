-- Duzelis67.sql — Reseptlər: "Körpə" kateqoriyası
--
-- Körpə reseptləri (category 'baby_food' və 'Əlavə qida', təxminən 74 resept) heç bir
-- recipe_categories sətrinə uyğun gəlmirdi, ona görə yalnız "Hamısı" altında görünürdü.
-- 1) recipe_categories-ə 'baby_food' / "Körpə" kateqoriyası 21 dildə əlavə olunur.
-- 2) 'Əlavə qida' kateqoriyalı reseptlər 'baby_food'-a köçürülür (bu dəyər heç bir
--    kateqoriya ilə uyğun gəlmirdi). Başqa reseptlərə, lokallaşdırılmış category_* mətnlərinə,
--    RLS-ə və writer guard/CDC trigerlərinə toxunulmur. Əlavə Qida Bələdçisi bu kateqoriyanı oxuyur.
--
-- İCRA (Google): VM-də anacan-postgres konteynerində bir transaksiyada.

BEGIN;

INSERT INTO public.recipe_categories (category_id, name, name_az, emoji, life_stage, sort_order, is_active,
  name_en, name_ru, name_tr, name_kk, name_de, name_ar, name_uz, name_ka, name_zh, name_id, name_fr, name_es, name_pt,
  name_vi, name_hi, name_ja, name_ko, name_pl, name_nl, name_sv)
SELECT 'baby_food', 'Körpə', 'Körpə', '👶', NULL, 7, true,
  'Baby', 'Для малыша', 'Bebek', 'Нәрестеге', 'Baby', 'للطفل', 'Chaqaloq uchun', 'ბავშვისთვის', '宝宝辅食', 'Bayi', 'Bébé', 'Bebé', 'Bebê',
  'Cho bé', 'शिशु', '赤ちゃん', '아기', 'Dla dziecka', 'Baby', 'Bebis'
WHERE NOT EXISTS (SELECT 1 FROM public.recipe_categories WHERE category_id = 'baby_food');

UPDATE public.admin_recipes SET category = 'baby_food' WHERE category = 'Əlavə qida';

NOTIFY pgrst, 'reload schema';
COMMIT;
