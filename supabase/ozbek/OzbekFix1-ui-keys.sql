-- ============================================================
-- OzbekFix1 — UZ UI açar düzəlişləri (seed keyfiyyəti)
-- Screenshot auditi (2026-09-05) əsasında:
--   • month_september/october → standart özbək latını: Sentabr / Oktabr
--   • "trimester" → "trimestr" (özbək norması)
--   • Nağıl placeholder adları → özbək adları (Aysel/Murad/Leman → Madina/Jasur/Dilnoza)
-- QEYD: uz.seed.json-da da eyni düzəlişlər edilib (yeni buildlər üçün).
-- Bu fayl KÖHNƏ buildlərin oxuduğu public.translations cədvəlini yeniləyir.
-- ON CONFLICT upsert — təkrar icra təhlükəsizdir.
-- ============================================================

INSERT INTO public.translations (key, lang, value, namespace) VALUES
('month_september', 'uz', 'Sentabr', 'app'),
('month_october', 'uz', 'Oktabr', 'app'),
('ft_child_name_ph', 'uz', 'Masalan: Madina, Jasur...', 'app'),
('ft_child_names_ph', 'uz', 'Masalan: Madina, Jasur, Dilnoza...', 'app'),
('admintrimestertips_trimester_tovsiyeleri_bf9d05', 'uz', 'Trimestr tavsiyalari', 'app'),
('reversetrialfunnel_pregnancy_status', 'uz', '{week}-hafta, {trimester}-trimestr', 'app'),
('revtrial_context_bump', 'uz', '{week}-hafta, {tri}-trimestr', 'app'),
('group_desc_2026_i̇yun_anaları', 'uz', '2025-yil oktabrda tug''ishi kutilayotgan onalar', 'app')
ON CONFLICT (key, lang) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
