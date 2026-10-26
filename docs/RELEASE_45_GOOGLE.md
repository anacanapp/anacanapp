# Anacan 45.0 — Android/iOS build və Xcode təhvili

## Cari vəziyyət

**2026-10-07 iOShotfix:**Store45dashboarddonması pointerdowncapturetoggle/
WKWebViewreparentingkimi təsdiqləndi. İstifadəçi minimal46hotfix-i fizikici-hazda
qəbul edib;Store/devpaketlər hazırdır. [iOS46təhvil](IOS_INPUT_HOTFIX_46.md).
45paketlər saxlanır,46storeupload/nəşri pending-dir.

**2026-10-07 server followup:** existing45Source-first build-in daily push yolu
serverdə düzəlib;normalcronFCMçatdırması və Googlejob/providerqəbulu keçir.
Source/Googledatabase-media yeni`d1c93425…`shadowcheckpoint-ə yenilənib.
[Push və yenilənmə](PUSH_GOOGLE_REFRESH_20261007.md). Delivered45SHA-ları və
finalizednativeworkspaces eynidir;nativepaket yenidən yığılmayıb.

**2026-10-04 followup:** istifadəçi build-ləri göndərdiyini bildirib. Community
server/data düzəlişi və Google runtime müstəqilliyi qəbul edilib;
[dəqiq backend vəziyyəti](GOOGLE_CLOUD_INDEPENDENCE.md). Dörd təhvil paketinin
checksum-u saxlanıb. Aşağıdakı build vaxtı tarixi cari worktree bərabərliyi və ya
final data/admission/DNS handoff-u kimi şərh edilmir.

2026-10-03 istifadəçinin hər iki platformanı yenidən yığmaq və iOS layihəsini
Xcode-da açmaq göstərişi tamamlanıb. Yeni izolə namizəd:
**`native-20261003t163726-4000073c`**.

- APK/AAB, production App Store IPA və development IPA imzalanıb və yoxlanıb.
- Xcode-da bu namizədin `App.xcodeproj` layihəsi açılıb; production entitlement-ləri
  yerindədir. Həmin build əməliyyatı mağazalara upload/submission etməmişdi.
- Build vaxtı `src/` native44 snapshot-ı ilə eyni idi; paketlər45.0 versiyası ilə
  yenidən yığılıb. Media URL/public giriş/statik IP düzəlişləri Google serverindədir.
- Native45 Source-first başlayır. Canonical API `https://api.anacan.az`, WebView
  hostname `app.anacan.az`, `refresh-before-use-v1`, `source-mirror-v1`, ayrı session
  realms və logout/adoption receipt-ləri qorunub. Son database/DNS keçidi app-build
  təsdiqindən sonra koordinasiya edilir.

## Hazır paketlər

Qovluq: **`azure-migration/releases/45.0/`**.

| Fayl | Bayt | SHA-256 |
|---|---:|---|
| `Anacan-45.0-Android.apk` |62968059|`aecf54e6df8ca3607d5cf691238ae0098d6f6187504170257504ce7054457c57`|
| `Anacan-45.0-Google-Play.aab` |61703573|`112cb04ac03c13163253ae91e6eb735e14e9cae43801d22ffb47da56128ccf88`|
| `Anacan-45.0-App-Store.ipa` |59265198|`57066da5ad1f44888a1ec89134da8120d0e1eaad55142e7eaa6c6fe480894664`|
| `Anacan-45.0-iOS-Development.ipa` |50613838|`359a42d088e87495e07950efd48d51c7a6d4efd2d04574778048cbb019a78592`|

`manifest.json` və `SHA256SUMS.txt` həmin qovluqdadır. Manifest SHA-256:
`2b3b5c1c43f1da1ff29fee77ee2d9a3fce3b2ce08e56b37a1df9e5c4634e815f`.
Development IPA mövcud profillərdəki **iki qeydiyyatlı iOS cihazı** üçündür.

## Qəbul

- Hər platformada504 JS/CSS asset və24 bundled routing ssenarisi.
- Android release build, APK/AAB imzaları, APK zipalign və hər paketdə4 ədəd64-bit
  ELF kitabxanasının11 load segment-i üçün16KB alignment keçir.
- Firebase `anacan-mobile` canlı read-only inventarı eyni SHA-1/SHA-256 signer-i,
  mövcud5 certificate-i və Google web audience uyğunluğunu təsdiqləyib.
- iOS app/widget `com.atlasoon.anacan` / `com.atlasoon.anacan.AnacanTimerWidgetExt`,
  Apple team `8B6976J8H7`, `group.com.atlasoon.anacan` qorunub.
- Store IPA: production APS, HealthKit, Apple Sign-In, widget/App Group,
  profile/certificate uyğunluğu və504 asset hash-i keçir. Profil2027-02-14-dəkdir.
- Development IPA: development APS və eyni capability/asset qəbulu keçir;
  profillər2027-08-20-dəkdir.
- Customer.io production workspace224149/source93570/EU native konfiqurasiyası
  yoxlanıb; SDK açarı JS-də yoxdur. Native brand portal auth bundle-ı istisna edilir.
- Native44 paketlərinin bütün dörd SHA-sı və native44/45 qorunan source/signing
  snapshot-ları yenidən yoxlanıb; `changed:[]`.

iOS archive/export hər ikisi exit0 ilə tamamlanıb. İlk paket verifier-i alət
xətası ilə dayanmışdı; **eyni IPA SHA-sı** ilə sonrakı tam imza/capability/asset
yoxlaması keçib və build receipt-i `--complete-build` ilə tamamlanıb. Əvvəlki
nəticə namizədin `build-ios-store-before-verification-*.json` tarixçəsindədir.

## Xcode və qəbul faylları

- Açılmış layihə:
  `azure-migration/native-preview/native-20261003t163726-4000073c/workspace/ios/App/App.xcodeproj`
- Arxiv:
  `azure-migration/native-preview/native-20261003t163726-4000073c/artifacts/Anacan-Google-45.0-AppStore.xcarchive`
- Native run altında `build-android.json`, `build-ios-store.json`, `web-android.json`,
  `web-ios.json` və immutable `acceptance/` metadata nüsxələri saxlanır.
- Cari ops receipt-ləri: `google-cloud-native-delivery.json`,
  `google-cloud-android-package.json`, `google-cloud-store-package.json`,
  `google-cloud-development-package.json`, `google-cloud-xcode-opened.json`.
- Əvvəlki44 ops metadata-sı:
  `azure-migration/ops/google-native-history/native-20261003t123628-a63473e5/`.
  Native44/43/Store43 və onların təhvil paketləri saxlanıb.

### Xcode IDE paket həlli — sonrakı düzəliş

İstifadəçinin “Missing package product” hesabatı ayrıca IDE səviyyəsində yoxlanıb.
23 lokal Swift package manifest/product-i və20 Android project yolu diskdə mövcud
idi. Xcode-un standart `SourcePackages` keşi CLI archive üçün istifadə edilən
`swift-packages` keşindən ayrıdır; eyni adlı Store39 və45 `App` workspace-lərinin
birlikdə açılması da sxem/build seçimində qarışıqlıq yaradırdı.

- Paketlər **Xcode-un standart keşi ilə** yenidən həll edilib; mövcud30 remote
  pin və `Package.resolved` SHA-sı saxlanıb.
- Saxlanılmış köhnə native workspace pəncərəsi bağlanıb, yalnız45 `App` layihəsi
  `App` sxemi / `Any iOS Device (arm64)` seçimi ilə açılıb. Unsaved dəyişiklik və
  aktiv build varsa yeni launcher bağlama əməliyyatını dayandırır.
- Birbaşa **Xcode IDE daxilində Debug/iphoneos build uğurla tamamlanıb**.
  Logun mənbə yolu və compiled `CFBundleVersion=45.0` ayrıca tutuşdurulub;
  build error0, missing package product0.
- Android `releaseRuntimeClasspath` real Gradle yoxlamasında20 lokal layihə və
  transitive dependency-lər həll olunub; unresolved0. Android dependency dəyişikliyi
  lazım olmayıb.
- Təhvil qovluğunda olmayan AAB imzalı orijinaldan eyni SHA ilə yenidən kopyalanıb.
  Dörd əvvəlki signed artifact və package pins dəyişməyib.

Yenilənmiş açma aləti:
`node azure-migration/google-cloud/open-native-xcode.mjs --reload`.
Bu alət əvvəlcə default IDE package resolution-u, sonra yüklənmiş workspace və
sxemi yoxlayır; yalnız Xcode prosesinin işləməsini qəbul sübutu saymır.

Əsas receipt: `azure-migration/ops/google-cloud-native-ide-verification.json`.
Əlavə: `google-cloud-native-ide-ios-resolve.json`,
`google-cloud-native-ide-android-resolve.json`, `google-cloud-xcode-opened.json`.
Bu, IDE/cache düzəlişidir; yeni native versiya və ya mağaza upload-u aparılmayıb.

Google web/API public-dir; sabit giriş **34.49.16.103**, çıxış **35.240.81.111**.
Fiziki cihaz qəbulu və istifadəçinin app-build təsdiqi ayrıca qalır.
[Final database/admission/DNS ardıcıllığı](GOOGLE_CLOUD_AFTER_APPROVAL.md).
