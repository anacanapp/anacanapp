# Store Compliance — Anacan

> Android Health Connect is limited to optional menstruation writes. iOS HealthKit
> functionality is unchanged. Align store declarations with the final release;
> these changes do not guarantee Google Play approval.

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
- Declare **write access to menstruation only**: `android.permission.health.WRITE_MENSTRUATION`.
- Purpose: **App functionality**, reproductive health / cycle tracking. Flow users can explicitly enable copying newly logged period records to Health Connect.
- Do not declare steps, cadence, exercise, mindfulness, calories, distance or heart-rate reads. Android does not import Health Connect data or display imported activity. Weight, blood-pressure and blood-glucose writes are also disabled on Android.
- The app manifest removes the read permissions contributed by `capacitor-health`, including `READ_STEPS` and `READ_EXERCISE`. Verify the final merged release manifest and artifact contain only `WRITE_MENSTRUATION` among health permissions.
- This is **not** a "no health data collected" app. Manually entered cycle, pregnancy, symptom and measurement records still use the Supabase/Lovable backend. Disclose actual backend collection and SDK handling; do not mark these records as ephemeral/on-device-only merely because the Health Connect export stays on the device.

### Android reviewer path
1. Sign in with a Flow (menstruation) account on a device where Health Connect is available. Non-Flow accounts cannot enable a new cycle export.
2. Open **Profile > Health integration** (`health-sync`), or **Profile > Settings > Health integration**.
3. Enable **Tsikli Health-ə yaz**. Only this explicit action requests menstruation write access. Opening/resuming the screen does not request authorization, and no reader connection is required.
4. **After enabling**, return to the Flow home screen, tap **Periodum başladı**, select a test start date and confirm with **Qeyd et**. This saves the app log and invokes the existing cycle writer. Enabling the toggle alone does not export historical logs.
5. Inspect Anacan's menstruation flow records in Health Connect for the selected start date and configured period length. The calendar path writes when a saved change updates the latest period start; do not use an unchanged historical log as proof of a new export.
6. Turn the toggle off to stop future exports. A prior enabled flag can also be disabled after leaving Flow mode or when Health Connect is unavailable. **İcazə ayarları** opens system settings to revoke permissions/manage existing records; turning the toggle off does not revoke permissions or delete prior exports.

### Native rationale check before submission
- Both Android permission-rationale entry points target the app's `HealthPermissionsActivity`.
- The rationale displays the Android write-only behavior offline and links to `https://anacanapp.lovable.app/legal/privacy_policy`, the same public policy used by the app. It replaces the dependency activity that required a missing resource and attempted to render a web page without JavaScript. Test both the Android 13-and-below and Android 14+ entry points.
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
- Health Connect steps/cadence/exercise are not collected by this Android integration. Assess any manually logged fitness data separately against actual backend behavior; recheck the other rows against the release's SDK configuration.

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
  > copied to HealthKit. The Android write-only restriction does not change iOS functionality."
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
