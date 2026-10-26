# Android 30.0 submission və iOS-la koordinasiyalı publish

**2026-09-16:** istifadəçi hər iki platformada 30-un yayımlandığını təsdiqləyib;
App Store AZ lookup-u 30-u public göstərir. Canlı admission hələ Source-dur.
[Yayımlanmış 30-un backend/UI izahı və iOS 31](IOS_RELEASE_31.md).

## Hansı faylı göndərmək lazımdır?

Google Play üçün hazır, imzalı **release AAB**:

[anacan-source-first-30.0.aab](../azure-migration/native-preview/native-20260913t165359-6aa475be/artifacts/anacan-source-first-30.0.aab)

- App/package ID: `com.atlasoon.anacan`
- versionName: **30.0**, versionCode: **30**
- Ölçü: **28,049,319 bytes**
- SHA-256: `e10fb417c7c7aa0334432dd2b452cde0c547a4049bb02d7ade628955a45d6d06`
- Əvvəlki AAB ilə eyni upload/release signer; targetSdk 36 / minSdk 26.
- Yeni loqo, source-first və refresh-before-use kodu iOS 30.0 ilə uyğun gəlir.

[APK](../azure-migration/native-preview/native-20260913t165359-6aa475be/artifacts/anacan-source-first-30.0.apk)
birbaşa cihaz sınağı üçündür; Play Console submission üçün yuxarıdakı **AAB** istifadə olunur.
Faylı açıb dəyişmək və ya yenidən imzalamaq lazım deyil.

## Google Play — review-a göndərmək

1. [Play Console](https://play.google.com/console/) → **mövcud Anacan** tətbiqini açın.
2. **Publishing overview → Managed publishing → Turn on managed publishing → Save**.
   Yaşıl **Managed publishing is turned on** statusunu yoxlayın. Bu, təsdiqlənən
   production dəyişikliyini siz publish edənədək saxlayır.
3. **Test and release → Production → Create new release**.
4. **App bundles → Upload** ilə `anacan-source-first-30.0.aab` faylını seçin.
   Əgər eyni 30 build-ini əvvəl internal testing-ə yükləmisinizsə, **Add from library**
   ilə həmin bundle-ı seçin və ya release-i production-a promote edin.
5. Release name və release notes yazın. Console-un göstərdiyi bloklayan səhvləri/
   çatışmayan review sahələrini tamamlayın. VersionCode 30 başqa məzmunla artıq istifadə
   olunubsa, onun üzərinə yazmaq olmur; yeni versionCode ilə build lazımdır.
6. **Save / Next** ilə release hazırlığını tamamlayın. **Publishing overview →
   Send changes for review / Send for review** ilə review-a göndərin.
7. Google təsdiqindən sonra **Changes ready to publish** bölməsində gözlədin.
   Koordinasiyalı buraxılış vaxtınadək **Publish changes** seçilmir.

İlkin cihaz/Google login/RevenueCat yoxlaması üçün internal track istifadə edilə bilər.
Internal testing production review-u əvəz etmir və **Managed publishing internal
track-i saxlamır** — tester-lərə versiya daha tez çata bilər.

Managed publishing artıq Google Play-də available olan tətbiqlərin yeniləmələri
üçündür. Bu app-ın ilk public buraxılışıdırsa, həmin seçim əlçatan olmaya bilər.

## iOS — təsdiqdən sonra gözlətmək

[Xcode 30.0 upload təlimatı](XCODE_UPLOAD_30.md) ilə build-i mövcud Anacan record-una
göndərin. App Store Connect-də iOS 30.0 səhifəsində:

1. **App Store Version Release → Manually release this version → Save**.
2. Review-a göndərin.
3. Təsdiqdən sonra status **Pending Developer Release** olmalıdır.

Bu status review-un keçdiyini, public release qərarının sizdə qaldığını göstərir.

## İkisini necə eyni vaxtda çıxarmaq olar?

1. Hər iki platformanın review-u bitsin:
   - iOS: **Pending Developer Release**;
   - Android: **Changes ready to publish**, Managed publishing aktiv.
2. Razılaşdırılmış final Source→Azure data/session sync və buraxılış qəbulu
   tamamlanmış olsun. [Final sync ardıcıllığı](AZURE_FINAL_SYNC_AFTER_APPROVAL.md).
3. Eyni buraxılış pəncərəsində:
   - App Store Connect → **Release This Version → Confirm**;
   - Play Console → **Publishing overview → Publish changes → Confirm**.
4. Hər iki mağazada versiyanın region/cihaz üzrə həqiqətən göründüyünü yoxlayın;
   istifadəçi elanını bundan sonra edin.

**Dəqiq eyni saniyədə görünmə təmin edilmir.** Google təsdiqdən sonrakı manual publish
üçün bir neçə dəqiqə, Apple isə manual release-dən sonra App Store-da görünmənin
**24 saata qədər** çəkə biləcəyini bildirir. Eyni anda düymələri basmaq sorğuları
koordinasiya edir; mağazaların yayılmasını və istifadəçilərin auto-update vaxtını yox.

Hamı üçün eyni buraxılış pəncərəsi istəyirsinizsə, iOS phased release və Play staged
rollout faizinin bu niyyətlə uyğun olduğunu yoxlayın; mərhələli rollout daha az
istifadəçiyə yayılmaq deməkdir.

## Yoxlama nəticəsi

Android release build, APK/AAB signatures, 16 KB ZIP/ELF alignment, 329 code-asset
hash-i və 12 bundled SDK/routing sınağı keçib. Source original assets/signing check
`changed:[]` qaytarıb. iOS Xcode-da normal recommended-setting/format dəyişiklikləri
göründü; effective team, target IDs, capability-lər, SPM mənbələri və native resurslar
yenidən yoxlanıb. Onlar agent tərəfindən geri çevrilməyib.

Android sübutu: `azure-migration/ops/native-android-verification-1789321864416.json`.
iOS cari layihə sübutu: `azure-migration/ops/ios-store-project-latest.json`.
Bu işdə agent Play Console/App Store Connect-ə upload, submit və ya publish etməyib.

## Rəsmi mənbələr

- [Google — Managed publishing və review/publish idarəsi](https://support.google.com/googleplay/android-developer/answer/9859654?hl=en)
- [Google — Release hazırlamaq və rollout etmək](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en)
- [Apple — Manual release seçimi və Pending Developer Release](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option)
