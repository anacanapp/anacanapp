# Flutter app (`app/`): build and store configuration

Store builds run only on Codemagic (`ios-flutter-store`, `android-flutter-store` in `codemagic.yaml`; owner guide in
Azerbaijani: `docs/CODEMAGIC.md`). The Flutter app ships as **60.0** and must install as an **in-place update** of the
Capacitor app (last Capacitor release: 53.0 bridge). Same identity on both stores:

| | Value |
|---|---|
| Android `applicationId` / namespace | `com.atlasoon.anacan` (launcher activity stays `com.atlasoon.anacan.MainActivity`) |
| Android signing | the existing Play upload key (`anacan_android_signing`: `CM_KEYSTORE`, `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, `CM_KEY_PASSWORD`) |
| iOS bundle id / team | `com.atlasoon.anacan` / `8B6976J8H7`, App Store Connect app `6758301924` |
| Version | iOS `60.0` (build `60.0.N`, next TestFlight number); Android `versionName 60.0.SEQ`, `versionCode 6000+SEQ` |

## Codemagic pipeline (both platforms)

1. `app/tool/codemagic/check_env.mjs <platform>`: same `anacan_native` rules as `scripts/codemagic/check-native-env.mjs`
   (canonical `https://api.anacan.az`, anon non-Source key, distinct Source key, `source-first-v1`, no auth cutover,
   RevenueCat on, bundled admission equal to the live `/.well-known/anacan-backend.json`), plus the live AdMob app ID of
   the platform and the Customer.io settings. `APP_VERSION` replaces `VITE_APP_VERSION`; `VITE_NATIVE_BUILD` is not used.
2. Flutter 3.50.1 check, `flutter pub get`, `app/tool/codemagic/check_generated.mjs` (runs
   `tool/design/gen_tokens.mjs --check` and `tool/i18n/export.mjs --check` when present; `npm ci` first when a generator
   imports from `node_modules`), `flutter analyze`, `flutter test`.
3. `app/tool/codemagic/write_dart_defines.mjs` -> `app/build/codemagic/dart_defines.json` for `--dart-define-from-file`.
4. `app/tool/codemagic/apply_native_config.mjs <platform>` -> gitignored native config (below).
5. Signing, `flutter build ipa` / `flutter build appbundle` + `flutter build apk`.
6. `apply_native_config.mjs verify <platform>`: fails if the Customer.io write key appears in any Dart/Flutter output
   (AOT `app.so`/`App.framework/App`, `app.dill`, `flutter_assets`, the defines file, and the same entries inside the
   IPA/AAB/APK). Android also prints the signer SHA-256 (fails on the debug key) and runs `zipalign -c -P 16`.

### Dart defines

Read in Dart with `String.fromEnvironment` / `bool.fromEnvironment` (flags are `"true"`/`"false"`):

| Define | From |
|---|---|
| `ANACAN_API_URL` | `VITE_SUPABASE_URL` |
| `ANACAN_ANON_KEY` | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `ANACAN_SOURCE_ANON_KEY` | `VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY` |
| `ANACAN_APP_VERSION` | `APP_VERSION` (workflow var) |
| `ANACAN_INITIAL_MANAGED_ADMISSION` | `VITE_INITIAL_MANAGED_ADMISSION` (JSON text) |
| `ANACAN_BACKEND_BOOTSTRAP` | `VITE_BACKEND_BOOTSTRAP` |
| `ANACAN_AUTH_CUTOVER` | `VITE_AUTH_CUTOVER` |
| `ANACAN_BUILD_MODE` | constant `google` (as `vite build --mode google`) |
| `ANACAN_AZURE_PARTNER_PAIRING`, `ANACAN_AZURE_GOOGLE_OAUTH_ENABLED`, `ANACAN_AZURE_APPLE_OAUTH_ENABLED`, `ANACAN_AZURE_REVENUECAT_ENABLED` | the `VITE_AZURE_*` flags of the same name |
| `ANACAN_CUSTOMERIO_ENABLED`, `_ENVIRONMENT`, `_REGION`, `_WORKSPACE_ID`, `_SOURCE_ID` | `VITE_CUSTOMERIO_*` (non-secret ids only) |
| `ANACAN_RC_ANDROID_API_KEY`, `ANACAN_RC_IOS_API_KEY`, `ANACAN_RC_FALLBACK_API_KEY` | committed `src/lib/revenuecat.ts` `REVENUECAT_CONFIG.ANDROID_API_KEY` / `IOS_API_KEY` / `API_KEY` (public SDK keys the Capacitor bundle ships) |
| `ANACAN_GOOGLE_SERVER_CLIENT_ID` | committed `android/app/google-services.json`, `oauth_client` with `client_type: 3` (Web client = ID-token audience) |
| `ANACAN_GOOGLE_IOS_CLIENT_ID` | committed `ios/App/App/GoogleService-Info.plist` `CLIENT_ID` |

The last five are public identifiers already in the repository, so they are **not** Codemagic variables:
`app/tool/codemagic/public_ids.mjs` reads them from those files at build time (format-checked; an environment
variable of the same name overrides one, e.g. for a test project).

Never emitted: `VITE_CUSTOMERIO_CDP_WRITE_KEY`, `VITE_ADMOB_IOS_APP_ID`, `VITE_ADMOB_ANDROID_APP_ID` (the script fails if
any define contains one of them), Firebase web values.

Local run against production: export the same variables, then
`node app/tool/codemagic/write_dart_defines.mjs` and `flutter run --dart-define-from-file=build/codemagic/dart_defines.json`
from `app/`.

### Native-only values

| Platform | File (gitignored, written by `apply_native_config.mjs`) | Consumed as | Local default |
|---|---|---|---|
| Android | `app/android/anacan-native.properties` | `manifestPlaceholders["anacanAdmobAppId"]`; resValue strings `anacan_customerio_enabled/_environment/_region/_cdp_write_key` | Google test AdMob id, Customer.io off |
| iOS | `app/ios/Flutter/AnacanNative.xcconfig` (`#include?` from `Debug.xcconfig`/`Release.xcconfig`) | `$(ANACAN_ADMOB_APP_ID)`; Info.plist `AnacanCustomerIoEnabled/Environment/Region/CdpWriteKey` from `$(ANACAN_CUSTOMERIO_*)`; Info.plist `GIDClientID` / `GIDServerClientID` / Google URL scheme from `$(ANACAN_GOOGLE_IOS_CLIENT_ID)` / `$(ANACAN_GOOGLE_SERVER_CLIENT_ID)` / `$(ANACAN_GOOGLE_REVERSED_CLIENT_ID)` (from the committed Firebase files) | same; Google ids empty (Google sign-in on iOS needs the script run once locally) |

The script refuses to write either file when Git does not ignore it.

## Android project (`app/android`)

Toolchain as generated by Flutter 3.50.1 (checked in `/opt/flutter/packages/flutter_tools/gradle`): AGP **9.3.1**,
Kotlin Gradle plugin **2.4.20**, Gradle **9.5.0**, NDK **28.2.13676358**, Flutter defaults compile/target SDK 36,
min SDK 24. Capacitor (`android/`) uses AGP 8.13.0, Gradle 8.13, Kotlin 2.2.20, SDK 26/36/36.

`app/android/app/build.gradle.kts`:
- `minSdk = 26` (Capacitor `variables.gradle`: Health Connect, `java.time` without desugaring);
  `compileSdk = maxOf(36, flutter.compileSdkVersion)`, `targetSdk = maxOf(36, flutter.targetSdkVersion)`.
- Java/Kotlin bytecode 17 (Flutter template). Codemagic runs Gradle on `java: 21`; AGP 9 needs JDK 17+, so 21 is fine.
- `versionCode`/`versionName` from `flutter build --build-number/--build-name`.
- Release signing from `app/android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`, same
  names as `android/keystore.properties.example`; example: `app/android/keystore.properties.example`). Without the file a
  local release build falls back to the debug key; Codemagic sets `ANACAN_REQUIRE_RELEASE_SIGNING=true`, which makes
  Gradle fail instead, and the verify step rejects a `CN=Android Debug` signer.
- R8 `isMinifyEnabled = true` + `isShrinkResources = true` (Flutter's plugin also adds `proguard-android-optimize.txt`,
  `flutter_proguard_rules.pro` and `app/proguard-rules.pro`). Capacitor kept resource shrinking off because plugins look
  up notification icons by name: list such resources in `app/src/main/res/raw/keep.xml` when they are added.
  `proguard-rules.pro` has a commented plugin section to fill as plugins arrive.
- 16 KB pages: NDK r28 aligns ELF LOAD segments to 16 KB by default and AGP 8.5.1+ stores uncompressed `.so` files
  16 KB-aligned in the APK/AAB; Flutter's prebuilt `libflutter.so` is expected to be 16 KB-compatible for 3.50.1 but
  that is **unverified here**. Codemagic runs `zipalign -c -P 16 -v 4` on the release APK (when build-tools support `-P`);
  also confirm in Play Console (App bundle explorer, "16 KB" column) for the first upload. Plugin `.so` files (e.g.
  ML/audio plugins added later) must be rebuilt with NDK r28+ or be 16 KB-aligned.
- `buildFeatures.resValues = true` (AGP 9 default is off).

`AndroidManifest.xml`: label `Anacan`, `android:allowBackup="true"` and `android:supportsRtl="true"` (copied from
Capacitor), `INTERNET` permission in the main manifest (Flutter's template has it only in debug/profile). Compared for
in-place updates: neither manifest has `android:sharedUserId` (adding one would block the update), neither sets
`android:installLocation`, neither declares `fullBackupContent`/`dataExtractionRules`. Activity class name stays
`.MainActivity` in `com.atlasoon.anacan`, so pinned launcher shortcuts survive.

### Manifest parity backlog

Everything else in `android/app/src/main/AndroidManifest.xml` (Capacitor 53.0). Add each item **with the feature that
needs it**, keep names/ids identical, and compare the merged manifests of the last Capacitor AAB and the Flutter AAB
(`bundletool dump manifest`) before the first Play upload: plugin-merged permissions such as
`com.google.android.gms.permission.AD_ID`, `com.android.vending.BILLING`, `ACCESS_NETWORK_STATE` come from plugins, and
Play Console declarations (Advertising ID, Health Connect, foreground service, data safety) must keep matching.

| Manifest entry | Feature that needs it | Notes |
|---|---|---|
| `uses-permission INTERNET` | core | **done** |
| `POST_NOTIFICATIONS` | push (FCM) and local reminders | Android 13+ runtime prompt in onboarding |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE` | feeding/sleep timer lock-screen chronometer | with the service below |
| `WAKE_LOCK` | timers / notifications | |
| `RECEIVE_BOOT_COMPLETED` | local reminders rescheduled after reboot | |
| `VIBRATE` | notifications, haptics | |
| `DETECT_SCREEN_CAPTURE` | screenshot guard / privacy cover (Android 14+) | |
| `CAMERA` | profile photo, pregnancy album, stool scanner | |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | weather clothing tips, SOS location share | |
| `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` | cry analysis, voice notes, white noise | |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | saving images on old Android | consider `maxSdkVersion` |
| `health.WRITE_MENSTRUATION`, `WRITE_WEIGHT`, `WRITE_BLOOD_PRESSURE`, `WRITE_BLOOD_GLUCOSE`, `READ_STEPS`, `READ_EXERCISE` | Health Connect (Health screen, cycle/vitals copies) | must equal the Play Health Connect declaration |
| `tools:node="remove"` for `health.READ_ACTIVE_CALORIES_BURNED`, `READ_TOTAL_CALORIES_BURNED`, `READ_DISTANCE`, `READ_HEART_RATE`, `READ_EXERCISE_ROUTE` | Health Connect | needs `xmlns:tools`; keeps plugin-merged extras out |
| `<queries><package com.google.android.apps.healthdata/>` | Health Connect | |
| `<queries>` PROCESS_TEXT intent | Flutter text selection | **kept** (Flutter template) |
| meta-data `com.google.android.gms.ads.APPLICATION_ID` | AdMob | value `${anacanAdmobAppId}` (placeholder already defined) |
| meta-data `com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT=true` | AdMob | |
| meta-data `com.google.firebase.messaging.default_notification_channel_id=high_importance_channel` | push | keep channel id; also timer channel `anacan_timer_channel` (user channel settings persist across the update) |
| meta-data `com.facebook.sdk.ApplicationId`, `ClientToken` (strings `facebook_app_id`, `facebook_client_token`, `fb_login_protocol_scheme`), `AutoInitEnabled=true`, `AutoLogAppEventsEnabled=false`, `AdvertiserIDCollectionEnabled=false` | Meta SDK events (consent-gated) | |
| meta-data `firebase_analytics_collection_enabled=false`, `google_analytics_default_allow_analytics_storage`, `_ad_storage`, `_ad_user_data`, `_ad_personalization_signals` = false | Firebase Analytics consent (`src/lib/privacyConsent.ts`) | must ship with the first Firebase plugin |
| MainActivity `intent-filter` VIEW/DEFAULT/BROWSABLE, schemes `anacan` and `com.atlasoon.anacan` | deep links, OAuth redirects (Google/Apple sign-in), notification links | **done** (+ meta-data `flutter_deeplinking_enabled=false`: app_links delivers links, go_router must not) |
| MainActivity attributes: `launchMode="singleTask"` (Flutter template: `singleTop`), `windowOptOutEdgeToEdgeEnforcement="true"`, `configChanges` incl. `navigation` | deep-link / notification-tap routing, edge-to-edge | `singleTask` **done**, template `taskAffinity=""` removed (Capacitor used the default affinity); the edge-to-edge opt-out was a WebView workaround and is not copied; `navigation` not needed |
| MainActivity base class | purchases_ui_flutter (RevenueCat paywall / Customer Center) | **done**: `FlutterFragmentActivity`, Preferences channel registration kept |
| `activity .HealthPermissionsActivity` (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`) + `activity-alias ViewPermissionUsageActivity` (`VIEW_PERMISSION_USAGE`, category `HEALTH_PERMISSIONS`, permission `START_VIEW_PERMISSION_USAGE`) | Health Connect rationale (Play requirement) | strings `health_permissions_title/_rationale`, `privacy_policy_url` |
| `provider androidx.core.content.FileProvider` `${applicationId}.fileprovider`, `@xml/file_paths` | share/save images, camera capture | Flutter plugins (share_plus, image_picker) bring their own providers; add only if Anacan code needs it |
| `service .TimerForegroundService` (`foregroundServiceType="specialUse"`, property `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`) | timer lock-screen notification | same class name; Play FGS declaration text |
| `receiver .AnacanJourneyWidget`, `.AnacanCareWidget`, `.AnacanWordWidget` (`APPWIDGET_UPDATE`, `@xml/widget_journey_info`, `widget_care_info`, `widget_word_info`, labels `widget_*_name`) | home-screen widgets | **same class names in `com.atlasoon.anacan`**, or widgets placed by users disappear on update (`res/xml/timer_widget_info.xml` and `TimerWidgetProvider.kt` exist but are not declared) |
| `android:roundIcon @mipmap/ic_launcher_round`, theme `AppTheme`/`AppTheme.NoActionBarLaunch`, splash | icons/splash port | |
| `google-services.json` + `com.google.gms.google-services` Gradle plugin; string `default_web_client_id` | Firebase push, Google sign-in | file is committed under `android/app/` |

## iOS project (`app/ios`)

Flutter 3.50.1 project with Swift Package Manager (no Podfile). Edits made textually (no Xcode here):

- `Runner.xcodeproj/project.pbxproj`: project-level `IPHONEOS_DEPLOYMENT_TARGET` 15.0 -> **16.6** (Debug, Release,
  Profile; Capacitor app is 16.6); `TARGETED_DEVICE_FAMILY` "1,2" -> **1** (iPhone only, like Capacitor; shipping iPad
  support would add iPad screenshots/review); `DEVELOPMENT_TEAM = 8B6976J8H7` on the Runner target (Debug, Release,
  Profile). Bundle id `com.atlasoon.anacan` was already set. Signing style stays as generated; Codemagic's
  `xcode-project use-profiles` switches it to manual App Store profiles at build time.
- `Runner/Info.plist`: `CFBundleName` `Anacan` (display name already `Anacan`), iPhone orientations portrait only (as
  Capacitor), `ITSAppUsesNonExemptEncryption` false, `AnacanCustomerIo*` keys from build settings.
- `Flutter/Debug.xcconfig`, `Flutter/Release.xcconfig`: local defaults for `ANACAN_*` and `#include? "AnacanNative.xcconfig"`.
- `.gitignore`: `Flutter/AnacanNative.xcconfig`.

Version: `flutter build ipa --build-name=60.0 --build-number=60.0.N` (Flutter keeps dotted iOS build numbers).

### Info.plist / entitlements parity backlog

From `ios/App/App/Info.plist`, `App.entitlements`, the 25 `*.lproj/InfoPlist.strings` and the extension targets.

| Item | Feature | Plan |
|---|---|---|
| `CFBundleDevelopmentRegion` `az`, `CFBundleLocalizations` (az en tr ru de kk ar uz ka zh-Hans id fr es pt-PT vi hi ja ko pl nl sv ky et tk uk) | i18n (system strings, permission texts) | with the i18n core; needed before any permission text |
| Usage strings, base value Azerbaijani, **all 25 locales** in `InfoPlist.strings` (13 keys): `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSMicrophoneUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSFaceIDUsageDescription`, `NSContactsUsageDescription`, `NSCalendarsUsageDescription`, `NSMotionUsageDescription`, `NSBluetoothAlwaysUsageDescription`, `NSLocalNetworkUsageDescription`, `NSUserTrackingUsageDescription` | camera/album/scanner, mic, location/SOS, Face ID lock, partner invite, calendar, steps, Bluetooth, local network, ATT | copy each key and its 25 translations with its feature (`Runner/<lang>.lproj/InfoPlist.strings`, added to the Xcode project's variant group) |
| `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` (base Info.plist only, not localized) | HealthKit | with HealthKit |
| `UIBackgroundModes`: `remote-notification`, `audio`, `fetch` | push, white noise, background refresh | each with its feature |
| `NSSupportsLiveActivities` true, `NSSupportsLiveActivitiesFrequentUpdates` false | timer Live Activities | with the widget extension |
| `CFBundleURLTypes`: `anacan` + `com.atlasoon.anacan` (name `com.atlasoon.anacan`), `fb927014948766655`, `com.googleusercontent.apps.296566533432-m57putge5tnil0t0kgh5sdqnp9r0oatc` | deep links/OAuth, Facebook, Google sign-in | **done** for `anacan`/`com.atlasoon.anacan` and Google (`$(ANACAN_GOOGLE_REVERSED_CLIENT_ID)`), plus `GIDClientID`/`GIDServerClientID` and `FlutterDeepLinkingEnabled=false`; `fb…` waits for the Meta SDK feature |
| `GADApplicationIdentifier` (= `$(ANACAN_ADMOB_APP_ID)`), `GADDelayAppMeasurementInit` true, `SKAdNetworkItems` (`cstr6suwn9.skadnetwork`) | AdMob | build setting already provided |
| `FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName`, `FacebookAutoLogAppEventsEnabled` false, `FacebookAdvertiserIDCollectionEnabled` true | Meta SDK | |
| `FIREBASE_ANALYTICS_COLLECTION_ENABLED` false, `GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE` / `_AD_STORAGE` / `_AD_USER_DATA` / `_AD_PERSONALIZATION_SIGNALS` false | Firebase consent | with the first Firebase plugin; `GoogleService-Info.plist` (committed in `ios/App/App/`) too |
| TikTok (Android too) | TikTok events | no Info.plist/manifest key: `scripts/native/tiktok-native-config.mjs` stages `TIKTOK_IOS_*` / `TIKTOK_ANDROID_*` (app id, TikTok app id, app secret) into the generated `capacitor.config.json` after `cap sync`; they are not in `anacan_native` per `docs/CODEMAGIC.md`, so Codemagic Capacitor builds report `not_configured`. With the feature: treat the secret like the Customer.io key (native-only via `apply_native_config.mjs`, never a Dart define) |
| `LSApplicationQueriesSchemes`: `itms-apps`, `mailto`, `tel`, `https`, `http`, `fbapi`, `fb-messenger-share-api`, `fbauth2`, `fbshareextension` | url_launcher checks, Facebook | |
| `NSAppTransportSecurity` (`NSAllowsArbitraryLoads` false, `NSAllowsArbitraryLoadsInWebContent` true) | WebView content | only if a WebView feature is kept |
| `UIViewControllerBasedStatusBarAppearance` true, `UIStatusBarStyle` default, `UIViewEdgeAntialiasing`/`UIViewGroupOpacity` false, `UIFileSharingEnabled`/`LSSupportsOpeningDocumentsInPlace` false | shell | review with the shell; `UIRequiredDeviceCapabilities armv7` and `CAPACITOR_DEBUG` are dropped (arm64 only) |
| `PrivacyInfo.xcprivacy` (required-reason APIs: UserDefaults, FileTimestamp, SystemBootTime, DiskSpace; collected data types) | App Store privacy manifest | copy to `Runner/` and add to the target before the first TestFlight upload; update as SDKs arrive |
| Entitlement `aps-environment` (`production`; Debug `development`) | push | add `Runner/Runner.entitlements` + `CODE_SIGN_ENTITLEMENTS` in Xcode |
| `com.apple.developer.applesignin` [`Default`] | Sign in with Apple | |
| `com.apple.developer.healthkit` true, `.healthkit.access` [], `.healthkit.recalibrate-estimates` true | HealthKit | |
| `com.apple.security.application-groups` [`group.com.atlasoon.anacan`] | widgets / Live Activities shared data | same group, same UserDefaults suite and keys, so widgets keep data after the update |
| Target **AnacanTimerWidgetExt** (Capacitor target `AnacanTimerWidgetExtExtension`, bundle `com.atlasoon.anacan.AnacanTimerWidgetExt`, WidgetKit + Live Activity, App Group, 25 `Localizable.strings`) | home widgets, timer Live Activity | add in Xcode on a Mac with the same bundle id and widget `kind` strings (placed widgets survive), then append `com.atlasoon.anacan.AnacanTimerWidgetExt=<target>` to `IOS_SIGNED_TARGETS` |
| Target **AnacanNotificationService** (bundle `com.atlasoon.anacan.AnacanNotificationService`, iOS 16.6, FCM image attachments) | push images | same; append `com.atlasoon.anacan.AnacanNotificationService=<target>` |

The App IDs already carry Push, HealthKit, Sign in with Apple and the App Group, so the App Store profiles fetched by
Codemagic include them; the 60.0 Runner simply does not request them until the entitlements file exists.

## First Codemagic run: what must be confirmed

Nothing here was built: this environment has no Android SDK, no Xcode and no device. Only YAML parsing and the Node
scripts (with fake values, success and failure paths) were run.

- Codemagic accepts `flutter: 3.50.1` and the version check passes; `npm ci` + generator `--check` pass on macOS.
- Android: Gradle sync of the edited `build.gradle.kts` (AGP 9.3.1 with `resValues`, `resValue`, placeholders), R8 and
  resource shrinking succeed; signer SHA-256 equals the Play upload certificate of the Capacitor builds; `zipalign -P 16`
  passes; Play accepts 6000 as an update of 53.0.x (internal testing track first), and an installed 53.0 updates in place.
- iOS: `flutter build ios --config-only` then `xcode-project use-profiles` applies the App Store profile to Runner;
  `flutter build ipa` with `$HOME/export_options.plist` exports; App Store Connect accepts 60.0 build `60.0.0`;
  TestFlight install over the 53.0 build keeps the app container (storage compatibility is checked separately).
- `apply_native_config.mjs verify` finds Dart output in both builds and reports no write key.
