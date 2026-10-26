# iOS 39.0 — Xcode / App Store göndərişi

## Göndəriləcək layihə

Cari kod üçün ayrıca **production-entitlement** workspace yaradılıb:

```sh
open -a Xcode "/Users/jamilturkan/Desktop/anacannew/azure-migration/native-preview/native-20260922t173908-102f5a44/workspace/ios/App/App.xcodeproj"
```

- Version / Build: **39.0 / 39.0**, App və widget target-lərində.
- Bundle ID `com.atlasoon.anacan`; team `8B6976J8H7`; automatic signing.
- Scheme **App**, Archive configuration **Release**, destination **Any iOS Device (arm64)**.
- Push entitlement **production**; Apple Sign-In, Google/Firebase, HealthKit,
  App Group, timer widget/Live Activities və RevenueCat inteqrasiyası qorunub.
- Canlı AdMob App ID, UMP, Source mirror/emergency müqaviləsi və son onboarding,
  chat/qrup/Premium kodu daxildir. [39.0 funksiyalar və sınaq paketləri](ADMOB_CONTINUITY_39.md).
- Source-first / `refresh-before-use-v1` / `source-mirror-v1`. Mövcud Source
  hesabları/sessiyaları saxlanır; app UI-si bundle-dən açılır.

Bu upload workspace-i `native-20260922t173908-102f5a44`-dür. Əvvəl verilmiş
`native-20260922t142744-d625d7ad` **development IPA/APK/AAB** təhvili ayrıca saxlanır.
Distribution archive-i yuxarıdakı production-entitlement layihəsindən yaradın.

## Hazırlıq və yoxlama

- iOS web build/sync bitib: **350 JS/CSS asset**, **24/24 bundled routing** ssenarisi.
  Web kod hash-ləri yoxlanmış 39.0 development paketindəki kodla eynidir.
- 56 native fayl/resurs, target/team, production push və bütün əsas capability-lər
  yoxlanıb: `ios-store-project-1790099008973.json`.
- AdMob live App ID fərqi ayrıca reviewed native input-a uyğun yoxlanır; digər
  Info.plist sahələri və mövcud Xcode-managed setting-lər qorunur.
- Original22 Swift pin, GoogleMobileAds **13.6.0**, UMP **3.1.0** saxlanır.
- **Release / iPhoneOS / arm64 kompilyasiyası keçib: 0 xəta, 0 xəbərdarlıq.**
  350 code asset, 57 onboarding artwork hash-i, real binary-də AdMob/Share/HealthCycle
  və GoogleMobileAds/UMP privacy manifestləri yoxlanıb:
  `azure-migration/ops/ios-compiled-app-1790100845699.json`.
- Xcode-da bu dəqiq layihə açılıb, **App** scheme-i təsdiqlənib və generic iOS
  destination seçimi göndərilib. Xcode scripting API generic destination-un
  əks-oxusunu vermədiyindən toolbar-da **Any iOS Device (arm64)** seçimini yoxlayın.
- Build yoxlaması command-line `CODE_SIGNING_ALLOWED=NO` ilədir; layihənin
  automatic signing ayarı aktivdir. Source original assets/signing recheck
  `changed:[]` qaytarıb.

## Xcode-dan göndərmək

1. Yuxarıdakı layihədə scheme **App** və **Any iOS Device (arm64)** seçin.
2. **Product → Archive**.
3. Organizer-də **39.0** arxivini seçin → **Validate App** → **Distribute App →
   App Store Connect → Upload**. Mövcud Anacan app record-u və eyni team istifadə olunur.
4. App Store Connect-də **39.0** versiyasını açın/yaradın; processing bitəndə **39.0**
   build-i seçin. Reklam/Privacy məlumatlarını aşağıdakı kimi uyğunlaşdırın.
5. Review məlumatları, işlək reviewer hesabı və release notes ilə review-a göndərin.
   Buraxılış vaxtına nəzarət üçün **Manually release this version** seçilə bilər.

Bu Mac-da local **Apple Distribution private key** görünmür; automatic signing
və Organizer distribution mərhələsi mövcud Apple hesabının/team-in səlahiyyətlərindən
istifadə edir. Xcode account girişini və ya distribution signing-i istəsə, həmin
hesabla tamamlayın. Certificate revoke/rotate edilməyib. Compile yoxlaması upload
və Apple server-side validation nəticəsi deyil.

## Reklama görə store-da yenilənəcək sahələr

### Google Play

- **Policy and programs → App content → Ads → Yes (Contains ads)**.
- **App content → Advertising ID → Yes**: 39.0 APK merged manifestində
  `com.google.android.gms.permission.AD_ID` var. Faktiki istifadəyə uyğun olaraq
  Advertising/Marketing, Analytics və fraud-prevention məqsədləri nəzərdən keçirilir.
- **Data safety**: AdMob SDK-nın device/account identifiers, IP-dən təxmini yer,
  app interactions və diagnostics məlumatlarının collection/sharing/purpose
  cavablarını əlavə edin və ya mövcud cavabları yeniləyin.
- Privacy Policy və Content rating/Target audience cavabları aktual funksiyaları
  əks etdirməlidir. Mövcud health/account/media/billing deklarasiyaları da qüvvədədir.

### App Store Connect

- **App Privacy → Edit**: GoogleMobileAds/UMP istifadəsini əlavə edin. Hazırkı
  GoogleMobileAds13.6 privacy manifestində aşağıdakı kateqoriyalar var:

| App Privacy kateqoriyası | SDK manifestində linked | SDK manifestində tracking |
| --- | --- | --- |
| Identifiers → Device ID | Yes | Yes |
| Location → Coarse Location | Yes | No |
| Usage Data → Advertising Data | Yes | No |
| Usage Data → Product Interaction | Yes | No |
| Diagnostics → Performance Data | No | No |
| Diagnostics → Other Diagnostic Data | No | No |
| Diagnostics → Crash Data | No | No |

  GoogleMobileAds manifesti əsasən **Third-Party Advertising**, **Analytics** və
  **Developer's Advertising or Marketing** məqsədlərini, Crash Data üçün Analytics-i
  bildirir. UMP coarse location/performance/interaction məlumatlarını **App Functionality**
  məqsədi ilə bildirir. Bu cədvəl iki SDK-nın faktiki manifestindən götürülüb;
  bütün tətbiqin cavabları app/Firebase/Meta/RevenueCat/backend istifadəsi ilə birlikdə
  yekunlaşdırılmalıdır. Xcode Organizer-də **Generate Privacy Report** kömək edir.
- Cari app və SDK manifestlərində tracking var və **ATT axını daxil edilib**.
  NPA seçilməsi "heç bir məlumat toplanmır" və ya avtomatik "Tracking = No" demək deyil.
- **App Information → Age Ratings → Edit**: reklam, user-generated content və
  messaging/chat imkanlarına uyğun cavabları yeniləyin; reytinq cavablardan hesablanır.
- **Privacy Policy URL**-də AdMob/Google, toplanan reklam məlumatları, məqsədlər və
  istifadəçinin razılıq/məxfilik seçimləri izah olunmalıdır.

Store formaları və Privacy Policy məzmunu operator tərəfindən ayrıca saxlanır;
native sync bu console cavablarını dəyişmir. `https://anacan.az/app-ads.txt`
developer-website domenində qalmalıdır. Əvvəlki UMP mesajı Published vəziyyətindədir.

## Buraxılış qeydi üçün mətn

> Yeni üçmərhələli onboarding, daha rahat mesajlaşma və qruplar, yenilənmiş Premium
> təcrübəsi və tətbiqin sabitliyini artıran düzəlişlər. Reklamlar üçün razılıq və
> məxfilik seçimləri dəstəklənir; Premium istifadəçiləri reklamsız davam edir.

Bu Source-first yeniləmənin upload/review/publish-i final Source→Azure
population/data admission-dan ayrıdır. [Final backend keçidi](AZURE_FINAL_SYNC_AFTER_APPROVAL.md)
üçün writer/refresh/receipt gate-ləri saxlanır. İllik ilk-il offer-in console setup-u
[ONBOARDING_STORE_OFFER.md](ONBOARDING_STORE_OFFER.md)-dədir; UI yalnız real store
məhsulu/qiymətini təqdim edir.

## Rəsmi mənbələr

- [Google — iOS App Store data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure)
- [Google — Android Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Play — Ads və app content deklarasiyası](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)
- [Apple — Age Ratings](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/)
