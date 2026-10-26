# Anacan 47.0 — Google backend-li iOS və Android Store paketləri

**İmzalı iOS App Store IPA və Android Google Play AAB hazırdır.**
İstifadəçinin2026-10-07 hər iki platforma üçün Store build sorğusu cari application
source-dan izolə `native-20261007t153716-3039ae35` namizədində tamamlanıb.

## Təhvil faylları

Qovluq: **`azure-migration/releases/47.0/`**.

| İstifadə | Fayl | Bayt | SHA-256 |
|---|---|---:|---|
| Google Play | `Anacan-47.0-Google-Play.aab` |62573019|`55a43ee7342cba04094d24dea0b8f961a57b1c2c61e25dad6e82f21a57e3a420`|
| App Store Connect | `Anacan-47.0-App-Store.ipa` |60137458|`49a94d47fd1dd8616fa3b3641a66e7950c3eda19b45b499b58a1b55fadea0999`|
| Android birbaşa quraşdırma | `Anacan-47.0-Android.apk` |63840089|`b1591012dbecd7c5d1825542285ef6248006db497b2b6df8bba7d24b399be4f1`|
| Qeydiyyatlı iOS cihaz sınağı | `Anacan-47.0-iOS-Development.ipa` |51486072|`3b7b5cd0338cbdcbc0af24542e0d3f9af6100dff368116816f481345c26df33f`|

`manifest.json`, `SHA256SUMS.txt` və `STORE_UPLOAD.txt` həmin qovluqdadır.
Version **47.0**; Android versionCode **47**, iOS app/widget build **47.0**.
Store upload/submission/publication istifadəçi tərəfindən edilir; paket təhvili tamamlanıb.

## Store-a göndərmək

- **Google Play Console:** mövcud Anacan tətbiqinin release-inə
  `Anacan-47.0-Google-Play.aab` faylını yükləyin.
- **Apple Transporter:** `Anacan-47.0-App-Store.ipa` faylını əlavə edib **Deliver** edin.
  Processing bitdikdən sonra App Store Connect-də47.0 versiyası üçün47.0 build-i seçin.
- **Xcode Organizer ilə:** hazır arxivi açın → **Distribute App → App Store Connect → Upload**.
  Arxiv:
  `azure-migration/native-preview/native-20261007t153716-3039ae35/artifacts/Anacan-Google-47.0-AppStore.xcarchive`.
- Mənbə layihəsi:
  `azure-migration/native-preview/native-20261007t153716-3039ae35/workspace/ios/App/App.xcodeproj`.

## Build və paket qəbulu

- Cari Google `ninth-park-492111-m4`, canonical **`https://api.anacan.az`**.
  Activecutover`ecdae836-9073-498e-aad0-4f53c34bd716`/managedrealm`azure`generation2
  bundle-də receipt-bound saxlanır; control offline olduqda da initialauthorityGoogle-dir.
- Əvvəlki hesab/refresh namespace, `refresh-before-use-v1`, logout tombstone,
  maintenance və one-wayadoption qalır. Hər platformada **17 bundled routing case** keçir.
- Hər paketdə **508 JS/CSS asset** byte/hash qəbulu.21dil bundle verification keçir.
  Web-only brand portal, website və browser launcher/public-blog prerender native
  paketlərdən çıxarılıb; Customer.io SDK açarı JavaScript-də yoxdur.
- iOS46 input hotfix-i yeni47 source/bundle-dədir; guard və native plugin46baseline
  ilə müqayisə edilib. Dashboard gesture zamanı pointerdown capture toggle yoxdur.
- Android release compile exit0, APK/AAB imza uyğunluğu, APK zipalign və4ELF/
  11loadsegment üçün **16KB** qəbulu keçir. compileSdk/targetSdk36,minSdk26.
  Firebase`anacan-mobile` signer SHA1/SHA256 və mövcud Google OAuth audience-ləri canlı
  read-only inventory ilə təsdiqlənib;5certificate saxlanıb.
- iOS Release/iPhoneOS/arm64 archive **0 xəta /0 xəbərdarlıq**, archive/exportexit0.
  Production App Store IPA main/widget imza/profile/certificate qəbulu keçir:
  **production push, HealthKit, Apple Sign-In və App Group/widget** qorunub.
  Storeprofil2027-02-14-dək, developmentprofil2027-08-20-dəkdir.
- Identity`com.atlasoon.anacan`,team`8B6976J8H7`,widget
  `com.atlasoon.anacan.AnacanTimerWidgetExt`,AppGroup`group.com.atlasoon.anacan`,
  WebViewhostname`app.anacan.az` saxlanır. LiveAdMob vəCustomer.io224149:93570/EU
  productionnativeprofil47-dədir.
- Originalapp/nativeassets/signing recheck `changed:[]`; əvvəlki43/44/45/46
  finalizedartifacts/workspace-lər saxlanıb. Source sealed3/cron0 vəactiveGoogle
  admission/data/runtime bu nativebuild zamanı qorunub.

Əsas receipt-lər:`google-cloud-native-delivery.json`,`google-cloud-native-completion.json`,
`google-cloud-android-package.json`,`google-cloud-store-package.json`,
`google-cloud-development-package.json`,`android-google-signing-1791388571169.json`.
Run daxilində`preparation.json`,`web-android.json`,`web-ios.json`,`build-android.json`,
`build-ios-store.json` və immutable`acceptance/` paketreceipt-ləri var.

## Buraxılış qeydi

**AZ:** Tətbiqin sabitliyi yaxşılaşdırıldı, iOS-da sürüşdürmə və düymə toxunuşları
ilə bağlı problem aradan qaldırıldı. Google backend-ə keçid və hesab məlumatlarının
davamlılığı təkmilləşdirildi.

**EN:** Improved app stability and fixed an iOS issue affecting scrolling and button
taps. Enhanced Google backend connectivity and account-data continuity.

Googledata/authority müqaviləsi:[GOOGLE_POPULATION_CUTOVER_20261007.md](GOOGLE_POPULATION_CUTOVER_20261007.md).
Yeni47signedpaketləri hazırdır; növbəti ümumi nativeversiya **48**-dir.
