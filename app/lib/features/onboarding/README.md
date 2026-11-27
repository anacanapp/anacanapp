# Onboarding (Flutter port)

Registration: `registerOnboardingFeature(FeatureRegistry r)` (`register.dart`) — gate `GateId.onboarding`
(`OnboardingGateScreen` → `OnboardingJourney(legacyPending, offerEnabled)`) and frame overlay `onboarding-tour-host`.
Tests: `app/test/features/onboarding/` (goldens are Flutter renders used as regression baselines only).

## React → Dart

| React | Dart |
|---|---|
| `components/onboarding/OnboardingJourney.tsx`, `PremiumOnboarding.tsx`, `funnel/ReverseTrialFunnel.tsx`, `OnboardingScreen.tsx` | `onboarding_journey.dart` |
| `components/onboarding/OnboardingFrame.tsx`, `styles/onboarding.css` | `onboarding_frame.dart` (`OnbStyle`, `OnboardingButton`, …) |
| `components/onboarding/OnboardingFields.tsx` | `onboarding_fields.dart` |
| `components/onboarding/OnboardingCompanion.tsx`, `OnboardingBenefits.tsx` | `onboarding_companion.dart` |
| `components/onboarding/OnboardingPaywall.tsx` | `onboarding_paywall.dart` |
| `lib/onboarding-model.ts` | `onboarding_model.dart` |
| `lib/onboarding-persistence.ts` | `onboarding_persistence.dart` (`OnboardingDataPort`, Supabase implementation) |
| `lib/onboarding-i18n.ts`, `lib/stage-names.ts` | `onboarding_i18n.dart` + generated `data/onboarding_copy.g.dart`, `data/onboarding_intl.g.dart` |
| `lib/onboarding-features.ts` | `onboarding_features.dart` + generated `data/onboarding_features_copy.g.dart` |
| `lib/onboardingTour.ts` | `onboarding_tour.dart` |
| `components/onboarding/GlassTour.tsx`, `glass-tour.css` | `glass_tour.dart` (`TourTargets`) |
| `components/onboarding/OnboardingTourHost.tsx` | `onboarding_tour_host.dart` |
| `components/BirthOnboardingModal.tsx` | `birth_onboarding_modal.dart` (`showBirthOnboardingModal`) |
| device push / localStorage / store side effects | `onboarding_ports.dart` |

Not ported: `hooks/useDynamicOnboarding.ts` (0 importers, docs/flutter/DEAD_CODE.md), `partner/v2/PartnerOnboardingTour.tsx`
(partner feature, not this flow).

Data: `node app/tool/onboarding/gen_onboarding.mjs` copies `src/assets/onboarding/*.webp` + `manifest.json` (sha256-checked)
to `app/assets/images/onboarding/` and regenerates every `*.g.dart` here and `native/purchases/data/premium_copy.g.dart`
byte for byte. **Declare `assets/images/onboarding/` in pubspec.yaml** (subdirectories are not covered by `assets/images/`).

## Behaviour kept

Draft key `anacan-onboarding-v3:<backend host>:<user>` (same JSON as the Capacitor app; a draft of the web app resumes).
Step machine of `onboardingSteps` (native adds `notifications`); auto-advance 220 ms on single-choice answers; back
never returns into the saved setup; `nameOnly` repairs a placeholder name. Setup save is confirmed by read-back,
idempotent on retry, and refuses an established profile. The one-time monthly coffee offer is claimed with a
compare-and-set on `onboarding_answers.journey.revision` (`offerSeenAt`, `offerKind: monthly-coffee`) — at most once per
account across devices; closing the annual paywall or cancelling the annual store sheet opens it, a selected monthly
plan or a seen offer continues free. A pending store payment survives a restart (`purchasePending`) and only offers
"refresh status".

## Ports to wire (defaults keep the feature safe)

| Provider | Default | Wire to |
|---|---|---|
| `notificationPermissionProvider` | unsupported (journey records `denied`, tour asks nothing) | Firebase Messaging permissions |
| `pushGrantedCallbackProvider` | no-op | device token registration (`anacan:push-granted`) |
| `tourToolConfigsProvider(stage)` | null → tour waits | Tools hub configs minus disabled tools |
| `tourConsentDecidedProvider` | false → tour waits | privacy consent `decidedAt != null` |
| `tourBlockedProvider` | false | lock offer / lock setup / feedback / article open |
| `hasPendingOnboardingProvider` (shell) | false | `ref.watch(onboardingPendingProvider)` |
| `analyticsSinkProvider` | no-op | analytics (no onboarding events are sent in React either) |

`TourTargets.key('tool-<id>')`, `'tools-free'`, `'tools-premium'` must be attached by the Tools hub (tab targets come
from `BottomNavBar.tourKey`). The tour itself is behind `app_settings.inapp_onboarding` (off in production).

## Unsure visual details

* `<input type="date">` → platform date picker; the value is shown in the numeric ICU date format of the language.
* `<select>` (delivery type) → Material dropdown.
* CSS `font-weight: 850/750/650` → Inter 800/700/600 (bundled weights).
* `fieldset > legend` drawn over the card border by hand.
* Companion images: `Image.asset` of the webp files (decoded by the engine); unknown poses render an empty box like a
  broken `<img>`.
