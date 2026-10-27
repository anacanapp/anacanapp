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


## Web deploy — done on Google, 2026-10-26 13:35 UTC

### Before the deploy: making this source match live
The live web build had two tools this source lacked: **Sleep training** (`SleepTraining`) and
**Baby tracker** (`BabyTracker`, with `useBabyLogsRange`). Both were rebuilt here in the new
design:
- Same behaviour, the same `baby_logs` data and the same device storage key
  (`anacan.sleepTraining.v1.<user>`).
- 255 strings in 21 languages.
- Logic tests in `src/lib/sleep-training.test.ts` and `src/lib/baby-logs-range.test.ts`.

The live startup screen (white mark, dark-mode colours, in `index.html`) was also ported. Result:
every component chunk on the live site now exists in this build, and `index.html` matches live
apart from asset hashes.

### Performance (gzipped, compared with live)
- **App chunk:** 455 KB (live 458).
- **ToolsHub:** 13 KB (live 16).
- **Startup CSS:** 40 KB (live 36).
- **On demand:** the new copy is one chunk of about 5–9 KB per language, loaded by
  `ensureLanguageReady`, with English inline as the fallback. Search, the drawer library, the
  Aptek top bar and the Aptek / baby-care styles load only when used.

### Image and deploy
- **Build:** Cloud Build `b11e8903…` produced `gateway@sha256:542f4b36…` (tag
  `redesign-aptek-202610261327`).
  - It is `FROM` the live image `1139061f…` and adds only `index.html`, the hash-named `assets/`
    and `aptek/`.
  - The blog, website, brand portal, sitemaps and nginx config are untouched.
- **Isolated test:** a test container on 127.0.0.1:8089 matched live on health, admission,
  `/brands`, auth and REST.
  - New assets are served gzipped with immutable caching.
  - Old live assets are still served, so open sessions keep working.
- **Deploy:** `deploy-current-web.py /home/anacan-runner/redesign-web-plan.json` returned
  `passed`.
  - `indexVerified`; no DNS or database change.
  - The previous container is kept as `anacan-gateway-before-refresh-1793021720`.
- **Public check:** `https://app.anacan.az/` serves `index.html` sha `c33bd0d6…`, and the
  admin entry `/?web=admin` loads with no console errors.

**Rollback (one command on the VM):**
`sudo python3 /home/anacan-runner/deploy-current-web.py /home/anacan-runner/rollback-redesign-web-plan.json`

**Note — who sees it:**
- **Browsers:** ordinary browser visits are sent to the store / native app, as documented in
  `docs/APP_ENTRY_20261006.md`. The web build is used by admins and by the web preview.
- **Users:** they get the redesign through the next native build (48), which bundles this same
  code.

## Dashboard cleanup (2026-10-26, after the web deploy)
- **Backup:** tag `backup/pre-dashboard-cleanup` (plus a branch of the same name with `-branch`)
  is exactly what is deployed as `gateway@sha256:f59f8735…`.
  - Restore the code: `git checkout backup/pre-dashboard-cleanup -- src`.
  - Restore the site: the VM has `rollback-articles-web-plan.json` and
    `rollback-redesign-web-plan.json`.
- **Baby home:** `Dashboard.tsx` went from 1,664 to 848 lines.
  - **Replaced by the Baby tracker tool:** the duplicated sleep/feeding/diaper trackers, with
    their timers, modals, history panel and today's summary.
    - The home now shows one compact card that opens the tool.
    - The `data-blog-module-section` anchors are kept, so article deep links still land.
    - The per-section AI analysis moved into the tool's three tabs.
  - **Removed duplicates:** the water widget (the water tile and day plan cover it) and the
    weekly feeding/sleep/diaper averages (the tool's 7/14/30/90-day view covers them).
  - **Merged:** daily info, the message for mom and the monthly illustration text are now one
    tabbed card.
  - **Restyled:** the preemie and cakes entries use the new card style.
- **Deleted, now unused:** `FeedingHistoryPanel`, `SleepHistoryPanel`, `QuickStatsWidget`, dead
  helpers in `Dashboard.tsx`, and unused imports in `FlowDashboard.tsx`.
- **Global styles:** older screens' `.a-section` and `.a-card` follow the new spacing, title type
  and borderless cards (cards keep their border in dark mode).

### Cleanup deploy (2026-10-26)
- **Image:** `gateway@sha256:2536ecbe…`, built FROM live `f59f8735…`; isolated test passed.
- **Deploy:** `deploy-current-web.py cleanup-web-plan.json` returned `passed`. The public
  `index.html` sha is `42d3a3f3…`; the previous container is
  `anacan-gateway-before-refresh-1793024816`.
- **Rollback chain (newest first), all on the VM:**
  1. `rollback-cleanup-web-plan.json` returns to the articles build (`f59f8735…`).
  2. `rollback-articles-web-plan.json` returns to the first redesign build (`542f4b36…`).
  3. `rollback-redesign-web-plan.json` returns to the pre-redesign live image (`1139061f…`).

## Known limitations (not regressions)
- **Fetus and baby illustration images:** the URLs stored in the database point to the retired Azure
  gateway and return 404. The pregnancy hero falls back to the bundled SVGs and the baby hero uses
  the companion mascot. Re-hosting those images is a separate content task.
- **Pre-existing failing test:** `src/components/admin/AdminNotificationCampaigns.test.tsx` already
  failed on the untouched baseline.
- **Order confirmation:** there are no push or email confirmations for Aptek orders. Admins see new
  orders in the panel; the courier/aloe.az workflow is a business decision.

## Appointments and reminders (2026-10-27)

### What changed
- **App:**
  - "+ Görüş" in the home "Qarşıda" list (all three stages) opens a sheet with title, type, date,
    time, note and a "Remind me" switch. Tapping an appointment edits it; deleting needs two taps.
  - The calendar uses the same sheet (`src/components/home/AppointmentSheet.tsx`).
  - `useAppointments` uses react-query, so the home screen and the calendar share one fetch.
  - 23 new strings in all 21 languages.
- **Reminders:** sent by the server, not the phone.
  - **When (Baku time):** the day before at 10:00, and 2 hours before when a time is set.
  - **Push:** type `appointment_reminder`, which opens the calendar.
  - **Edits:** changing the date or time re-arms the reminder.
  - **Skipped:**
    - users with `push_enabled = false`;
    - a reminder whose moment had already passed when the appointment was created.
  - **Old phone reminders:** they used random ids and were never cancelled. Pending ones are
    cleared once per device.

### Database — applied on Google 2026-10-27 08:38 UTC
1. **Backup:** verified backup `base_0000000100000098000000C8`.
2. **Dry run:** `40-appointment-reminders.dryrun.sql` (ends in ROLLBACK) passed.
3. **Apply:** `40-appointment-reminders.sql` (sha256 `4c49fbd1e21d…`, identical to
   `supabase/migrations/20261027120000_appointment_reminders.sql`).

The migration adds:
- `reminder_day_sent_at` and `reminder_soon_sent_at`;
- the `appointments_rearm_reminders` trigger;
- the partial index `appointments_reminder_due_idx`.

The table was already guarded, and its 3 CDC/guard triggers are unchanged. 74 past rows were marked
as already reminded; 1 upcoming row is armed.

A claim rehearsal as `pgadmin` inside a rolled-back transaction confirmed that both the claim and the
re-arm pass the writer guard.

### Notification job — live 2026-10-27 08:41 UTC
- **Image:** `notification-jobs@sha256:ca490aab8ae87fc7b1ea69ea43f7b249f92e4938cb108cbe90f568be89df0914`.
  - Cloud Build `4fad7b6c`; the 4 job tests run inside the build.
  - It is `FROM` `c4ae4731…`. Compared with that image, exactly 2 files differ:
    `send-vitamin-reminders.mjs` and the new `send-appointment-reminders.mjs`.
  - Sources: `merge-pending/2026-10-27-appointment-reminders/`.
- **Scope:** only `anacan-job-vitamin-reminders.json` points at the new image. Appointment reminders
  run inside that 5-minute run, so they arrive at most 5 minutes late.
  - No timer was added: 8 business timers, unchanged.
  - The first run on the new image exited 0.
- **Rollback:**
  `sudo cp -p /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json.before-appt-reminders-20261027 /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json`.
  The added columns are harmless when left in place.

### Web deploy — 2026-10-27
- **Image:** `gateway@sha256:6c1db2e0f544013a241101eed98ca1fae72c76eacad2d2e3ab71ca53600e1881`.
  - Cloud Build `d27378d1`, built `FROM` live `2536ecbe…`; only `index.html`, `assets/` and `aptek/`
    were added.
- **Isolated test:** on :8089, every shared path matched live.
- **Deploy:** `deploy-current-web.py appointments-web-plan.json` returned `passed`.
  - Public `index.html` sha `567835b2…`; previous container `anacan-gateway-before-refresh-1793090833`.
  - No DNS or database change.
- **Rollback (newest first):** `rollback-appointments-web-plan.json` returns to the cleanup build
  (`2536ecbe…`), followed by the earlier chain above.
- **Size:** App chunk unchanged at 466 KB gzipped (the same as live before this change). The sheet is
  a separate 1.9 KB chunk.

### Vitamin reminder window fix — live 2026-10-27 09:11 UTC
- **Problem:** the job looked for schedules within ±1 minute of "now + 5 minutes", but runs every
  5 minutes. Times ending in :x2, :x3, :x7 or :x8 (e.g. 09:12) were never sent.
  - Live check: 50 active schedules, none at such a minute yet, so no user had lost a reminder.
- **Fix:** `vitamin-window.mjs`.
  - Each run handles its own 5-minute slice `[tick + 3, tick + 8)` in Baku time, so every minute of
    the day belongs to exactly one run.
  - Reminders come 3–7 minutes before the scheduled time. Every time the old window covered is sent
    at the same moment as before.
  - A slice crossing midnight is split, with each part using its own date and weekday (this also
    applies to the "already taken" check).
  - Tests: a full simulated day, the 09:12 case and the midnight split (3 tests). They run inside
    the image build with the 4 appointment tests.
- **Image:** `notification-jobs@sha256:1681a0b0e80d7d47ad7d396f1c2b1545a513495d460b0982c8c829a0b3f118b3`.
  - Cloud Build `bb1d3b44`.
  - Compared with base `c4ae4731…`, exactly 3 files differ: `send-vitamin-reminders.mjs`,
    `send-appointment-reminders.mjs` and `vitamin-window.mjs`.
- **Verified:** a manual run and the 09:15 and 09:20 UTC timer runs exited 0, with continuous slices
  (13:13–13:18, then 13:23–13:28 Baku).
- **Rollback:**
  - To the appointment-only image:
    `sudo cp -p /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json.before-vitamin-slices-20261027 /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json`
  - To the original image: the `.before-appt-reminders-20261027` copy.
