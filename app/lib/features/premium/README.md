# Premium, paywall and purchases (Flutter port)

Feature code: `app/lib/features/premium/`; purchases service: `app/lib/native/purchases/` (barrel `purchases.dart`).
Registration: `registerPremiumFeature(FeatureRegistry r)` (`register.dart`). Tests: `app/test/native/purchases/`,
`app/test/features/premium/` (goldens in `goldens/`, Flutter renders only — never compared with the web).

## React → Dart

| React | Dart |
|---|---|
| `lib/revenuecat.ts` (+ constants of the dead `lib/iap.ts`) | `native/purchases/revenuecat.dart` (`RevenueCatService`, `PurchasesSdk`) |
| `@revenuecat/purchases-capacitor(-ui)` | `native/purchases/revenuecat_flutter_sdk.dart` (purchases_flutter / purchases_ui_flutter 12), `fake_purchases_sdk.dart` |
| `lib/purchase-errors.ts` | `native/purchases/purchase_errors.dart` |
| `lib/premium-grant-cache.ts` | `native/purchases/premium_grant_cache.dart` |
| `hooks/usePremiumEntitlement.ts` (+ `PremiumEntitlementMonitor`) | `native/purchases/premium_entitlement.dart` |
| `hooks/useInAppPurchase.ts` | `native/purchases/in_app_purchase.dart` (`InAppPurchaseController`), `purchases_providers.dart` (`InAppPurchaseHost`) |
| `hooks/useSubscription.ts`, `useSubscriptionCancellation.ts` | `native/purchases/subscription.dart` (pure limits stay in `domain/billing/usage_limits.dart`) |
| `hooks/usePaywallConfig.ts` | `native/purchases/paywall_config.dart` |
| `hooks/usePremiumConfig.ts`, `lib/premium-i18n.ts` | `native/purchases/premium_config.dart` (+ generated `data/premium_copy.g.dart`) |
| `lib/premium-funnel.ts` | `native/purchases/premium_funnel.dart` |
| `hooks/useAppSettings.ts` (`useAppSetting`, `useLifeStageEnabled`) | `native/purchases/app_setting.dart` (no core port existed) |
| `lib/analytics.ts` paywall/purchase calls | `native/purchases/purchase_analytics.dart` (`AnalyticsSink`, no-op default) |
| `lib/onboarding-billing.ts` | already in `domain/billing/onboarding_billing.dart` (re-exported) |
| `components/paywall/PaywallCore.tsx` | `features/premium/paywall_core.dart` |
| `components/PremiumModal.tsx` | `features/premium/premium_modal.dart` (`showPremiumModal`, `PremiumModalView`) |
| `components/premium/{PremiumGate,PremiumBlurGate,PremiumToolBoundary}.tsx` | `features/premium/premium_gates.dart` |
| `components/premium/AdFreePremiumOffer.tsx` | `features/premium/ad_free_premium_offer.dart` |
| `lib/paywall-stage-copy.ts` | `features/premium/paywall_stage_copy.dart` |
| `.a-sky` / `.a-cloud` (anacan-design.css) | `features/premium/a_sky.dart` |
| EpointPayOption, QaygiCashPremium(Option/EarnLine), SponsorEntry | slots in `paywall_extensions.dart` (commerce phase) |

Not ported here: `lib/referralSync.ts` (dead, header says deprecated; the referral reward is confirmed server-side by
`sync-revenuecat-entitlement`), `src/data/lock-offer` (the Face ID / PIN app-lock offer, not a Premium surface — belongs
to the app-lock/settings feature), `BillingScreen` / `CancellationReasonDialog` (screen.billing; they can use
`InAppPurchaseHost`, `billingConfigProvider`, `premiumConfigProvider`, `submitCancellationReason`, `storeSubscriptionsUrl`),
`SponsorSheet`, `PartnerAIPremiumGate`, `supabase/functions/_shared/premium-purchases` (server).

## Purchase behaviour kept

Offering `pricing_2026` (fallback `current`); entitlement `Anacan LLC Pro`; products
`com.atlasoon.anacan.premium.{monthly,yearly}`, Google base plans `monthly-plan` / `yearly-plan`, offer
`yearly-plan:onboarding-first-year`. Android buys the explicit paid subscription option (never the free-trial default),
a plan change uses Play's product change (yearly → `WITH_TIME_PRORATION`, otherwise `DEFERRED`). iOS re-checks intro
eligibility right before a discounted purchase (unknown eligibility only when both prices were shown). A purchase that
would duplicate web/promo/household/other-store Premium is refused. Account mismatch (`getAppUserID` ≠ Supabase user)
refuses purchase and restore. A finished store call without the entitlement is *pending*. Premium unlocks only after
`sync-revenuecat-entitlement` says `isPro` (retries 0/1.5/3/6 s, 10 s bound each); otherwise the paywall shows
"refresh status" and never charges again. `get_premium_access_v1` + realtime on `subscriptions`/`profiles` decide
access; the offline grant is `anacan_premium_grant_v1:<backend>:<uid>` (same JSON as the Capacitor app; the protocol
string of the RPC answer is `anacan-premium-access-v1`).

Differences forced by the SDK: purchases_flutter would create a new native instance on every `configure`; the
adapter configures once per process and binds later accounts with `logIn` (the Capacitor app re-configured on each
paywall mount). `logOutRevenueCat` exists but, as in React, nothing calls it on sign-out (Source builds); Azure clears
its binding.

## Build configuration (`--dart-define`)

| Name | Value (from the Capacitor build) |
|---|---|
| `ANACAN_RC_ANDROID_API_KEY` | RevenueCat public Google key `goog_…` (in `src/lib/revenuecat.ts` `REVENUECAT_CONFIG.ANDROID_API_KEY`) |
| `ANACAN_RC_IOS_API_KEY` | RevenueCat public Apple key `appl_…` (`REVENUECAT_CONFIG.IOS_API_KEY`) |
| `ANACAN_RC_FALLBACK_API_KEY` | `REVENUECAT_CONFIG.API_KEY` fallback (`test_…`; only used when a platform key is missing) |
| `ANACAN_AZURE_REVENUECAT_ENABLED` | existing core name (`VITE_AZURE_REVENUECAT_ENABLED`) |

Native store config needed: iOS In-App Purchase capability + StoreKit (purchases_flutter iOS ≥ 13), Android
`com.android.vending.BILLING` (added by the plugin), RevenueCat project `a3647ee8` apps `appaedb35b823` /
`appcbfb47e107`, App Store / Play products and offers as in `docs/ONBOARDING_STORE_OFFER.md`. Customer Center and the
native paywall come from purchases_ui_flutter (Android requires `FlutterFragmentActivity`).

## Unsure visual details

* Emoji feature icons render as boxes in test goldens (no emoji font in the test engine); devices draw them.
* `.a-sky` radial gradients are painted as scaled ellipses; blur radius 13 px → sigma 6.5 (approximation of CSS blur).
* framer-motion `reducedMotion: 'always'` on lite devices: y/scale animations off, opacity kept (CTA shine still runs).
* Currency formatting uses Node-ICU-generated layouts/symbols for ~60 currencies (`onboarding_intl.g.dart`); other codes
  print the ISO code.

## Wiring the app root must do

* Mount `PremiumEntitlementMonitor` (registered as a frame overlay; React mounts it for the whole app).
* Call `bootstrapRevenueCat(container)` at start (React: `initRevenueCat()` in App.tsx).
* Override `analyticsSinkProvider` once analytics exists; optionally `appSettingProvider` with a shared settings source.
* `deviceTimeZone` returns `Asia/Baku` (no IANA zone without a plugin such as flutter_timezone).
