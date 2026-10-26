-- Duzelis57.sql — Preemie Faza B: "Preemie Bələdçisi" aləti + Community qrupu
--
-- 1) tool_configs: yeni "preemie-hub" aləti (komponent: PreemieHubScreen.tsx,
--    ToolsHub.tsx-də 'preemie-hub' case-i ilə qeydiyyatdan keçib).
--    Pulsuz sağlamlıq məzmunudur (danger-signs kimi) — is_premium=false.
--    bump üçün də aktivdir (erkən doğuş riski olan hamilələr NICU-ya hazırlıq
--    üçün oxuya bilər).
--
-- 2) community_groups: "Vaxtından Əvvəl Doğulanlar 💛" dəstək qrupu.
--    is_auto_join=false (auto_join_criteria profiles sahələri ilə işləyir,
--    prematurluq isə user_children.due_date-dədir — istifadəçilər qrupa
--    Community siyahısından öz istəyi ilə qoşulur).
--
-- Hər iki blok idempotentdir — təkrar işlətmək təhlükəsizdir.

-- ─────────────────────────────────────────────────────────────
-- 1) Alət qeydiyyatı
INSERT INTO public.tool_configs (
  tool_id, name, name_az, name_en, name_ru, name_tr, name_kk, name_de, name_ar,
  description, description_az, description_en, description_ru, description_tr,
  description_kk, description_de, description_ar,
  icon, color, bg_color, life_stages, sort_order,
  is_active, bump_active, mommy_active, flow_active,
  is_premium, premium_type, premium_limit
) VALUES (
  'preemie-hub',
  'Preemie Bələdçisi', 'Preemie Bələdçisi', 'Preemie Guide',
  'Недоношенный малыш', 'Prematüre Rehberi', 'Шала туған нәресте',
  'Frühchen-Ratgeber', 'دليل الخدّج',
  'NICU, kenquru qayğısı, qidalanma və korreksiya olunmuş yaş bələdçisi',
  'NICU, kenquru qayğısı, qidalanma və korreksiya olunmuş yaş bələdçisi',
  'NICU, kangaroo care, feeding and corrected age guide',
  'ОРИТН, метод кенгуру, кормление и скорректированный возраст',
  'Yenidoğan yoğun bakım, kanguru bakımı, beslenme ve düzeltilmiş yaş rehberi',
  'Қарқынды терапия, кенгуру әдісі, тамақтандыру және түзетілген жас',
  'NICU, Känguru-Methode, Ernährung und korrigiertes Alter',
  'العناية المركزة، رعاية الكنغر، التغذية والعمر المصحّح',
  'Baby', 'text-rose-600', 'bg-rose-50', '{bump,mommy}', 22,
  true, true, true, false,
  false, 'none', 0
)
ON CONFLICT (tool_id) DO UPDATE SET
  is_active = true,
  bump_active = true,
  mommy_active = true,
  name = EXCLUDED.name,
  name_az = EXCLUDED.name_az,
  name_en = EXCLUDED.name_en,
  name_ru = EXCLUDED.name_ru,
  name_tr = EXCLUDED.name_tr,
  name_kk = EXCLUDED.name_kk,
  name_de = EXCLUDED.name_de,
  name_ar = EXCLUDED.name_ar,
  description = EXCLUDED.description,
  description_az = EXCLUDED.description_az,
  description_en = EXCLUDED.description_en,
  description_ru = EXCLUDED.description_ru,
  description_tr = EXCLUDED.description_tr,
  description_kk = EXCLUDED.description_kk,
  description_de = EXCLUDED.description_de,
  description_ar = EXCLUDED.description_ar,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  bg_color = EXCLUDED.bg_color,
  life_stages = EXCLUDED.life_stages,
  sort_order = EXCLUDED.sort_order;

-- ─────────────────────────────────────────────────────────────
-- 2) Community qrupu (idempotent — ad üzrə mövcudluq yoxlanılır)
INSERT INTO public.community_groups (
  name, name_en, description, description_en,
  group_type, icon_emoji, is_active, is_auto_join
)
SELECT
  'Vaxtından Əvvəl Doğulanlar 💛',
  'Preemie Parents 💛',
  'Vaxtından əvvəl doğulmuş körpələrin valideynləri üçün dəstək qrupu — NICU təcrübələri, kenquru qayğısı, korreksiya olunmuş yaş, qidalanma və böyümə söhbətləri. Bu yolu keçən tək siz deyilsiniz.',
  'Support group for parents of premature babies — NICU experiences, kangaroo care, corrected age, feeding and growth conversations. You are not alone on this journey.',
  'general', '👶', true, false
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_groups
  WHERE name = 'Vaxtından Əvvəl Doğulanlar 💛'
);

-- ─────────────────────────────────────────────────────────────
-- YOXLAMA (SELECT-only):
--   SELECT tool_id, name, life_stages, sort_order, is_active
--   FROM tool_configs WHERE tool_id = 'preemie-hub';
--
--   SELECT id, name, group_type, is_active
--   FROM community_groups WHERE name LIKE 'Vaxtından Əvvəl%';
