# Redesign v3 + Anacan Aptek — operator handoff (2026-10-27)

> **2026-10-29: redesign v3 UI reverted in source.** At the user's request every screen is back to
> the pre-redesign design (`976bd00`). Kept and re-wired onto the old screens: Anacan Aptek (store
> route, pregnancy/baby home offers, hospital-bag offer, product hits under the Tools search, Admin
> card/fields), appointment add/edit sheet + server reminders (Calendar), Baby tracker and Sleep
> training (Tools), Admin notification test-send, vitamin job changes, plus an Upcoming appointments
> card on the three homes. Six screens keep the mojibake text repair and the home shortcuts keep the
> corrected tool ids. `anacan-design.css` is the old file plus new-only tokens/classes used by the
> kept components. No database or job change: everything below that is live stays live. The live web
> serves this design since the 2026-10-29 deploy (last section); native 48 builds get it too.

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

## Design pass for tools and screens — deployed 2026-10-27

### What changed (commit `abb9bf4`)
- **Shared styles:** older `a-*` cards, lists, buttons, inputs, tabs and chips follow the `a3` scale:
  - text of at least 12.5px;
  - 44px tap targets;
  - 16px inputs, so iOS does not zoom in;
  - pill buttons and borderless light cards.
- **Long titles:** tool titles wrap to two lines instead of being cut off.
- **Shared controls:** the shadcn `Button` and `Input` are pills with 44px and 48px targets.
- **Colours:**
  - Hard-coded Tailwind colours in 25 components now use design tokens (light and dark).
  - Colour classes stored in the database were never generated by Tailwind. Fixed in the white-noise
    player and the partner surprise categories.
  - The crisis widget built a class at runtime; it now uses a fixed class.
- **Restyled:** partner profile, blocked screen, rating prompt, medical disclaimer, mood picker,
  white-noise player, birth modal and floating timer.
- **Removed:**
  - the unused `mommy/hero/` variants and their admin setting, which no longer did anything;
  - `PartnerQuickStats`, which nothing imported.
- **Weather tool:** handles an empty server response safely.

### Verification
- **Tools:** a preview smoke run opened all 43 tools. All render, with no spinner hang and no error
  boundary.
- **Server functions:** all 13 functions the tools call answer a CORS preflight on
  `api.anacan.az` (204; an unknown name returns 404).
- **Database and storage:** all 165 tables, 62 RPCs and 6 storage buckets the app uses exist live.
- **Tests:** 1500 of 1501 pass. The other one is a load-related timeout that passes on its own.
- **Size:** startup CSS 39.9 KB gzipped (was 42.2); App chunk unchanged.

### Deploy
- **Image:** `gateway@sha256:dfd63929aa2ff813a47acfea02de5b35168a1b89ebdc7edcef9710fec5ebd16c`.
  - Cloud Build `f26d71c5`, built `FROM` `6c1db2e0…`; only `index.html`, `assets/` and `aptek/` were
    added.
- **Isolated test:** on :8089, every shared path matched live.
- **Deploy:** `deploy-current-web.py design-web-plan.json` returned `passed`.
  - Public `index.html` sha `75585307…`; previous container `anacan-gateway-before-refresh-1793097137`.
  - 8 timers unchanged; no DNS or database change.
- **Rollback (newest first):** `rollback-design-web-plan.json` returns to the appointments build
  (`6c1db2e0…`), followed by the earlier chain above.

### Known gap (not changed)
The admin "test send" for daily and cycle notifications calls `send-daily-notifications` and
`send-flow-reminders` as functions. On Google these run only as scheduled jobs, so those test buttons
do not work.

## Admin notification test-send on Google (2026-10-27)

### Why
On Google the daily, cycle and vitamin senders run only as scheduled job images. The admin test
buttons invoked them as functions and got 404. The buttons affected:
- `NotificationOpsCard`: "Test: Daily / Flow / Vitamin";
- `PushDiagnosticsCard`: "send to me";
- both "İndi Test Et" buttons in `AdminPushNotifications`.

### How it works now
1. **Queue:** the button calls `request_notification_test(kind)`, where kind is `daily`, `flow` or
   `vitamin`.
   - It is admin-only and **always targets the caller's own account**.
   - It reuses an open request and allows 20 per day.
   - The request is a row in `public.notification_test_requests`.
2. **Run:** the 5-minute `anacan-job-vitamin-reminders` run claims pending rows (requests older than
   30 minutes expire).
   - For each row it spawns the real job script with `TEST_USER_ID=<admin>` and `SKIP_DEDUP=true`.
   - It stores that run's `notification_run_log` counts in `result`.
   - There is no broadcast path.
3. **Result:** the admin UI (`src/lib/notification-tests.ts`) shows "queued", then polls the row and
   shows the result. Expect up to about 5 minutes.

### Database — applied 2026-10-27 10:55 UTC
- **Backup:** verified backup `base_000000010000009900000054`.
- **Dry run:** `44-notification-test-requests.dryrun.sql` (ROLLBACK) passed.
- **Apply:** `44-notification-test-requests.sql` (sha256 `0c15037de4025000…`, identical to
  `supabase/migrations/20261027150000_notification_test_requests.sql`).
- **Verified:**
  - table owned by `pgadmin`, with RLS on;
  - SELECT policy "Admins read own notification tests";
  - 3 CDC/guard triggers, and 1 `guarded_relations` row;
  - RPC is SECURITY DEFINER, owned by `pgadmin`, executable by `authenticated` only, not `anon`;
  - `authenticated` has SELECT only.
- **Live rehearsal** (rolled back, `46-rehearsal.sql`):
  - an admin request works, and a second request reuses the same id;
  - the job's claim targets the admin;
  - the admin reads `done`, and another user sees 0 rows;
  - 0 rows remain after the rollback.
- **Pre-release test:** PGlite harness `.redesign-backup/pg/notiftest.mjs`, 17/17 checks.

### Job image — live 2026-10-27 10:57 UTC
- **Image:** `notification-jobs@sha256:03a230fcdbb20d8e695c78c7088981d774c0667fb32ab499bac332cc40911169`.
  - Cloud Build `98bb1229`; 10 job tests run inside the build.
  - It is `FROM` base `c4ae4731…`. Exactly 4 files differ:
    - `send-vitamin-reminders.mjs`
    - `send-appointment-reminders.mjs`
    - `vitamin-window.mjs`
    - `run-notification-tests.mjs`
- **Scope:** only `anacan-job-vitamin-reminders.json` was switched (from `1681a0b0…`). The first run
  exited 0, and the 8 timers are unchanged.
- **Rollback:**
  `sudo cp -p /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json.before-notification-tests-20261027 /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json`.
  The table can stay; it is unused without the job.
- **Goes live:** the admin buttons start working with the next web deploy, which carries the
  changed admin files.

### Incident during verification
The manual verification run at 10:57 UTC repeated the 14:58–15:03 Baku vitamin slice that the 10:55
scheduled run had already sent. Two users received a duplicate vitamin reminder.
- Do not start `anacan-job-vitamin-reminders.service` by hand between ticks.
- A per-slice "already sent" guard in the vitamin job is the follow-up.

## Vitamin per-slice "already sent" guard (2026-10-27)

### Why
The 10:57 manual verification run repeated a slice the 10:55 scheduled run had already sent, so two
users got a duplicate vitamin reminder (see above). The job had nothing that remembered a slice
was done.

### What changed
- **New file:** `merge-pending/2026-10-27-appointment-reminders/vitamin-guard.mjs`.
- **Slice key:** each scheduled run writes its key (Baku date and slice start, e.g.
  `2026-10-27T15:13`) to `notification_run_log.active_slot`.
  - That column was null for vitamin runs, and the admin status RPC and UI do not read it for vitamin.
- **Skip:** before sending, a run skips the slice (reason `slice_already_sent`) when a successful
  scheduled run already has the same key within the last day.
  - It uses the existing index `idx_notif_run_log_function_started`.
- **Exceptions:** a run that ended in error does not count, so it can be retried. Admin test runs
  (`TEST_USER_ID`) bypass the guard.
- **No race:** runs of the job are serialized by the `flock` in `run-job.py`, so check-then-send
  cannot race. No database change was needed.
- **Build checks:** the image build now fails when a local import or a test file is missing, and
  requires 12 passing tests.
  - This caught a real problem: the first build (`a6039642…`) lacked `vitamin-guard.mjs` and was
    never switched in.

### Live — 2026-10-27 11:07:49 UTC
- **Image:** `notification-jobs@sha256:33c829f343f861f38cc1df6841df041026aca438fd0427714752b055e0d3009c`.
  - Cloud Build `4aa75fcb`, built `FROM` base `c4ae4731…`.
  - Exactly 5 files differ from the base, now including `vitamin-guard.mjs`.
- **Verified:**
  - the 11:10 scheduled run recorded slice `15:13`;
  - a manual start at 11:10:29 in the same slice logged "already sent … skipping" and sent nothing
    (that slice was empty, so the check was safe);
  - the 11:15 run handled its new slice `15:18` normally;
  - 8 timers unchanged.
- **Rollback:** returns to the image without the guard.
  `sudo cp -p /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json.before-vitamin-guard-20261027 /srv/anacan/runtime/jobs/anacan-job-vitamin-reminders.json`.
- **Manual starts:** a manual `systemctl start anacan-job-vitamin-reminders.service` is now safe
  after the slice's scheduled run.

## Homes + admin test-send web deploy — 2026-10-27
- **Contents:**
  - Commit `e0aa2b0`, homes:
    - pregnancy hero fixed on today;
    - baby message under the hero;
    - today's plan after This week;
    - baby home: today's info after the hero;
    - feeding and sleep widgets (formula with ml presets, solid food);
    - no growth related articles.
  - Commit `0d25052`: the admin test-send UI (the queue and job parts went live earlier, see that session's
    section).
- **Image:** `gateway@sha256:487bce5c167cecc68d23e5872f6c8fc1c1c0b9d5272ced788f4bc9d909f54b8b`.
  - Cloud Build `94709c5d`, built `FROM` `dfd63929…`.
- **Isolated test:** passed on :8089.
- **Deploy:** `deploy-current-web.py homes-web-plan.json` returned `passed`.
  - Public `index.html` sha `3c75dd49…`; previous container `anacan-gateway-before-refresh-1793100487`.
  - 8 timers; no DNS or database change.
- **Rollback:** `rollback-homes-web-plan.json` returns to the design-pass build (`dfd63929…`), followed by the
  earlier chain.

## Original-design web deploy — 2026-10-29
- **Contents:** commits `88a65fa` (redesign UI reverted, features kept) and `44130aa` (Upcoming
  appointments card on the three homes), built with `npm run build` (Google mode).
- **Image:** `gateway@sha256:1354acb417dda7be6381754d84c39b77bbdd8feebb4a04691895854a5b22a157`
  (tag `revert-design-202610290733`, Cloud Build `0a54b733`, service account `anacan-build`), built
  `FROM` live `487bce5c…`; adds only `index.html`, `assets/` and `aptek/`.
- **Isolated test (:8089):** health, `index.html`, admission, `/brands`, `/blog/`, sitemap, auth,
  REST and the website matched live; new and previous live assets both served (gzip).
- **Deploy:** `deploy-current-web.py original-design-web-plan.json` returned `passed`;
  `index.html` sha `eabd2670…`; previous container `anacan-gateway-before-refresh-1793259436`;
  no DNS or database change. Public `app.anacan.az` serves the new `index.html`; `/?web=admin`
  loads with no console errors.
- **Rollback:** `rollback-original-design-web-plan.json` returns to the homes build (`487bce5c…`),
  followed by the earlier chain.


## Homes carousel web deploy — 2026-10-29
- **Contents:** commit `c82c4bb`: Calendar card after the message sections, no related-articles
  blocks on the homes, article carousel (up to 9, autoplay), My sleep removed, compact water row,
  merged development card.
- **Image:** `gateway@sha256:fb35ddc18328fd32d775980f9cd3e3a427c61d3c1e5da2145b037f0449bc0e1f`
  (Cloud Build `790dda3c`, `anacan-build`), built `FROM` live `1354acb4…`; adds only `index.html`,
  `assets/` and `aptek/`.
- **Isolated test (:8089):** every checked path and the website matched live; index sha, admission
  and the previous live assets verified before the deploy started.
- **Deploy:** `deploy-current-web.py homes-carousel-web-plan.json` returned `passed`; `index.html`
  sha `f75e75bf…`; previous container `anacan-gateway-before-refresh-1793270208`; no DNS or
  database change. Public `/?web=admin` loads with no console errors.
- **Rollback:** `rollback-homes-carousel-web-plan.json` returns to the original-design build
  (`1354acb4…`), followed by the earlier chain.

## Mommy period card web deploy — 2026-10-29
- **Contents:** commit `2556f63`: Menstruasiya wording and the minimal period card on the baby home.
- **Image:** `gateway@sha256:0c3804714f9438966417fee9c07f49b558b3c602033651a4c1a0b850e5226760`
  (Cloud Build `a579b6e6`), built `FROM` live `fb35ddc1…`; adds only `index.html`, `assets/`, `aptek/`.
- **Isolated test (:8089):** all checked paths and the website matched live; index sha, admission and
  previous live assets verified first.
- **Deploy:** `deploy-current-web.py mommy-period-web-plan.json` returned `passed`; `index.html` sha
  `c6bd6755…`; no DNS or database change; public `/?web=admin` loads with no console errors.
- **Rollback:** `rollback-mommy-period-web-plan.json` returns to the homes carousel build (`fb35ddc1…`).

## Storage cache + upload compression web deploy — 2026-10-29
- **Contents:** commit `f1d7c74` (photos are downscaled to 1600 px and re-encoded in the browser
  before upload) and gateway `nginx.conf` marker `storage-cache-v1`: a `$storage_cache_control`
  map sends `public, max-age=31536000, immutable` for GET/HEAD of public `community-media` and
  `chat-media` objects, `public, max-age=86400` for public `assets` (admin uploads use upsert),
  and the Storage API's own header everywhere else (private buckets, signed URLs, uploads).
  Goal: cut load-balancer egress, which repeat downloads of uncached feed media dominated.
- **Image:** `gateway@sha256:68576641eef72460788eadbd8f481e2ceea1c33ae415537c7312345b008b2332`
  (Cloud Build `4c9f8772`), built `FROM` live `0c380471…`; replaces `nginx.conf` (live file plus
  the map and two lines in `location /storage/v1/`) and adds `index.html`, `assets/`, `aptek/`.
- **Isolated test (:8089):** `nginx -t` passed; all checked paths, website, admission, old and new
  JS matched; public media returned the same bytes with the new headers; private unauthenticated
  reads still 400; storage preflight still 204.
- **Deploy:** `deploy-current-web.py storage-cache-web-plan.json` returned `passed`; `index.html`
  sha `8b26124c…`; no DNS or database change; public `/?web=admin` loads with no console errors.
- **Rollback:** `rollback-storage-cache-web-plan.json` returns to the mommy period build (`0c380471…`).

## One-time recompression of stored images — 2026-10-29
- **Scope:** JPEG/PNG objects over 500 KB in every bucket (1,740 objects, 3.05 GB). Tool image
  `anacan-runtime/media-recompress@sha256:9448230f…` (Pillow): EXIF-oriented, max 1600 px, JPEG
  q82 progressive or optimized PNG; same path, same type; replaced only when ≥20% smaller.
- **Path:** each original was copied to
  `gs://anacan-migration-ninth-park-492111-m4/gcp-backups/files/media-originals-20261029/<bucket>/<name>`
  (2.65 GB, `ifGenerationMatch=0`) before an upsert through the Storage API with a short-lived
  `service_role` JWT whose `sub` is the object's owner, so `owner_id` and `cacheControl` stay and
  storage triggers/CDC run as for any upload. No direct database writes.
- **Result:** 1,029 replaced, 530 left (not ≥20% smaller), 181 left unchanged: 155 moderation/ad
  media refused by `community_ad_storage_guard_v1` (`MODERATION_MEDIA_IMMUTABLE`, intentional),
  14 truncated files, 9 undecodable, 3 transient errors. 3.05 GB → 1.36 GB.
- **Restore:** upload the backup object back to the same path with `x-upsert: true`.
  Working files: `/var/tmp/media-recompress-20261029/` on the VM (`result.tsv`, `dry-result.tsv`).

## Review PDF fixes web deploy — 2026-10-29
- **Contents:** commits `99dc8ee` (period), `56651fd` (layout, pregnancy home, nutrition),
  `5be44e2` (chat menu). SQL applied on Google first, each in one transaction with owner/ACL
  unchanged: `supabase/duzelis/Duzelis65.sql` (record_period_days learns cycle length from
  21–35 day cycles only) and `Duzelis66.sql` (chat_set_reaction_v2 and the
  `chat_reaction_emoji_v2` CHECK accept 16 extra reactions).
- **Image:** `gateway@sha256:8c7b11287998b988bbf6d0cadfef3321ea7203100c5e8b7c38e99f93e105e1c9` (Cloud Build `44915637`), built `FROM` live
  `68576641…`; adds only `index.html`, `assets/`, `aptek/`.
- **Isolated test (:8089):** nginx -t, paths, website, admission, old/new JS and storage headers matched.
- **Deploy:** `deploy-current-web.py review-fixes-web-plan.json` returned `passed`; `index.html`
  sha `4f3fd00a…`; public `/?web=admin` loads with no console errors.
- **Rollback:** `rollback-review-fixes-web-plan.json` returns to the storage cache build (`68576641…`).
- **Also on 2026-10-29:** deleted unused travelmatch leftovers in us-central1 (reserved IP
  `travelmatchstatic`, snapshot schedule `default-schedule-1`, 14 snapshots of the deleted
  `travelmatch` disk). Anacan disks have no snapshot schedule; backups stay in GCS.

## Breastfeeding age web deploy and Cloud Armor removal — 2026-10-29
- **Contents:** commit `8055305` (breastfeeding options until the child's second birthday).
- **Image:** `gateway@sha256:a7ee8504319d12ee35871c3d1be93962a27b234945787963ed3eb3a5f7f1af55` (Cloud Build `1a049bc5`), built `FROM` live
  `8c7b1128…`; adds only `index.html`, `assets/`, `aptek/`. Isolated test matched live.
- **Deploy:** `deploy-current-web.py breastfeeding-web-plan.json` returned `passed`; `index.html`
  sha `fac8db01…`. Rollback: `rollback-breastfeeding-web-plan.json` (`8c7b1128…`).
- **Cloud Armor:** `anacan-preview` (only an allow-all default rule, ~$17/month at 14.5M
  requests/30 days) was detached from `anacan-runtime-backend`; app, API, website and storage
  answered as before, then the policy was deleted. Rate limits remain in the gateway; Google's
  load balancer keeps its built-in L3/L4 DDoS protection.

## Solid food guide web deploys — 2026-10-29
- **First:** commits `6fb9599`, `54cb18c`; image `gateway@sha256:107983495d02d1e0c6a286c539907ce86b95838d6ddaad00c5cb74b9f29e6cf3` (Cloud Build
  `271c07a7`) from `a7ee8504…`; plan `solid-food-web-plan.json` passed (index `336fed3f…`).
  SQL first: `supabase/duzelis/Duzelis67.sql` adds recipe category `baby_food` / Körpə (21 languages)
  and moves the 60 'Əlavə qida' recipes into it (70 active baby recipes).
- **All languages:** commit `71a5689` (texts in `src/data/solid-food-guide/<lang>.json`, 21 languages);
  image `gateway@sha256:adb697720abd1b28d1d15fc2881f68b18153d6c4f24153310a5265957a89f38a` (Cloud Build `f5639bdc`) from `10798349…`; plan
  `sfg-i18n-web-plan.json` passed (index `91ec84f8…`); public `/?web=admin` has no console errors.
- **Rollback:** `rollback-sfg-i18n-web-plan.json` (→ `10798349…`), then `rollback-solid-food-web-plan.json`.

## Dark mode, Mommy period screen and chat edit web deploy — 2026-10-29
- **Contents:** commits `96f594e` (dark-mode pastel mapping, CTA/switch/blog cover, trimester tips under
  the hero, Mommy period screen: calendar first, cycle overview, phase tips, daily log, symptoms) and
  `f138c91` (chat edit through `chat_edit_message_v1`; no SQL change).
- **Image:** `gateway@sha256:d3678a34d2d5f36ef3b0fbf99e992289840ce7f7f1fb53dd722abf0397ac6f01` (Cloud Build `96e820f2`) from `adb69772…`; isolated test matched.
- **Deploy:** `chat-edit-web-plan.json` passed; index `fb2e9a8b…`; no console errors.
- **Rollback:** `rollback-chat-edit-web-plan.json` (→ `adb69772…`).

## Partner rebuild phase 1 web deploy — 2026-10-30
- **SQL first:** `supabase/duzelis/Duzelis68.sql` (applied on Google). `partner_can_see_v1` applies the woman's
  `share_*` flags to partner reads of appointments, baby_logs, contractions, kick_sessions and
  weight_entries. Partners can no longer read `daily_logs` or `daily_summaries` directly; they use the masked RPCs
  `partner_daily_logs_v1` and `partner_daily_summaries_v1` instead (mood, symptoms and water only per flag; never notes,
  temperature or bleeding). Old native clients (≤47) lose the partner mood view until the next native build.
- **Contents:** commits `018f840` (real sign-out, newest-first feed, quick messages with push), `2cee7ed`
  (client on masked RPCs, Google always uses secure pairing) and `ae90c91` (in-app re-link form on the not-linked home
  and the profile, legacy pairing removed, a one-sided legacy link is cleared only after the server confirms
  it is not mutual).
- **Image:** `gateway@sha256:0b979ca713a451f75e5842cb341882674a2cb3fc098e9365c571112fdc571f92` (Cloud Build `a19b34b4`) from `d3678a34…`; isolated test matched.
- **Deploy:** `partner-p1-web-plan.json` passed; index `29099c92…`; no console errors.
- **Rollback:** `rollback-partner-p1-web-plan.json` (→ `d3678a34…`).

## Partner rebuild phases 2–5 web deploy — 2026-10-30
- **SQL first:** `supabase/duzelis/Duzelis69.sql` (applied on Google after a rolled-back dry run). New tables
  `partner_night_shifts` and `birth_plans` (pgadmin, RLS on, no direct grants) are reachable only through
  `partner_family_mother_v1`, `night_shifts_v1`, `night_shift_set_v1`, `birth_plan_get_v1`, `birth_plan_save_v1`
  (mother, or her mutually linked partner). Both relations are enrolled in `_anacan_gcp_migration.guarded_relations`
  with `anacan_gcp_writer_guard` / `anacan_gcp_change` / `anacan_gcp_truncate`; no cron or timer.
- **Contents:** commits `e3226a6`, `0e6ab4a`, `d0f441f`: stage-aware partner missions (`src/data/partner-missions`, 50
  missions, 21 languages), birth mode card from week 36, stage chips, grouped "Biz" with birth plan / night shift,
  woman-side partner hub (invite, last 7 days, grouped sharing with preview, unlink), compact dashboard card,
  Ata AI (partner persona, `chat_type='partner'` history, woman's stage, cycle dates only when shared), night shift
  and birth plan screens, new partner profile; 131 new feature37 keys in 21 languages; dead partner files removed.
- **Image:** `gateway@sha256:6f79504860a592b040c3526b4281bac170a07974df11d70c3f60a018b97c111c` (Cloud Build `aaaedb4f`) from `0b979ca7…`; isolated test matched.
- **Deploy:** `partner-full-web-plan.json` passed; index `cb71cda9…`; no console errors.
- **Rollback:** `rollback-partner-full-web-plan.json` (→ `0b979ca7…`). The new tables are additive.

## Partner postpartum guide, notification choices and tour — 2026-10-30
- **SQL first:** `supabase/duzelis/Duzelis70.sql` (rolled-back dry run, then applied). `user_preferences` (already
  guarded) gains `push_partner_thanks`, `push_partner_shopping`, `push_partner_contractions` (default true). The original
  claim function is kept as `claim_communication_notification_core_v2`; the new `claim_communication_notification_v2`
  (same signature, pgadmin, service_role only) still writes the claim and in-app notification, then returns false for
  a partner type the target turned off, so `send-push-notification` sends no push. SOS/birth alerts are never filtered.
  The functions image is unchanged.
- **Contents:** commit `5763ac9`: "İlk 8 həftə" partner guide (`src/data/postpartum-partner`, 21 languages; week guide,
  baby blues vs postnatal depression, warning-sign checklist with the local emergency number, one-tap messages,
  "today I've got this" task list), home card for babies under 8 weeks with a low-mood nudge from shared moods,
  Biz tile, `PartnerNotificationsScreen`, tour v2 texts and Ata AI step.
- **Image:** `gateway@sha256:f24217c2b5c0813489aa73d02892265e23258d0488e40671e586f124da207725` from `6f795048…`; isolated test matched.
- **Deploy:** `partner-pp-web-plan.json` passed; index `102adcb0…`; no console errors.
- **Rollback:** `rollback-partner-pp-web-plan.json` (→ `6f795048…`). To undo the claim filter: drop the wrapper and
  rename `claim_communication_notification_core_v2` back.

## Solid food guide alignment and Aptek offer frame — 2026-10-30
- **Contents:** commit `00c6a30`. Guide chip rows (tabs, ages, food groups) start on the card edge
  (`.sfg-chips`); the Aptek home offer uses a real border with `overflow: hidden`, so the full-width product
  rail no longer paints over the green frame.
- **Image:** `gateway@sha256:26fb99ea3ebb73bb99adf86c7cd350e3c0e8e972cbdde7b1eed151a7583d5e6b` from `f24217c2…`; isolated test matched.
- **Deploy:** `fix-sfg-aptek-web-plan.json` passed; index `bb27c6dd…`; no console errors.
- **Rollback:** `rollback-fix-sfg-aptek-web-plan.json` (→ `f24217c2…`).

## Körpəmdən mesajlar — 2026-10-30
- **Contents:** commit `3972fd6`. Pregnancy dashboard card + `baby-chat` screen: the baby's daily message (existing
  `pregnancy_daily_content.baby_message`) arrives at a per-user/per-day time between 09:00 and 20:30; the mother's replies
  get curated, week-aware baby answers (`src/data/baby-chat`, 21 languages; no AI, nothing medical). Threads stay on the
  device (last 14 days). On-device local notifications for the next 7 arrivals (`src/lib/baby-chat-notifications.ts`;
  tap → pushNav `baby_chat`). Share as a 1080×1920 photo or a recorded message-by-message video with pop sounds
  (`src/lib/baby-chat-share.ts`). No SQL, server job or functions change.
- **Image:** `gateway@sha256:c1ffe62e75275e1254692bd7942c1e555515a95dc39074202924ecccd02bc7d0` from `26fb99ea…`; isolated test matched.
- **Deploy:** `baby-chat-web-plan.json` passed; index `094dff49…`; no console errors.
- **Rollback:** `rollback-baby-chat-web-plan.json` (→ `26fb99ea…`).
