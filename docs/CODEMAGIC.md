# Codemagic ilə iOS və Android Store build-ləri

`codemagic.yaml` iki əl ilə başladılan workflow verir:

| Workflow | Nəticə |
|---|---|
| `ios-store` | İmzalı App Store IPA, App Store Connect-ə yüklənir (TestFlight-a avtomatik təqdim edilmir) |
| `android-store` | İmzalı Google Play AAB və APK (artifact kimi endirilir, Play-ə əl ilə yüklənir) |

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
   `CURRENT_PROJECT_VERSION=$APP_VERSION.$BUILD_NUMBER` (məs. `48.0.3`).
   Android: `versionName=$APP_VERSION`, `versionCode=$ANDROID_VERSION_CODE`.

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

**Start new build** → branch → workflow. Versiya `codemagic.yaml`-dadır (`APP_VERSION`
`48.0`, Android `ANDROID_VERSION_CODE` `48`). Eyni versiyanı Play-ə ikinci dəfə yükləmək
üçün build başlatarkən `ANDROID_VERSION_CODE`-u artırın (Play eyni versionCode-u rədd edir).
iOS build nömrəsi `$BUILD_NUMBER` ilə avtomatik artır.

## Məhdudiyyətlər

- Bu, 47-ni hazırlayan PC-dəki izolə namizəd pipeline-ının (routing case və asset
  acceptance receipt-ləri) tam əvəzi deyil. Repodakı native layihə namizəd
  workspace-dən geri qala bilər: Store-a göndərməzdən əvvəl ilk Codemagic paketini
  TestFlight / Play internal testing-də yoxlayın (giriş, admission, push, HealthKit,
  widget, alış, reklam).
- Common Store pointer 47-dir. Codemagic 48 paketinin publish edilməsi bu sənədlə
  qeyd olunmur; nəticəni `docs/` altında ayrıca release sənədində qeyd edin.
