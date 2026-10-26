-- ============================================================
-- OzbekFix2 — menstruation_phase_tips: title_uz/content_uz
-- Problem: UZ istifadəçilər faza məsləhətlərini AZ (köhnə build) və ya
-- RU (körpü) görürdü — uz sütunları ümumiyyətlə yox idi.
-- 1) Sütunlar əlavə olunur (IF NOT EXISTS — təkrar icra təhlükəsizdir)
-- 2) 34 sətir uz məzmunu ilə doldurulur (id-lər Son16 faylı ilə eynidir)
-- FlowDashboard artıq title_uz/content_uz oxuyur (fallback: uz → ru → az).
-- ============================================================

ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS title_uz text;
ALTER TABLE public.menstruation_phase_tips ADD COLUMN IF NOT EXISTS content_uz text;

UPDATE public.menstruation_phase_tips AS t SET
  title_uz = v.title_uz,
  content_uz = v.content_uz
FROM (VALUES
  ('834fd4e8-3dbc-429f-8947-3db24a1be46e'::uuid, 'Maksimal energiya', 'Kuch-g''ayratingiz va o''zingizga ishonchingiz cho''qqida. Murakkab ishlar va muhim uchrashuvlar uchun ideal vaqt.'),
  ('3f34eb4c-27d8-4049-bc4a-8a2df68d2e81', 'Muloqot mahorati', 'Notiqlik qobiliyatingiz yuqori. Taqdimotlar, muzokaralar va murakkab suhbatlar uchun ajoyib imkoniyat.'),
  ('1154102c-a3d0-4026-b540-8a6fb7b272f0', 'Antioksidant mahsulotlar', 'Tuxum hujayralar salomatligi uchun antioksidantlar iste''mol qiling: rezavorlar, ko''katlar va rang-barang sabzavotlar.'),
  ('d2e9d59c-44a5-4404-a19f-ac4856a006b5', 'Libido oshishi', 'Libidoning oshishi — normal holat. Tanangiz signallariga quloq soling va juftingiz bilan ochiq muloqot qiling.'),
  ('fda2ecdf-1ca3-418d-aab9-c4ca370581b2', 'Omega-3 yog'' kislotalari', 'Gormonlar ishlab chiqarilishini losos, yong''oq, chia va zig''ir urug''lari bilan qo''llab-quvvatlang.'),
  ('ffb37116-e486-4f9a-9ddb-340456a05883', 'Kayfiyatni qo''llab-quvvatlash', 'His-tuyg''ularni boshdan kechirish — normal. Bu davrda o''zingizga qattiq bo''lmang va o''zingizga g''amxo''rlik qiling.'),
  ('179abf2c-3369-4e48-99af-eeca41c63966', 'Ko''proq magniy', 'Magniy og''riqli spazmlarni kamaytirishga yordam beradi. Banan, bodom, avokado yeng yoki qo''shimcha qabul qiling.'),
  ('37af0e3a-ca24-4172-b150-2e6f7d0332cc', 'Yangi mashqlarni sinab ko''ring', 'Tanangiz hozir yanada intensiv yuklamalarga tayyor. HIIT, yugurish yoki kuch mashqlarini sinab ko''ring.'),
  ('af156cb3-6771-406d-a5ba-119fa06514b0', 'Protein kuchi', 'Mushaklar rivojini kam yog''li oqsillar bilan qo''llab-quvvatlang: tovuq, baliq, tuxum va dukkaklilar.'),
  ('7d44caa7-a394-483d-ad87-5fefe2486f95', 'Ijtimoiy energiya', 'O''zingizni ancha kirishimli his qilishingiz mumkin. Uchrashuvlar va yangi tanishuvlar uchun ajoyib vaqt.'),
  ('da23fe5a-c574-4029-8ed3-96134a706cd1', 'Yangi mahsulotlar', 'Bu bosqichni yengil, yangi taomlar bilan qo''llab-quvvatlang: salatlar, fermentlangan sabzavotlar va sitrus mevalar.'),
  ('a7ff1aa2-b7c6-4c0d-8891-42e69c021f25', 'Teri parvarishi', 'Estrogen teringizga yog''du bag''ishlaydi! Yangi parvarish vositalari yoki yuz muolajalarini sinab ko''rish uchun yaxshi vaqt.'),
  ('003bed47-bde1-443e-9b45-79e0d60d609f', 'Temirga boy mahsulotlar', 'Charchoq bilan kurashish uchun temirga boy taomlar yeng: ismaloq, yasmiq, qizil go''sht va achchiq shokolad.'),
  ('56dee5f7-7810-4438-aa5a-ab1810e52b6c', 'Suv balansini saqlang', 'Ko''p suyuqlik ichish shishish va spazmlarni kamaytiradi. Kuniga 8–10 stakan suv ichishga harakat qiling.'),
  ('207f37d6-46e3-4b26-ac0f-5414965615d5', 'Yengil harakat', 'Yengil yoga, sayr yoki cho''zish mashqlari spazmlarni yengillashtiradi va kayfiyatni yaxshilaydi.'),
  ('6e4e2308-e3d0-4383-97d6-f6663eba5f4c', 'Suv ichishga e''tibor', 'Suv ichishda davom eting; intensiv mashq qilayotgan bo''lsangiz, elektrolitlar qo''shing.'),
  ('297deed2-d938-48ee-9861-f26d1b25641e', 'Fertillik cho''qqisi', 'Bu — eng unumdor davringiz. Ona bo''lishni istasangiz, eng maqbul vaqt.'),
  ('cd8f542f-367c-4e21-ae33-e868cd3cb175', 'Murakkab uglevodlar', 'Ishtahaning oshishi — normal! Murakkab uglevodlarni tanlang: to''liq donli mahsulotlar, batat va suli.'),
  ('18d97298-bf07-46ec-9bc4-c0b5c73f7f3b', 'PMS haqida xabardorlik', 'Progesteron ko''tariladi — bu kayfiyat o''zgarishlariga sabab bo''lishi mumkin. Buni hisobga oling va o''zingizga ko''proq g''amxo''rlik qiling.'),
  ('39b82687-e047-4cc0-9a2a-0a7c9f5f6db5', 'B6 vitamini', 'PMS uchun B6 vitaminini iste''mol qiling: banan, no''xat, kartoshka va parranda go''shti.'),
  ('6d6694a8-7170-43c0-a593-1b8166f83b35', 'Kundalikning yordami', 'Fikr va his-tuyg''ularni yozish bu nozik davrda hissiyotlaringizni tartibga solishga yordam beradi.'),
  ('905059dd-9edd-41c0-beab-84b185d7a8b0', 'Kofeinni kamaytiring', 'Kofein spazm va bezovtalikni kuchaytirishi mumkin. O''rniga moychechak yoki zanjabil choyi iching.'),
  ('a79419dc-2ba3-4b60-931b-31a3400d5721', 'Dam olish muhim', 'Tanangiz jadal ishlamoqda. Dastlabki kunlarda o''zingizga ko''proq dam bering va organizmga quloq soling.'),
  ('d3ebd14b-d8bd-4ebc-b6bf-b7b9829c360c', 'Issiq kompress', 'Hayz og''riqlarini yengillashtirish uchun qorningizning pastki qismiga isitgich yoki issiq suvli idish qo''ying.'),
  ('99cae289-1465-4a9e-bc82-e0419cab8838', 'Yuqori intensivlik mumkin', 'Tanangiz eng og''ir mashqlarga tayyor. Musobaqalar va shaxsiy rekordlar uchun ideal vaqt.'),
  ('586726b9-960a-4a76-bc3e-67dfcbbe1949', 'Yengil og''riq — normal', 'Ovulyatsiya paytidagi yengil og''riq normaldir. Og''riq kuchli bo''lsa, shifokoringiz bilan maslahatlashing.'),
  ('27ea4cb6-02ed-49b7-a7fa-9e5d6a34dd5f', 'Energiya ko''tarilmoqda', 'Estrogen darajasi ko''tarilmoqda! Yangi loyihalarni boshlash va murakkab ishlarni uddalash uchun ajoyib vaqt.'),
  ('858fc921-c88d-4bc5-9861-126abdc96a57', 'Alkogolni cheklang', 'Alkogol PMS belgilarini kuchaytirishi va uyquni buzishi mumkin. Kamaytirish yoki butunlay voz kechish haqida o''ylab ko''ring.'),
  ('94e682fe-2fc7-438c-adb3-79e9bfd3ba0d', 'O''rtacha mashqlar', 'Energiya pasayganda o''rtacha yuklamalarga o''ting: suzish, velosiped yoki pilates.'),
  ('62415d54-7f54-4f1d-a33f-13bba59fa2f0', 'Tuzni kamaytiring', 'Shishish va suyuqlik tutilishini kamaytirish uchun natriy iste''molini cheklang.'),
  ('b3959838-1f31-4556-b9bb-43c52418ddc0', 'Kalsiy qabuli', 'Tadqiqotlar kalsiy PMS belgilarini kamaytirishini ko''rsatadi. Sut mahsulotlari va bargli ko''katlar iste''mol qiling.'),
  ('c9cec764-068d-4cdf-ab7b-a5ae634021ff', 'Uyqu — ustuvor', 'Sizga ko''proq uyqu kerak bo''lishi mumkin. Tanangizga quloq soling va kechasi 8–9 soat uxlashga harakat qiling.'),
  ('c95f20da-f7b4-4e90-8e29-50fe44e8ddf6', 'Achchiq shokolad', 'Ozgina achchiq shokolad kayfiyatni ko''taradi va magniy beradi. Asosiysi — me''yor!'),
  ('a875dc15-f821-40e3-a1f8-5e489767e136', 'Ijodkorlik cho''qqisi', 'Aqliy faoliyatingiz kuchaygan. Bu vaqtni aqliy hujum, o''rganish va ijodiy ishlar uchun sarflang.')
) AS v(id, title_uz, content_uz)
WHERE t.id = v.id;
