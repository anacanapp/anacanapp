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
5. iOS: App Store profilləri (app + widget) tətbiq olunur, `MARKETING_VERSION=$APP_VERSION`,
   `CURRENT_PROJECT_VERSION=$APP_VERSION.$BUILD_NUMBER` (məs. `48.0.3`).
   Android: `versionName=$APP_VERSION`, `versionCode=$ANDROID_VERSION_CODE`.

## Codemagic-də bir dəfəlik qurulum

1. **Personal** hesabla GitHub üzərindən daxil olun, `anacanapp/anacanapp` repo-nu
   əlavə edin, layihə tipi **Ionic**. Konfiqurasiya `codemagic.yaml`-dan oxunur.
2. **App Store Connect API key** (Integrations → Developer Portal): App Store Connect →
   Users and Access → Integrations → yeni key (App Manager). Codemagic-də adı dəqiq
   **`Anacan ASC`** olmalıdır.
3. **iOS code signing** (Code signing identities): mövcud Apple Distribution
   sertifikatını `.p12` kimi yükləyin (və ya Codemagic-də yaradın), sonra
   **Fetch profiles** ilə `com.atlasoon.anacan` və
   `com.atlasoon.anacan.AnacanTimerWidgetExt` App Store profillərini gətirin.
   Profillərdə push (production), HealthKit, Sign in with Apple və
   `group.com.atlasoon.anacan` olmalıdır.
4. **Android keystore** (Code signing identities → Android keystores): mövcud Play
   upload keystore-u (`anacan-release-key.jks`) parolları və alias ilə yükləyin,
   reference adı **`anacan_upload`**. Yeni keystore yaratmayın: Play yalnız mövcud
   upload açarını qəbul edir.
5. **Environment variables** → qrup **`anacan_native`**, hamısı **Secure**:
   - 47 Store namizədinin native build mühitindəki bütün `VITE_*` dəyərləri
     (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
     `VITE_INITIAL_MANAGED_ADMISSION`, `VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY`,
     `VITE_AUTH_CUTOVER`, `VITE_BACKEND_BOOTSTRAP`, Azure/Google flag-ləri və s.).
     Mənbə PC-dədir: `azure-migration/native-preview/native-20261007t153716-3039ae35/`.
     `VITE_NATIVE_BUILD` və `VITE_APP_VERSION`-u əlavə etməyin, build özü qoyur.
   - Canlı AdMob: `VITE_ADMOB_IOS_APP_ID`, `VITE_ADMOB_ANDROID_APP_ID`.
   - Customer.io (production profil, `.env.customerio.production.local`-dan):
     `VITE_CUSTOMERIO_ENABLED`, `VITE_CUSTOMERIO_ENVIRONMENT`, `VITE_CUSTOMERIO_REGION`,
     `VITE_CUSTOMERIO_WORKSPACE_ID`, `VITE_CUSTOMERIO_SOURCE_ID`,
     `VITE_CUSTOMERIO_CDP_WRITE_KEY`.

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
