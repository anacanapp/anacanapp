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
