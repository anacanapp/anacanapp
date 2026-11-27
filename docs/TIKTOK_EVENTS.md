# TikTok Business SDK (App Events), 2026-11-25

Owner request: integrate the TikTok Business SDK on iOS and Android so TikTok Ads can attribute installs and
optimize for registrations and subscriptions.

## Pieces
- Native plugin: `packages/tiktok-events` (`@anacan/tiktok-events`, `file:` dependency like `customerio-data-in`).
  - iOS: SPM package `tiktok-business-ios-sdk` 1.7.2, plugin `TikTokEventsPlugin.swift`. Added to
    `ios/App/CapApp-SPM/Package.swift` (only the TikTok lines; release candidates regenerate it with `cap sync`).
  - Android: `tiktok-business-android-sdk` 1.7.1 from JitPack (root `android/build.gradle` has the JitPack repo
    restricted to `com.github.tiktok`), lifecycle-process, installreferrer; keep rules in the plugin and in
    `android/app/proguard-rules.pro` (release is minified).
- JS: `src/lib/tiktok-events.ts` (event map, consent, identity), `src/components/TikTokSession.tsx` (external id),
  hooks in `src/lib/analytics.ts` (every `logEvent`) and `src/lib/privacyConsent.ts` (consent changes).

## Credentials (private)
- Values: `.env.tiktok.local` (ignored by Git): `TIKTOK_IOS_APP_ID` (App Store id 6758301924),
  `TIKTOK_IOS_TT_APP_ID`, `TIKTOK_IOS_APP_SECRET`, `TIKTOK_ANDROID_APP_ID` (com.atlasoon.anacan),
  `TIKTOK_ANDROID_TT_APP_ID`, `TIKTOK_ANDROID_APP_SECRET`. CI can provide the same variables instead.
- `scripts/native/tiktok-native-config.mjs` runs after every `cap copy` / `cap sync` (package.json
  `capacitor:copy:after`) and writes them into the generated, ignored `ios/App/App/capacitor.config.json` and
  `android/app/src/main/assets/capacitor.config.json` as `plugins.TikTokEvents`. Missing values remove the block and
  the plugin answers `not_configured` (no TikTok traffic). The script never prints the values.
- The App Secret ships inside the app binary, as TikTok's mobile SDK requires; it is kept out of Git, the web
  bundle, bridge arguments and logs.

## Behaviour
- Consent: nothing happens without attribution consent (Məxfilik → Razılıq). Only then `start` initializes the SDK
  (which also enables TikTok's automatic install / launch / retention events). Revoking consent calls logout and
  stops tracking (iOS `setTrackingEnabled(false)`, Android `destroy`); next launches never initialize it.
- iOS ATT: asked once by the app (`facebook-events.ts`), never by the TikTok SDK. With ATT not authorized the SDK
  reads no IDFA and attribution relies on SKAdNetwork. iOS automatic StoreKit purchase tracking stays on (default).
- Events (internal → TikTok): sign_up → Registration, login → Login, premium_trial_started → StartTrial,
  premium_subscribed → Subscribe (value, currency, plan), premium_paywall_clicked → AddPaymentInfo,
  books_checkout_started → Checkout, books_purchase_confirmed → Purchase, book_added_to_cart → AddToCart,
  book_viewed → ViewContent, name_searched → Search (no query text). The generic `purchase` event is not mapped
  (it is fired together with premium_subscribed). Health records are never sent.
- Identity: the Anacan account id (pseudonymous) via `identify`, only with consent; no email or phone. Sign-out →
  `logout`.

## Open items
- TikTok's SKAdNetwork identifiers are not yet in `Info.plist` (`SKAdNetworkItems`); add the IDs TikTok Events
  Manager / TikTok Ads lists for the app before relying on SKAN attribution.
- A native build is needed for the SDK to ship (next common native version per `AGENTS.md`). Verify in TikTok
  Events Manager → Test Events (debug: call `start({ tracking, debug: true })` from a dev build).
