# Anacan — 25 dil (Türkmən və Ukrayna)

2026-11-17 genişləndirilməsi [23 dil müqaviləsinə](LOCALIZATION_23.md) iki tətbiq dili əlavə edir:

| Kod | Dil seçimi | Format locale-i | Yazı |
| --- | --- | --- | --- |
| `tk` | Türkmençe | `tk-TM` | Latın (ä, ç, ň, ö, ş, ü, ý, ž) |
| `uk` | Українська | `uk-UA` | Kiril (і, ї, є, ґ) |

## Əhatə

- **Tətbiq (consumer/native bundle)**: `APP_LANGUAGES` 25 dildir. `NEW_LANGUAGE_CODES`
  `tk`/`uk`-ni də daxil edir, `LANGUAGE_EXPANSION_25 = ['tk','uk']`.
- **Vebsayt** (`anacan.az`) və **brand portal** 21 dildə qalır: `WEBSITE_LANGUAGES` /
  `WebsiteLanguageCode` ky/et/tk/uk-nı çıxarır.
- UI: `scripts/i18n/{tk,uk}.seed.json` (ky ilə eyni açar dəsti).
- Məzmun: `scripts/i18n/content/{tk,uk}.json` ky ilə eyni açar dəsti və `sourceHash`; yeni
  `_tk/_uk` sütunu YOXDUR — server `_lang` olmadıqda paket tərcüməsi istifadə olunur. Hüquqi
  sənədlər v2.0 (Şərtlər, Məxfilik, Tibbi məsuliyyət) da bu paketdədir.
- Bundan əlavə: `src/data/*/{tk,uk}.json`, `scripts/i18n/copy/{tk,uk}.json`, bütün
  `languages`/`values` copy JSON-ları, `src/data/parenting/{tk,uk}/`, `src/data/play-together/{tk,uk}.ts`,
  oyun mətnləri, startup/update copy, mərhələ adları, peyvənd adları, iOS `tk.lproj`/`uk.lproj`,
  server `_shared/languages.ts`/`expanded-copy.ts`, e-poçt təsdiqi, premium push, AI cavab
  direktivləri, flow/vitamin xatırlatmaları.
- `date-fns`: `uk` öz locale-i ilə; `tk` üçün xüsusi locale (Intl `tk-TM` ay/gün adları).
- IP ölkəsi: `TM → tk`, `UA → uk` (`src/lib/geoLanguage.ts`).
- Epoint ödəniş səhifəsi dili: `tk → ru`, `uk → en` (Epoint bu dilləri dəstəkləmir).

## Server

`supabase/migrations/20261117200000_turkmen_ukrainian_languages.sql`: `community_language_valid_v1`,
community/localization/moderator/ad-moderation contract-ları, admin insight filtri,
`search_share_blogs_v1` və `community_post_translations_lang_check` tk/uk qəbul edir. Yeni relation
yoxdur (mövcud funksiyalar yenidən yazılır, CDC-yə təsir etmir). Push şablonları üçün
`title_tk/body_tk/title_uk/body_uk` ayrıca Duzelis faylındadır. Canlı bazaya tətbiq Google
auth tələb edir.

## Tərcümə

Bütün tərcümələr bu sessiyada Claude agentləri tərəfindən birbaşa edilib (Gemini və ya başqa
maşın tərcümə API-si istifadə olunmayıb). 32 622 unikal mətn + hüquqi sənədlər, 64+ hissə;
hər hissə placeholder/HTML/Markdown, sətir sonu, rus hərfləri (uk) və kiril (tk) yoxlamasından
keçib. Türkmən — rəsmi latın əlifbası, `Siz` forması; Ukrayna — müasir orfoqrafiya, kiçik
hərflə `ви`, rusizm/surjik yoxdur.

## Bilinən mənbə problemləri (tk/uk-dan asılı deyil)

- `baby_daily_info` cədvəlində 5 sətrin `info` mənbəyi `[[TRANSLATION FAILED]] …` qalıbdır; bütün
  dillərdə belə görünür. Mənbə mətn yenidən yazılmalıdır.
- Körpə çimdirmə məqaləsində (mənbə) rəqəmlər yerini dəyişib: “3°C … 38 aylıq”; tk/uk tərcüməsi
  düzgün 38°C və 3 ay yazır.
- Bir resept başlığında (`244e5027…`) mənbə AI şərhidir; tk/uk “Golden Matcha Elixir” kimi tərcümə edir.

## Yerli rəy tələb edən sahələr

Türkmən tibbi terminlər (peyvənd adları, SOS kartları) və Ukrayna dilində valideynə müraciətdə
qadın cinsi formaları üçün doğma dil daşıyıcısının baxışı tövsiyə olunur.
