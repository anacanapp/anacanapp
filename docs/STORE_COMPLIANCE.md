# Store Compliance — Anacan

> **Changed 2026-11-01:** Android Health Connect now reads steps + exercise (shown only
> on the Health screen, never uploaded) and optionally writes menstruation, weight,
> blood pressure and blood glucose. The Play Console Health Connect declaration and
> Data safety form below MUST be updated before uploading a build with this manifest.
> These changes do not guarantee Google Play approval.

## 40.0 development candidate — 2026-09-25

- New21-language Source-first test workspace and capture behavior: [NATIVE_40.md](NATIVE_40.md).
- Main dashboard permits capture; protected Android windows use FLAG_SECURE.
  iOS uses a secure-text surface plus native black recording/app-switcher curtain.
  Physical screenshot exclusion and keyboard/touch behavior still need device acceptance;
  the latest readiness check had no connected iPhone.
- Source SQL/function acceptance is required before distributing the new Source-first
  feature set. The40.0 workspace is development-entitled, with no Store upload performed.

## Current 39.0 store preparation — 2026-09-22

- Production-entitlement Xcode workspace and exact upload/console instructions:
  [IOS_STORE_39.md](IOS_STORE_39.md). The signed development packages and Source
  advertising transport are in [ADMOB_CONTINUITY_39.md](ADMOB_CONTINUITY_39.md).
- Play **Contains ads = Yes** and **Advertising ID = Yes**: AD_ID is present in the
  verified 39.0 APK. Update Data safety for the SDK's identifiers, IP-derived coarse
  location, interactions and diagnostics, with actual advertising/analytics sharing.
- App Privacy must account for the packaged GoogleMobileAds13.6 / UMP3.1 privacy
  manifests as well as existing app/Meta/Firebase/RevenueCat data practices. The
  exact Google SDK category/linked/tracking table is in the upload instructions.
- ATT is present, and current app/SDK manifests declare device-ID tracking. NPA
  alone is not a no-data/no-tracking declaration. Age ratings and the public Privacy
  Policy must reflect the release's ads, UGC and messaging behavior.

## Earlier AdMob 31.0 candidate — 2026-09-20

- Current candidate: `native-20260919t173724-4142fccb`; delivery/build status is in
  [IOS_RELEASE_31.md](IOS_RELEASE_31.md) and [ADMOB_CONTROL_CENTER.md](ADMOB_CONTROL_CENTER.md).
- Adds Google Mobile Ads and UMP through `@capacitor-community/admob@8.1.0`, including
  native story media/video, interstitial, rewarded and banner placements.
- App code sends no health records, pregnancy/cycle/child attributes, message text
  or search terms to ad requests. Non-personalized requests are the default.
- UMP `canRequestAds` gates native requests. Configure Privacy & messaging for the
  actual publisher and verify accept/deny/privacy-options on physical devices.
- Store **contains ads**, Data Safety/App Privacy and public privacy text must reflect
  the final Mobile Ads/UMP configuration and SDK data handling. Non-personalized or
  test ads do not establish that the SDK collects no device/usage data.
- Native story uses SDK media/CTA/AdChoices with visible ad attribution and separate
  close/next controls. Only an earned reward grants the configured local benefit;
  Premium and server purchase entitlements are not modified by reward callbacks.
- Store declarations/submissions and physical-device acceptance have not been completed
  by the web deployment. Existing identity, signing and Health capabilities are preserved.

## Historical Android 25.0 Release Check

- Version code: `25`; package: `com.atlasoon.anacan`.
- Built with `npm run build`, then `npx cap sync android` and Gradle `:app:bundleRelease :app:assembleRelease` using JDK 21.
- The final AAB contains the production Supabase endpoint `https://tntbjulojatnrqmylorp.supabase.co` and its public anon key. No Azure gateway endpoint or service-role key was found in the bundled JavaScript.
- Decoding the AAB manifest with bundletool confirmed exactly one health permission: `WRITE_MENSTRUATION`. `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` and coarse location are present.
- bundletool validation and AAB/APK signature verification passed. The signer matches the existing upload certificate.
- `npm test`: 160 tests passed. `npx tsc --noEmit -p tsconfig.app.json` passed.
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`.
- APK for device testing: `android/app/build/outputs/apk/release/app-release.apk`.
- No Android device was connected. Before submission, test microphone allow/deny/re-enable, recording cancellation, gallery selection, weather with approximate location, location services disabled, and the Health Connect reviewer path below. Use Play internal testing for an update signed by Play; a locally signed APK may not install over a Play-signed installation.
- Play Console declarations, public privacy-policy content and submission have **not** been changed by the build.

---

## 1. Google Play — Data Safety formu

Play Console → App content → Data safety → yenilə:

### Health Connect bölməsi (Play Console ayrıca soruşur)
- **"Does your app access Health Connect?"** → **Yes**
- Declare exactly the permissions in the merged release manifest:
  - Read: `android.permission.health.READ_STEPS`, `android.permission.health.READ_EXERCISE`.
  - Write: `WRITE_MENSTRUATION`, `WRITE_WEIGHT`, `WRITE_BLOOD_PRESSURE`, `WRITE_BLOOD_GLUCOSE`.
  - Not requested (removed with `tools:node="remove"`): calories, distance, heart rate, exercise route.
- Purpose for reads: **App functionality** — show the person's daily steps, 7-day step chart and recent
  workouts on the Health screen (pregnancy/postpartum activity). Read data stays on the device: it is not
  sent to Anacan servers, not shared and not used for ads.
- Purpose for writes: **App functionality** — copy measurements (weight, blood pressure, blood glucose) and
  Flow period days that the person saved in Anacan to Health Connect, only after they turn on the matching
  switch. Each switch requests its own permission when turned on.
- Manually entered cycle, pregnancy, symptom and measurement records still use the backend. Disclose that
  collection; do not mark it as on-device-only merely because Health Connect data stays on the device.
- Verify the final merged release manifest contains only the six health permissions above.

### Android reviewer path
1. Open **Profile > Health integration** (`health-sync`). Install/update Health Connect if the screen asks.
2. Tap **Health Connect ilə qoşul** and allow Steps and Exercise. The screen shows today's steps with a
   7,000 goal ring, the 7-day chart and recent workouts. If no app writes steps to Health Connect, the
   screen explains where to enable a source (Google Fit, Samsung Health…). Denied access is shown as
   **İcazə yoxdur** with **İcazə ver** / **İcazələri aç**.
3. Under **Anacan-dan Health Connect-ə köçürmə**, turn on **Ölçmələr**: this requests weight/blood-pressure/
   blood-glucose write access and copies the last 30 days of saved measurements once; later saves in the
   Weight, Blood pressure and Blood sugar trackers are copied automatically (no duplicates). **İndi sinxron et**
   retries anything not yet copied.
4. Flow accounts can turn on **Period qeydləri**; then log a period start on the Flow home screen and check
   Health Connect for Anacan's menstruation records.
5. Turning a switch off stops future copies; it does not revoke permissions or delete copied records
   (use **İcazə ayarları** → Health Connect for that). **Oxumanı dayandır** stops reading on this device.

### Native rationale check before submission
- Both Android permission-rationale entry points target the app's `HealthPermissionsActivity`.
- The rationale explains the Android reads (steps, exercise; on-device only) and optional writes offline and links to `https://anacanapp.lovable.app/legal/privacy_policy`, the same public policy used by the app. It replaces the dependency activity that required a missing resource and attempted to render a web page without JavaScript. Test both the Android 13-and-below and Android 14+ entry points.
- The public policy must also describe actual health-data handling. It was reachable during this release check, but its current text does not explicitly describe Health Connect; update it through the existing legal-content administration before resubmitting.
- Complete these device checks and the final manifest/artifact inspection with the release build. Source changes and unit tests alone do not verify native permission dialogs or store approval.

### Data types (ümumi bölmə)
| Data type | Collected? | Shared? | Purpose |
|---|---|---|---|
| Health info (cycle, hamiləlik, simptomlar — Supabase-ə yazılan) | Yes | No | App functionality |
| Name, Email | Yes | No | App functionality, Account management |
| User IDs | Yes | Yes (Firebase/RevenueCat/Facebook) | Analytics, App functionality |
| Device IDs (advertising ID — AdMob/Google and Facebook SDK) | Yes | Yes | Advertising/Marketing, Analytics |
| Photos | Yes | No | App functionality |
| Approx/Precise location | Yes | No | App functionality (hava/xəritə) |
| Purchase history | Yes | Yes (RevenueCat) | App functionality |
| Crash logs / Diagnostics | Yes | No | Analytics |
- Encryption in transit: **Yes** · Deletion request: **Yes** (tətbiqdaxili hesab silmə var)
- Health Connect steps/exercise are read and displayed on the device only; they are not collected by Anacan servers. Assess manually logged fitness data separately against actual backend behavior; recheck the other rows against the release's SDK configuration.

### Health apps declaration (2024+ tələbi)
Play Console → App content → **Health apps** → "My app is a health & fitness app" →
kateqoriya: **Reproductive health / cycle tracking** seçin.

---

## 2. App Store — Privacy & Health Disclosure

### App Privacy (App Store Connect → App Privacy)
`PrivacyInfo.xcprivacy` ilə uyğun olmalıdır:
- **Health & Fitness** → Collected, Linked to user, App Functionality
- Contact Info (Name, Email) → Linked, App Functionality
- Identifiers (User ID / Device ID) → Linked; Device ID → **Used for Tracking = YES** (AdMob/Google and Facebook SDK)
- Photos, Location (Precise), Purchase History, Crash & Performance Data → App Functionality/Analytics
- Tracking sualına: **Yes** (ATT dialoqu mövcuddur — `NSUserTrackingUsageDescription`)

### HealthKit tələbləri (App Review Guideline 5.1.3)
- Review Notes-a əlavə edin:
  > "The existing iOS integration reads steps, workouts and mindfulness from HealthKit
  > and optionally writes menstruation and vital measurements with user consent.
  > Imported HealthKit data is processed on-device. Health records entered manually
  > in the app are stored with the user's Supabase account and may optionally be
  > copied to HealthKit."
- App Store təsvirində HealthKit istifadəsini qeyd edin (1 cümlə kifayətdir).
- Privacy Policy səhifəsinə HealthKit/Health Connect bölməsi əlavə edin:
  distinguish iOS reads/writes, Android menstruation-only writes, manually entered
  records stored in Supabase, and actual third-party data handling.

### Yoxlama siyahısı (hər iki mağaza)
- [ ] Privacy Policy-də health data bölməsi yeniləndi
- [ ] Play Data Safety formu yeniləndi (Health Connect + WRITE_MENSTRUATION)
- [x] Final Android 25 artifact has no health read permissions or additional health write scopes
- [ ] Android rationale opens the approved privacy policy on both intent entry points
- [ ] Flow reviewer path tested with a new period log after enabling export
- [ ] Play "Health apps" declaration dolduruldu
- [ ] App Store Privacy labels yeniləndi
- [ ] App Review notes-a HealthKit izahı yazıldı
- [ ] PrivacyInfo.xcprivacy target-ə əlavə olundu (Xcode)

## Google Play "DEX code optimization" (obfuscation 2%) — 2026-11-01
- Release builds now run R8 (`minifyEnabled true`, `proguard-android-optimize.txt`); `shrinkResources` stays off
  because plugins resolve some resources (notification icons) by name. Keep rules in `android/app/proguard-rules.pro`
  cover the Capacitor bridge, Cordova, every `com.getcapacitor.Plugin`, `@JavascriptInterface`, Anacan's own
  `com.atlasoon.anacan` classes and the local Customer.io plugin; line numbers are kept and the mapping is embedded
  in the AAB (`BUNDLE-METADATA/.../proguard.map`), so Play deobfuscates crashes.
- R8 found a real defect: the root `build.gradle` forced every Kotlin stdlib to 1.9.24 while the compiler is 2.2.20,
  so suspend code in `HealthCyclePlugin` referenced `kotlin.coroutines.jvm.internal.SpillingKt`, which 1.9 lacks
  (a runtime crash on the Health Connect write path). The pin is now 2.2.20.
- `org.gradle.jvmargs` raised to `-Xmx4g` (R8 ran out of memory at 1.5 GB; Codemagic mac_mini_m2 has 8 GB).
- Local check (same `npx cap sync android` + `bundleRelease` as Codemagic, 19 plugins): build passes, 50% of
  33,050 classes obfuscated (threshold 25%), all plugin classes keep their names. No emulator here: run the
  release build on a device (sign-in, purchase screen, push, Health Connect, AdMob, timer widget) before publishing.
