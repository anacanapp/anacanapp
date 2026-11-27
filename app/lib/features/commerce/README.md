# Commerce (phase 7)

Aptek, cakes, in-app Epoint, payment result pages, QayğıCash, partner shop home cards, partner discounts (QR),
promo codes and the sponsored-Premium sheet. Entry: `register.dart` (`registerCommerceFeature`,
`commerceWiringOverrides()`, slot builders for providers the app root already overrides).

| Folder | React source |
|---|---|
| `aptek/` | `components/aptek/*`, `hooks/useAptek.ts`, `lib/aptek-i18n.ts` (pricing/offers live in `domain/aptek`) |
| `cakes/` | `components/CakesScreen.tsx`, `components/cakes/*`, `hooks/useCakes.ts` (cart: `state/cake_cart_store.dart`) |
| `epoint/` | `components/paywall/EpointPayOption.tsx`, `lib/in-app-epoint{,-copy}.ts` (status calls reuse `native/purchases`) |
| `payment/` | `components/payment/PaymentSuccess.tsx`, `PaymentError.tsx` |
| `qaygicash/` | `components/qaygicash/*`, `lib/qaygicash{,-copy}.ts`, `hooks/useQaygiCash.ts` |
| `partner_shop/` | `components/partner-shop/PartnerShop.tsx`, `lib/partner-shop.ts`, `hooks/usePartnerShop.ts` |
| `partners/` | `components/partners/*`, `hooks/usePartnerVenues.ts` |
| `promo/` | `components/promo/*`, `lib/promo.ts` (normalise/save/read: `entry/auth/promo.dart`; `/h/<code>`: `app/deep_links.dart`) |
| `sponsor/` | `components/premium/Sponsor*.tsx`, `lib/premium-sponsor.ts`, `data/sponsor/*.json` |

`screen.referral` is the profile feature's `ReferralScreen`. Web-only (not ported): `/p/v/:token`, `/h/:code`
landing, the admin-only Mağaza `shop` screen (its `PartnerShopSection` is exported for it), admin cake/partner tools.

Data tables: `node app/lib/features/commerce/gen_commerce_data.mjs` (repo root) regenerates `qaygicash/qc_intl.g.dart`,
`sponsor/sponsor_copy.g.dart`, `partner_shop/partner_catalog.g.dart`.

Seams with defaults: `commerceBackendProvider` (Supabase), `commerceImageProvider` (CachedNetworkImage; relative
`/olivia/…` paths resolve against `https://app.anacan.az`), `checkoutPageOpenerProvider` (url_launcher: Android
Custom Tabs, iOS Safari), `qrCodeBuilderProvider` (text fallback until `qr_flutter` is added), the external openers
of cakes / partner shop / partners, `qcRefreshProfileProvider`, `commercePlatformProvider`.
