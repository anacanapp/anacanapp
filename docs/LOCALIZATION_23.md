# Anacan — 23 dil (Qırğız və Eston)

2026-11-03 genişləndirilməsi [21 dil müqaviləsinə](LOCALIZATION_21.md) iki tətbiq dili əlavə edir:

| Kod | Dil seçimi | Format locale-i | Yazı |
| --- | --- | --- | --- |
| `ky` | Кыргызча | `ky-KG` | Kiril |
| `et` | Eesti | `et-EE` | Latın (õ, ä, ö, ü, š, ž) |

## Əhatə

- **Tətbiq (consumer/native bundle)**: `APP_LANGUAGES` 23 dildir. `NEW_LANGUAGE_CODES`
  `ky`/`et`-i də daxil edir, `LANGUAGE_EXPANSION_23 = ['ky','et']`.
- **Vebsayt** (`anacan.az`) dərc olunmuş 21 locale URL müqaviləsini saxlayır:
  `WEBSITE_LANGUAGES` / `WebsiteLanguageCode` ky/et-i çıxarır. Brand portal da 21 dildə qalır.
- UI: `scripts/i18n/{ky,et}.seed.json` (11 470 açar: köhnə 11 389 + cari inline/tr açarları).
- Məzmun: `scripts/i18n/content/{ky,et}.json` cari Google bazasının bütün `_sv`-li
  relation/sahələrinə (111 cədvəl, 234 sahə) `contentTranslationKey` ilə bağlıdır.
  Yeni `_ky/_et` sütunu YOXDUR — server `_lang` olmadıqda paket tərcüməsi istifadə olunur.
  Mənbə dəyişəndə həmin sətir mənbə dilinə qayıdır (köhnə tərcümə tətbiq edilmir).
- Bundan əlavə: `src/data/*/{ky,et}.json` (15 bölmə), `scripts/i18n/copy/{ky,et}.json`,
  bütün `languages`/`values` copy JSON-ları, oyun mətnləri, startup copy, mərhələ adları,
  iOS `ky.lproj`/`et.lproj` (InfoPlist), server `EXPANDED_LANGUAGE_NAMES`/`EXPANDED_SERVER_COPY`,
  AI cavab direktivləri, flow/vitamin xatırlatmaları.
- `date-fns` qırğız locale-i yoxdur: `ky` üçün rus format qaydaları + Intl `ky-KG` ay/gün adları.

## Server (Duzelis85)

`supabase/migrations/20261103180000_kyrgyz_estonian_languages.sql` canlı Google bazasında
tətbiq olunub: `community_language_valid_v1`, community/localization/moderator/ad-moderation
contract-ları, admin insight filtri, `search_share_blogs_v1` (ky → rus başlıq fallback-i) və
`community_post_translations_lang_check` ky/et qəbul edir. Yeni relation yoxdur.

## Tərcümə pipeline-ı

Vertex Gemini (`gemini-3-flash-preview`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`
rotasiyası, `GOOGLE_CREDENTIALS_B64` service account). Placeholder-lər (`{x}`, `%s`, URL, HTML)
yoxlanılır; uyğunsuzluqda yenidən cəhd edilir. Manifestdə ky/et faylları öz `keysHash`
(və content üçün `sourceHash`) dəyərini saxlayır; `verify-bundles.mjs` bunu qəbul edir.
