# Azure native test build 27.0 — Google hotfix / RevenueCat aktiv

**Yeni source-first namizəd:** [29.0 paketləri və no-logout hazırlığı](AZURE_RELEASE_CANDIDATE_29.md).
Bu sənəd 27.0 Azure preview artefaktlarının qeydidir.

**Hazırdır:** 2026-09-12. Backend **`https://api.anacan.az`**.
Bu buraxılış ayrıca native preview-dir; production cutover hələ **NO-GO**-dur.

## Artefaktlar

| Platforma | Fayl | Ölçü |
| --- | --- | --- |
| Android, birbaşa quraşdırma | [anacan-azure-27.0.apk](../azure-migration/native-preview/native-20260912t201621-e9264295/artifacts/anacan-azure-27.0.apk) | 29.2 MB |
| Android, internal testing paketi | [anacan-azure-27.0.aab](../azure-migration/native-preview/native-20260912t201621-e9264295/artifacts/anacan-azure-27.0.aab) | 28.0 MB |
| iOS, development imzalı | [anacan-azure-27.0-development.ipa](../azure-migration/native-preview/native-20260912t201621-e9264295/artifacts/anacan-azure-27.0-development.ipa) | 18.6 MB |

Xcode arxivi: `azure-migration/native-preview/native-20260912t201621-e9264295/artifacts/AnacanAzure-27.0.xcarchive`.
27.0 build statusu: `azure-migration/native-preview/native-20260912t201621-e9264295/build-android.json`
və həmin qovluqdakı `build-ios.json`. Latest pointer artıq yeni namizədə yönələ bilər.

### SHA-256

```text
APK  3cf7f296936b683a1c112af8c7427ff3d3e1514c188d0862fdfdf3806a473626
AAB  94c9f4f49820517d0e152c48f5ba23f7aff5f63f9eafa9f7eb5e0f61e9df3875
IPA  ca1566724ab160ee8733754e19b2690b60837bf6b9dc8ca985ec6fd9369af00d
```

## Quraşdırma

- **Android:** Android 8.0/API 26 və daha yeni ayrılmış test cihazında APK-ni açıb
  quraşdırın. AAB birbaşa telefona quraşdırılmır; Play internal testing üçün paketdir.
- **iOS:** iOS 16.6+; mövcud development profillərində olan **2 qeydiyyatlı cihaz**
  üçün imzalanıb. Cihazı Mac-a qoşub Xcode → Window → Devices and Simulators və ya
  Apple Configurator vasitəsilə development IPA/App-ı quraşdırın. Developer Mode
  və cihazın Mac-a Trust təsdiqi tələb oluna bilər.
- Hər iki platformada eyni `com.atlasoon.anacan` app ID saxlanılır, buna görə
  production app ilə yan-yana ayrıca app kimi quraşdırılmır. Ayrılmış test cihazı
  istifadə edin; signature konflikti çıxarsa production tətbiqi/data-nı silməyin.
- Bu IPA development imzalıdır. TestFlight/App Store export-signing və mağazadakı
  son build nömrəsi ayrıca yoxlanmalıdır. Heç bir mağazaya upload və cihaz quraşdırması
  agent tərəfindən edilməyib.

## Konfiqurasiya və qorunan sərhədlər

| Sahə | Android | iOS |
| --- | --- | --- |
| Versiya | versionCode 27 / 27.0 | version/build 27.0 |
| Ad | Anacan Azure Preview | Anacan Azure Preview |
| Backend | `https://api.anacan.az` | `https://api.anacan.az` |
| Google | Aktiv, cihaz sınağı ayrıca | Aktiv, nonce hotfix-dən sonra istifadəçi girişi təsdiqləyib |
| Apple | Deaktiv — mövcud Android OAuth yolu ayrıca qalır | Aktiv — native ID-token, `.p8` tələb etmir |
| RC SDK/alış/restore/paywall | Preview üçün aktiv | Sandbox preview üçün aktiv |
| Auth cutover | `false` | `false` |
| WebView hostname | `app.anacan.az` | `app.anacan.az` |

`VITE_AZURE_REVENUECAT_ENABLED=true` yalnız bu preview build-də RC-ni açır. SDK login
olmuş UUID ilə qurulur; alış/restore nəticəsi server təsdiqindən sonra uğurlu göstərilir.
Production/source rejiminin mövcud davranışı testlə qorunur. Gateway v10 saxlanılıb;
Auth `--0000004`, Functions `--0000005` Google compatibility/RC preview üçün yenilənib.
[RC sınaq qaydası](AZURE_REVENUECAT_PREVIEW.md). Əvvəlki 26.0 artefaktları ayrıca saxlanılıb.

iOS Google wrapper-i raw nonce qaytarmadığından rəsmi native uyğunluq ayarı
`GOTRUE_EXTERNAL_GOOGLE_SKIP_NONCE_CHECK=true` tətbiq olunub. Apple nonce və token
imza/issuer/audience/expiry yoxlamaları qalır. İstifadəçi mövcud IPA-da Google girişini
təsdiqləyib; bu hotfix üçün reinstall lazım deyildi. RC üçün isə 27.0 tələb olunur.

### Android Google signer

APK və AAB əvvəlki AAB ilə **eyni yerli release sertifikatı** ilə imzalanıb.
Fingerprint-lər əvvəlcə Firebase-də yox idi. İstifadəçi təsdiqi ilə mövcud
`anacan-mobile` / `com.atlasoon.anacan` Android app-ına yalnız bunlar əlavə edildi:

```text
SHA-1   2c3a45781860caad7eb399eed6b7cca91e7b2a77
SHA-256 5e5aef2e2f1a0f4c00f7084b2d1c1d2b52db768d57c785d8d873bc93e454a720
```

Əvvəlki 3 fingerprint saxlanılıb (indi 5). Firebase-in yenidən verdiyi SDK config
bu signeri göstərir; əvvəlki Web client/audience ID-ləri saxlanır. Hazır APK-dəki
köhnə config snapshot-ı yeni SHA sətrini göstərmir, amma server qeydiyyatı təsdiqlənib;
Web client ID dəyişmədiyi üçün bu əlavə üçün artefakt yenidən build edilməyib.
Bu metadata yoxlaması real cihaz Google login acceptance-i deyil.

## Keçən yoxlamalar

- **100/100 focused test**, 49 backend/SQL və 24 router/deploy testi; hər iki TypeScript layihəsi; yeni ops/build script-lərinin
  `node --check` yoxlaması.
- Android release APK/AAB build; APK v2 signature və AAB JAR signature; signer
  əvvəlki AAB ilə eynidir. ZIP və bütün 4 64-bit native library üçün **16 KB alignment**.
- APK manifest: app ID, versionCode 27, versionName 27.0, minSdk 26, targetSdk 36 və preview adı.
- iOS archive/export/codesign; mövcud team `8B6976J8H7`, uyğun development sertifikatı,
  main app/widget profilləri, 2 ortaq qeydiyyatlı cihaz; Apple Sign in/HealthKit/app ID-lər qorunur.
- Hər üç paketin daxilində veb entry byte hash-i, **Azure client factory URL-si**,
  platforma flag-ləri və native Capacitor identity yoxlanıb.
- Production `.env`, root `dist`, embedded native assets, source Xcode/Gradle/config
  faylları, signing properties/keystore və original Android25 AAB əvvəl/sonra hash-lərlə qorunub.
  Original AAB hash-i: `264bb250541ea6a4602287413f3d33317a5a4f000da00a3e89b2290ad83f8b3e`.

## İndi cihazda sınanacaq

1. Öz əvvəlki hesabınızla daxil olun: Android Google/e-mail, iOS Google/Apple/e-mail.
   Eyni profil və operatorun read-only yoxlamasında eyni UUID/provider subject olmalıdır.
2. App-ı bağlayıb açın, sonra offline/online dönüş və access-token expiry/refresh-i yoxlayın.
   Bu, **Azure sessiyasıdır**; source sessiyalarının no-logout keçidi ayrıca hazırlanmalıdır.
3. Əsas səhifələr, məlumatlar, community/DM, media upload, kamera/mikrofon və Health
   icazələrini cihazda yoxlayın. Source data baseline **2026-09-09**-dur.
4. RC purchase/restore üçün Sandbox/TestFlight/Play internal test hesabları ilə
   [qəbul sınağını](AZURE_REVENUECAT_PREVIEW.md) edin. Epoint/legacy payment və population push bağlıdır.
5. Yalnız cihaz/model/OS, sınaq vaxtı, nəticə və görünən xəta kodunu bildirin;
   parol, OTP, token, receipt və cookie paylaşılmır.

## Production buraxılışından əvvəl qalanlar

- Real Google/Apple native login, eyni UUID və cihaz funksiyalarının acceptance-i.
- RC mapping/restore siyasəti, atomic TRANSFER və Sandbox webhook TEST artıq
  təsdiqlənib. Real store purchase/restore/refund/lifecycle, custom/unmigrated
  identity reconciliation və final production webhook ownership qalır.
- Google Workspace SMTP server konfiqurasiyası və recovery/confirmation çatdırılması;
  `provider-inputs/smtp.txt` artıq yerli qovluqda var; konfiqurasiya/delivery qəbulu gözlənilir.
- Son source inserts/updates/**deletes**, auth.sessions/refresh lineage, no-logout
  handoff, bir writer/scheduler sahibi və rollback rehearsal.
  [Final sync mağaza təsdiqindən sonra manual release-dən əvvəl ola bilər](AZURE_FINAL_SYNC_AFTER_APPROVAL.md);
  hazır 27.0 hələ auth-cutover-false preview-dir.
- FCM/APNs fiziki delivery, source/store version-aware update siyasəti, mağazaların
  faktiki build nömrələri və iOS distribution signing/export.

Provider addımları: [AZURE_PROVIDER_STEPS.md](AZURE_PROVIDER_STEPS.md).
Tam texniki sübut: `azure-migration/ops/REVENUECAT-ACTIVATION-2026-09-12.md`.

Build workspace private materialın (məsələn signing properties) yerli surətini saxlayır.
Kod arxiv generatoru bütün `native-preview/` ağacını kənarda saxlayır; təhvil üçün
yuxarıdakı APK/AAB/IPA və credential-free code/evidence arxivi ayrı saxlanılır.
