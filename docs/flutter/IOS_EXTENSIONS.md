# iOS extension targets for the Flutter Runner (pending)

The Flutter iOS project (`app/ios`) has only the **Runner** target. The Capacitor app (`ios/App`) also shipped two
extensions. They are **not** added yet (the owner is stabilising the Runner build); this page is the exact recipe.
Sources are staged, byte-identical to the Capacitor ones, in `app/ios/extensions_pending/` (not referenced by the Xcode
project, so they do not affect the build).

What the Runner already does (Swift in `app/ios/Runner/`, compiled since 2026-11-28):

| Runner file | Role for the extensions |
|---|---|
| `HomeWidgetsChannel.swift` | writes the widget snapshot to App Group `group.com.atlasoon.anacan`, key `anacan.widget.snapshot.v1` (the key `AnacanHomeWidgets.swift` `HWSnapshot.load()` reads) and reloads kinds `AnacanJourneyWidget`, `AnacanCareWidget`, `AnacanWordWidget` |
| `LiveActivityChannel.swift` + `AnacanTimerAttributes.swift` | ActivityKit start / end; reads pending stops from the App Group key `anacan-pending-timer-stops`. **Refuses to start while Info.plist lacks `NSSupportsLiveActivities`** (Dart then shows its ongoing-notification fallback) |
| `Runner.entitlements` / `Runner.Debug.entitlements` | already carry the App Group `group.com.atlasoon.anacan` |

## 1. Widget + Live Activity extension: `AnacanTimerWidgetExt`

Identity must equal the Capacitor target so placed widgets and the App Store record survive:

| Setting | Value |
|---|---|
| Xcode template | Widget Extension (uncheck "Include Configuration App Intent"; Live Activity checkbox off, the sources bring it) |
| Product name / target name | `AnacanTimerWidgetExt` |
| Bundle id | `com.atlasoon.anacan.AnacanTimerWidgetExt` |
| Team | `8B6976J8H7` |
| Deployment target | iOS 16.6 |
| Swift | 5.0 |
| Entitlements | `CODE_SIGN_ENTITLEMENTS = AnacanTimerWidgetExt/AnacanTimerWidgetExt.entitlements` (copy of `extensions_pending/AnacanTimerWidgetExt.entitlements`: App Group `group.com.atlasoon.anacan`) |
| Info.plist | `extensions_pending/AnacanTimerWidgetExt/Info.plist` (`NSExtensionPointIdentifier` = `com.apple.widgetkit-extension`), plus `CFBundleDisplayName` `AnacanTimerWidgetExt` |
| Versions | `MARKETING_VERSION = $(FLUTTER_BUILD_NAME)`, `CURRENT_PROJECT_VERSION = $(FLUTTER_BUILD_NUMBER)` and the target's build configurations based on `Flutter/Debug.xcconfig` / `Flutter/Release.xcconfig` (an extension version different from the app's is rejected by App Store Connect; Capacitor hard-coded `24.0`) |
| Embed | Runner → Build Phases → "Embed Foundation Extensions" (Xcode adds it); Runner target dependency on the extension. Put the embed phase **before** "Thin Binary" (Flutter's known "Cycle inside Runner" error otherwise) |

Files (drag from `app/ios/extensions_pending/AnacanTimerWidgetExt/` into a new group `AnacanTimerWidgetExt` next to
`Runner`, then delete the template's Swift files):

| File | Target membership |
|---|---|
| `AnacanTimerWidgetBundle.swift` (`@main`), `AnacanHomeWidgets.swift`, `AnacanTimerWidgetLiveActivity.swift` | AnacanTimerWidgetExt |
| `AnacanTimerStopIntent.swift` | **AnacanTimerWidgetExt and Runner** (a `LiveActivityIntent` runs in the app process when the app is alive; Capacitor had it in both targets) |
| `app/ios/Runner/AnacanTimerAttributes.swift` (already in Runner) | **add AnacanTimerWidgetExt** as a second target (one file, same type name in both, or ActivityKit cannot decode the activity) |
| `Assets.xcassets` (AccentColor, WidgetBackground, AppIcon) | AnacanTimerWidgetExt |
| `<lang>.lproj/Localizable.strings` × 25 (az en tr ru de kk ar uz ka zh-Hans id fr es pt-PT vi hi ja ko pl nl sv ky et tk uk) | AnacanTimerWidgetExt, as one variant group `Localizable.strings` |

`AnacanWidgetsPlugin.swift` and `AnacanTimerAttributes.swift` of the Capacitor folder are intentionally **not** in
`extensions_pending` (the first is replaced by `HomeWidgetsChannel.swift`, the second already lives in Runner).

Runner `Info.plist` once the extension is in (targeted edit; the other keys are owned elsewhere):

```xml
<key>NSSupportsLiveActivities</key>
<true/>
<key>NSSupportsLiveActivitiesFrequentUpdates</key>
<false/>
```

Codemagic: append `com.atlasoon.anacan.AnacanTimerWidgetExt=AnacanTimerWidgetExt` to `IOS_SIGNED_TARGETS` (see
`docs/CODEMAGIC.md`); the App ID already exists with the App Group capability, so its App Store profile is fetched
like Capacitor's.

## 2. Push image extension: `AnacanNotificationService`

| Setting | Value |
|---|---|
| Xcode template | Notification Service Extension |
| Target / product | `AnacanNotificationService` |
| Bundle id | `com.atlasoon.anacan.AnacanNotificationService` |
| Team / deployment / Swift | `8B6976J8H7` / iOS 16.6 / 5.0 |
| Files | `extensions_pending/AnacanNotificationService/NotificationService.swift` (replaces the template's), `Info.plist` (`NSExtensionPrincipalClass` = `$(PRODUCT_MODULE_NAME).NotificationService`) |
| Entitlements | none (Capacitor had none); no Firebase dependency (the source only uses UserNotifications) |
| Versions / embed | as for the widget extension (`$(FLUTTER_BUILD_NAME)` / `$(FLUTTER_BUILD_NUMBER)`, embed before "Thin Binary") |

Codemagic: append `com.atlasoon.anacan.AnacanNotificationService=AnacanNotificationService` to `IOS_SIGNED_TARGETS`.
FCM payloads must keep `mutable-content: 1` and the image field the Capacitor extension reads (unchanged server side).

## 3. Later: SDK packages for the guarded Runner channels

`TikTokEventsChannel.swift`, `CustomerIoChannel.swift` (and `FbEventsChannel.swift`) compile today without their SDKs
(`#if canImport(TikTokBusinessSDK)`, `#if canImport(CioDataPipelines)`, `#if canImport(FBSDKCoreKit)`) and answer like
Capacitor's "not_configured" / no-plugin builds. Adding the SDKs (Swift packages on the Runner target: TikTok Business
SDK, Customer.io `CioDataPipelines`, Meta `FBSDKCoreKit` 18.0.0) is a separate later step, together with their native
configuration (TikTok ids/secret and the Customer.io write key only via `apply_native_config.mjs`, never Dart defines;
Meta `FacebookAppID` / `FacebookClientToken` / `FacebookDisplayName` in Info.plist). Not done now: the Runner build is
being stabilised.

## 4. Verify on a device (nothing here was built)

- Widgets placed with the Capacitor 53.0 build still exist after installing the Flutter build with the extension and
  show the snapshot the Flutter app writes (Journey, Care locked / Premium, Word).
- Start a feeding timer: Lock Screen + Dynamic Island Live Activity; the stop button (iOS 17+) ends it and the stop is
  saved to baby_logs on the next app resume (pending-stops key in the App Group).
- A push with an image shows the attachment.
- App Store Connect accepts the build (extension versions equal to the app's).
