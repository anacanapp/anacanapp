# Anacan 43.0 — Lovable/Source buraxılışı

## Backend və iş bazası

2026-09-30 istifadəçi qərarına uyğun olaraq cari worktree-dən hazırlanıb.
Database/Auth **Lovable/Source**-da qalır:
`https://tntbjulojatnrqmylorp.supabase.co`.
Admission **Source / generation0**-dır. Azure population cutover aparılmayıb.

- Development namizədi: `native-20260930t144622-b4a6e3ba`.
- Ayrı production-entitlement Store namizədi: `native-20260930t160219-8686f93e`.
- Bundle: `com.atlasoon.anacan`; Apple team: `8B6976J8H7`.
- Android: versionCode43, versionName43.0, minSdk26, targetSdk36.
- iOS tətbiq/widget:43.0, minimum iOS16.6.
- Source-first, `refresh-before-use-v1`, `source-mirror-v1`; paketdəki WebView
  hostname-i `app.anacan.az` olaraq qalır.

## Hazır təhvil paketləri

Qovluq: `azure-migration/releases/43.0/`.
`manifest.json` və `SHA256SUMS.txt` həmin qovluqdadır.

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `Anacan-43.0-Android.apk` |62911695|`9078f067b8d2cd7afa6fffacf605603803fc47c397e328f879ee1ff7f3c74383`|
| `Anacan-43.0-Google-Play.aab` |61647004|`c74948e58c4502983c4f9bc1ed31727e8a26c7e6cdc5fda75c506f2909c5132c`|
| `Anacan-43.0-iOS-Development.ipa` |50566820|`2f1e55d95f363cd20f130346648bd9ce484ca6ffb7c0c84f04195309bdeeb940`|
| `Anacan-43.0-App-Store.ipa` |59218481|`93d0571b44cdce5287e6a41e2976524eef9a2873cf59cf7c917bdaeaf1c77bbf`|

Development IPA yalnız mövcud development profillərindəki iki qeydiyyatlı cihaz
üçündür. APK/AAB eyni əvvəlki Android release sertifikatı ilə imzalanıb; SHA-1 və
SHA-256 Firebase-də canlı qarşılaşdırılıb. Paketdəki köhnə Google JSON siyahısında
imza görünməsə də, Firebase-in cari siyahısı və yenidən verdiyi konfiqurasiya onu
təsdiqləyir. Həmin run üçün ən son `android-google-signing-*.json` receipt-i
əsas götürülməlidir.

## Store workspace

`azure-migration/native-preview/native-20260930t160219-8686f93e/workspace/ios/App/App.xcodeproj`

Bu layihənin production APS, Apple Sign-In, HealthKit, App Group və widget
konfiqurasiyası yoxlanıb. Archive/IPA qəbulunun ayrıca nəticəsi:
`azure-migration/ops/release43-store-package.json` — **passed:true**,2026-09-30
17:33 UTC. App və widget production distribution imzası, profil/certificate
uyğunluğu, production push, HealthKit, Apple Sign-In, App Group və504 asset hash-i
təsdiqlənib. App Store IPA-da development-device məhdudiyyəti yoxdur; bu fayl
App Store Connect/Transporter-ə göndərilmək üçündür.

İlk unsigned archive-dan export imzalı IPA versə də, capability yoxlaması onun
push/HealthKit/App Group/Apple Sign-In entitlement-lərini itirdiyini aşkar etdi.
Həmin export buraxılış paketi deyil. Düzgün yol: mövcud development profili ilə
capability-ləri daşıyan archive, sonra App Store production profili ilə export.
Build zamanı yalnız izolə namizədin signing nüsxəsi istifadə edilir; son Xcode
layihəsi production entitlement-lərinə qaytarılıb. Yekun paylaşım
`release43-store-package.json` **passed:true** nəticəsinə əsaslanır.

Qəbul edilmiş arxiv: `azure-migration/native-preview/native-20260930t160219-8686f93e/artifacts/AnacanSourceFirst-43.0-AppStore-capabilities.xcarchive`.
Son təhvil receipt-i: `azure-migration/ops/release43-delivery.json`.

## Source-da tamamlanan yeniliklər

Lovable OAuth/MCP ilə reviewed installer-lər hər əvvəlki DDL-dən sonra təzə catalog
ilə hazırlanıb və quraşdırılıb:

- localization21 +299 hash-pinned məzmun hissəsi;
- Admin21 və notification recipient snapshot-ları;
- regional21,48 healthcare qeydi, vaksin/schedule data-sı;
- Community exact-language discovery;
- followup36 məzmunu,1680 ad, badge və vaksin-country override;
- followup37 Premium expiry/refund grant-ları və Blog reference;
- Community reklam moderasiyası və Moderator console;
- xarici worker üçün ayrıca, məhdud Source RPC transportu.

Source indi276 data relation və17 runtime receipt saxlayır. Writer **open /0**,
mövcud **5 cron** və onların hash-i, accepted/pending zənciri qorunub.
Catalog: `37d97c35d9dfad27b139bc1de2892b223d00b1e1079675e3744723d69df00107`.
Əvvəl quraşdırılmış SQL34/35 Customer.io receipt-ləri dəyişdirilməyib.

**29 Edge Function** istifadəçinin təsdiqlədiyi məhdud Lovable-agent tapşırığı ilə
yerləşdirilib. Archive/hash manifesti:
`azure-migration/handoffs/SOURCE_FUNCTIONS43_1790783798795.zip`,
SHA-256 `da4c4a57041b0e2648284566d6a72e3154c3a18d098c875c17ce40c1689d0c17`.
Altı conditional route-un əvvəl mövcud olduğu yoxlanıb. Source funksiyaları yeni
əl ilə environment flag əlavə etmədən moderation-u tətbiq edir. Cron auth artıq
imzası yoxlanmamış JWT payload-ını etibarlı açar kimi qəbul etmir; mövcud cron-ların
dəqiq konfiqurasiya açarları saxlanır.

## Source moderator paneli və avtomatik worker

Eyni tətbiq kodunun Source-backed veb nüsxəsi:

https://anacan-source-release.grayocean-6fd65b89.westeurope.azurecontainerapps.io/moderator

Admin reklam növbəsi eyni hostda `/admin/ad-moderation` yolundadır. Bu statik
frontend Source API-yə birbaşa qoşulur. Image:
`anacanregistry.azurecr.io/source-web@sha256:2575118fc2dbda268263849002a1cd7b568757abffb4830d0c98dfa24610bcad`.

`anacan-source-ad-moderation` hər dəqiqə işləyir. Image:
`anacanregistry.azurecr.io/community-moderation@sha256:1deb9d3832bce843c1b82c2fe4ff28959ab5a1a339d120f2e7cbbf0b6a1d4575`.
Worker yalnız reviewed claim/finish/delivery/heartbeat əməliyyatlarına icazəsi olan
ayrıca token istifadə edir; Source service-role açarı platformadan çıxarılmır.
`source-community-worker-v1` hash:
`99aa066479ccdf05ce91616d8d4ff462f173690502dd0e645cb77e30f5e61972`.
Yeni private control relation CDC/writer guard-a daxil edilib. Source pg_cron-a
yeni iş əlavə olunmayıb. Worker mail göndərməzdən əvvəl panelin Source metadata-sını
yoxlayır; GCP/Firebase/SMTP mövcud Key Vault secret reference-lərindən işləyir.

## Qəbul nəticələri

- **1220 app testi**, TypeScript build yoxlaması keçib.
-90 Source prerequisite SQL testi; yeni məhdud worker daxil17 moderation SQL,
  34 worker və6 edge-auth yoxlaması keçib. OAuth/atomik SQL transportunun16 testi keçib.
- Hər native platformada24 bundled routing/AdMob outage/privacy ssenarisi;
  hər paketdə504 JS/CSS asset və57 onboarding artwork hash-i təsdiqlənib.
- Android imza, zipalign və64-bit ELF kitabxanalarının16KB alignment-i keçib.
- Source-da9 canlı qəbul qrupu: real signup, Premium lease/expiry/foreign-user
  denial, moderator/staff hüquqları, private comment edit/replay, bir dəfə warning
  ACK, scoped/full REST və function blokları, appeal, real scheduled Gemini
  clearance və Source paneli. Fixture hesabları silinib; real push/mail recipient0.
- Android native bundle ilə AZ/EN × Bump/Mommy/Flow onboarding-in6 real Source
  yazma/reload ssenarisi keçib; uşaqlar və cavablar tutuşdurulub.
- iOS native bundle ilə10 canlı communication qrupu keçib: mesaj/reply/reaction,
  realtime, private media/RLS/range, mikrofon→preview→göndəriş→decode,
  şəkil/video və navigation. Fixture3 hesab/5 obyekt təmizlənib.
- Customer.io native production profili **workspace224149/source93570/EU** ilə
  reconcile edilib. Rəsmi iOS SDK identify/track/screen üçün HTTP200 alıb;
  həmin test profili Customer.io-da ayrıca görülüb. Native açar JS asset-lərində
  yoxdur; paketlərdə yalnız Data In SDK-ları mövcuddur.

Əsas sübutlar `azure-migration/ops/` altındadır:
`release43-app-tests.json`, `release43-source-runtime.json`,
`release43-source-acceptance.json`, `release43-lovable-functions.json`,
`communications-live-source-1790785802581.json`,
`communications-live-source-1790788123605.json`,
`customerio-android-package-43.json`, `customerio-ios-package-43.json`,
`customerio-sdk-ingestion.json`, `release43-customerio-destination.json`.

## Xarici asılılıqlar

1. **Source IP qeydiyyat qaydası:** `public.moderator_before_user_created_v1(event
   jsonb)` quraşdırılıb, lakin Lovable Cloud-un hazır authenticated alətləri Auth
   PostgreSQL hook-larını qoşa və binding-i yoxlaya bilmir. PostgREST pre-request
   işləyir; IP mode **off** qalır. Hook üçün Lovable Cloud support/operator addımı,
   sonra observe və owned spoof-header/email/OAuth qəbulundan sonra enforce lazımdır.
2. **RevenueCat project revenue metrics:** `a3647ee8` üçün server açarına v2 metrics
   read icazəsi lazımdır. Hazır cavab `available:false / permission_required`-dır.
   Tətbiqin Source Premium yoxlamaları və v1 billing sync-i işləyir.
3. Fiziki iOS cihaz qoşulmadığına görə native capture/real-device SDK/purchase
   qəbulu cihazda aparılmalıdır. Store upload/submission hələ edilməyib.

Published30, əvvəlki39/40/41 paketləri, native42 workspace-i, Store39 və root
native/signing input-ları saxlanıb.
Hər iki yeni namizədin original-input müqayisəsi `changed:[]` qaytarıb.
