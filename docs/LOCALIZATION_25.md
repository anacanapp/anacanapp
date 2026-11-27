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
`title_tk/body_tk/title_uk/body_uk` Duzelis87-dədir. **2026-11-17 canlı Google bazasına tətbiq
olunub** (supabase_admin, bir tranzaksiya): `community_language_valid_v1('tk'/'uk') = true`; push
şablonları 294 + 4370 + 20 sətir. Notification-job image-ləri (flow, vitamin, daily slots/halfhour) eyni gün yenidən
build olunub (bax `scripts/notification-jobs/README.md`). Functions image `8233e6b62bf1…` (tk/uk server copy +
partner-conversion) və gateway `6fcfab9698dd…` (plan `tkuk-web-plan.json`, rollback `rollback-tkuk-web-plan.json`) canlıdır.

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

## Canlı məzmun yenilənməsi (2026-11-17)

- 2026-11-03 ixracından sonra dəyişən 538 canlı sətir (meyvə adları, gündəlik məlumat, ana/körpə
  mesajları, reseptlər, vitaminlər, analıq qaydaları, məxfilik siyasəti v1, 2 blog yazısı) ky/et/tk/uk
  paketlərinə canlı sətrin açarı ilə əlavə edildi (birbaşa tərcümə).
- Tətbiq blog yazılarını projection vasitəsilə oxuyur (HTML `blog-native-content` ilə sarılır), ona görə
  açar xam mənbədən fərqlənir. 91 yazının projection açarı bütün 16 paket dilində xam açarın mövcud
  tərcüməsinə bağlandı. Projection çıxışı dəyişərsə bu alias-lar yenilənməlidir.
- Yoxlama: anon REST ilə 12 440 canlı sətir oxunur, `contentTranslationKey` hesablanır; uk paketində
  çatışmayan açar 0.
- `useBabyDailyInfoByDay` artıq `mapRowTranslation` istifadə edir (əvvəl paket dillərində Azərbaycanca
  göstərirdi).

## Məzmun paketləri (content packs, növbəti native build)

16 paket dilinin (`NEW_LANGUAGE_CODES`) məzmun tərcümələri (`scripts/i18n/content/<lang>.json`, ~108 MB)
artıq tətbiq bundle-ına daxil edilmir. az/en/ru/tr/kk/uz/de/ar/ka DB sütunlarından gəlir, dəyişməyib.

- **Build**: `scripts/i18n/content-packs.mjs` (Vite plugin `contentPacksPlugin`) veb build-də
  `dist/content-packs/<lang>/manifest.json` və `dist/content-packs/<lang>/<shard>.<sha256[0:16]>.json`
  yaradır. Shard açarın sahəsinə (`<id>:<field>:<hash>` → `field`) görədir; böyük sahələr açar hash-inə
  görə 2–32 hissəyə bölünür, kiçik sahələr `_misc.N`-də birləşir (~256 KB). Hash kanonik JSON-un
  (açarlar sıralı) sha256-sıdır. `VITE_NATIVE_BUILD=true` olduqda heç nə yaradılmır; `verify:bundle`
  native build-də `content-packs/` və ya məzmun lüğəti tapsa xəta verir (codemagic əlavə olaraq
  `dist/content-packs`-ı silir). Ayrıca: `node scripts/i18n/content-packs.mjs <outDir>`.
- **Runtime** (`src/lib/content-packs.ts`, `content-i18n.ts`): native `https://app.anacan.az/content-packs/`
  ünvanından `CapacitorHttp` ilə (Android WebView host-u da `app.anacan.az` olduğu üçün `fetch` yerli
  faylı oxuyardı), veb eyni origin-dən `fetch` ilə yükləyir. Əvvəlcə manifest, sonra yalnız ekranın
  soruşduğu shard-lar; hamısı IndexedDB-də (`anacan-content-packs`) saxlanılır, oflayn yenidən istifadə
  olunur, hash/sxem yoxlanılır, köhnə shard-lar silinir. İlk render gözləmir: shard hazır olana qədər
  ky/tk → ru, digərləri → en göstərilir; shard gələndə `App.tsx` dil açarlı sorğuları yeniləyir və
  yenidən render edir. Son istifadə olunan shard-lar növbəti açılışda keşdən əvvəlcədən yüklənir.
- **Deploy (gateway)**: gateway image-i `dist/content-packs/` qovluğunu da kopyalamalıdır (indi yalnız
  `index.html`, `assets/`, `app-entry-*`). `manifest.json` üçün `Cache-Control: no-cache`, shard-lar
  üçün `public, max-age=31536000, immutable`; `application/json` gzip/brotli ilə. Köhnə native
  build-lər manifest-i hər açılışda yoxlayır; shard tapılmasa (404) manifest yenilənir. Məzmun açarları
  mənbə mətnə bağlı olduğundan yeni paket köhnə build üçün də düzgündür.
