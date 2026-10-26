# iOS 31.0 — yeni UI namizədi və backend keçidi

**Cari göndəriş layihəsi 39.0-dır:** [iOS 39.0 Store workspace və Xcode upload](IOS_STORE_39.md).
Aşağıdakı 31.0 qeydləri əvvəlki namizədlərin tarixçəsidir.

**2026-09-21 ayrıca cihaz testi:** real AdMob ID və storage-quota düzəlişi olan
[34.0 development paketi](IOS_ADMOB_TEST_34.md) iPhone-a quraşdırılıb; giriş və banner
istifadəçi tərəfindən təsdiqlənib. Aşağıdakı 31.0 store workspace-i qorunur; yeni
test paketi onun üzərinə yazılmayıb və store upload edilməyib.

## Niyə yayımlanmış 30 köhnə versiyanı göstərir?

2026-09-16 canlı yoxlamasında App Store Azərbaycan storefront-u `30` versiyasını
göstərir; release vaxtı `2026-09-16T10:39:06Z`-dir. İstifadəçi Android 30-un da
production-da yayımlandığını təsdiqləyib.

30.0 üçün verdiyimiz workspace **source-first-v1** idi. Canlı admission hələ:

```json
{"schema":"anacan-backend-admission-v1","generation":0,"phase":"source","minNativeVersion":"28.0","handoffSha256":null}
```

Bu qərar native SDK-nı `https://tntbjulojatnrqmylorp.supabase.co` ünvanına seçir.
App Store publish və database pre-sync ayrıca backend admission qərarı vermir.
Mövcud 30 backend-i Azure admission dərc ediləndən sonra yeni bootstrap ilə seçə bilir.

Ekranlar `app.anacan.az` yerli WebView origin-ində **app bundle-dən** açılır;
`server.url`/uzaq UI loader yoxdur. 30.0-dakı 329 JS/CSS faylının hash-i əvvəlki
13 sentyabr namizədi ilə uyğundur. Son `record_period_days`, `get_community_feed`,
`save_story_editor` RPC-ləri və native Share plugin-i həmin namizəddə yoxdur.
Son web ekranlarının iOS-a çatdırılması yeni native buraxılış tələb edir.

Sübut: `azure-migration/ops/published-native-1789561471114.json`.
Bu, lokal hazırlanmış namizədin və public store metadata-sının auditidir;
App Store-un imzalı binary-si endirilib müqayisə edilməyib.

## Cari AdMob 31.0 namizədi — 2026-09-20

Bu namizəd AdMob v2-yə aiddir. Sonradan əlavə edilmiş
[Rəng çeşidləmə](COLOR_SORT.md) Azure web-də canlıdır; həmin oyunun native UI-si
üçün yeni isolated web build/sync və paket yoxlaması tələb olunur.

```sh
open -a Xcode "/Users/jamilturkan/Desktop/anacannew/azure-migration/native-preview/native-20260919t173724-4142fccb/workspace/ios/App/App.xcodeproj"
```

- Son 13-placement AdMob v2 UI, story native/video, hər 2 oyun fasiləsi,
  rewarded can/gediş bərpası və top/middle/bottom banner idarəetməsi daxildir.
- iOS və Android web sync/routing yoxlamaları keçib. Android Release APK/AAB
  kompilyasiyası, imzalar, 334 embedded asset, AdMob App ID/bridge metodları,
  16 KB uyğunluğu və menstruation-only Health scope yoxlamaları keçib.
- **Cari iOS Release / iPhoneOS arm64 kompilyasiyası keçib: 0 xəta, 0 xəbərdarlıq.**
  App və widget 31.0/31.0, 334 embedded asset, AdMob/Share/HealthCycle class-ları,
  App ID və native story/banner bridge metodları real build məhsulunda yoxlanıb.
- Google test App ID-ləri ilə hazırlanıb. Öz App ID-lərinizlə production üçün
  [AdMob native hazırlıq](ADMOB_CONTROL_CENTER.md#8-native-və-canlı-id-lər) addımları izlənir.
- Swift original 22 pin saxlanır; yalnız GoogleMobileAds 13.6.0 və
  GoogleUserMessagingPlatform 3.1.0 əlavə edilib.
- Kompilyasiya `CODE_SIGNING_ALLOWED=NO` ilə aparılıb. Distribution archive/IPA,
  fiziki cihaz qəbulu və store upload/publication ayrıca tamamlanır.

Bu namizədin metadata-sı `azure-migration/native-preview/native-20260919t173724-4142fccb/`
altındadır. Cari compile sübutu `azure-migration/ops/ios-compiled-app-1789898136971.json`;
`ios-compiled-app-latest.json` də bu namizədə işarə edir. Fiziki cihazda UMP, native
story, revive və banner mövqeləri ayrıca yoxlanmalıdır.

### Android 31.0 test artefaktları

- [Signed AAB](../azure-migration/native-preview/native-20260919t173724-4142fccb/artifacts/anacan-source-first-31.0.aab),
  30,679,681 byte; SHA-256 `f718954fb57d051b0904e5a772e422204caca5583b228ea37bb88ce28bc87e7c`.
- [Signed APK](../azure-migration/native-preview/native-20260919t173724-4142fccb/artifacts/anacan-source-first-31.0.apk),
  31,962,708 byte; SHA-256 `eb6de043cba25bdb433989956a38b60a5c230ef22a95e99631897f9f8243357d`.
- Mövcud upload signer saxlanıb; min SDK 26, target SDK 36, versionCode 31.
- Google test AdMob App ID-si ilədir; fiziki cihaz/Play testing və öz publisher
  konfiqurasiyası ayrıca tamamlanır. Store upload/publication edilməyib.
- Sübut: `azure-migration/ops/native-android-verification-1789885921928.json`.

## Əvvəlki yoxlanmış 31.0 layihəsi — AdMob-dan əvvəl, 2026-09-16

```sh
open -a Xcode "/Users/jamilturkan/Desktop/anacannew/azure-migration/native-preview/native-20260916t122428-4dd0f472/workspace/ios/App/App.xcodeproj"
```

- Version / Build: **31.0 / 31.0**, main və widget target-ində.
- Son günlük flow, cəmiyyət, bildiriş, story və həkim PDF ekranları daxil edilib.
- Native `@capacitor/share@8.0.1` SwiftPM product-u və `SharePlugin` əlavə edilib.
- `com.atlasoon.anacan`, team `8B6976J8H7`, widget/App Group, production push,
  HealthKit, Apple/Google, native origin və auth/session müqavilələri qorunub.
- Operatorun 30 workspace-dəki Xcode project ayarları əsas götürülüb; 56 native
  resurs və reviewed Xcode settings müqayisəsi keçib.
- 333 JS/CSS sync/hash yoxlaması, 11 yeni feature source müqayisəsi, 12 bundled/
  mock-network routing/adoption ssenarisi və TypeScript yoxlaması keçib.
- **Xcode 26.2 / Release / iPhoneOS arm64 kompilyasiyası keçib:** main və widget
  31.0 / 31.0, 0 xəta və 0 xəbərdarlıq. Yaranmış `App.app` daxilində 333 web asset
  hash-i və real binary-də `SharePlugin`/`HealthCyclePlugin` class-ları yoxlanıb.

Bu **Xcode Archive üçün hazırlanmış layihədir**. Distribution archive/IPA,
upload, review və public publish operatorun Xcode/App Store Connect addımlarıdır.
Yerli kompilyasiya `CODE_SIGNING_ALLOWED=NO` ilə aparılıb; real cihaz qəbulu ayrıca
tamamlanır. Sübut: `azure-migration/ops/ios-compiled-app-1789565345749.json`.
Layihə source-first və refresh-before-use-v1 davranışını saxlayır. Yeni UI-nin
istifadə etdiyi Azure RPC-lərinin canlı native çatdırılması backend keçidi ilə
koordinasiya edilməlidir; 31.0-ın public publish-i həmin qəbuldan sonra edilir.

## Canlı Azure backend keçidi

Store tərəfinin yayımlanması məlumdur. Mobil writer admission üçün
[final sync/handoff](AZURE_FINAL_SYNC_AFTER_APPROVAL.md) ardıcıllığı tamamlanmalıdır:

1. Source app/Auth/storage yazıları və job/webhook axınları üçün koordinasiyalı
   freeze/drain pəncərəsi, sonra son delta və session/refresh uyğunluğunun qəbulu.
2. Real native upgrade/expiry/restart, revoked sessiya rəddi və tək provider/job
   writer-i üzrə qəbul sübutları.
3. `prepare-admission.mjs` ilə bu sübutlara bağlı yeni generation/Azure policy-si
   hazırlanıb gateway-də dərc edilir. 30 və 31 növbəti bootstrap-da Azure-a keçir.

07:21 UTC receipt-i `anacan-data-sync-receipt-v1` ilə data sərhədini təsdiqləyir.
Azure admission ayrıca `anacan-cutover-acceptance-v1` final handoff receipt-i və
yuxarıdakı real writer/session/cihaz qəbul sübutları tələb edir.

## 31.0 Xcode / App Store addımları

Son namizədin compile/artifact və real cihaz qəbulu tamamlandıqdan sonra scheme
`App`, destination `Any iOS Device (arm64)`, Archive
configuration `Release` seçilir. `Product → Archive`, sonra Organizer-də
`Validate App → Distribute App → App Store Connect → Upload`. Mövcud Anacan app
record-u/team istifadə edilir; App Store Connect-də 31.0 build seçilir.
`Manually release this version` ilə backend qəbuluna uyğun release pəncərəsi saxlanır.

Mövcud tətbiqi silib quraşdırmaq session/backendlə bağlı həll addımı deyil.
WebView hostname, auth storage açarları, tombstone və adoption receipt-ləri saxlanır.

## Sübutlar

- `azure-migration/native-preview/native-20260919t173724-4142fccb/preparation.json`
- `azure-migration/native-preview/native-20260919t173724-4142fccb/web-ios.json`
- `azure-migration/native-preview/native-20260919t173724-4142fccb/web-android.json`
- `azure-migration/ops/ios-compiled-app-1789898136971.json`
- `azure-migration/native-preview/native-20260919t173724-4142fccb/compile-release-1789897682466.xcresult`
- `azure-migration/ops/native-android-verification-1789885921928.json`
- `azure-migration/ops/admob-web-1789883603854.json` — canlı web v2; native cihaz qəbulu deyil
- Aşağıdakılar **16 sentyabrın əvvəlki namizədinə** aiddir:
  - `azure-migration/native-preview/native-20260916t122428-4dd0f472/web-ios.json`
  - `azure-migration/ops/ios-store-project-1789565130007.json`
  - `azure-migration/ops/native-feature-content-1789561973519.json`
  - `azure-migration/ops/ios-compiled-app-1789565345749.json`
  - `azure-migration/native-preview/native-20260916t122428-4dd0f472/compile-release.xcresult`
  - `azure-migration/ops/PUBLISHED-30-BACKEND-2026-09-16.md`
