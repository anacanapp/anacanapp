# Xcode ilə mövcud Anacan tətbiqinə 30.0 göndərilməsi

**2026-09-16:** App Store-da 30 public görünür. Bu səhifə həmin source-first
namizədin tarixçəsidir. Son ekranlarla hazırlanan növbəti layihə:
[iOS 31.0 və backend keçidi](IOS_RELEASE_31.md).

Android 30.0 AAB və iki mağazada koordinasiyalı publish: [STORE_SUBMISSION_30.md](STORE_SUBMISSION_30.md).

## Hazır olan layihə

Giriş səhifəsində “A” fallback-i tətbiqin mövcud ana–körpə loqosu ilə əvəz edilib.
Loqo bundle-dən dərhal yüklənir; admin loqo URL-si alınmasa da yerli loqo göstərilir.
Mobil ölçüdə yığılmış tətbiqin login ekranında şəkil uğurla yüklənib və görüntü yoxlanıb.

**Version / Build: 30.0 / 30.0** — həm App, həm widget target-ində.
Xcode-da açılacaq layihə:

```sh
open -a Xcode "/Users/jamilturkan/Desktop/anacannew/azure-migration/native-preview/native-20260913t165359-6aa475be/workspace/ios/App/App.xcodeproj"
```

Bu layihədə yeni web bundle artıq `ios/App/App/public` içinə sync olunub. Layihə
Swift Package Manager istifadə edir; giriş nöqtəsi `App.xcodeproj`-dir.

## Əvvəlki tətbiqdən qorunan ayarlar

| Sahə | Dəyər |
| --- | --- |
| Main Bundle ID | `com.atlasoon.anacan` |
| Widget Bundle ID | `com.atlasoon.anacan.AnacanTimerWidgetExt` |
| Developer Team | `8B6976J8H7` |
| Signing | Automatically manage signing — hər iki target |
| App Group | `group.com.atlasoon.anacan` — main + widget |
| Sign in with Apple | Aktiv |
| HealthKit | Aktiv, mövcud access/recalibration entitlement-ləri |
| Release Push environment | `production` |
| Live Activities / widget | Mövcud Swift kodu və target |
| Background Modes | Remote notifications, audio, fetch |
| Google/Firebase | Mövcud `GoogleService-Info.plist`, URL scheme və plugin-lər |
| RevenueCat | Mövcud SDK konfiqurasiyası/product ID-ləri |
| Native web origin | `app.anacan.az` |

**56 native fayl/resurs müqayisəsi keçib.** Xcode-da sonradan qəbul edilən standart
warning/parallel-build ayarları və eyni team-in project-level inheritance-a keçməsi
yoxlanıb; target strukturu və capability-lər qorunur. Native Swift kodu, app icon, launch screens, privacy
manifest, permission mətnləri, Info.plist, Firebase faylı və entitlement-lər saxlanıb.
SPM paketlərinin real source yolları da eynidir. 329 JS/CSS faylının sync hash-ləri yoxlanıb.

## Xcode addımları

1. Yuxarıdakı **App.xcodeproj** layihəsini açın. SPM paketlərinin yüklənməsi/resolve
   tamamlanana qədər gözləyin.
2. **Xcode → Settings → Accounts**: əvvəlki Anacan tətbiqini idarə edən Apple ID/team
   ilə daxil olun.
3. **TARGETS → App → Signing & Capabilities**:
   - **Automatically manage signing** aktiv;
   - Team ID **8B6976J8H7**;
   - Bundle Identifier **com.atlasoon.anacan**.
4. **AnacanTimerWidgetExtExtension** target-ində də eyni team/automatic signing və
   `com.atlasoon.anacan.AnacanTimerWidgetExt` seçili olmalıdır. Yuxarıdakı ayarlar
   hazırlanmış layihədə artıq qoyulub.
5. **App → General**: Version **30.0**, Build **30.0**. App Store Connect-də bu build
   nömrəsi artıq istifadə olunubsa, hər iki target üçün uyğun daha yüksək build seçin.
6. Xcode yuxarı panelində scheme **App**, destination **Any iOS Device (arm64)** /
   **Any iOS Device** seçin. Archive üçün simulator seçilmir.
7. **Product → Scheme → Edit Scheme → Archive** bölməsində configuration **Release**
   olduğunu yoxlayın, sonra **Product → Archive**.
8. **Window → Organizer → Archives** içində yeni **30.0** arxivini seçin.
   **Validate App**, sonra **Distribute App → App Store Connect → Upload**.
9. Automatic signing və mövcud Anacan team/app seçimi ilə upload-u tamamlayın.

### Bu Mac-dakı signing vəziyyəti

Hazırda yerli keychain-də Apple Development identity-ləri görünür; uyğun yerli
Apple Distribution private key-i görünmür. Xcode Organizer team icazələri daxilində
cloud-managed distribution signing istifadə edə bilər. Yerli distribution certificate
tələb edilərsə, əvvəlki upload üçün istifadə olunan **Apple Distribution `.p12`**-ni
Keychain Access-ə import edin və mövcud App Store profillərini həmin team-dən yeniləyin.
`.p12` və onun şifrəsi çata/kod arxivinə daxil edilmir.

30.0 staging production entitlement-ləri ilə hazırlanıb. 29.0 development IPA-sı
cihaz sınağı üçün idi; bu upload üçün yeni **30.0 layihəsindən Archive** yaradılır.
Bu sessiyada App Store upload/distribution imzalanması icra edilməyib.

## App Store Connect addımları

1. **Apps → mövcud Anacan** qeydini açın. Eyni Bundle ID-li əvvəlki app record-u ilə
   işləmək istifadəçiləri, IAP/subscription məhsullarını və tətbiqin mövcud tarixçəsini qoruyur.
2. Build processing bitdikdən sonra **TestFlight**-da 30.0 görünməlidir. Source
   versiyasından update, giriş, Google/Apple, widget, HealthKit, push və RC restore
   sınağını edin.
3. Mövcud app daxilində iOS versiyası **30.0** yaradın, build-i seçin və tələb olunan
   release notes/review məlumatlarını tamamlayın.
4. Buraxılış seçimində **Manually release this version** seçin və review-a göndərin.

## Source→Azure keçid sırası

Bu build ilkin olaraq **canlı Source backend** ilə işləyir və əvvəlki sessiya
namespace-ni saxlayır. Azure admission veriləndə API istifadəsindən əvvəl target
refresh edir. Store təsdiqindən sonra final source data/session sync və qəbul,
ardınca Azure admission və manual public release edilir.
[Ətraflı final-sync planı](AZURE_FINAL_SYNC_AFTER_APPROVAL.md).

Yoxlamalar: 17 mövcud AuthScreen testi, app TypeScript yoxlaması, yığılmış iOS web
paketində 12 auth/routing sınağı, mobil login logo görüntüsü və store-project/resource
müqayisəsi keçib. Cari status: `azure-migration/ops/ios-store-project-latest.json`.
