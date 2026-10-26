# Xarakterli onboarding — 38.0

## Dizayn və axın

İstifadəçinin Open Design layihəsindəki `anacan-onboarding-funnel.html` tətbiqə
uyğunlaşdırılıb. Ritm → `flow`, Tumurcuq → `bump`, Qucaq → `mommy`.
57 real xarakter asset-i şəffaf WebP kimi bundle-a daxildir: **1,155,460 byte**.
Mənbə və nəticə hash-ləri `src/assets/onboarding/manifest.json`-dadır.

İlk qarşılanma → auth/ölkə → mərhələ → ad → mərhələ məlumatları → uyğun suallar,
dəstək/məxfilik/məzmun → native bildiriş seçimi → təsdiqli saxlama → plan xülasəsi
→ imkanlar → endirimli illik/aylıq mağaza paywall-ı → illikdən çıxışda aylıq kofe
təklifi və ya pulsuz davam.
Başlanğıc qarşılanması görüldükdə qeydiyyatdan sonra eyni ekran təkrarlanmır.

- Hamiləlik: LMP və ya USM doğuş tarixi, 1–4 körpə, təcrübə, simptomlar, maraqlar.
- Analıq: hər körpə üçün ayrı ad/cins/doğum, erkən doğuş və həftə/EDD, istəyə bağlı
  doğuş növü, qidalanma/yuxu/maraqlar. Hər körpə ayrıca `user_children` sətridir.
- Tsikl: son period, 10–50 günlük tsikl və 2–10 günlük period, məqsəd/müntəzəmlik/
  simptomlar. Müntəzəm tsikl cavabı ilə zidd “qeyri-müntəzəm” narahatlığı çıxarılır.
- Ümumi quiz cavabları da serverdə saxlanır; atlanan cavablar uydurulmur.
- Partner linking əvvəlki auth yolu ilə qalır; mövcud hesabda yalnız ad çatışmırsa
  tək ad düzəlişi edilir, tarixlər və tamamlanmış onboarding yenidən yazılmır.

9 dil (`az,en,tr,ru,de,ar,ka,kk,uz`) üçün yeni axının bütün mətnləri bundle-dadır.
Module-load zamanı AZ-da donan mətn yoxdur; ərəb dili RTL, tarix və rəqəmlər lokal
formatdadır. UI safe-area/keyboard/scroll və reduced-motion seçimlərini nəzərə alır.
Prototipin demo checkout-u, nümunə rəyləri, saxta statistikası və qurulmamış renewal
xatırlatmaları məhsul iddiası kimi istifadə edilmir.

## Data və bərpa

Yeni data relation/sütun yaradılmır. Mövcud CDC/writer-guarded `profiles`,
`user_children`, `user_preferences` istifadə olunur; Source sxema qəbul zəncirinə
DDL müdaxiləsi yoxdur.

- Draft açarı backend host + user UUID ilə ayrıdır; quota failure gizlədilmir.
- Uşaqlar stabil UUID-lə əvvəl yazılır və response-dan yoxlanır; sonra preferences,
  sonda profilin `life_stage`/`onboarding_answers` completion marker-i yazılır.
- Yarımçıq/naməlum yazı nəticəsi UI-də tamamlanmış sayılmır. Retry mövcud UUID-ləri
  yenidən istifadə edir; child insert xətası səssiz udulmur.
- Profil read-back bütün cavabları yoxlayır. Backend/actor dəyişərsə yazı dayanır.
- `onboarding_answers.journey` serverdə setup completion, ümumi completion,
  təklifin görünməsi və revision saxlayır. Təklif/sonlanma CAS ilə yenilənir.
- Köhnə hesab-sahibi bilinməyən `anacan_pending_funnel='1'` başqa hesaba tətbiq edilmir.

## Ödəniş

Trial təqdimatı çıxarılıb. Yeni alışda Android ödənişli base plan/explicit option
seçir; iOS-da avtomatik trial/uyğunluğu məlum olmayan intro ilə alış açılmır.
Əvvəlki aktiv trial hüquqları qorunur.

Son istifadəçi düzəlişi: illik **$29.99 əvəzinə ilk il $19.99**, sonra **$29.99/il**;
illik plan X ilə bağlananda/mağaza sheet-i ləğv ediləndə mövcud paid aylıq plan
“bir fincan kofe qiymətinə” təqdim olunur. Aylıq seçilibsə təklif təkrarlanmır.
SDK real qiyməti,
valyutanı, periodu və eligibility-ni təsdiqləməlidir. Eksik məhsul/bilinməyən
eligibility/bahalı fallback saxta uğura çevrilmir. Alış sonrası server confirmation
hər iki backend-də tələb olunur; pending əməliyyat yenidən ödənişlə təkrarlanmır.

[App Store / Play / RevenueCat quraşdırması](ONBOARDING_STORE_OFFER.md).
Mağaza məhsulları və qiymətləri istifadəçi tərəfindən konsolda quraşdırılmalıdır.
Azure məhsul map-ı hazırdır: `onboarding-product-map-1790054960066.json`,
Functions **`anacan-functions--0000007`**, eyni immutable image, 6 məhsul ID-si;
digər env/route/identity/ingress qorunub.

Ana səhifədə və hər iki Premium səthində “Reklamları dayandırmaq üçün Premium olun”
çağırışı bütün dillərdədir. Aktiv/household Premium üçün app kartı gizlənir.
Azure dayananda Source-first davranışı: [outage müqaviləsi](AZURE_OUTAGE_SOURCE_FIRST.md).

## Yoxlama və təhvil qeydi

- Son tam app suite: **90 fayl / 926 test** PASS; hər iki TS layihəsi PASS.
- Son əlavə yoxlamalar körpə sayının təzə login-də hydrate olunmasını, Google
  single-payment intro dövrünü və Source SDK-da köhnə hesab binding-i ilə alış/
  restore-un rədd edilməsini də əhatə edir.
- Canlı sınaqda tutulan nəticə-ekranı erkən klik problemi düzəldilib: profil refresh-i
  bitənədək CTA busy-dir. Yeni regression + tsikl tutarlılığı daxil focused suite
  **61 test** PASS (35 UI / 17 model-dil / 9 persistence).
- İngiliscə tsikl canlı UI/data/reload qəbulu:
  `communications-live-azure-1790056548838.json`. Onboarding keçib; idle DB cleanup
  bağlantısı kəsilib. Recovery **`communications-live-azure-1790057476932.json`**:
  3 hesab / 100 cədvəl üzrə qalıq **0**, cleanup confirmed. Verifier uzun brauzer
  matrisindən sonra cleanup üçün təzə bağlantı açır.
- Cari native workspace: **`native-20260922t052417-209d75c8`**, **38.0**, Source-first.
  Son mənbələrdən bundle routing platforma başına **17 ssenari / 350 code asset**
  ilə keçib. Əlavə dörd ssenari Azure outage və fresh-install davranışını yoxlayır.
- Tam Azure/Source 9×3 canlı matris runner-i:
  `azure-migration/ops/onboarding-checks-1790057666636.json` — **PASS**.
  Azure `communications-live-azure-1790058761633.json`, Source
  `communications-live-source-1790058770352.json`: hər birində **27/27**, bütün
  cavablar/date/children/language read-back, completion/reload və fixture cleanup.
  Source catalog/accepted/pending zənciri dəyişməyib. Native transport simulyasiyadır,
  data sorğuları isə real backend-ə gedib; mağaza əməliyyatı edilməyib.
- Gateway **v29 / `anacan-gateway--0000027`**, ACR **cb1d**:
  `test-gateway@sha256:d77ca840698faaccd38760ef9dbd4b29713cf91e2959fd378bf8d3057662b0da`.
  Əvvəlki rollback image v28 `sha256:92ae0e4295ba3ee68a75811759d15b9de6b385fa386349213471f36fa65803e6`.
- Deployed bytes/health/gates: `web-artifact-1790064168776.json` — PASS.
  Yayımlanmış v28-dən ayrıca son pregnancy/twins/reload sınağı:
  `communications-live-azure-1790060196307.json` — PASS, 100 cədvəldə fixture qalıq 0.
- Son Source read-only: `source-runtime-live-1790060020879.json` — 259/255,
  writer open/generation 0, eyni accepted/pending, 5 cron, Source admission.
- Son qiymət/kofe/reklamsız dəyişikliyi: **96 focused test** və tam **926 test** keçib.
  `onboarding-checks-1790064127169.json` — PASS: hər native platformada 17 routing
  ssenarisi, Azure-da 3 mərhələ və Azure bloklu real Source-da 3 mərhələ.
  Azure report `communications-live-azure-1790064373846.json`, Source report
  `communications-live-source-1790064416223.json`. App Premium kartı/modalı da
  açılıb-bağlanıb, bütün test hesabları təmizlənib.
- İlkin iOS archive 30 dəqiqəlik limitə çatıb; `native-38-ios-timeout-20260922.json`
  tarixçədir. User qiymət düzəlişində əvvəlki native kompilyasiyalar dayandırılıb,
  yalnız bu izolə workspace-in mənbələri yenilənib; cache/signing saxlanıb. Low-memory
  native build limiti 60 dəqiqədir. Cari paketlər aşağıdakı signed report-larla təsdiqlənir.

Native admission/source writer/delta/store publication ayrı sübutlardır; bu namizəd
avtomatik final cutover və ya store release demək deyil.

## Native paketlər

Run: `native-20260922t052417-209d75c8`, versiya **38.0**. Paketlər Source-first-dir;
orijinal signing materialı və köhnə release artefaktları saxlanılır.

| Paket | Byte | SHA-256 |
| --- | ---: | --- |
| [Android APK](../azure-migration/native-preview/native-20260922t052417-209d75c8/artifacts/anacan-source-first-38.0.apk) | 33,224,501 | `b37e3b3f987db5f778e16603b95e7bfc1e69f7f6e2c112fe90054cb55a7c5f4c` |
| [Android AAB](../azure-migration/native-preview/native-20260922t052417-209d75c8/artifacts/anacan-source-first-38.0.aab) | 31,950,052 | `0cf968cf269731bff07902a3205466d5ad961dda5f843d52dcfa70c635b23587` |
| [iOS development IPA](../azure-migration/native-preview/native-20260922t052417-209d75c8/artifacts/anacan-source-first-38.0-development.ipa) | 21,319,781 | `2745322aa187634521b8a1761bef9fbf574712fb5c45b998edf9c17bbedaf0e7` |

Android sübutu: `native-android-verification-1790064730740.json` — PASS. Orijinal
AAB signer-i, permission guard, keyboard resize, 16 KB library/ZIP alignment,
350 code asset və **hər iki paketdə 57 xarakter asset-inin hash-i** yoxlanıb.
Fiziki cihaz/store alış qəbulu build yoxlamasından ayrıdır.

iOS archive/export/signature uğurla tamamlanıb. Sübut:
`native-ios-verification-1790065978215.json` — PASS; 350 code asset, 57 xarakter,
app/team/widget kimliyi, development profillər, minimum iOS 16.6 və 2 ümumi
provisioned device təsdiqlənib. Bu IPA App Store upload paketi deyil.

`ios-device-test-1790066027853.json`: compiled capabilities/7 bridge metodu,
AdMob **revision 61 / live / 13 iOS placement**, Source/generation 0 keçib.
Fiziki cihaz mərhələsi **`IOS_TEST_DEVICE_NOT_CONNECTED`** ilə dayanıb; install/launch
edilməyib. Son original-assets/signing recheck də dəyişiklik tapmayıb.

Kod/sübut arxivi: [LATEST.json](../azure-migration/handoffs/LATEST.json), müstəqil
üzv/hash yoxlaması: [VERIFIED.json](../azure-migration/handoffs/VERIFIED.json).
