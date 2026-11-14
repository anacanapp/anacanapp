# In-app promo banners (method)

Reusable way to make image banners that promote our own tools (cakes, PDF books, and
later any other tool) and open them with an in-app deeplink. First used 2026-11-05 for
Tortlar and PDF kitablar.

## 1. Creative format (no size problems)
- One size for every banner: **1200 × 500 px (2.4 : 1)**. The app's `ImageBanner`
  (`src/components/banners/BannerSlot.tsx`) renders `w-full h-auto` inside a rounded,
  shadowed button, so the creative is full-bleed: no own corners, border or shadow.
- On a phone the banner is ~343 px wide (scale ~0.29), so text sizes are fixed by the
  renderer: title 74 px (~21 px on screen), subline 38 px, CTA 36 px. Keep the title to two
  short lines and the subline to one; the renderer warns when copy overflows.
- Brand: Anacan mark + wordmark, Plus Jakarta Sans 600 for titles, Switzer for body,
  coral `#ff5a5f` CTA pill. Layouts: `split` (photo right), `trio` (three round photos),
  `fan` (three covers), `row` (four covers), `card` (one cover), `bold` (coral background).

## 2. Render
```
PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium \
  node scripts/banners/render-promo-banners.mjs scripts/banners/specs/<spec>.json <outDir>
```
- Spec fields: `id, layout, bg?, ink?, accent?, eyebrow, title (*word* = accent), sub, cta,
  images[], link {link_type, link_url}`. Images are https URLs (fetched by Node) or paths.
- Output: `<id>.png` per banner and `contact.png`, which shows every banner at phone width
  for approval. Show `contact.png` to the owner before uploading anything.
- Example spec: `scripts/banners/specs/cakes-books-20261105.json` (3 cake, 3 book variants).

## 2b. Premium upsell banners (free users)
- Scene art: Nano Banana Pro (Vertex `gemini-3-pro-image`, aspect `21:9`) with a prompt that keeps the
  left 55% as plain negative space, subject on the right, Anacan pastel/coral palette, and no text,
  logos or UI. All copy is rendered by the script (`layout: "scene"`, `badge: "Anacan Premium"`,
  `veil: [solid%, clear%]` to hide hard photo edges, `ink` for dark scenes).
- Copy sells features only (all tools, ad-free, sleep sounds, growth curves, weekly reports). No
  prices or trial lengths: store prices and trial eligibility differ per store/country/user.
- Targeting: `audience_tiers = {free}` (own banners honour it since 2026-11-05, so Premium members never
  see them), link `/premium`. Example: `scripts/banners/specs/premium-20261105.json`.

## 3. Deeplink targets
Banners use `link_type = 'internal'` with an app deeplink path. `BannerSlot` parses it with
`parseDeeplink` (`src/lib/deeplink.ts`) and dispatches the `anacan:deeplink` window event;
`src/pages/Index.tsx` routes it exactly like an external `anacan://` or app.anacan.az link.
- `/cakes`: Tortlar (Azerbaijan only, guarded in Index).
- `/books`, `/my-books`: PDF book store / purchased books (az language or admin only).
- `/tool/{tool_id}`: any tool (e.g. `/tool/solid-food-guide`); `/premium`, `/blog/...` etc.
- New targets: add the route to `DEEPLINK_ROUTES` and `parseDeeplinkRoute`, plus a test in
  `src/lib/deeplink.test.ts`.

## 4. Upload and activation
- Convert PNG to WebP (sharp, quality ~86) and upload to public storage
  `assets/banners/promo/<id>-<yyyymmdd>.webp`.
- Insert into `public.banners` with `banner_type='image'`, `is_active=false`, `placement`
  (usually `home_top`), `link_type='internal'`, `link_url`, and targeting: for cakes and books
  `target_languages={az}` (cakes also `target_countries={AZ}`). The owner activates the
  banner in Admin → Bannerlər; nothing goes live without that switch.
- `banners` is a Google relation; writes go through the existing admin/CDC-guarded path
  (`run-sql.py` on the VM), never directly against Source.

## 5. Gotcha: own banners and Premium users (2026-11-09)
Every banner gets an "Anacan" brand creative (`ad_brand_creatives`), so `brand_banner_eligible_v3` treats it as
branded. A branded banner with `audience_tiers = NULL` is shown to **free users only** (Premium is ad-free). For a
promo that everyone in the audience should see (e.g. PDF books for all az moms), set
`audience_tiers = {free,premium}` explicitly; keep `{free}` for Premium upsell banners.
Example: `kitab-2-sira` on home_top, tools_top, community_top, profile_top (az + mommy, `/books`).

## 6. Platform targeting is enforced on the server too (2026-11-09)
`target_platforms` used to be filtered only in the app (BannerSlot, builds from 2026-11-05). Migration
`20261109170000_banner_platform_server_guard.sql` adds `request_client_platform_v1()` (User-Agent: Android →
`android`, iPhone/iPad/iPod → `ios`, else unknown) and withholds a platform-targeted banner from a known platform it
does not list on every read path: inventory v3, inventory v2 and direct table reads (restrictive RLS, admins exempt).
So an iOS-only banner never reaches Android, old builds included. Unknown user agents (e.g. iOS native HTTP
"CFNetwork/Darwin") fall back to the app's own filter.
Note: on the old v2 path (builds before inventory v3) own branded banners are hidden from Premium users regardless of
`audience_tiers`; v3 builds honour `audience_tiers`.

## 7. Minimum app version (2026-11-09)
`creative_options.min_app_version` (e.g. `"49"`) hides a banner from older app builds on the server
(`20261109180000_banner_min_app_version.sql`, `banner_client_allowed_v1`). The version comes from the
`X-Anacan-Version` header that native builds send from 50.0.2 on (`src/integrations/supabase/client.ts`), else from
the newest `user_consents.app_version` (the consent screen ships with 49.0, so users without a record are on older
builds). Admins are exempt. The PDF book banner uses `min_app_version = 49` (books and `/books` exist from 49.0).

## 8. 11.11 Poz-Aç campaign banners (2026-11-10)
- Three designs × five languages (az, en, tr, kk, uz), `assets/banners/promo/1111-<lang>-<n>-20261110.jpg`.
  Banner 3 → `home_top`; banner 2 → `tools_top`, `community_top`; banner 1 → `profile_top`, `ai_chat_top`.
- Each links (external) to `https://anacan.az/website/premium/1111/index.html?lang=<lang>&utm_…&utm_content=<placement>`.
  `audience_tiers={free}`, `sort_order=-10`, window now → 2026-11-11T19:59:59Z.
- az: `target_languages={az}`, `target_countries={AZ}`, active. tr/kk/uz: own language; en: the 19 other app
  languages; created **inactive** until the owner approves after the az test (switch in Admin → Bannerlər).
- Kazakh needs Cyrillic: Plus Jakarta Sans has none, so the renderer falls back to Manrope (cyrillic subsets) for it.
- Live check: simulated 200 AZ users; every free user had the az home banner in `get_banner_inventory_v3`.
- Update (owner, same evening): all 11.11 banners are active in every language and country (az no longer AZ-only);
  `creative_options.server_tiers=["free"]` + `audience_tiers={free,premium}` so admins see them whatever their
  Premium state (`20261110210000_banner_server_tiers_admin.sql`; other Premium users never get them from the server).
  PDF book banners paused by `start_date = 2026-11-11T20:00Z` (12 Nov 00:00 Baku): they return by themselves.
- Website: `src/website/Campaign1111.tsx` shows the same creatives (`public/website/premium/1111/banners/<lang>-<n>.webp`):
  banner 3 above the home hero, 2 above the journal, 1 after each article; hides itself after 2026-11-11T19:59:59Z.
  Web sizes: `<lang>-<n>-wide.webp` 2240×320 (shown 1120×160) from 720 px up via <picture>; phones keep 1200×500.
  Live: gateway `a0b7e6d8…` (plan `web1111w-web-plan.json`), runtime `513b028a…` (rollback `website-runtime-plan.before-web1111w.json`).
  Deployed: gateway `85d65dca…` (plan `web1111-web-plan.json`), runtime `04b4840f…`
  (rollback: `website-runtime-plan.before-web1111.json`). Note: a web plan's `indexSha256` is the app `/index.html`
  hash, keep the inherited value.
- Fix (2026-11-11): `requires_v3` is generated and turns true when `audience_tiers` contains `premium`, which hid the
  11.11 banners from older builds (Android, v2 feed). They now use `audience_tiers = NULL` + `server_tiers=["free"]`:
  every build renders them, the server still withholds them from Premium non-admins. Never put `premium` in
  `audience_tiers` for a banner that must reach older builds.
- Pushes: campaign links may be `https://anacan.az/…` (`20261111073000_campaign_deeplink_website.sql`); the push
  runner `/home/anacan-runner/push1111.py` sends one group at a time (flock) with retries, since parallel audience
  previews hit the statement timeout.

## Live set (2026-11-14)
- PDF kitablar: four Azerbaijani family scene creatives (`kitab-a1-korpe`, `kitab-a6-printer`, `kitab-a2-boya`,
  `kitab-a5-herf`, `-20261114.jpg`, spec `scripts/banners/specs/books-family-20261114.json`) on Ana səhifə and İcma,
  az + AZ + mommy, targeted by youngest child age (0–540 since `20261114130000`, 540–2190, 1095–2190, 1460–2190 days), "Anacan" brand.
  Every older `/books` row is off. Migration `20261114120000_book_banners_family_by_age.sql`.
- Tortlar (off since 2026-11-13; `tort-1-foto`, `tort-2-uclu`, `tort-3-bir-yas`, `-20261113.jpg`): İcma, Alətlər, Profil; az + AZ,
  bump/mommy, min app version 49, assigned to the "Anacan" brand so impressions and clicks are measured
  (`ad_metrics_daily`, shown in Admin → Bannerlər). Migration `20261113180000_cake_promo_banners.sql`; the brand
  assignment runs `admin_brand_action_v1('assign_banner', …)` as an admin.
- `banners.requires_v3` is a generated column (true when audience_tiers includes premium, or week/child-age/lead-form
  targeting): never list it in an INSERT.
