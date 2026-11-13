# Anacan 51.0 (Codemagic, iOS + Android)

Prepared 2026-11-13 on `main-630mc7`. iOS 50.0 is released on the App Store (50.0.1 most used), so the next
submission is a new version: `APP_VERSION` **51.0** in `codemagic.yaml`. iOS build numbers start at 51.0.0
(from TestFlight); Android `versionName` 51.0.`ANDROID_BUILD_SEQ`, `versionCode` 5100 + `ANDROID_BUILD_SEQ`.

**Deadline:** Recap 2026 opens on 10 December (Baku); the export fix below must be in the stores before that.

## Checks on this commit
- Full test suite: 301 files, 2 991 tests passed (2 skipped).
- Native web bundle (`VITE_NATIVE_BUILD=true vite build --mode google`): exit 0.
- Server-side changes in this period are already live and need no build.

## Start the builds
Codemagic → **Start new build** → branch `main-630mc7` → `ios-store`, then `android-store`.
Check in TestFlight / Play internal testing before release: sign-in, push, purchase/restore, HealthKit/Health
Connect, widget, Recap video export, Story-lər, Samsung A51 scrolling.

## What is new in the app code since 50.0
- Recap 2026: video export works on all phones (bitrate, chunked save, background abort, image fallback).
- Stories loaded from the server (admin "Story-lər").
- Android: no freeze on mid-range phones (Samsung A51): cache writes deferred, light mode, no blur, smaller blog cache.
- Tools: merged sections show tool names; code tools (Körpə izləyicisi, Yuxu təlimi, …) follow their rows.
- Update centre screens (force / soft / banner); native builds send their version (`X-Anacan-Version`).
- Community: Instagram-style comments sheet. Anacan AI is Premium with a paywall on entry.
- Uşaqla oyun in 23 languages; paywall shows store first-year offer prices.

## Store release notes
**AZ:** Recap 2026 videosu indi bütün telefonlarda rahat yadda saxlanır. Android-də tətbiq daha axıcı işləyir, donmalar
aradan qaldırıldı. Yeni Story-lər, yenilənmiş şərhlər bölməsi və "Uşaqla oyun" əlavə olundu.

**EN:** Your Recap 2026 video now saves smoothly on every phone. The app runs faster on Android with freezes fixed.
New Stories, a refreshed comments view and screen-free "Play together" games.
