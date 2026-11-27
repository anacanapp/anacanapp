# Entry flow (phase 2 gates)

`registerEntryFeature(r)` (entry_feature.dart) registers the gates `initialLanguage`, `intro`, `auth`, `blocked`,
`emailVerification`, `consent`, `country` and the route page `OuterRouteId.resetPassword`. The app root must also
apply `entryOverrides()`:

* `consentGateInputProvider` ← `consentGateInputFromStateProvider` (useConsentGate → shell gate order);
* `socialAuthProviderProvider` ← `NativeSocialAuthProvider()` (app/lib/native/social_auth).

Backend/auth seams live in `entry_services.dart` (`entryAuthActionsProvider`, `entryRpcProvider`,
`geoCountryFetcherProvider`, `emailVerificationApiProvider`, `profileCountryWriterProvider`, `authScreenConfigProvider`,
`loginLogoUrlProvider`, `consentPlatformProvider`); defaults use the AuthController and the Supabase client.

Generated data: `node app/tool/entry/export_entry.mjs` (`--check` verifies) copies `src/assets/brand-mark.png`, the
three `*-welcome.webp` companions and 239 flags (from `countries.json` base64) to `app/assets/images/entry/`, and writes
`data/*.g.dart` (countries, localized country names from Node ICU + `country-names-ky.json`, e-mail-verification ui
copy, promo copy, onboarding intro copy + stage names).

**pubspec**: declare `assets/images/entry/`, `assets/images/entry/flags/`, `assets/images/entry/onboarding/`
(subfolders are not covered by `assets/images/`). Tests read them from disk until then.

## React → Dart

| React | Dart |
|---|---|
| components/InitialLanguageScreen.tsx, lib/geoLanguage.ts (usage), app-languages `localizedCountryName` | language/initial_language_screen.dart, data/countries.g.dart, data/country_names.g.dart |
| components/AppIntroduction.tsx, onboarding/OnboardingFrame.tsx (frame+button), OnboardingCompanion.tsx (Family), lib/onboarding-i18n.ts (subset), lib/stage-names.ts | intro/app_introduction.dart, data/intro_copy.g.dart |
| components/AuthScreen.tsx, lib/promo.ts (subset), data/promo | auth/auth_screen.dart, auth/promo.dart, data/promo_copy.g.dart |
| pages/ResetPassword.tsx | auth/reset_password_page.dart |
| components/EmailVerificationScreen.tsx, data/email-verification | email/email_verification_screen.dart, data/email_verification_copy.g.dart |
| components/BlockedScreen.tsx | blocked/blocked_screen.dart |
| components/CountryGate.tsx, CountrySelect.tsx | country/country_gate.dart, country/country_select.dart |
| lib/consentGate.ts, lib/consent-copy.ts, hooks/useConsentGate.ts | consent/consent_gate.dart, consent/consent_copy.dart, consent/consent_gate_controller.dart |
| components/consent/ConsentGateScreen.tsx, consentSaveFeedback.tsx | consent/consent_gate_screen.dart |
| styles/anacan-design.css `.a-sky/.a-cloud/.a-icon-btn`, framer initial/animate/exit | widgets/entry_widgets.dart (`EntrySky`, `EntryIconButton`, `EntryField`, `MotionIn`, `PresenceSwitcher`) |
| lib/native-auth.ts (plugin side), social-auth-errors.ts (error shapes) | ../../native/social_auth/native_social_auth.dart |

Not ported here: `LanguageSelector.tsx` (Profile/Settings use it), `components/privacy/**` (PrivacyConsentSheet shows
only to signed-in users, not before auth), `AiConsentGate.tsx` (the logic `decideAiConsent`/`setAiConsent` is in
consent_gate.dart for the AI feature), LegalScreen (settings feature; the consent gate renders `registry.screen(ScreenId.legal)`).

## Behaviour differences (natively unavoidable)

* InitialLanguageScreen: no page reload after choosing a non-az language (widgets rebuild from the language providers).
  `Intl.Locale().maximize()` is replaced by a CLDR likely-region table for the 25 app languages.
* AuthScreen: the Azure Apple *web* SDK flow (`usesAzureAppleWebFlow`) never applies in a native build, so its four
  vitest cases are not ported; `window.location.reload()` after pairing → `partnerPairingCompleteProvider`
  (`refreshProfile()`). The pairing-retry form (React: toast `description` node) is passed as the toast `action` widget
  because `AToastController.show` only takes a string description.
* Terms/Privacy words under the auth card are plain text (React buttons have no onClick).
* E-mail "sent once per session" uses process memory (sessionStorage).

## Visual details I was unsure about

* Blur of `box-shadow`s (MaskFilter) is not rendered by flutter_test goldens; the buttons' coloured shadows look like a
  hard band in goldens only.
* Blocked expiry uses `formatDateTimeAz(includeYear)` ("5 mart 2027, 10:20") instead of `toLocaleDateString` with
  hour/minute (ICU output may differ in the separator).
* `font-mono` partner code: `monospace` with Menlo/Courier fallbacks.
* Onboarding `font-weight: 850` → w800 (bundled Inter max). Onboarding h1 `clamp(22px, 6vw, 28px)` computed from width.
* Text not covered by bundled fonts (Georgian, CJK, Devanagari…) renders as boxes in goldens; devices use system fonts.
* Reference shots (Chromium headless) show ISO codes in the country list because that browser lacked
  `Intl.DisplayNames` data; the port shows the localized names (what devices show).

## Native config needed (Google / Apple sign-in)

Dart defines (public client IDs, not secrets): `--dart-define=ANACAN_GOOGLE_SERVER_CLIENT_ID=<Web OAuth client,
google-services.json oauth_client client_type 3>` (the ID-token audience Firebase Auth used; Supabase Google provider
must list it) and, for iOS, `--dart-define=ANACAN_GOOGLE_IOS_CLIENT_ID=<GoogleService-Info.plist CLIENT_ID>`.

* iOS Info.plist: keep the `com.googleusercontent.apps.<…>` URL scheme (REVERSED_CLIENT_ID, already present);
  add `GIDClientID` (= iOS CLIENT_ID) and `GIDServerClientID` (= web client) if the dart-defines are not used; keep the
  `com.atlasoon.anacan` scheme (browser OAuth callback `com.atlasoon.anacan://auth-callback`). Entitlement
  `com.apple.developer.applesignin` (present in App.entitlements). Deployment target ≥ 13 (sign_in_with_apple).
* Android: Credential Manager needs the release/upload **and** Play app-signing SHA-1 + SHA-256 registered on the
  Android OAuth client (`oauth_client` type 1, package `com.atlasoon.anacan`) in the Firebase/GCP project; keep the
  `com.atlasoon.anacan` intent filter (already in AndroidManifest) for the browser fallback. No google-services plugin
  is required by google_sign_in 7 when `serverClientId` is passed.
* The shell's link handler must route `com.atlasoon.anacan://auth-callback…` to
  `authControllerProvider.notifier.completeNativeOAuthCallback(url)`.
