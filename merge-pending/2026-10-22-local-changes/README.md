# Ən son mənbəyə köçürülməli lokal dəyişikliklər (2026-10-22)

Bu qovluq (`anacanapp-main`) **20 oktyabrda GitHub-dan endirilmiş zip-dən** açılıb, canlı web build-dən isə
geridədir. Canlı versiya 16.10 tarixli gateway build-dir və mənbəyi bu kompüterdə yoxdur. Buna görə buradan
tam web deploy edilmir. Bu qovluqdakı işi itirməmək üçün bütün dəyişikliklər patch kimi saxlanılıb.

| Fayl | Məzmun |
|---|---|
| `local-changes.patch` | Orijinal `anacanapp-main.zip`-ə nisbətən **189 fayl** (`git` formatı, binary daxil). `.gitignore`-dakı fayllar (`.env.google`) və `.claude/` daxil deyil. |
| `files.txt` | `A` = yeni, `M` = dəyişdirilmiş fayllar. |
| `files-by-group.txt` | Mənbəyə görə: 1) brend reklamları v3 (32), 2) performans və dark-mode sessiyası (128), 3) digər (29). |

**Yoxlanılıb:** patch orijinal zip-in surətinə xətasız tətbiq olunur və bu qovluğu baytbayt bərpa edir
(fərq yalnız CRLF/LF-dədir).

## Artıq canlıda olanlar (təkrar deploy etməyin)
- Brend reklamları v3 SQL: Google bazası, `38-brand-ads-v3.sql`.
- `/brands` portalı: ayrıca bundle, gateway `sha256:e7f844a8…`.

## Ən son mənbə gələndə tətbiq qaydası
1. Ən son tam mənbəni (canlı 47.0 build-in qovluğu, GitHub və ya Lovable) ayrıca qovluğa qoyun.
   Əvvəlcə onun build-ini canlı build ilə modul-modul müqayisə edin, ən son olduğunu bu yolla təsdiqləyin.
2. Həmin qovluqda yeni branch açın, sonra: `git apply --3way --whitespace=nowarn local-changes.patch`
   (`--3way` ziddiyyətləri ayrıca qeyd edir və heç nəyi üstündən yazmır).
3. Ziddiyyətləri qrup-qrup həll edin. Ən riskli yerlər:
   - `scripts/i18n/*.seed.json`: canlıda xeyli böyükdür, yalnız lokal əlavələri köçürün;
   - `src/App.tsx`, `bootstrap-app.tsx`, `main.tsx`: canlıda 10.10-dan sonra dəyişiblər;
   - `src/components/banners/BannerSlot.tsx`, `useBanners.ts`: canlıda `banner-sizes`/`brand-ads` modulları var.
4. Bunlar keçməlidir: `npx tsc -p tsconfig.app.json --noEmit`, `npx vitest run`, `npx vite build --mode google`.
5. Deploy gateway image modeli ilə edilir: Cloud Build, əvvəlki image-in üzərinə overlay, VM-də izolə test
   konteyneri, sonra `deploy-current-web.py`. Ətraflı: `docs/BRAND_PORTAL.md`.
