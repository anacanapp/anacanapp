# Anacan 44.0 — Google Cloud üçün hazırlanmış native paketlər

## Cari vəziyyət

İzolə namizəd: **`native-20261003t123628-a63473e5`**.
İstifadəçinin2026-10-03 göstərişinə əsasən build hazırlanıb, son məlumat keçidi
isə app təsdiqindən sonrakı mərhələyə saxlanıb.

- Native44 **Source-first** başlayır; database/Auth hazırda Lovable/Source-dadır.
- Google Cloud `ninth-park-492111-m4` shadow namizədinin data/fayl/Auth qəbul
  receipt-ləri paket metadata-sına bağlanıb.
- Canonical API `https://api.anacan.az`, WebView hostname `app.anacan.az` qalır.
  İstifadəçi build-i təsdiqləyəndən sonra son sinxron və admission koordinasiya
  edilir; DNS-i ən sonda istifadəçi yönləndirir.
- `source-first-v1`, `refresh-before-use-v1`, `source-mirror-v1`, ayrıca backend
  sessiyaları, logout tombstone-ları və one-way adoption receipt-ləri qorunub.

Google web önizləməsində canonical media URL-lərinin hələ köhnə Azure-a getməsi
2026-10-03 tarixində `gcp-preview-public-media-v1` gateway düzəlişi ilə həll edilib.
Preview JSON cavabları public şəkilləri Google hostundan açır; bu native binary
dəyişikliyi deyil və aşağıdakı dörd paket/checksum qüvvədədir. Ətraflı qəbul:
[Google media URL düzəlişi](GOOGLE_CLOUD_MIGRATION.md#önizləmədə-public-media-url-düzəlişi--2026-10-03).

## Təhvil paketləri

Qovluq: **`azure-migration/releases/44.0/`**.
`manifest.json` və `SHA256SUMS.txt` eyni qovluqdadır.

Sonrakı45.0 təhvili ayrıca [Release45](RELEASE_45_GOOGLE.md)-dədir. Cari ops
pointer-ləri45-ə keçdiyindən44-ün qəbul metadata-sının immutable nüsxəsi
`azure-migration/ops/google-native-history/native-20261003t123628-a63473e5/`
altındadır. Aşağıdakı44 paketləri və onların SHA-ları saxlanıb.

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `Anacan-44.0-Android.apk` |62968147|`4ebdf8edee951ac303ea7e5f9a9bbce5f31ebbfcd9b3b4d54a220d6d5d6952e4`|
| `Anacan-44.0-Google-Play.aab` |61703633|`34f2a466fac180161fd3e91791b31f94701c2ab1f360fbe9606a26b252343b67`|
| `Anacan-44.0-App-Store.ipa` |59266038|`be01283ff0d1c08314fddbaea5b9a0ddcc3193812a3ad3791e26935a0043b7b4`|
| `Anacan-44.0-iOS-Development.ipa` |50614658|`ee0b40246ae4f0bc0ec099f1a94f1a3287a360d70af280537a53f12ec7799428`|

APK cihazda sınaq üçündür; AAB Google Play Console-a, production IPA App Store
Connect/Transporter-ə təqdim edilir. Development IPA mövcud profillərdəki **iki
qeydiyyatlı cihaz** üçündür. Mağazalara göndəriş və fiziki cihaz sınağı edilməyib.

## Native qəbulu

- App `com.atlasoon.anacan`; Apple team `8B6976J8H7`.
- Widget `com.atlasoon.anacan.AnacanTimerWidgetExt`; App Group
  `group.com.atlasoon.anacan`; app/widget44.0, Android versionCode44.
- Hər platformada24 bundled routing ssenarisi; hər paketdə504 JS/CSS asset hash-i.
- APK və AAB imzaları eynidir. APK zipalign və hər iki paketdə4 ədəd64-bit ELF
  kitabxanasının11 load segment-i16KB tələbinə uyğundur.
- Firebase `anacan-mobile` canlı inventarında SHA-1/SHA-256 və Google web audience
  uyğunluğu read-only yoxlanıb; mövcud5 certificate qorunub.
- Store IPA: distribution signature/profile uyğunluğu, production APS, HealthKit,
  Apple Sign-In və widget/App Group qəbul edilib. Profil müddəti2027-02-14-dəkdir.
- Development IPA: eyni compiled archive və504 asset; development APS, HealthKit,
  Apple Sign-In və widget/App Group qəbul edilib. Profillər2027-08-20-dəkdir.
- Customer.io EU production workspace224149/source93570 native konfiqurasiyası
  qorunub; native SDK açarı JavaScript asset-lərində yoxdur. Web-only brand portal
  native auth/session bundle-ına daxil deyil.21 dil və real-store müqaviləsi saxlanır.
- Native43/Store43 qorunan source/assets/signing yoxlaması yenidən `changed:[]`
  qaytarıb; əvvəlki release qovluqları saxlanır.

Əsas receipts (`azure-migration/ops/`):
`google-cloud-android-package.json`, `google-cloud-store-package.json`,
`google-cloud-development-package.json`, `google-cloud-native-delivery.json`.
Firebase-in həmin run üçün son `android-google-signing-*.json` receipt-i delivery
manifestində hash ilə göstərilir.

## Xcode və arxiv

- Layihə:
  `azure-migration/native-preview/native-20261003t123628-a63473e5/workspace/ios/App/App.xcodeproj`
- Qəbul edilmiş arxiv:
  `azure-migration/native-preview/native-20261003t123628-a63473e5/artifacts/Anacan-Google-44.0-AppStore.xcarchive`
- Production export: `artifacts/google-app-store-export/App.ipa`.
- Development export: `artifacts/google-development-export/App.ipa`.

Production entitlement-li namizəd saxlanıb. Build capability-bearing development
archive-dan production profile ilə export edilir; yalnız `xcodebuild` exit0 deyil,
paket içindəki entitlements/signature/assets ayrıca yoxlanır. Export destination
`export`-dur; upload edilməyib.

## Build təsdiqindən sonrakı iş

[Keçid təlimatı](GOOGLE_CLOUD_AFTER_APPROVAL.md) dəqiq təsdiq, təzə Source stream,
target CAS/media qəbulu və ayrıca live handoff sərhədini göstərir. Hazır paketlərin
texniki PASS nəticəsi istifadəçinin build təsdiqi sayılmır.

Source Auth-hook binding/IP enforcement, RevenueCat v2 metrics icazəsi, Google/
Apple callback qəbulu və fiziki cihazda real purchase/push sınaqları üzrə vəziyyət
[Google miqrasiyası](GOOGLE_CLOUD_MIGRATION.md) sənədindədir.
