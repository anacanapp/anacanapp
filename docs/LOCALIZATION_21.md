# Anacan — 21 dil müqaviləsi

## Yeddi yeni dil

2026-09-24 genişləndirilməsi əvvəlki [14 dil buraxılışına](LOCALIZATION_14.md)
yeddi dil əlavə edir. Bütün dillər eyni Azure/Source-compatible tətbiq kodundadır.

| Kod | Dil seçimi | Format locale-i |
| --- | --- | --- |
| `vi` | Tiếng Việt | `vi-VN` |
| `hi` | हिन्दी | `hi-IN` |
| `ja` | 日本語 | `ja-JP` |
| `ko` | 한국어 | `ko-KR` |
| `pl` | Polski | `pl-PL` |
| `nl` | Nederlands | `nl-NL` |
| `sv` | Svenska | `sv-SE` |

Hindi Devanagari, Japanese kanji/kana, Korean Hangul yazısından istifadə edir.
Vyetnam/Avropa diakritikləri saxlanır. Dil seçimi hesabın ölkəsini dəyişmir;
əvvəlki `zh-CN`, `pt-PT` və ərəb RTL/Qriqorian davranışı qorunur.

## Yayımlanmış Azure təhvili — 2026-09-24

- SQL27 Azure-da quraşdırılıb: 110 cədvəldə 226 sahə üçün əlavə **1 582 nullable
  sütun**. Əvvəlki SQL26 sütunları, məlumat və operator tərcümələri saxlanır.
- Functions **`anacan-functions--0000010`**, ACR **cb1k** yayımlanıb:
  `sha256:47d14fe38355b598f1d5269d431a55a8837d105db94432b888258d3955021cf3`.
  **23 aktiv route**, mövcud gate-lər, ingress, resurslar və secret references qorunub.
- Gateway **v33 / `anacan-gateway--0000031`**, ACR **cb1m** yayımlanıb:
  `sha256:12f3692af5cdb828dbb63605db028c75b90594a3ea88a802974a608e47f58516`.
  Mövcud domain, admission, environment, identity və scale konfiqurasiyası qorunub.
- On iki expansion dilinin hamısı canlı Azure Auth ilə admin filter, public
  tərcümə və lokallaşdırılmış self-diagnostic inbox yoxlamasından keçib.
  Real push recipient **0**, owned fixture cleanup təsdiqlənib.
- **94 fayl / 1010 app testi**, 32 actual push/admin worker testi, 7 Source
  install/upgrade və 6 birbaşa21 install testi keçib.
- Mətn düzəlişlərindən sonra 84 localization/onboarding testi və 9 translation/
  compile-time i18n testi keçib. Yeddi dildə real PDF renderer/font çıxarışı
  yoxlanıb; Hindi/Japanese/Korean glyph-ləri PDF-ə browser shaping ilə daxil olur.
- Bütün12 expansion UI/content paketi tamamlanıb; yeni7 dil worker-i complete-dir.
  Azure məzmunu **299 idempotent SQL hissəsi / 13 974 uyğun sahə-sətir** ilə
  tamamlanıb. Local və deployed browser-də hərəsində 12 dil üzrə **48 qəbul qrupu**
  keçib; resept filtrləri və typed ingredient fallback-i də daxildir.
- Bütün24 locale chunk-ı hər iki gateway origin-də byte/hash ilə yoxlanıb:
  **48 müqayisə**. Ümumi entry/health/closed-route yoxlamaları da keçib.

## UI, tarixlər və məzmun

`APP_LANGUAGES` 21 dili təqdim edir. `NEW_LANGUAGE_CODES` bütün 12 expansion
dilidir; `LANGUAGE_EXPANSION_21` yalnız bu yeddi dildir. Startup copy, bayraqlar
və lokal ölkə adları backend SDK-sı başlamadan işləyir.

UI corpus-u hər expansion dilində **11 389 açardır**: onboarding, Premium,
chat/qruplar, oyun, accessibility, admin və sabit server mətnləri daxildir.
Yalnız seçilmiş dilin UI/content paketləri yüklənir. Server/localStorage keşi
paketlərin ilkin hazırlanmasını əvəz etmir.

Public məzmun inventarı **110 relation / 226 sahə**, **11 110 unikal mətn** və
**14 290 mənbəyə bağlı sahə variantıdır**. Source hash:
`acb69e8c504923bc3171713ad1a20ad26f2b4141691f565d1ceb987f1f6876df`.
Serverdə `_lang` mövcuddursa üstün qalır; yoxdursa paket tərcüməsi
`id + field + SHA256(base, _az, _en)` ilə dəqiq mənbəyə bağlanır. Redaktə olunmuş
mənbəyə köhnə variant tətbiq edilmir. Array/JSON tipləri və paraqraflar qorunur.

Yeni date-fns/Intl locale-ləri və ordinal formatları əlavə olunub. Sadə
`{count} days/weeks/months/...` label-lərində CLDR count formaları istifadə olunur:
məsələn `1 dzień / 2 dni`, `1 dag / 2 dagen`. Qiymətlər və sərbəst cümlələr bu
unit formatter-dən keçmir. Calendar-only month/weekday istisnaları Intl və
mənbəyə bağlı reviewed overrides ilə hazırlanır.

Reseptin xam `category` identifikatoru filtr və free-tier qruplaşdırması üçün
saxlanır; ayrıca `categoryLabel` lokallaşdırılır. Operatorun kateqoriya adı
resept mətnindən fərqli olsa belə filtr işləyir. Source-schema bundle və server
sütunu yolları ayrıca hook testləri və bütün12 dildə browser ilə yoxlanıb.

Keyfiyyət auditində köhnə EN mənbəsindəki `day → uncle`, `boy → height`,
menstruasiya tarixi və Anacan yazılışı düzəldilib. İlk hamiləlik sualının cavabı
ilk uşaqla qarışmaması üçün açıq şəkildə “first pregnancy” kimi verilir.
Bu mənbə düzəlişləri bütün 12 expansion dilinə source-hash ilə yenilənir.
Son UI source hash:
`5217894a62fa59b1b39bf0cc19e95dcab11d5d1805833e473bc8a77c7d53fad8`.
`verify-localization-copy.mjs` bütün sabit server namespace-lərinin cari seed-lərlə
eyni olduğunu ayrıca yoxlayır; bu UI düzəlişləri yayımlanmış server copy-sini dəyişmir.

`content-overrides.json` yeddi mənbəyə dəqiq bağlı düzəlişi saxlayır: Japanese
gündəlik ifadələr, Korean vahid/Level III yazılışı və Polish say halları. Mənbədə
olmayan gluten-free əlavəsi çıxarılıb. Provider qorunan sayların dəyərini ayrıca
qrammatik ipucu kimi alır, cavabda isə həmin protected token-ləri saxlayır.

## Tərcümə pipeline-ı

`scripts/i18n/expansion-languages.json` dil/locale/üslub siyahısıdır. Public
export anon-read siyasəti ilə reviewed scope-dan hazırlanır; şəxsi profil,
mesaj və sağlamlıq qeydləri provider-ə göndərilmir.

```sh
LOCALIZATION_CONCURRENCY=32 node azure-migration/ops/run-localization21-job.mjs --start
node azure-migration/ops/localization21-stats.mjs
node azure-migration/scripts/localization-expansion.mjs --audit-content vi,hi,ja,ko,pl,nl,sv
```

Vahid **24–32 paralel network request** pool-u, compact wire keys, safe UI text reuse,
cached source hashes və serialize/throttle olunmuş checkpoint-lər istifadə edilir.
Worker heap768 MB-dir. UI prioritetlidir; sonra public content və qalan retry-lər
işlənir. Əsas controller/status `ops/localization21-job.json`, təfərrüatlı progress
`ops/localization21-progress.json`-dadır.

`localization21-ui-delta.mjs --prepare` UI source düzəlişlərini aktiv content
worker-in checkpoint-lərinə toxunmadan hazırlayır. `--apply` yalnız worker
bitdikdən və bütün cari source hash-lər uyğun gəldikdən sonra işləyir.

Worker bitdikdən sonra:

```sh
node azure-migration/scripts/localization-expansion.mjs --publish-ui
node azure-migration/scripts/localization-expansion.mjs --publish-content-overrides
node azure-migration/scripts/localization-expansion.mjs --finalize-bundles
node scripts/i18n/verify-bundles.mjs
```

Prepared UI source düzəlişləri varsa finalization-dan əvvəl
`node azure-migration/ops/localization21-ui-delta.mjs --apply` işlədilir.

Manifest **12 UI + 12 content faylının** byte/hash/key-set qəbulunu saxlayır.
Azure və yeni native build-lər bu qəbul olmadan başlamır. Böyük locale JSON-ları
Vite/Vitest-də `json.stringify:true, namedExports:false` ilə işlənir; ayrı-ayrı
property AST-lərinin lokal build yaddaşını doldurmasının qarşısı alınır.

## Azure sxem və məzmun tətbiqi

```sh
node azure-migration/scripts/prepare-localization21-schema.mjs
node azure-migration/ops/apply-localization-runtime.mjs --schema21
node azure-migration/scripts/prepare-localization21-data.mjs
node azure-migration/ops/apply-localization-runtime.mjs --data21
```

SQL27 hash:
`bf677d04268642147e48d2000056533f07c06fd1f3eee2af9fb912033b32e11f`.
`get_localization_contract_v1()` 21 dil və `source-bound-bundle-v1` qaytarır.
Admin filter və community translation cache constraint-i 21 dili qəbul edir.

`localization21-data/manifest.json` bütün 12 expansion dili üçün hissələri
hash-ləyir. SQL exact-source match + `COALESCE` istifadə edir: source dəyişibsə
yazmır, mövcud operator tərcüməsini əvəz etmir, yarımçıq apply resumable-dır.
Azure apply yalnız explicit Azure host/database-də işləyir və ayrıca
`ops/localization21-data-applied.json` checkpoint-i saxlayır.

## Source operator təhvili

Source localization/admin quraşdırılması **hələ qəbul edilməyib**. Yeni versiyalar:

- **`source-localization-v2`**:
  `azure-migration/source-compat/RUN_SOURCE_LOCALIZATION_21_INSTALL.sql`;
  SQL hash `9da534524bb9dc37d775a244fdd5d5fcfc444138a0e758264b584d13f527e6bb`.
- **`source-admin-console-v3`**:
  `azure-migration/source-compat/RUN_ADMIN_CONSOLE_21_INSTALL.sql`;
  SQL hash `210ad2e24b9491f363085b3836b87ab753369b9fcbb014e30e85ca3d619383d6`.

1. Cari catalog-a bağlanmış localization installer-i hazırlayın:
   `node azure-migration/source-compat/prepare-localization21.mjs`.
   Tam generated SQL faylını Source SQL Editor-da icra edin. Bu versiya həm
   ilkin9-dil sxemindən, həm quraşdırılmış14-dil v1-dən upgrade-i dəstəkləyir.
2. Manifestə uyğun `source-compat/localization21-data/LOCALIZATION_DATA_*.sql`
   fayllarındakı **299 hissəni** tətbiq edin; mövcud tərcümələr saxlanır.
3. `source-compat/localization21-functions/` içindəki 14 single-file function-u
   eyni adlı Source function-lara yerləşdirin. Fayl/hash siyahısı
   `ops/localization21-source-functions.json`-dadır. Mövcud server secret
   references saxlanır; paketə provider key daxil edilmir.
4. Admin console üçün ayrıca `prepare-admin-console21.mjs` işlədin və tam
   `RUN_ADMIN_CONSOLE_21_INSTALL.sql` faylını tətbiq edin. Hər iki installer
   catalog-pinned-dir: birini quraşdırdıqdan sonra **digərini yenidən generate edin**.

Localization yeni data relation/cron yaratmır. Dəyişmiş relation-lar commit-dən
əvvəl CDC/writer guard-a enroll olunur; accepted/pending receipt chain və
open/generation0 qorunur. Admin console-un ayrıca delivery relation-ı var.
Quraşdırılmış AdMob runtime hash-i və calendar scheduler dəyişmir; mövcud daily
notification handler-i `field_${language}` sütunlarını dinamik oxuyur.

Yeni12 `app_languages` sətri legacy siyahıda **inactive** qalır. Köhnə native
klientlər bu paketləri daşımır; yeni bundle registry-si 21 dili ayrıca göstərir,
remote `disabled_tools` məhdudiyyətlərini isə saxlayır.

## Buraxılış yoxlamaları və sərhədlər

- `ops/localization21-vitest.json`: 94 fayl / 1010 passing app test. 8 GB maşında
  full suite `--maxWorkers=1` ilə qəbul edilib; paralel Chrome/full-suite yükündə
  baş vermiş iki 5s timeout sonra həmin testlər də full run-da keçib.
- `ops/localization21-runtime-build-latest.json`: Functions10/cb1k image və source digest.
- `ops/localization-copy-quality.json`: bütün12 dildə valid mətn və cari seed/server uyğunluğu.
- `ops/localization21-pdf.json`: yeddi dildə real PDF/font qəbulu; public synthetic
  fixture-lərdən başqa data istifadə edilmir.
- `ops/localization-api-1790233715273.json`: 12 dil, canlı Auth/filter/translation/inbox,
  zero real push və fixture cleanup.
- `ops/localization-web-1790236409440.json` (local) və
  `ops/localization-web-1790236913419.json` (deployed): actual CSS/bundle ilə ilk
  seçim, lokal ölkə, onboarding, admin filter, public fallback və resept filtri;
  320/390/768/1440px, hər hesabatda48 qəbul qrupu.
- `ops/localization-assets-1790236712469.json`: hər iki origin-də bütün24 locale
  chunk-ının byte/hash uyğunluğu — cəmi48 müqayisə.
- `ops/web-artifact-1790236701726.json`:6entry asset,4health,10closed route.
- `ops/localization-schema21-azure-1790231826740.json`,
  `ops/localization-data21-azure-1790235894765.json`: SQL27 və299 hissənin qəbulu.
- Source installer-ləri 07:30 UTC-də eyni259/255 catalog,5cron və accepted/pending
  ilə yenidən hazırlanıb. Native admission 2026-09-24-də yenidən
  **source / generation0**, minimum28.0, handoff hash null qaytarıb.
- Hər iki finalized39 run-un `--verify-source` nəticəsi `changed:[]`-dır.

Credential-free kod/SQL/function təhvili və bütün arxiv üzvlərinin hash yoxlaması:
`azure-migration/handoffs/LATEST.json` / `VERIFIED.json`.

Əsas ünvan **https://api.anacan.az**-dır. Bu iş yeni native Store publication və
ya population/Auth cutover deyil. Published30/finalized39 workspaceləri qorunur;
yeni native paket ayrıca izolə workspace tələb edir. Source operator qəbulu və
RevenueCat metrics read permission403 ayrıca açıqdır. Qiymət/trial/entitlement
və mövcud push gate-ləri əvvəlki müqavilədə qalır.
