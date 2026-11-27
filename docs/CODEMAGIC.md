# Codemagic ilə iOS və Android Store build-ləri

`codemagic.yaml` dörd əl ilə başladılan workflow verir:

| Workflow | Nəticə |
|---|---|
| `ios-store` | Capacitor: imzalı App Store IPA, App Store Connect-ə yüklənir (TestFlight-a avtomatik təqdim edilmir) |
| `android-store` | Capacitor: imzalı Google Play AAB və APK (artifact kimi endirilir, Play-ə əl ilə yüklənir) |
| `ios-flutter-store` | Flutter (`app/`, 60.0+): eyni IPA və App Store Connect yükləməsi |
| `android-flutter-store` | Flutter (`app/`, 60.0+): eyni AAB və APK |

Capacitor workflow-ları 53.0 körpü buraxılışı və geri qayıtma üçün qalır; Flutter workflow-ları aşağıda,
[Flutter workflow-ları](#flutter-workflow-ları-60) bölməsindədir.

Trigger yoxdur: build yalnız **Start new build** ilə başlayır. Personal hesabın ayda
500 pulsuz macOS M2 dəqiqəsi push-larla xərclənmir. Team hesabında pulsuz dəqiqə yoxdur.

## Build nə edir

1. `npm ci`.
2. `scripts/codemagic/check-native-env.mjs`: `VITE_NATIVE_BUILD=true`, canonical
   `https://api.anacan.az`, Source olmayan anon key, `VITE_APP_VERSION` və
   `VITE_INITIAL_MANAGED_ADMISSION` yoxlanır. Admission canlı
   `/.well-known/anacan-backend.json` ilə sahə-sahə eyni olmalıdır (managed `azure`,
   generation 2+). Uyğunsuzluqda build dayanır.
3. `vite build --mode google` (Customer.io write key Vite-a verilmir). Marketing
   `website/` və pitch-deck faylları native paketdən çıxarılır.
4. `cap sync`, sonra `scripts/codemagic/apply-native-config.mjs`: canlı AdMob app ID
   native layihəyə (repoda Google-un test ID-ləri durur), Customer.io write key yalnız
   generated `capacitor.config.json` → `plugins.CustomerIoDataIn`-ə yazılır. Key web
   bundle-da tapılsa build dayanır.
5. iOS: sertifikat və App Store profilləri (app + widget) API ilə gətirilir/yaradılır, `MARKETING_VERSION=$APP_VERSION`,
   `CURRENT_PROJECT_VERSION=$IOS_BUILD_VERSION`: 50.0-dan başlayaraq App Store Connect-dəki son TestFlight build-i + 1 (`50.0.0`, `50.0.1`, …); sorğu alınmasa `$APP_VERSION.$BUILD_NUMBER`.
   Android: `versionName=$APP_VERSION.$ANDROID_BUILD_SEQ` (`50.0.0`, `50.0.1`, …), `versionCode=5000+$ANDROID_BUILD_SEQ`.

**Push şəkilləri (iOS Notification Service Extension).** `ios/App/AnacanNotificationService`
target-i (`com.atlasoon.anacan.AnacanNotificationService`, team `8B6976J8H7`, iOS 16.6,
Firebase-siz Swift) FCM-in `fcm_options.image` (və ya üst səviyyə `image`) https URL-ini
~8 s ərzində endirib bildirişə şəkil kimi əlavə edir; uğursuzluqda bildiriş şəkilsiz
çatdırılır. App target-i onu `Embed Foundation Extensions`-a widget kimi yerləşdirir.
`ios-store` workflow-u bundle ID-ni lazım olduqda yaradır (`bundle-ids create … || true`)
və ilk build onun App Store profilini `fetch-signing-files --create` ilə avtomatik yaradır.
Entitlement/App Group tələb olunmur.

## Codemagic-də bir dəfəlik qurulum

Personal hesabda Team integrations / Code signing identities menyuları yoxdur. Ona görə
bütün imzalama dəyərləri tətbiqin öz **Environment variables** tab-ındadır
(app → **Settings** → **Environment variables**). Hər dəyişən **Secret** işarələnir və
aşağıdakı qrup adına əlavə edilir.

1. **Personal** hesabla GitHub üzərindən daxil olun, `anacanapp/anacanapp` repo-nu
   əlavə edin, layihə tipi **Ionic**. Konfiqurasiya `codemagic.yaml`-dan oxunur.
2. Qrup **`anacan_ios_signing`**:
   - `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_IDENTIFIER`,
     `APP_STORE_CONNECT_PRIVATE_KEY` (`.p8` faylının bütün mətni). Açar: App Store
     Connect → Users and Access → Integrations → App Store Connect API → Team Keys,
     rol **App Manager**. `.p8` yalnız bir dəfə endirilir.
   - `CERTIFICATE_PRIVATE_KEY`: Codemagic-ə məxsus sertifikat açarı (PEM, bütün mətn,
     `BEGIN/END RSA PRIVATE KEY` sətirləri daxil). Bir dəfə yaradılır və saxlanır:
     `ssh-keygen -t rsa -b 2048 -m PEM -f anacan_codemagic_cert_key -q -N ""`.
     İlk build bu açarla yeni Apple Distribution sertifikatı və app + widget üçün App
     Store profillərini yaradır (`--create`), sonrakı build-lər onları təkrar istifadə
     edir. Push, HealthKit, Sign in with Apple və App Group App ID-lərdən gəlir.
     Apple hesabında Distribution sertifikat limiti dolubsa, köhnə istifadəsizini silin.
3. Qrup **`anacan_android_signing`**:
   - `CM_KEYSTORE`: mövcud Play upload keystore-un (`anacan-release-key.jks`) base64
     mətni. Windows PowerShell:
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("anacan-release-key.jks")) | Set-Clipboard`.
     Yeni keystore yaratmayın: Play yalnız mövcud upload açarını qəbul edir.
   - `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, `CM_KEY_PASSWORD`
     (`android/keystore.properties`-dəki `storePassword`, `keyAlias`, `keyPassword`).
4. Qrup **`anacan_native`** (`VITE_NATIVE_BUILD` və `VITE_APP_VERSION`-u əlavə
   etməyin, build özü qoyur). `azure-migration/` olmadan da yığılır:

   | Dəyişən | Dəyər / mənbə |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://api.anacan.az` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Google public anon key: PC-də `node setup-env-google.mjs` `.env.google` yazır |
   | `VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY` | Köhnə Source anon key: repodakı `.env`-də `VITE_SUPABASE_PUBLISHABLE_KEY` (one-way adoption üçün) |
   | `VITE_INITIAL_MANAGED_ADMISSION` | `https://api.anacan.az/.well-known/anacan-backend.json` cavabının JSON-u, tək sətir |
   | `VITE_BACKEND_BOOTSTRAP` | `source-first-v1` |
   | `VITE_AUTH_CUTOVER` | `false` |
   | `VITE_AZURE_PARTNER_PAIRING`, `VITE_AZURE_GOOGLE_OAUTH_ENABLED`, `VITE_AZURE_APPLE_OAUTH_ENABLED`, `VITE_AZURE_REVENUECAT_ENABLED` | `true` (managed backend-də partner, Google/Apple login və RevenueCat bunlarsız sönür) |
   | `VITE_ADMOB_IOS_APP_ID` / `VITE_ADMOB_ANDROID_APP_ID` | `docs/SOURCE_RUNTIME_COMPATIBILITY.md`-dakı canlı ID-lər |
   | `VITE_CUSTOMERIO_ENABLED` / `_ENVIRONMENT` / `_REGION` | `true` / `production` / `EU` |
   | `VITE_CUSTOMERIO_WORKSPACE_ID` / `_SOURCE_ID` | `224149` / `93570` |
   | `VITE_CUSTOMERIO_CDP_WRITE_KEY` | `.env.customerio.production.local` və ya Customer.io → workspace 224149 → Data & Integrations → Sources → source 93570 → API key |

   Firebase web dəyişənləri repodakı `.env`-dən avtomatik gəlir. Yoxlama skripti
   bootstrap, cutover, açarlar və admission səhv olarsa build-i dayandırır.

Bu dəyərlər heç vaxt Git-ə, loglara və ya chat-ə yazılmır.

## Build başlatmaq

**Start new build** → branch → workflow. Versiya `codemagic.yaml`-dadır (Capacitor: `APP_VERSION`
`53.0`, Android `versionCode` = 5300 + `ANDROID_BUILD_SEQ`; əvvəlki buraxılış: `docs/RELEASE_52_CODEMAGIC.md`). Eyni versiyanı Play-ə ikinci dəfə yükləmək
üçün build başlatarkən `ANDROID_BUILD_SEQ`-i bir artırın (Play eyni versionCode-u rədd edir).
iOS build nömrəsi App Store Connect-dən avtomatik hesablanır (53.0.0-dan).

## Flutter workflow-ları (60)

`ios-flutter-store` və `android-flutter-store` `app/` qovluğundakı Flutter tətbiqini yığır. Eyni `mac_mini_m2`,
eyni əl ilə başlatma, eyni artifact/yükləmə qaydası, eyni üç qrup (`anacan_native`, `anacan_ios_signing`,
`anacan_android_signing`). **Yeni sirr və ya yeni qrup lazım deyil**: Flutter build-i mövcud `VITE_*` dəyərlərini
özü çevirir. Texniki təfərrüat (ingiliscə): `docs/flutter/BUILD.md`.

Addımlar:

1. `app/tool/codemagic/check_env.mjs`: `check-native-env.mjs` ilə eyni yoxlamalar (canonical `https://api.anacan.az`,
   Source olmayan anon key, ayrıca Source key, `source-first-v1`, `VITE_AUTH_CUTOVER=false`, RevenueCat açıq,
   admission canlı `/.well-known/anacan-backend.json` ilə sahə-sahə eyni) + platformanın canlı AdMob ID-si və
   Customer.io ayarları. Uyğunsuzluqda build dayanır.
2. Flutter **3.50.1** (başqa versiya gəlsə build dayanır), `flutter pub get`, dizayn token-ları və i18n ixracının
   `--check` yoxlaması (alət repoda varsa; lazım olsa əvvəlcə `npm ci`). `flutter analyze` + `flutter test`
   susmaya görə ötürülür (~5–6 dəqiqə; budağa hər push-dan əvvəl lokal işlədilir); Codemagic-də işlətmək üçün
   **Start new build → Environment variables**-ə `RUN_FLUTTER_TESTS=true` əlavə edin.
3. `write_dart_defines.mjs`: `VITE_*` → `--dart-define-from-file` JSON-u (`ANACAN_API_URL`, `ANACAN_ANON_KEY`,
   `ANACAN_SOURCE_ANON_KEY`, `ANACAN_APP_VERSION`, `ANACAN_INITIAL_MANAGED_ADMISSION`, `ANACAN_BACKEND_BOOTSTRAP`,
   `ANACAN_AUTH_CUTOVER`, `ANACAN_BUILD_MODE` (`google`), `ANACAN_AZURE_*` bayraqları, Customer.io-nun gizli olmayan ID-ləri). Customer.io write key və
   AdMob ID-ləri buraya **düşmür**. RevenueCat-in açıq SDK açarları və Google OAuth client ID-ləri Codemagic dəyişəni
   **deyil**: Capacitor build-inin istifadə etdiyi, artıq repoda olan fayllardan oxunur (`app/tool/codemagic/public_ids.mjs`):
   `ANACAN_RC_ANDROID_API_KEY` / `ANACAN_RC_IOS_API_KEY` / `ANACAN_RC_FALLBACK_API_KEY` ← `src/lib/revenuecat.ts`
   (`REVENUECAT_CONFIG.ANDROID_API_KEY` / `IOS_API_KEY` / `API_KEY`), `ANACAN_GOOGLE_SERVER_CLIENT_ID` ←
   `android/app/google-services.json` (`client_type: 3` olan web client), `ANACAN_GOOGLE_IOS_CLIENT_ID` ←
   `ios/App/App/GoogleService-Info.plist` (`CLIENT_ID`). Eyni adlı mühit dəyişəni verilsə, o üstün tutulur (məs. test layihəsi).
4. `apply_native_config.mjs`: canlı AdMob ID-si və Customer.io write key yalnız Git-ə düşməyən native fayla yazılır
   (Android `app/android/anacan-native.properties`, iOS `app/ios/Flutter/AnacanNative.xcconfig`). iOS faylına Google
   girişi üçün `ANACAN_GOOGLE_IOS_CLIENT_ID`, `ANACAN_GOOGLE_REVERSED_CLIENT_ID`, `ANACAN_GOOGLE_SERVER_CLIENT_ID` də
   yazılır (Info.plist `GIDClientID`, `GIDServerClientID`, URL sxemi; eyni repodakı fayllardan).
5. iOS: `ios-store` kimi sertifikat və App Store profili API ilə gətirilir (`keychain`, `fetch-signing-files --create`,
   `xcode-project use-profiles`), sonra `flutter build ipa`. Hələlik yalnız `Runner` (`com.atlasoon.anacan`) imzalanır;
   widget və bildiriş xidməti target-ləri Flutter layihəsinə köçürüləndə `IOS_SIGNED_TARGETS` siyahısına bir sətir
   əlavə olunur. Android: `keystore.properties` `ios-store`/`android-store`-dakı eyni upload keystore-dan yazılır,
   `flutter build appbundle` və `flutter build apk`.
6. Yoxlama: write key Dart/Flutter çıxışında (snapshot, `flutter_assets`, IPA/AAB/APK içində) tapılsa build dayanır.
   Android-də imza sertifikatının SHA-256-sı loga yazılır (debug açarı ilə imzalanıbsa build dayanır) və APK 16 KB
   səhifə uyğunluğu üçün `zipalign -P 16` ilə yoxlanır.

**Versiya (60.0).** `APP_VERSION: "60.0"`. iOS: `CFBundleShortVersionString` 60.0, build nömrəsi App Store Connect-dəki
son 60.0 TestFlight build-i + 1 (`60.0.0`, `60.0.1`, …). Android: `versionName` = `60.0.ANDROID_BUILD_SEQ`,
`versionCode` = 6000 + `ANDROID_BUILD_SEQ` (bütün 53.0.x kodlarından, 5300+, yuxarı). Hər yeni Play yükləməsindən
əvvəl `ANDROID_BUILD_SEQ`-i bir artırın. Eyni `applicationId`/bundle ID və eyni imza açarı ilə 60.0 mövcud tətbiqin
yerində yeniləməsi kimi quraşdırılır.

**Capacitor workflow-ları qalır.** `ios-store` / `android-store` 53.0 körpü buraxılışı və geri qayıtma üçündür.
60.0 Store-a çıxandan sonra geri qayıtmaq lazım olsa, Capacitor build-i 60.0-dan **yuxarı** versiya ilə yığılmalıdır
(məs. `APP_VERSION` 60.1 və Android `versionCode` 6100+); Store-lar aşağı versiyanı yeniləmə kimi qəbul etmir.

**Layihə tipi (Ionic).** Konfiqurasiya `codemagic.yaml`-dan oxunduqda workflow-lar faylda tam təsvir olunur və
paneldəki layihə tipi (Ionic / Flutter) Workflow Editor üçündür; yaml build-lərində istifadə olunmadığını bilirik,
amma bunu bu mühitdən yoxlaya bilmədik (**yoxlanmayıb**). Ehtiyat üçün: app → **Settings**-də konfiqurasiya mənbəyi
`codemagic.yaml` olaraq qalsın; **Start new build** pəncərəsində `ios-flutter-store` / `android-flutter-store`
görünmürsə, layihə tipini dəyişməyin, əvvəlcə branch-də `codemagic.yaml`-ın yeni versiyasının olduğunu yoxlayın.

**İlk Flutter build-də yoxlanmalı olanlar** (burada heç bir build işlədilməyib: Android SDK və Xcode yoxdur):
Codemagic-in Flutter 3.50.1-i quraşdırması; Gradle (AGP 9.3.1) və R8-in keçməsi; loga yazılan Android imza SHA-256-sının
Play Console → App integrity → Upload key certificate ilə eyni olması; App Store profilinin `Runner`-ə tətbiq olunması;
TestFlight / Play internal testing-də 53.0-ın üzərinə yeniləmə kimi quraşdırma. Siyahının tam variantı:
`docs/flutter/BUILD.md` → "First Codemagic run".

## Məhdudiyyətlər

- Bu, 47-ni hazırlayan PC-dəki izolə namizəd pipeline-ının (routing case və asset
  acceptance receipt-ləri) tam əvəzi deyil. Repodakı native layihə namizəd
  workspace-dən geri qala bilər: Store-a göndərməzdən əvvəl ilk Codemagic paketini
  TestFlight / Play internal testing-də yoxlayın (giriş, admission, push, HealthKit,
  widget, alış, reklam).
- Common Store pointer 47-dir. Codemagic 48 paketi istifadəçi tərəfindən Store-a göndərilib;
  növbəti paket 49-dur (stikerlər, iOS privacy cover/Face ID düzəlişi, coral splash/ikon).
  Publish nəticələrini `docs/` altında ayrıca release sənədində qeyd edin.
