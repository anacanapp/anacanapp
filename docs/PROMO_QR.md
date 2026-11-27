# QR Premium campaigns

People who scan a campaign QR and sign up get Anacan Premium automatically. Each QR is its own campaign with:

- its own Premium duration;
- its own rule for who can redeem it (new accounts only, or everyone);
- a use limit and a date window.

Admins manage campaigns in **Admin › Kommersiya › QR kampaniyalar** (`/admin/promo-qr`).

## Flow

1. The QR opens `https://app.anacan.az/h/<CODE>`.
   - On the web (app not installed), `PromoLanding` shows the gift, the three steps, the code and the App Store / Google Play
     links. `/h/<CODE>` is a `system` exception in the browser launcher (`src/web-entry/policy.mjs`), so the page renders
     instead of jumping straight to a store; any other path still goes through the launcher.
   - In the installed app, the universal link (`/h/*` in `apple-app-site-association`) or `anacan://h/<CODE>` is caught by the `appUrlOpen` listener in `src/lib/deeplink.ts`.
2. The code is saved on the device (`localStorage` `anacan:promo-code`, 30 days).
3. `PromoRedeemer` (mounted in `App.tsx`) calls the `promo-redeem` function as soon as a session exists. That covers signup, login, Google or Apple sign-in, and the next app start.
4. People who install from the store without opening the link have two ways to enter the code:
   - the optional **Hədiyyə kodu** field in the signup form;
   - **Profil › Hədiyyə kodu**.
5. When redemption fails:
   - final refusals drop the saved code: used, not a new account, full, ended, not found, or an active store subscription;
   - network or server failures keep the code for the next start.

## Server

- Migration `supabase/migrations/20261121090000_promo_qr_campaigns.sql` (with its `.cdc.json`).
  - `promo_campaigns` and `promo_redemptions` are guard-enrolled with CDC.
  - Both have RLS on and no client grants.
- `promo_campaign_public_v1(code)`: anon. Returns the public card: title, duration, eligibility, state.
- `promo_reserve_v1` and `promo_finish_v1`: service role only.
  - Reserving checks the campaign is active, the date window, the limit, the new-account rule (`auth.users.created_at` within `new_user_days`) and one gift per person.
  - A reservation counts toward the limit for 10 minutes.
- Admin RPCs `promo_admin_list_v1`, `promo_admin_save_v1` and `promo_admin_redemptions_v1` require `has_role(admin)`. The code never changes after creation.
- `supabase/functions/promo-redeem`, a user route:
  1. Refuses people with an auto-renewing App Store or Google Play subscription (`premium_store_subscription_active`).
  2. Extends a running promotional, one-time or web pass, so the gift starts when that pass ends.
  3. Grants the RevenueCat promotional entitlement for the campaign duration (`weekly` … `lifetime`). These map to `rc_promo_Anacan LLC Pro_<duration>` in `REVENUECAT_PRODUCT_PLANS_JSON`. Never use a custom `end_time_ms` grant: it creates an unmapped `_custom` product.
  4. Finishes the redemption and runs `syncEntitlementForUser`, so the gift survives every later RevenueCat sync, exactly like a purchase.

## Deployed 2026-11-21

- Migration applied in one transaction; 2 relations / 6 guard triggers verified.
- Functions image `sha256:85d6cc10…` (recreate script `/root/functions-promoqr.py`, previous image `sha256:be574526…`),
  `ENABLED_FUNCTIONS` gained `promo-redeem`.
- Gateway `sha256:5b73a2d2…` (plan `promoqr2-web-plan.json`, rollback `rollback-promoqr2-web-plan.json`).
- Live checks: anonymous `promo-redeem` 401; anon cannot read `promo_campaigns`, call the admin list or `promo_reserve_v1`;
  `promo_campaign_public_v1` answers `{"state":"not_found"}`; `/h/<unknown>` renders the "no longer valid" card; AASA lists `/h/*`.

## Deploy checklist (Google)

1. Apply the migration on `anacan-gcp-candidate`. It refuses to run without the guard catalog and verifies 2 relations and 6 triggers.
2. Add the `promo-redeem` route to the functions image `catalog.mjs`. It is a user route and needs `REVENUECAT_SECRET_API_KEY`.
3. Add `promo-redeem` to `ENABLED_FUNCTIONS` in `functions.env`.
4. Keep the existing `qaygicash-premium` and `cake-checkout` entries.
5. Deploy the web bundle.
6. Native builds pick up the `/h/*` universal link and the in-app capture with the next native release. Until then, the code field and the profile entry work in every installed version that has the new web bundle.

Copy lives in `src/data/promo/<lang>.json` (25 languages). The admin page is Azerbaijani only, like the rest of the admin panel.
