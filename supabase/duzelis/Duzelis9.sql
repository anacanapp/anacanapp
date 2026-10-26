-- ============================================================
-- Duzelis9 — Spot-check zamanı tapılmış telefon düzəlişləri (webfetch ilə
-- rəsmi saytlar yoxlanıldı). UPDATE istifadə olunur (INSERT yox) ki, bu fayl
-- Duzelis6/7/8.sql-dən ƏVVƏL və ya SONRA işlədilsə də nəticə həmişə düzgün olsun.
--
-- Tapıntılar:
--   ✓ Kanad Hospital (AE)              → telefon TƏSDİQLƏNDİ (dəyişməyib)
--   ✓ University Hospital Sharjah (AE) → telefon TƏSDİQLƏNDİ (dəyişməyib)
--   ✗ Tawam Hospital (AE)              → köhnə nömrə "+971 3 767 7444" rəsmi saytda
--     YOXDUR; hazırkı əlaqə "800 50" (SEHA ümumi pasiyent xətti) — DÜZƏLDİLDİ
--   ✗ Mediclinic City Hospital (AE)    → "+971 4 435 9999" səhv idi, rəsmi sayt
--     "04 4359900" göstərir — DÜZƏLDİLDİ ("+971 4 4359900")
--   ? King Faisal Specialist Hospital (SA) → nömrə rəsmi saytda tapılmadı (səhifə
--     uzun idi, bölmə görünmədi) — EHTİYAT ÜÇÜN NULL edildi (səhv nömrə
--     göstərməkdənsə heç göstərməmək daha təhlükəsizdir)
--   + NCAGIP / Elmi Mərkəz Akuşerlik-Ginekologiya (KZ) → rəsmi saytda RƏSMİ
--     çağrı-mərkəzi nömrəsi tapıldı, əvvəllər NULL idi — ƏLAVƏ EDİLDİ
-- ============================================================

UPDATE public.healthcare_providers SET phone = '800 50' WHERE name_en = 'Tawam Hospital' AND country_code = 'AE';
UPDATE public.healthcare_providers SET phone = '+971 4 4359900' WHERE name_en = 'Mediclinic City Hospital' AND country_code = 'AE';
UPDATE public.healthcare_providers SET phone = NULL WHERE name_en = 'King Faisal Specialist Hospital and Research Centre' AND country_code = 'SA';
UPDATE public.healthcare_providers SET phone = '+7 727 300-45-99' WHERE name_en = 'Scientific Center of Obstetrics, Gynecology and Perinatology' AND country_code = 'KZ';
