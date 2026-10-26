# startup.io 1.5.0 / build 6 — store təhvili

Kimlik: **`com.atlasoon.startupio`**, Apple team **`8B6976J8H7`**.
Cari rejim: **Unlimited**, Phaser3.90 izometrik2.5D. AZ/EN, oflayn48bot rəqib.

## Cari imzalı paketlər və archive

| Paket | Fayl |
| --- | --- |
| Google Play signed AAB | `artifacts/store-1.5.0/startup-io-1.5.0-play-store.aab` |
| Android release APK | `artifacts/store-1.5.0/startup-io-1.5.0-android-release.apk` |
| iOS Apple Development IPA | `artifacts/delivery-1.5.0/startup-io-1.5.0-ios-development.ipa` |
| Current iOS archive | `artifacts/store-1.5.0/startup.io.xcarchive` |

SHA-256:

```text
ea13f4bc99d2d431460254d462efc3ee2eba596af0fce785a6bf5e1c8410ad54  startup-io-1.5.0-play-store.aab
0357cd14667fbe632e3ef84766fa9f2b708cdd8576b5c064e9c9ca8e4ae7158a  startup-io-1.5.0-android-release.apk
d7b4c16ca60f4ddcfd0d1a9e4a76c9efb116afebee5981be1318f6af241933da  startup-io-1.5.0-ios-development.ipa
```

iOS archive/developmentprofile/team/signature və36web asset keçib.
Final AppStoredistributionexport `No Accounts` və`No signing certificate` ilə
bloklanıb; istifadəçi **“Finish with signing blocker”** seçib. Əvvəlki1.5.0
AppStoreIPA final safe-area/pause source-u daşımır və cari handoff-a daxil deyil.
Android lint/signature/SDK36/non-debuggable/16KB zip alignment/APK+AAB36asset
keçib; bundled native library yoxdur. Exact receipts:
`ios-store-build.json`, `android-store-build.json` (eyni store qovluğunda).

DevelopmentIPA və debugAPK test paketləridir. GooglePlayupload üçün PlayAAB
istifadə olunur. AppStore üçün operator mövcudXcodeaccount/AppleDistribution
certificate-i bərpa edib **`npm run store:ios -- --export-only`** işlətməlidir.

## Bu versiyadakı dəyişikliklər

-48orijinal uydurma startup və dörd orijinal Venture fond kimliyi.
- Görünən takeover warning, escape/PIVOT və daha balanslı rəqib satınalmaları.
- Daha oxunaqlı nişan/label/ölçü, sakit şəhər palitrası, kompakt mission/rewardHUD.
- Sabit fixed-step touch/PIVOT və preview24/game60FPS limitləri.
- Əvvəlki wallet/kosmetika/actorID/checkpoint/credit-ledger migration qorunur.
- Capacitor8.5.2 və yenilənmiş build dependencies; audit0vulnerability.
- Android fullscreencanvas/cutout-safeCSS; duplicateSystemBarpadding çıxarılıb.
- NativeApppause listener Home transition zamanı gameplay-ni dərhal saxlayır.

## Acceptance və screenshots

[Cari test qəbulu](TESTING.md):66mechanics/30mobilebrowser/3iOSnativePASS, signed
native packages və AndroidnativegameplayPASS. FinaliPhoneinstall/launchlockedpending.
Final native gameplay/capture vəziyyətini
`artifacts/store-1.5.0/store-readiness.json` göstərir.

iOS store ekranları **10/10PASS**: native iPhone17 Pro1206×2622 və
iPadPro13-inch2064×2752, English/home/arena/PIVOT/marketplace/customize.
PNG-lər alpha-sızdır, dimensions/hash/source36asset binding yoxlanıb.
Androidsignedrelease7nativechecks/5screenshotsPASS:API35hostVulkan/guestANGLE,
1080×2400 home/arena/PIVOT/marketplace/customize vəbackgroundpause.

Final handoff generator: **`npm run store:handoff -- --with-signing-blocker`**.
Nəticə: `artifacts/handoff-1.5.0/`, `artifacts/startup-io-1.5.0-handoff.zip`;
manifest vəSHA256SUMS exact delivered bytes-ı yoxlayır. Clean source archive
`.gitignore`-a uyğun hazırlanır, private signing inputs və build cache daxil deyil.
`listing/assets/` App Store1024/Play512 icon vəPlay1024×500 feature graphic saxlayır.
`archive/startup-io-1.5.0-ios.xcarchive.zip` distributionexport üçün currentarchive-dir;
archiveözü installableIPA deyil. DevelopmentIPA ayrıca`packages/`-dədir.

## Public listing və review

- [Məxfilik](https://startup-io-store-info-ltnibovl3a-ew.a.run.app/privacy.html)
- [İstifadə şərtləri](https://startup-io-store-info-ltnibovl3a-ew.a.run.app/terms.html)
- [Dəstək](https://startup-io-store-info-ltnibovl3a-ew.a.run.app/support.html)
- [Public oyun səhifəsi](https://startup-io-store-info-ltnibovl3a-ew.a.run.app/index.html)

YeddiEN/AZ səhifənin HTTP/hash/session-free qəbulu:
`artifacts/store-public-urls.json`. Copy vəreview addımları:
`store/metadata.json`, `store/REVIEW.md`.

Free, reklam/IAP/account/tracking/analytics/real-playerchat yoxdur; image/logo,
sector,progress,wallet/collection cihazda saxlanır. Real şirkət nişanları əvəzinə
original fiction istifadə olunur; registry trademark clearance iddiası yoxdur.

## Qalan operator işi

App Store Connect/Play Console records, supported listing locales, age-rating
questionnaires, upload,submission,review vəpublication account operatorunda qalır.
**Store upload/submission/publication icra edilməyib.** Fiziki gameplay qəbulu
install/launch-dan ayrıca qeyd edilir.
