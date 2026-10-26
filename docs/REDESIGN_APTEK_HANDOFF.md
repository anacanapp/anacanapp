# Redesign v3 + Anacan Aptek — operator handoff (2026-10-27)

This change ports the approved prototype (`prototype/anacan-prototype.html`) into the app and adds
**Anacan Aptek**, a baby-feeding store on the existing shop tables. Everything client-side ships with
a normal web deploy and native build. One database migration must be applied by the operator.
Until it is applied, the store simply stays hidden and the rest of the redesign works unchanged.

## What changed

### Design and screens
- **Design system:** new token palette in `src/styles/anacan-design.css`. The `:root` and `.dark`
  blocks were updated, so all ~168 existing `a-*` components pick up the new colours automatically.
  New `a3-*` / `ap-*` classes cover the new layouts. Two motion modes are respected:
  `html.a-lite` (opaque surfaces, no blur) and reduced motion.
- **Home screens:**
  - Pregnancy, baby and cycle homes have new heroes (progress ring, companion art), "today"
    trackers, an ask bar, a day plan and an "upcoming" list.
  - The baby home's upcoming list includes vaccines from the national schedule.
  - All previous sections, premium gates, ad slots and `data-*` hooks are kept.
- **Other screens:** bottom nav (sliding indicator), global search sheet, tools categories, AI
  companion intro, community segmented tabs and the profile card are restyled.
- **Bug fixes found along the way:**
  - Home shortcuts used non-existent tool ids (`vitaminTracker`, `safetyLookup`). They now open the
    real tools.
  - Six screens had garbled Azerbaijani fallback text (mojibake). Repaired.

### Anacan Aptek
- **Client:** store home, product list/filters, product page, sets, cart, checkout (cash or card on
  delivery), order tracking.
- **Contextual offers:** on the pregnancy and baby homes, and product hits in search.
  - Infant formula is **never offered**; it is only browsable inside the store, with a breastfeeding
    notice.
  - Note: the WHO Code also covers bottles and teats. Each offer placement can be switched off in
    Admin.
- **Prices:** checkout calls `place_aptek_order()`, which recomputes every price, set discount,
  coupon and delivery fee on the server. Client-side numbers are only a preview.
- **Product images:** 57 images ship with the app under `public/aptek/`. Nothing needs uploading.
- **Admin:**
  - Products: new Aptek fields.
  - Orders: delivery slot, payment and phone.
  - Settings: "Anacan Aptek" card with the on/off switch, delivery, sets and per-placement switches.

### Translations
New UI copy lives in `scripts/i18n/redesign-copy.json` and `scripts/i18n/aptek-copy.json` (21
languages each). `src/lib/redesignCopy.test.ts` checks that every language has every key and the
same placeholders. Hashed seed files and `verify-bundles` pins are untouched.

**Recommended:** have native speakers review the non-Azerbaijani strings before a wide release.

## Operator steps

### 1. Database — **applied on Google 2026-10-26**
Status: installed on `anacan-gcp-candidate` (phase `active`).
- **Backup:** verified backup `base_0000000100000093000000FA` was taken first.
- **Dry-run:** `/home/anacan-runner/39-aptek-store.dryrun.sql` (ends in ROLLBACK) passed.
- **Apply:** `39-aptek-store.sql` was applied with `run-sql.py`
  (sha256 `2d8f22e2…7d4d`, identical to the committed migration file).
- **Reload:** `39b-aptek-store-reload.sql` reloaded the PostgREST schema cache (12:13:37 UTC).
- **Verified:**
  - 52 `store='aptek'` products, one of them tagged `infant_formula`;
  - config `enabled=false` with 4 sets; coupon `ANACAN10` (`aptek`);
  - both functions are SECURITY DEFINER and owned by `pgadmin`;
  - `anon` can read the config and products but cannot run `place_aptek_order`;
  - a normal user's order returns `APTEK_DISABLED` while the store is off;
  - 3 CDC/guard triggers are still on `products`.
- **Live-schema note:** `orders.payment_method` already exists live (Epoint/cake/album values), so
  the migration adds **no** CHECK constraint on it.

Original procedure, kept for re-runs:
Migration: `supabase/migrations/20261027090000_aptek_store.sql` (+ `.cdc.json`).

- Adds nullable columns to `products` / `orders`. No new table, no cron, no timer.
- Refuses to run unless `products, orders, order_items, cart_items, coupons, app_settings` are
  already CDC / writer-guard enrolled.
- Idempotent: products upsert by `sku`; the coupon and config are `ON CONFLICT DO NOTHING`.
- Verified against a real Postgres (PGlite 0.5.8) replica: applies twice cleanly, and the checkout
  RPC passes 32 behaviour checks (pricing, coupon, stock, grants, validation, CDC capture).

Steps:
1. Back up (same procedure as `20261022120000_brand_ads_v3`).
2. Apply on the candidate with `/home/anacan-runner/run-sql.py`, then on production.
3. Run the PostgREST reload, if your runner does not already do it. The migration ends with
   `NOTIFY pgrst, 'reload schema'`.
4. Smoke check:
   - `select get_aptek_config();` returns the config with `enabled=false`.
   - `select count(*) from products where store='aptek';` returns `52`.

### 2. Turn the store on (when fulfilment with aloe.az is agreed)
Admin → Settings → **Anacan Aptek** → "Aptek istifadəçilərə açıqdır".

- While it is off, only admins see the store, so it can be tested with real orders first.
- Orders appear in Admin → Orders with `store = aptek`.
- The phone number is personal data; it is flagged `pii` in the CDC manifest.

### 3. Web deploy and native build
- Web deploy: normal build (`npm run build`).
- Native: run the usual native build. Device checklist:
  - **Homes:** check all three stages, in light and dark mode. Tap the water tile and confirm the
    +1 animation. Check the day plan's celebration.
  - **Navigation:** swipe weeks on the pregnancy hero. Confirm the bottom sheet drags down to close.
  - **Store:** with the store enabled for an admin account, open the store from the home offer, add
    a set, apply `ANACAN10`, place a cash order, and see it in "Sifarişlərim" and in Admin → Orders.
  - **Languages:** check Arabic (RTL) and one CJK language for text overflow on the small tracker
    tiles.

## Known limitations (not regressions)
- **Fetus and baby illustration images:** the URLs stored in the database point to the retired Azure
  gateway and return 404. The pregnancy hero falls back to the bundled SVGs and the baby hero uses
  the companion mascot. Re-hosting those images is a separate content task.
- **Pre-existing failing test:** `src/components/admin/AdminNotificationCampaigns.test.tsx` already
  failed on the untouched baseline.
- **Order confirmation:** there are no push or email confirmations for Aptek orders. Admins see new
  orders in the panel; the courier/aloe.az workflow is a business decision.
