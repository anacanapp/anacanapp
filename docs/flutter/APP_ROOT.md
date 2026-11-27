# Flutter app root: entry, startup, providers, chrome

Port of `src/main.tsx`, `src/bootstrap-app.tsx`, `src/App.tsx` (native consumer entry) and the startup UI
(`SplashScreen`, `StartupScreen`, `ForceUpdateScreen`, `components/appUpdate/**`, `RootErrorBoundary`,
`ErrorBoundary`, `OfflineSyncIndicator`, the `index.html` bootstrap splash and the admission error screen of
`main.tsx`). Code: `app/lib/main.dart`, `app/lib/app/`, `app/lib/features/startup/`.
Tests: `app/test/app/`, `app/test/features/startup/`, `app/test/widget_test.dart`.

| File | What |
|---|---|
| `app/app_main.dart` | `runAnacanApp()`: error zone, `FlutterError.onError` / `PlatformDispatcher.onError` → crash reporter, release `ErrorWidget.builder`, edge-to-edge, `runApp` |
| `app/anacan_app.dart` | `AnacanApp`: owns the `ProviderContainer`, runs `runAppStartup`, switches on `StartupResult`, restart (= `location.reload()`), admission watcher, lifecycle hooks |
| `app/routed_app.dart` | `RoutedApp` (`MaterialApp.router` + `buildShellRouter()`), `AppChrome` (text scale, `dir`, status bar, `AToastHost`, offline pill) |
| `app/app_overrides.dart` | `appRootOverrides()`, `createAppContainer()` |
| `app/feature_registrations.dart` | `registerAllFeatures(r)` with alphabetical slots; `buildFeatureRegistry()` |
| `app/theme_mode.dart` | `themeModeProvider` (next-themes key `theme`) |
| `app/device_tier.dart` | `deviceTierProvider` (lite / noBlur), `DeviceInfoHardwareProbe` |
| `app/localization.dart` | 25 supported locales, `kAppLocalizationsDelegates` (+ fallback delegates) |
| `app/system_chrome.dart` | `WebViewTextScale`, `ThemeStatusBarSync`, `configureSystemChrome()` |
| `app/crash_reporter.dart` | `CrashReporter` / `DefaultCrashReporter` / `SupabaseCrashReportSink`, `CrashReporting.report*` |
| `app/startup_language.dart` | `storedStartupLanguage()`, `LegacyLanguagePreferenceStore` (i18n ↔ Capacitor Preferences) |
| `features/startup/` | `StartupScreen`/`SplashScreen`, `AdmissionScreen`, `RootErrorFallback`, `ErrorBoundaryFallback`, `ForceUpdateScreen` + `ForceUpdateGate`, `AppUpdateSheet`/`AppUpdateSheetHost`/`AppUpdateBanner`/`AppUpdateBannerSlot`, update-centre providers, `OfflineSyncIndicator`, `ASky`, `registerStartupFeature` |
| `app/tool/app/gen_startup_copy.mjs` | generates `features/startup/generated/app_update_copy.g.dart` from `src/lib/appUpdate-i18n.ts`; `--check` also verifies `core/i18n/generated/startup_copy.g.dart` against `src/lib/startup-i18n.ts` |

## 1. Startup timeline

```
native launch screen (cream #FAF7F4 + coral mark; Android 12+ system splash / LaunchTheme, iOS LaunchScreen)
└─ main(): runZonedGuarded
   ├─ WidgetsFlutterBinding.ensureInitialized, error hooks (reports dropped until a reporter is installed)
   ├─ configureSystemChrome() (edge-to-edge, transparent bars, dark icons) — not awaited
   └─ runApp(AnacanApp)  ── FIRST FRAME: StartupScreen in BootstrapFrame (no providers, no i18n)
AnacanApp._boot()
   ├─ createAppContainer()  (appRootOverrides)
   ├─ prepareAppContainer: I18nRuntime.preferences = Capacitor Preferences adapter;
   │                       ContentTranslations.instance = create() (support dir)                  [sequential, ms]
   ├─ deviceTier.probe()  ───────────────────────────────────────────────────────┐ parallel
   └─ runAppStartup(container)  (core/app_bootstrap.dart)                         │
        ┌ LocalStore.load ─┬─ language: Preferences (≤3 s) → ensureLanguageReady ─┐
        └ backend: admission (4 s probe) → SDK → session restore (8 s / 15 s) ───┤   failure → result
        → legacy import → stores hydrate → query cache restore + bindQueryClientLifecycle
        → await language → wireRuntime (LS `language`, DB overlay)               │
   await both ◄──────────────────────────────────────────────────────────────────┘
   ├─ StartupUpdateRequired            → AdmissionScreen(updateRequired)
   ├─ StartupMaintenance / StartupRetry → AdmissionScreen(connectionPending)   (language: storedStartupLanguage)
   └─ StartupOpened (Ready / SignedOut / NeedsLanguage)
        ├─ crash reporter installed (crash_reports via the admitted client)
        ├─ hooks: lifecycle pause/hide → LocalStore.flush + translation persists; connectivity regained →
        │         content-pack retry + admission wake; app resume → admission wake; shard arrivals →
        │         invalidate queries keyed by the language (300 ms)
        ├─ BackendClient.watchAdmission(restart, wakes)   (60 s ticks + wakes)
        └─ UncontrolledProviderScope → RoutedApp → GateHost: splash gate 350 ms (StartupScreen again) → gates → shell
restart() (retry button, admission change, root crash fallback): stop hooks → drop reporter → LocalStore.flush →
   BackendClient.restart() → dispose container after the frame → GateHost.brandSplashShown = false → _boot()
```

The same `StartupScreen` is shown by the bootstrap frame, the 350 ms splash gate and the auth-loading gate, so the
hand-off native splash → Flutter has one look. Query-cache focus/online wiring is done inside the core startup
(`bindQueryClientLifecycle`, `AppLifecycleListener` resume = window focus, connectivity_plus = `online`).

## 2. Provider overrides (`appRootOverrides`)

| Provider | Value |
|---|---|
| `shellStateOverrides()` (state/shell_bindings.dart) | `shellUserProvider`, `gateInputsProvider`, `gateActionsProvider`, unread counters 0, nav style classic |
| `featureRegistryProvider` | `buildFeatureRegistry()` |
| `liteModeProvider` (design) | `deviceTierProvider.lite` (`html.a-lite`; also the MotionConfig equivalent, below) |
| `updateCentreForceProvider` | `updateCentreForceGateProvider` (`useAppUpdate().forceRequired && decision`) |
| `legacyForceUpdateProvider` | `legacyForceUpdateGateProvider` (`!loading && updateRequired && forceUpdate`) |
| `authSideEffectsProvider` | `AuthSideEffects(reportAuthError: CrashReporting.reportAuthError)` |
| `extra` | appended last (tests: fixtures instead of `shellStateOverrides`, `includeShellState: false`) |

Not overridden (defaults are real): `localStoreProvider` (file), `backendClientProvider`, `connectivitySourceProvider`
(connectivity_plus), `i18nRuntimeProvider` (`I18nRuntime.instance`), `deviceHardwareProbeProvider`
(device_info_plus), `shellPlatformProvider`. Tests override them (`test/app/app_test_support.dart`).

## 3. Registering a feature

A feature exports `void registerXFeature(FeatureRegistry r)` (SHELL.md §11 for the `register*` methods). To land it,
edit `app/lib/app/feature_registrations.dart`: uncomment its import and its call in the alphabetical slot (blog, chat,
commerce, community, entry, games, home, onboarding, partner, premium, profile, settings, startup, tools); add a new
line in order for anything else. Registering an id twice throws at startup. The startup feature registers
`GateId.splash`, `GateId.startup`, `GateId.forceUpdate` and the frame overlay `app-update-sheet`; the Home feature
should place `AppUpdateBannerSlot()` above the Dashboard (Index's `px-4 pt-2` banner).

## 4. Decisions

- **Text scale.** The WebView scaled text, not layout: iOS WKWebView ignores Dynamic Type for CSS px text →
  `TextScaler.noScaling`. Android Chromium WebView initialises `textZoom` from the system font scale (linear %);
  neither `MainActivity.java` nor Capacitor resets it, and `configChanges` lacks `fontScale`, so a change recreates
  the activity → `TextScaler.linear(platformDispatcher.textScaleFactor)` (not Android 14's non-linear curve). Bold
  text is forced off on both (the WebView did not follow it). The Chromium behaviour is from its source as
  remembered, not checked on a device.
- **Theme.** next-themes semantics: LocalStore key `theme`, values `light|dark|system`, missing → `system`, an unknown
  value → light palette (its class matches no CSS). `themeModeProvider` follows store changes (storage event).
  `themeAnimationDuration: Duration.zero` (the class swap is instant).
- **Locales.** `supportedLocales` = the 25 registry locales. flutter_localizations has tables for all except `tk`;
  `FallbackLocalizationsDelegate` loads `materialLocaleFor(code)` (tk → ru) and else en. Direction always comes from
  the language (`Directionality` in `AppChrome`), only `ar` is RTL. MaterialApp also appends its English defaults,
  so no locale can throw.
- **Device tier.** Cores = `Platform.numberOfProcessors`; RAM = device_info_plus `physicalRamSize`, bucketed like
  Chromium's `navigator.deviceMemory` — used on Android only, where `a-lite`/`a-noblur` are forced anyway. iOS has no
  `deviceMemory` in WKWebView, so only cores count there. Probe failure → unknown (not low-end).
- **MotionConfig.** `reducedMotion: 'always'` on lite = `AnacanTokens.lite` (from `buildAnacanTheme(lite:)`), which
  design widgets combine with `MediaQuery.disableAnimations` (`'user'`).
- **Status bar.** `ThemeStatusBarSync` = `AnnotatedRegion<SystemUiOverlayStyle>` from the resolved theme (dark →
  light icons); bars transparent, edge-to-edge (`contentInset: never`, `viewport-fit=cover`).
- **Crash reports.** Table `crash_reports`, same columns, caps, ignore list and 30 s dedupe. `user_id` from the SDK's
  current user (React awaited `getUser()`), `url` = `https://app.anacan.az/`, `user_agent` = `Anacan-Flutter/<v>
  (<os> <version>)`. Framework errors are `react_error_boundary`, zone/platform errors `uncaught_error`.
- **Copy before i18n.** Admission/retry copy = generated `kStartupCopy` via `startupText` (already produced by
  `app/tool/i18n/export.mjs`; `gen_startup_copy.mjs --check` verifies it); update-screen labels = generated
  `kAppUpdateCopy` via `updateText`. Everything else uses `tr` with the React keys.

## 5. Parity notes (record in PARITY_FIXES.md)

1. `index.html` ships `brand-mark-white.png` (120 px) but `startup.css` is linked after the inline style and repaints
   the bootstrap screen cream → a white-on-cream mark. HEADER_SPLASH_38.md says bootstrap, splash and loading share
   the 96 px mark: the bootstrap frame renders `StartupScreen`.
2. The startup progress bar keeps `translateX(+24px)` in RTL (it slides out of its clipped track, as in the WebView).
3. ErrorBoundary: Flutter replaces only the failing widget (`ErrorWidget.builder`, release builds). "Retry" rebuilds
   the tree (`reassembleApplication`); the chunk-load / offline branch is web-only. RootErrorBoundary's fallback is
   used above the provider scope, its retry restarts the app.
4. The soft update sheet is drawn in the navigator overlay (above the nav, like z-400); Android back pops nothing
   there (it is an overlay, not a route) and goes to the shell's handler, as in React.
5. Pre-i18n screens render in the light palette (no `html.dark` before React mounted).

## 6. Not verified (no device, no Xcode, no Android SDK)

- Native splash: `app/android/app/src/main/res/{drawable*/splash_icon.png, drawable*/launch_background.xml,
  values*/styles.xml, values/colors.xml}` and `app/ios/Runner/{Assets.xcassets/Splash.imageset,
  Base.lproj/LaunchScreen.storyboard}` were written and copied from the Capacitor project but never built or shown.
  Capacitor's second Android phase (the plugin's full-bleed `splash.png`, 2 s auto-hide / 180 ms fade) is not
  reproduced: Flutter's first frame (`StartupScreen`) follows the system splash directly.
- Status bar icon colours, edge-to-edge insets, text scaling on real font-size settings.
- Lifecycle hooks (pause flush, resume wakes, connectivity), the admission watcher restart, the device probe values
  (device_info_plus `physicalRamSize`), PackageInfo version, crash-report inserts against the live table.
- The update-centre RPCs (`get_app_update_v1`, `get_public_app_setting`) were not called; only parsing and UI tested.
- Not wired here: notification-tap listeners at boot (native plugins not ported), `appUrlOpen` / launch URL → shell,
  analytics `logScreenView`, RevenueCat / Facebook / privacy consent init, app lock, screen-capture guard.
