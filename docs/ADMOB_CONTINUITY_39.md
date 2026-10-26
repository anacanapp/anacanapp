# Azure kəsiləndə reklamlar — Source davamlılığı / 39.0

## Cari vəziyyət — 2026-09-22

Source reklam runtime-ı canlıda quraşdırılıb və **revision 61 / live / 13 placement**
üzrə Azure ilə eyni konfiqurasiyanı qaytarır. Source **259 cədvəl / 255 guarded
relation**, writer **open / generation 0**, accepted/pending zənciri və **5 cron**
qorunub. Frontend və admin dəyişiklikləri üçün **91 fayl / 959 test**, hər iki
TypeScript layihəsi keçib. Azure web yenilənib; native 39.0 veb bundle-ləri və
platforma başına 24 routing ssenarisi keçib. **Android APK/AAB və iOS development
IPA imzalanıb, bütün paket/məzmun yoxlamalarından keçib.**

- Gateway **`anacan-gateway--0000028`**, `v30-admob-continuity-20260922`, ACR **cb1e**.
- Image: `anacanregistry.azurecr.io/test-gateway@sha256:a9ed9fbac799324a705b9ad0f3d7f9a84742adda861ecf2c93522da85ced8467`.
- Rollback image: `anacanregistry.azurecr.io/test-gateway@sha256:d77ca840698faaccd38760ef9dbd4b29713cf91e2959fd378bf8d3057662b0da`.
- Functions `--0000007`, Storage `--0000008`, Source/generation0 admission qorunur.

Bu yeni client müqaviləsidir. Tamamlanmış 38.0 paketləri əvvəlki Azure public
konfiqurasiya yolunu istifadə edir; Source SQL-in tək quraşdırılması köhnə paketin
transport yolunu dəyişmir. 38.0 workspace/artifact-ləri qorunur.

**App Store-a göndərmək üçün** ayrıca production-entitlement 39.0 layihəsi:
[IOS_STORE_39.md](IOS_STORE_39.md). Aşağıdakı development IPA cihaz sınağı üçündür.

## İş prinsipi

- Əsas reklam redaktəsi Azure-da `https://api.anacan.az/admin/ads` ünvanındadır.
- `source-mirror-v1` client Source seçiləndə yalnız həmin SDK ilə
  `get_source_admob_configuration_v1(p_expected_revision)` çağırır.
- Snapshot mövcud CDC/writer-guarded `public.app_settings` cədvəlində
  `admob_source_control_v1` açarı ilə saxlanır. Yeni data relation/cron yoxdur.
- Source public RPC dərhal validated last-good nüsxəni qaytarır; open fazada
  `pg_net` vasitəsilə sabit anonim Azure URL-dən asinxron yenilənmə istəyir.
  URL/headers caller tərəfindən dəyişdirilə bilməz; JWT, user/profile/health datası
  yuxarı xidmətə göndərilmir. Normal interval ən azı 30s, adminin yeni revision
  gözləntisi olduqda ən azı 2s; bir anda bir pending request.
- Upstream network/403/503/malformed cavab əvvəlki ayarları, o cümlədən əvvəlki
  disabled state-ni əvəz etmir. Revision geriləməsi və eyni revision-da fərqli
  sənəd rədd olunur. İşlənən yalnız bu mirror-un öz request/response ID-sidir.
- Config reader hər 30s yenilənir və 75s freshness/error guard-ı qüvvədədir.
  Source-un uğurlu cavabı fresh read-dir; Azure ilə son sync tarixinin köhnəlməsi
  Source-dakı təsdiqlənmiş nüsxəni etibarsız etmir. Source özü əlçatmazdırsa yeni
  reklam fail-closed dayanır. Bu, limitsiz lokal config cache deyil.
- Azure-a artıq qəbul edilmiş cihaz öz Azure authority/pin və konfiqurasiya yolunu
  saxlayır. Reklam davamlılığı account/data authority-ni dəyişdirmir.

## İdarəetmə və dayandırma

Azure save/restore/disable əvvəlcə primary-də commit olur, sonra Source nüsxəsinin
həmin revision-a çatması yoxlanır. Panel **təsdiqlənib / yenilənir / təsdiq gözlənilir**
və son sync vaxtını göstərir. Source təsdiqlənməzsə Azure save təkrarlanmır və bütün
cihazlara çatdığı iddia edilmir. **Source sinxronunu yoxla** yalnız nüsxəni yenidən
yoxlayır, primary revision-u artırmır.

Source admin bölməsində ayrıca **Source reklamlarını dayandır** açarı var.
`admin_set_source_admob_emergency_v1(boolean)` Source administratorunu serverdə
yoxlayır. Override sticky-dir: Azure yenilənməsi onu ləğv edə bilməz. Override-un
ləğvi yalnız Source-da saxlanmış ayarları yenidən tətbiq edir; primary disabled-dirsə
reklamı açmır. Azure sessiyası Source admin əməliyyatına daşınmır.

Azure web-də mirror yoxlaması yalnız Source public anon key ilə edilir. Mövcud
Azure Auth URL/namespace qorunur; public key explicit `build-azure-web.mjs` ilə
build prosesinə daxil edilir, `.env` faylları dəyişdirilmir.

## Source SQL təhvili və `__ADMOB_SEED__` xətası

İcra üçün **`azure-migration/source-compat/RUN_SOURCE_ADMOB_INSTALL.sql`** nəzərdə
tutulub. `admob-continuity.sql` renderer şablonudur və birbaşa icra olunarsa DDL-dən
əvvəl düzgün faylın adını göstərən xəta verir. `source-admob-continuity-v1.sql`
eyni tam hazırlanmış installer-in uyğunluq adıdır.

- Runtime SQL hash:
  `e88057f8438f6488aed8fd5637d18b74f046904719488e05f1e48ffdc497c6e1`.
- Yoxlanmış revision61 installer SHA-256:
  `25c58dc76f05420dcb6f4d54ef304a9669d9f77931de49009aaf53e3407b29bf`.
- Renderer hər placeholder-in əvəz olunduğunu, seed JSON-u və diskə yazılmış
  faylın hash-ni yoxlayır; atomik rename istifadə olunur.
- **11 SQL testi**: faktiki operator faylının runtime/seed-i disposable PostgreSQL-də
  işlədilir; yalnız live bridge/catalog binding-ləri fixture mühitinə uyğunlaşdırılır.
  Yanlış şablon, install/replay, CDC/lineage, anonim fixed request, outage/stale,
  sticky emergency, frozen read və icazə sərhədləri yoxlanır.
- Canlı sübut: `azure-migration/ops/admob-continuity-live-1790086561748.json`.
  Source `syncedAt: 2026-09-22T14:16:01.406561+00:00`, `no-store`, primary ilə eyni
  snapshot və dəyişməyən catalog/accepted/pending/writer/cron təsdiqlənib.
- `source-admob-continuity-prepared.json` artıq `installed:true` göstərir.
  Tətbiq edilmiş runtime SQL hash-i dəyişdirib eyni versiya ilə replay etmə.

## Freeze, cutover və xidmət sərhədləri

Writer fazası open deyilsə public reader yalnız saxlanan snapshot-u qaytarır:
mirror/app_settings/CDC və network queue yazısı etmir. Source emergency də mövcud
writer guard tərəfindən bloklanır. Final freeze-dən əvvəl nəzərdə tutulan reklam
və emergency vəziyyəti qurulmalı, native admission ilə koordinasiya edilməlidir.
Bu səbəblə freeze guard-ı yumşaltmaq və ya altıncı cron əlavə etmək olmaz.

`verify-admob-continuity.mjs` user datası/reklam/global ayar yazmır, amma public
Source accessor mirror-u/pg_net növbəsini yeniləyə bildiyindən **read-only deyil**.
`verify-runtime.mjs` isə yalnız stable contract/status çağırışları ilə read-only qalır.

UMP, Premium/household, naməlum entitlement, placement/schedule/caps, qorunan
ekranlar və SDK uyğunluğu qüvvədədir. İnternet, Source və Google AdMob/UMP ayrıca
işlək olmalıdır; fill və gəlir zəmanəti verilmir. Azure-a göndərilən coarse tətbiq
telemetriyası outage zamanı itə bilər; Google AdMob gəlir hesabatı ayrıca xidmətdir.

`https://anacan.az/app-ads.txt` publisher sətrini direct HTTP 200 ilə, Azure-a
redirect etmədən təqdim edir. Store developer website domenini və bu faylı qoruyun.
`api.anacan.az/app-ads.txt` həmin sətrin Azure-dakı əlavə nüsxəsidir.

## Qəbul və təhvil

- API testləri: Source-only config, public-key sərhədi, 8s timeout, pending/retry,
  primary commit-in təkrarlanmaması və Source admin/freeze davranışı.
- Provider sınaqları: bütün Azure fetch-ləri bloklu ikən official test ID-lərlə
  banner/interstitial/story/rewarded request/show; 403/503 iOS/Android bannerləri,
  privacy withdrawal, Premium, unknown entitlement, yeni kill/emergency və Source
  özü dayandıqda fail-closed.
- Admin UI: Source emergency, frozen nəticə, Azure stop-un pending statusu və
  yalnız mirror retry. Bütün bunlar synthetic adapters/fixtures ilədir.
- Yeni native pipeline `admobControlProtocol:'source-mirror-v1'` metadata-sını,
  real bundled SDK routing-i, Source snapshot və official test AdMob transport
  çağırışlarını yoxlayır. Physical hardware və real Google fill qəbulu deyil.
- Yayımlanmış store versiyası hələ 30-dur; 39.0 source-first test namizədidir.

### Native 39.0 paketləri

Run: `native-20260922t142744-d625d7ad`.

| Paket | Fayl | SHA-256 |
| --- | --- | --- |
| Android APK | [anacan-source-first-39.0.apk](../azure-migration/native-preview/native-20260922t142744-d625d7ad/artifacts/anacan-source-first-39.0.apk) | `33a3e08888cf4618b5f08818c40888a1f1b7b14855d1b7e262c4516dbea83d41` |
| Android AAB | [anacan-source-first-39.0.aab](../azure-migration/native-preview/native-20260922t142744-d625d7ad/artifacts/anacan-source-first-39.0.aab) | `00ed13dea796ad47def92e0e034f7abfaf3e1d248e9d9d1dfe237f307a0ad454` |
| iOS development IPA | [anacan-source-first-39.0-development.ipa](../azure-migration/native-preview/native-20260922t142744-d625d7ad/artifacts/anacan-source-first-39.0-development.ipa) | `1c846b3d9a25ad856a1453b045ebc75dd02b8290197e236eaef02420f2d6e7f1` |

APK **33,227,561 byte**, AAB **31,953,137 byte**. Android API26–36, əvvəlki AAB ilə
eyni signer, ZIP/ELF 16KB alignment, AdMob bridge, təhlükəsiz media-permission bridge,
350 code asset və hər paketdə 57 xarakter asset hash-i yoxlanıb:
`native-android-verification-1790096880202.json`.

iOS Xcode workspace:
`azure-migration/native-preview/native-20260922t142744-d625d7ad/workspace/ios/App/App.xcodeproj`.
IPA **21,322,284 byte**, arm64 / iOS16.6+, mövcud 2 qeydiyyatlı development cihazı
üçündür. App/widget imzası, 350 code asset və 57 xarakter hash-i keçib:
`native-ios-verification-1790097964884.json`.

`ios-device-test-1790097966682.json` compiled capabilities/7 native bridge, real
Source snapshot V61, App ID-lər və Source/generation0 admission-u təsdiqləyir.
Sonra **`IOS_TEST_DEVICE_NOT_CONNECTED`**: install/launch edilməyib, app container
oxunmayıb. Fiziki iOS/Android reklam/alış və store publication qəbulu ayrıca qalır.

39.0 bu workspace-in **yekun təhvilidir**; növbəti dəyişikliklər yeni izolə workspace-də
edilməlidir. 31.0 store və 38.0 tamamlanmış workspace-lər qorunur. Build-dən sonra
`--verify-source` yenidən `originalAssetsAndSigningPreserved:true`, `changed:[]` qaytarıb.

### Kod arxivi

Credential-free kod/sənəd/evidence arxivinin dəqiq yolu, fayl sayı və SHA-256-sı
`azure-migration/handoffs/LATEST.json`-dadır. `VERIFIED.json` eyni arxivin bütün
üzvlərini ayrıca yoxlayır. Native binary, signing materialı, provider inputs və
private session/data snapshot-ları həmin kod arxivinə daxil edilmir.

### Veb və native bundle qəbul sübutları

- Workspace: `azure-migration/native-preview/native-20260922t142744-d625d7ad/`.
  `web-android.json` / `web-ios.json`: hərəsində **350 JS/CSS asset**, **24/24**
  bundled ssenari. Üç Azure kəsilmə növündə test banneri göstərilib və Source
  emergency update-dən sonra dayandırılıb. Premium/UMP/Source-error/global-disable
  ssenarilərində yeni ad request olmayıb. Bütün backend/provider trafikləri fixture-dir.
- `source-runtime-live-1790087263516.json`: core, communications, groups və yeni
  advertising contract read-only qəbulundan keçib; Source/generation0 və zəncir qorunur.
- `admob-continuity-live-1790097398789.json`: 17:16 UTC yekun Source recheck-də də
  V61 / live / 13 placement, Source generation1, emergency false və eyni zəncir keçib.
- `web-artifact-1790088452346.json`: 6 yayımlanmış HTML/entry müqayisəsi, 4 health,
  10 route/gate yoxlaması keçib.
- `public-admob-1790088450761.json`: JSON/no-store/CORS/credential stripping,
  exact routes, stale telemetry rejection və Source admission qorunması keçib.
- `admob-continuity-web-1790088455888.json`: **yayımlanmış JS**, synthetic Azure admin
  sessiyası və **3 real Source public read** ilə mirror status/retry/mobile layout
  keçib. Azure fixture token-i serverə göndərilməyib, cross-backend credential
  sorğusu 0, real user/global config/ad request yazısı yoxdur. Source accessor
  öz mirror metadata/növbəsini yeniləyə bilər.

Əvvəlki funksiyalar/qiymətlər: [38.0 onboarding](ONBOARDING_38.md),
[Store təklifləri](ONBOARDING_STORE_OFFER.md). Source-first authority sərhədləri:
[Azure outage](AZURE_OUTAGE_SOURCE_FIRST.md).
