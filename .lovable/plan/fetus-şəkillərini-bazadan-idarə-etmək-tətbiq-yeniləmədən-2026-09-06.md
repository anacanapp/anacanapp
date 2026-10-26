# Fetus şəkillərini bazadan idarə etmək (tətbiq yeniləmədən)

## Problem
Hamiləlik (bump) rejimində 9 aylıq fetus şəkilləri hazırda tətbiqin daxilinə yığılmış SVG fayllardır (`src/assets/fetus/month-1.svg` ... `month-9.svg`). Onları dəyişmək üçün mağazaya yeni versiya göndərmək lazımdır. Admin paneldən dəyişilən və bütün cihazlarda avtomatik yenilənən şəkillər bazadan gəlməlidir.

## Həll

### 1. Yeni cədvəl: `pregnancy_fetus_illustrations`
- `month_number` (1–9, unikal), `image_url`, `is_active`, `title`/`description` + mövcud dil sütunları (`_en`, `_ru`, `_tr`, `_kk`, `_de`, `_ar`, `_ka`, `_uz` — digər məzmun cədvəlləri ilə eyni sxem)
- GRANT + RLS: hamıya (anon + authenticated) oxuma açıq, yazma yalnız admin (`has_role`)
- Mövcud 9 SVG-ni ilkin məlumat kimi storage-a yükləyib cədvələ salmaq (ki, admin heç nə etməsə belə hazırki görünüş qorunsun)

### 2. Frontend: dinamik yükləmə
- `useBabyMonthIllustrations.ts`-ə oxşar yeni hook: `useFetusIllustrationByMonth(month)` — `pregnancy_fetus_illustrations`-dan oxuyur, dil açarı keşə daxildir, 30 dəqiqəlik keş (mövcud nümunə ilə eyni)
- `Dashboard.tsx`-də hamiləlik hero-sunda statik SVG importu yerinə bu hook istifadə olunur
- **Fallback:** bazada şəkil yoxdursa və ya yüklənmə xətası olarsa, köhnə daxili SVG göstərilir — yəni offline/köhnə versiyada da heç nə sınmır

### 3. Admin panel: "Fetus şəkilləri" bölməsi
- Mövcud "Baby ay şəkilləri" (baby_month_illustrations) admin ekranının eyni sxemi ilə: ay seçimi, şəkil yükləmə (storage-a), aktiv/deaktiv, başlıq/təsvir dillərə görə
- Yükləmə mövcud storage bucket (`assets`-də yeni `fetus-illustrations/` qovluğu) vasitəsilə

## Nəticə
Bundan sonra admin paneldən fetus şəklini dəyişdikdə, artıq quraşdırılmış bütün cihazlarda ən gec ~30 dəqiqəyə (və ya tətbiq yenidən açılanda) yeni şəkil görünür — mağaza yeniləməsi lazım deyil.

## Texniki detallar
- Dəyişən fayllar: yeni migration, `src/hooks/useFetusIllustrations.ts` (yeni), `src/components/Dashboard.tsx` (hero görüntü mənbəyi), admin paneldə yeni idarəetmə ekranı + menyu bəndi
- Migration-da GRANT/RLS qaydaları tam əməl olunur
- Keş: React Query `staleTime` 30 dəq (istənilən vaxt azaldıla bilər)
