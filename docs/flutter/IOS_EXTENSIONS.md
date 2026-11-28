# iOS extension targets of the Flutter Runner

Since 2026-11-28 `app/ios/Runner.xcodeproj` has the two extensions the Capacitor app (`ios/App`) shipped, with the same
bundle ids, so placed widgets, the Live Activity and push images survive the 53.0 → 60.0 update. Nothing here was built:
there is no Xcode in the porting environment (see "What only Codemagic / a device can verify").

## How the project is kept in sync

Two layers, on purpose:

1. **Committed `project.pbxproj`** (hand-edited, deterministic ids `sha1("anacan-ios-ext:<key>")[0..24]`): opening the
   project in Xcode or building locally needs no script.
2. **`app/tool/ios/add_extensions.rb`** (Ruby, `xcodeproj` gem >= 1.27), run by `ios-flutter-store` before
   `flutter build ios --config-only`. Idempotent: it finds the targets/files by name and path, writes only what is
   missing or different, saves only when something changed (new ids come from a fixed SHA-1 sequence). On the
   committed project it is a no-op for the extensions; its real job on Codemagic is
   - every `.swift` file under `app/ios/Runner/` (subfolders become groups) in Runner's Sources phase, so a Swift file
     added without an Xcode edit still compiles;
   - the remote Swift packages listed in `app/ios/spm_packages.json` (below).
   `ruby app/tool/ios/add_extensions.rb --check` lists what it would change and exits 1 (use it on a Mac).

   Then `node app/tool/ios/check_pbxproj.mjs` (read-only) parses the project and fails on unbalanced braces, duplicate
   keys/ids, any referenced id that is not defined, a missing extension target / bundle id / configuration / source,
   the embed phase after "Thin Binary", a file reference missing on disk, or a Runner Swift file outside Sources.
   Self-test: `node --test app/tool/ios/check_pbxproj.test.mjs`. Run the check after any manual pbxproj edit.

Why both: hand-editing alone cannot pick up Swift files and packages other changes add later, and a script alone would
leave the committed project without the targets (Xcode on a Mac, `flutter run`). The script is written to produce the
same structure as the committed edit, so on Codemagic it should print "in sync" for the extensions.

### `app/ios/spm_packages.json`

```json
{ "packages": [
  { "url": "https://github.com/tiktok/tiktok-business-ios-sdk.git", "requirement": "exact:1.7.2",
    "products": ["TikTokBusinessSDK"] },
  { "url": "https://github.com/customerio/customerio-ios.git", "requirement": "exact:4.9.0",
    "products": ["DataPipelines"], "target": "Runner" }
] }
```

`requirement`: `"1.2.3"` / `"exact:1.2.3"`, `"from:1.2.3"` (= `upToNextMajor:`), `"upToNextMinor:1.2.3"`,
`"branch:main"`, `"revision:<sha>"`, or Xcode's own object (`{"kind": "upToNextMajorVersion", "minimumVersion": "18.0.0"}`).
`target` defaults to `Runner`. Entries are only added or updated, never removed (remove a package by hand). The example
above is only the format; the SDK agent owns the real entries (the file ships with `"packages": []`).

## 1. Widget + Live Activity extension

| Setting | Value (= Capacitor `AnacanTimerWidgetExtExtension`) |
|---|---|
| Target / product / module | `AnacanTimerWidgetExtExtension` (`AnacanTimerWidgetExtExtension.appex`), app-extension |
| Bundle id / team | `com.atlasoon.anacan.AnacanTimerWidgetExt` / `8B6976J8H7` |
| Deployment / Swift / family | iOS 16.6 / 5.0 / iPhone (`TARGETED_DEVICE_FAMILY = 1`) |
| Configurations | Debug, Release, Profile, each based on `Flutter/Generated.xcconfig` |
| Versions | `MARKETING_VERSION = $(FLUTTER_BUILD_NAME)`, `CURRENT_PROJECT_VERSION = $(FLUTTER_BUILD_NUMBER)` (equal to the app's; Capacitor hard-coded 24) |
| Info.plist | `GENERATE_INFOPLIST_FILE = YES` + `AnacanTimerWidgetExt/Info.plist` (`NSExtensionPointIdentifier` `com.apple.widgetkit-extension`), `CFBundleDisplayName` `AnacanTimerWidgetExt` |
| Entitlements | `AnacanTimerWidgetExt/AnacanTimerWidgetExtExtension.entitlements`: App Group `group.com.atlasoon.anacan` |
| Other settings | as Capacitor: accent/widget-background colour names, `SWIFT_EMIT_LOC_STRINGS`, `SWIFT_APPROACHABLE_CONCURRENCY`, `SWIFT_UPCOMING_FEATURE_MEMBER_IMPORT_VISIBILITY`, `SKIP_INSTALL`, runpaths `@executable_path/../../Frameworks` |

Files (`app/ios/AnacanTimerWidgetExt/`, byte-identical to `ios/App/AnacanTimerWidgetExt/`, moved from the former
`app/ios/extensions_pending/`):

| File | Target membership |
|---|---|
| `AnacanTimerWidgetBundle.swift` (`@main`), `AnacanHomeWidgets.swift`, `AnacanTimerWidgetLiveActivity.swift` | extension |
| `AnacanTimerStopIntent.swift` | extension **and Runner** (a `LiveActivityIntent` runs in the app process when the app is alive; as in Capacitor) |
| `app/ios/Runner/AnacanTimerAttributes.swift` | Runner **and extension** (one type, or ActivityKit cannot decode the activity) |
| `Assets.xcassets`, `Localizable.strings` (variant group, 25 languages) | extension resources |
| `Info.plist`, `AnacanTimerWidgetExtExtension.entitlements` | none (build settings) |

`AnacanWidgetsPlugin.swift` (replaced by `HomeWidgetsChannel.swift`) and the Capacitor copy of
`AnacanTimerAttributes.swift` are not used. WidgetKit/SwiftUI are linked by Swift auto-linking (Capacitor's explicit
framework entries were not copied).

Runner side: `HomeWidgetsChannel.swift` writes the snapshot to the App Group key `anacan.widget.snapshot.v1` and reloads
kinds `AnacanJourneyWidget`, `AnacanCareWidget`, `AnacanWordWidget`; `LiveActivityChannel.swift` starts/ends the
activity and reads pending stops (`anacan-pending-timer-stops`). `Runner/Info.plist` now has
`NSSupportsLiveActivities` true and `NSSupportsLiveActivitiesFrequentUpdates` false (as Capacitor), so the channel's
"not configured" guard passes and Dart's ongoing-notification fallback is used only when the person disabled Live
Activities (or the start fails).

## 2. Push image extension

| Setting | Value (= Capacitor `AnacanNotificationService`) |
|---|---|
| Target / product | `AnacanNotificationService` (`.appex`), app-extension |
| Bundle id / team / deployment / Swift | `com.atlasoon.anacan.AnacanNotificationService` / `8B6976J8H7` / iOS 16.6 / 5.0 |
| Files | `app/ios/AnacanNotificationService/NotificationService.swift`, `Info.plist` (`NSExtensionPrincipalClass` = `$(PRODUCT_MODULE_NAME).NotificationService`) |
| Entitlements | none (as Capacitor); no Firebase dependency |
| Configurations / versions | as the widget extension |

FCM payloads keep `mutable-content: 1` and the image field the extension reads (server unchanged).

## 3. Runner wiring

- Build phase **Embed Foundation Extensions** (`dstSubfolderSpec = 13`, both `.appex`, `RemoveHeadersOnCopy`), placed
  after "Embed Frameworks" and **before "Thin Binary"** (Flutter's "Cycle inside Runner" error otherwise).
- Target dependencies Runner → both extensions (the shared scheme builds implicit dependencies too).

## 4. Signing (Codemagic `ios-flutter-store`)

`IOS_SIGNED_TARGETS` = `com.atlasoon.anacan=Runner com.atlasoon.anacan.AnacanTimerWidgetExt=AnacanTimerWidgetExtExtension
com.atlasoon.anacan.AnacanNotificationService=AnacanNotificationService`. As in `ios-store`, the step first runs
`app-store-connect bundle-ids create com.atlasoon.anacan.AnacanNotificationService … || true`, then
`fetch-signing-files <bundle id> --type IOS_APP_STORE --create` per pair, `xcode-project use-profiles` (applies the
profiles and writes `$HOME/export_options.plist` for all three), and fails early if any listed target got no profile.

Apple Developer prerequisites (already true for the Capacitor builds; verify only if signing fails):
- App ID `com.atlasoon.anacan.AnacanTimerWidgetExt` exists with the **App Groups** capability and
  `group.com.atlasoon.anacan` assigned (otherwise the App Store profile lacks the group and the widget shows no data).
- App ID `com.atlasoon.anacan.AnacanNotificationService` exists (the workflow creates it if missing; no capability needed).
- App ID `com.atlasoon.anacan` keeps App Groups (+ Push, HealthKit, Sign in with Apple).

## 5. What only Codemagic / a device can verify

- `add_extensions.rb` loads the project with the gem on Codemagic and prints "in sync" (or only Swift-file/package
  additions); `check_pbxproj.mjs` passes after it.
- `xcodebuild -showBuildSettings` reads the project; each of the three targets gets its App Store profile.
- The extensions compile with Xcode `latest` (sources are the Capacitor ones; Runner now also compiles
  `AnacanTimerStopIntent.swift`) and `flutter build ipa` archives/exports without the "Cycle inside Runner" error.
- App Store Connect accepts the build (extension versions equal to the app's: `60.0` / `60.0.N`).
- Device: widgets placed with the Capacitor 53.0 build still exist after the update and show the Flutter snapshot
  (Journey, Care locked / Premium, Word); a feeding timer shows the Lock Screen + Dynamic Island activity, the stop
  button (iOS 17+) ends it and the stop is saved on the next resume; a push with an image shows the attachment.
