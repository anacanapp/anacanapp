# Security feature (`registerSecurityFeature`)

| React | Dart |
|---|---|
| lib/appLock.ts, lib/lock-offer.ts | app_lock.dart (AppLock on LocalStore, `hashPin`, biometric interface) |
| components/security/PinPad.tsx | pin_pad.dart |
| AppLockScreen.tsx + AppLockGate.tsx | app_lock_screen.dart |
| AppLockSetupSheet.tsx | app_lock_setup_sheet.dart (`showAppLockSetupSheet`) |
| LockOfferSheet.tsx | lock_offer_sheet.dart (+ `LockOfferHost` frame overlay in register.dart) |
| ScreenCaptureGuard.tsx (+ plugins/ScreenshotGuard) | screen_capture_guard.dart |

PIN scheme (byte-compatible): `anacan_lock_hash` = hex(SHA-256(UTF-8 "<salt>:<pin>:anacan")), salt = 16 random bytes hex;
keys `anacan_lock_enabled|_hash|_salt|_bio|_last_bg`; re-lock after > 30 000 ms in the background
(AppLifecycleListener hide/show). Test `a hash produced by the TypeScript implementation verifies in Dart` uses a
Node-generated hash.

## Wiring
- App root must mount `AppLockGate()` above the navigator (App.tsx) and wrap the app in `ScreenCaptureGuard(child: …)`.
- `biometricAuthProvider` (local_auth; Android prompt title not passed — needs local_auth_android messages),
  `screenshotGuardPlatformProvider` (native plugin), `dashboardCaptureAllowedProvider` (shell/home: true only on the
  visible main dashboard without dialogs), `onboardingTourActiveProvider`, `isNativePlatformProvider`,
  `appLockForgotActionProvider` (web reloads after sign-out).
