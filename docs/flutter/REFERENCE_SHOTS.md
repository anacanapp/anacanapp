# Reference screenshots (React app → Flutter parity)

Plan §5.5–5.6 (`docs/FLUTTER_MIGRATION_PLAN.md`): the React/Capacitor consumer app in `src/` is rendered
deterministically on fixed data, and every screen is captured in two sizes, light/dark and `az`/`en`/`ru`/`ar`.
Flutter golden/integration screenshots are compared against these files. Harness: `tools/reference-shots/`.

## Run it

```bash
# whole matrix: 45 scenarios × 2 viewports × 2 themes × 4 languages (720 cells, ~3,100 PNGs; ~100 min on 4 cores)
node tools/reference-shots/run.mjs --run full

# one screen, quickly (≈20 s including dev-server start)
node tools/reference-shots/run.mjs --scenario bump.tool.kick --viewport 390x844 --theme light --lang az --dpr 1

node tools/reference-shots/run.mjs --list                       # scenarios and cell count
node tools/reference-shots/compare.mjs <runA> <runB>            # determinism / regression check
```

Flags: `--scenario a,b,prefix*` `--persona p` `--lang az,ar` `--theme dark` `--viewport 360x800` `--run <name>`
(default: timestamp) `--workers 4` `--dpr 3` `--retries 1` `--fonts auto|cached|fallback` `--platform native|web`
`--chrome-flags det` (extra raster flags, see Determinism) `--verbose` (page errors).

Requirements: Node 22, the repo's `node_modules` (Vite), and a Playwright with installed Chromium. The harness
prefers the globally provisioned Playwright (`require('playwright')` from `/`), falls back to the repo copy, or
`PLAYWRIGHT_MODULE=/path/to/playwright`. Nothing is installed, nothing outside `tools/reference-shots/` is written.

## Output contract (what Flutter consumes)

```
tools/reference-shots/out/<run>/<viewport>/<theme>/<lang>/<scenario>__<shot>.png
tools/reference-shots/out/<run>/index.json        # one entry per PNG
tools/reference-shots/out/<run>/unmocked.json     # every request that had no fixture (see below)
tools/reference-shots/out/<run>/_errors/...       # last frame of a failed cell
```

* `<viewport>` = `390x844` (iPhone 14/15 class, presented as **iOS**) or `360x800` (Android class, presented as
  **Android**: the app then adds `html.a-lite a-noblur`, i.e. no backdrop blur and no endless animations — this is the
  real Android behaviour, see `src/App.tsx`). CSS viewport in dp/pt; PNG pixels = viewport × `deviceScaleFactor`
  (default **3**, so 1170×2532 and 1080×2400). Screenshots are the viewport only (the app scrolls inside
  `[data-scroll-container]`, not the document); scrolled states are separate shots (`home-2`, `home-3`).
* `<theme>` = `light` | `dark` (next-themes `localStorage.theme` + `prefers-color-scheme` emulation).
* `<lang>` = `az` | `en` | `ru` | `ar` (`ar` is RTL; `dir="rtl"` set by the app).
* `<scenario>` = `<persona short>.<area>[.<id>]`, e.g. `bump.tabs`, `mommy.tool.baby-tracker`, `gate.first-run`;
  `<shot>` = state inside the scenario (`home`, `home-2`, `tools`, `profile-family`, `kick`, …).
* `index.json` → `shots[]`: `{scenario, shot, persona, viewport, theme, lang, file, sha256, stable, unmocked}`
  plus run metadata (`frozenTime`, Chromium version, DPR, font mode, viewports with UA/platform, failures).
  `stable:false` means the page never produced two identical consecutive frames (treat as suspect).

A Flutter golden for `mommy.tabs__home` at `390x844/dark/ar` must render the same persona fixture
(`tools/reference-shots/fixtures/mommy-6m/`) at 390×844 logical px, DPR 3, dark theme, Arabic, frozen clock
`2026-11-20T09:00:00+04:00` (Asia/Baku), and is compared with that file.

### Tolerance guidance

References are Blink (desktop Chromium, software raster); Flutter renders with Skia/Impeller and its own text
shaper. Exact pixel equality is not achievable even for a perfect port:

* Text: glyph rasterisation, hinting and sub-pixel positioning differ; line breaking can differ at a word boundary.
  Compare text regions perceptually (SSIM ≥ 0.97 per tile, or a per-pixel threshold ~0.1 in YIQ like `pixelmatch`)
  and treat **layout** (box positions/sizes within ±1 logical px, same line count) as the hard gate.
* Shapes/gradients/shadows: anti-aliasing differs at edges; allow ≤ 0.5 % changed pixels per screen with
  per-pixel threshold 0.1, and flag any changed region > 24×24 logical px for manual review (plan §5.6).
* Emoji: see below — always mask or compare loosely.
* Run-to-run noise of the references themselves is listed under "Determinism"; never set a tolerance tighter than it.

## How the app is rendered

* **Server:** `vite --mode google` dev server on a free port, env from the process (Vite gives process env priority
  over the repo's `.env*`; nothing is written to the repo root): `VITE_NATIVE_BUILD=true` (skips the store-launcher
  page, `src/web-entry/`), `VITE_SUPABASE_URL=https://api.anacan.az`, a fake anon key, no `VITE_BACKEND_BOOTSTRAP`
  (admission is not source-first, so the SDK targets the URL directly), Codemagic feature flags
  (`VITE_AZURE_GOOGLE_OAUTH_ENABLED`, `…APPLE…`, `…PARTNER_PAIRING`, `…REVENUECAT…` = `true`), Firebase/Customer.io
  unconfigured. Dev was chosen over `vite build` + preview: it is up in ~1 s, transforms are cached in memory across the
  run's pages, and a production build takes minutes and runs extra prerender/verify steps; the rendered CSS/DOM is the
  same source.
* **Native presentation:** an init script sets `window.CapacitorCustomPlatform = {name:'ios'|'android'}` so
  `Capacitor.isNativePlatform()` is true (native-only UI, no "web mode" banners, `body.native-app`); plugin calls fall
  back to each plugin's web implementation. A few native-only methods (push/local notification permission, FCM token,
  Firebase Analytics) get fixed answers through Capacitor's own `PluginHeaders`/`nativePromise` path
  (`NATIVE_STUBS` in `lib/page-setup.mjs`). `--platform web` renders the browser variant instead.
* **Determinism:** clock fixed with `context.clock.setFixedTime(2026-11-20T09:00:00+04:00)` (timers still run),
  timezone `Asia/Baku`, locale per language, seeded `Math.random`, `prefers-reduced-motion: reduce`, injected CSS
  zeroing animation/transition durations (end state, single iteration), hidden carets/scrollbars, Playwright
  `animations:'disabled'`, framer-motion's `MotionGlobalConfig.skipAnimations/instantAnimations` switched on by
  appending one line to Vite's pre-bundled `framer-motion.js` as it is served (route interception, no source change),
  `overflow-anchor:none`, service workers blocked, `--force-color-profile=srgb`. A tab tap is retried until the tab
  reports `aria-current="page"`. A shot waits for: no request in flight for 700 ms (browser-level, includes lazy
  chunks), no startup screen, no visible spinner, fonts loaded, images decoded, then takes screenshots until two
  consecutive frames are identical.
* **Seeded state** (`lib/page-setup.mjs`): the GoTrue session under `sb-api-auth-token`
  (`resolveAuthStorage('https://api.anacan.az')`, `src/integrations/supabase/auth-storage-key.ts`; fake JWT with `exp`
  far after the frozen clock, so no refresh happens), the zustand store `anacan-user-store` (`language`,
  `hasSelectedLanguage`, life stage…; `src/store/userStore.ts`), `localStorage.language` (`src/lib/i18n.ts` boot
  language), `theme`, the privacy-consent decision, and the "already seen" flags of one-time tours/prompts
  (partner tour, onboarding tour, lock offer, rating, daily prompt — keys from `src/lib/migration-export.ts`).
  Seeding happens once per tab, so the app's own reload after a language choice keeps in-app writes.

### Fonts and emoji

* Inter, Nunito and Plus Jakarta Sans come from Google Fonts in the app (`src/index.css`). The harness serves them from
  `tools/reference-shots/.cache/fonts/` (gitignored); on a miss (`--fonts auto`, default) the file is fetched **once**
  with curl through the environment proxy using a desktop-Chrome UA (woff2), later runs are offline. `--fonts cached`
  never fetches (misses are logged as `font-miss`); `--fonts fallback` serves empty CSS (system fonts — not
  parity-grade; recorded in `index.json`). Noto Sans Arabic is the app's own `@fontsource` import.
  Flutter must bundle the same families/weights (plan §5.3).
* **Emoji are the Linux system font (Noto Color Emoji)** in these references. On devices the WebView draws Apple Color
  Emoji (iOS) or the device's Noto/Samsung emoji (Android), and Flutter draws whatever the platform supplies. Emoji
  glyphs therefore never match across platforms: mask emoji boxes or compare them by size/position only. The fixtures
  use emoji deliberately (they are part of the real content), so the masks are needed anyway.
* References are rendered in **desktop Chromium (Blink, Linux)**, not in iOS WKWebView (WebKit) or Android System
  WebView. Besides emoji: WebKit and Blink differ in text rasterisation, `backdrop-filter`, form controls and
  font-weight synthesis; there are no safe-area insets (`env(safe-area-inset-*)` = 0, no notch/status bar), and native
  overlays (AdMob banners, the native splash, system sheets/permission prompts) do not exist. Chromium's ICU has no
  Azerbaijani region names, so `Intl.DisplayNames('az')` returns codes (the country list shows "AZ, AF, …" in `az`);
  devices show localised names.

## What is mocked

All network goes through `lib/network.mjs`; nothing reaches a real server and no account is needed.

| Traffic | Answer |
|---|---|
| Vite dev server (same origin), content packs | passed through |
| `fonts.googleapis.com`, `fonts.gstatic.com` | local cache (see above) |
| `https://api.anacan.az/.well-known/anacan-backend.json` | fixed managed admission policy (`no-store`) |
| `/auth/v1/*` | `user` / `token` return the persona's user and session; signed-out personas get 401/400; `logout` 204 |
| `/rest/v1/<table>` | generic PostgREST mock over `fixtures/<persona>/tables/<table>.{json,mjs}` → `_shared` |
| `/rest/v1/rpc/<name>` | `rpc/<name>.{json,mjs}` (`.mjs` default export receives `(ctx, args)`); missing → `null` |
| `/functions/v1/<name>` | `functions/<name>.{json,mjs}`; missing → `{}` |
| `/storage/v1/object/...` | `fixtures/<persona|_shared>/_assets/<bucket>/<path>` or a deterministic pastel placeholder PNG |
| Realtime websocket | stub: every `phx_join`/heartbeat acknowledged, nothing pushed |
| any other host (analytics, ads, CDNs, images) | empty 204 / empty script / placeholder PNG, logged as `external` |

PostgREST mock semantics (`lib/postgrest.mjs`): `select` (top-level columns, aliases, `->` paths; embedded resources
are returned as stored in the fixture row), filters `eq neq gt gte lt lte in is like ilike cs cd ov` with `not.`,
`or=(…)`/`and=(…)` (nested), `order` (multi-key, nulls first/last), `limit`/`offset`, `Prefer: count=…` →
`Content-Range`, `HEAD`, single-object `Accept` (406 `PGRST116` on 0 rows), `maybeSingle`. Writes (`POST` incl.
upsert/`on_conflict`, `PATCH`, `DELETE`) apply to an in-memory copy for the rest of that browser context, so
"save then re-read" flows work; nothing is persisted. Unsupported filters are ignored and logged as `filter`.

`unmocked.json` lists every table/RPC/function/storage/auth/external request without a fixture (deduplicated, with the
scenarios and personas that made it). Add fixtures until the screens you care about no longer appear there.

## Fixtures and personas

`tools/reference-shots/fixtures/<persona>/persona.json` + `tables/`, `rpc/`, `functions/`, `_assets/`;
`_shared/` holds reference content used by everyone (tool configs, weekly/daily pregnancy content, trimester tips,
blog, community feed and profile cards, baby/mommy daily content, flow insights, names, hospital-bag templates,
providers, premium entitlement, consents…). `_lib/` holds helpers (`ml()` for `_az/_en/_ru/_ar` columns, shared casts).

| Persona | State |
|---|---|
| `new-user` | fresh install, signed out |
| `new-signup` | signed in, no life stage, consents not given (consent gate + privacy sheet) |
| `signup-country` / `signup-onboarding` | extend `new-signup`: country gate / onboarding journey |
| `bump-week24` | pregnant, 24 w 2 d, Premium, appointments, weight, kicks, BP, logs, hospital bag |
| `flow-day12` | cycle day 12 of 28 (fertile window), free plan, 5 past cycles, period/flow logs |
| `mommy-6m` | one girl (Aylin, 183 days), Premium, a week of sleep/feeding/diaper logs, growth, milestones |
| `partner-linked` | father linked to `bump-week24` (household Premium, sharing on, couple chat) |

JSON fixtures may use tokens relative to the frozen clock: `{{date:-3}}` (Baku calendar date), `{{iso:-2h}}`,
`{{iso:+10d}}`, and persona `vars` (`{{user_id}}`, `{{profile_id}}`, …). `.mjs` fixtures get `ctx`
(`ctx.date()`, `ctx.iso()`, `ctx.vars`, `ctx.persona`, `ctx.now`) and the RPC/function arguments.

**Add a persona:** create `fixtures/<name>/persona.json` (`signedIn`, `user`, `vars`, `store` overrides for
`anacan-user-store`, optional `premium`, `householdPremium`, `consents: accepted|none|off`, `privacyDecided`,
`seenDefaults`, `localStorage`, or `extends: <persona>`), then `tables/profiles.json` (columns:
`src/integrations/supabase/types.ts`). Run a scenario for it and fill what `unmocked.json` reports.

**Add a scenario:** a file in `scenarios/*.mjs` exporting one object or an array of
`{ id, persona, steps(page, h), langs?, themes?, path?, waitFor? }`. Helpers `h`:
`ready()` (network idle + fonts + images + no startup/spinner), `shot(name, {fullPage, locator})`,
`tab(id)` (bottom bar `data-tour="tab-<id>"`), `openTool(id)` (taps the Tools tile `data-tour="tool-<id>"`, falls back
to the in-app deeplink for tools that live inside a host tool), `screen(name)` / `deeplink(action, params)` (the app's
own `anacan:deeplink` event — the path banners/pushes use), `back()`, `tap(textOrSelector)`, `scroll(y)` (re-applied until
stable), `sleep(ms)`. Scenario ids must be unique; keep `<persona short>.<area>.<id>`.

## Coverage now (45 scenarios)

* Gates: language → country → intro → auth (`gate.first-run`), consent gate + privacy sheet, country gate,
  onboarding journey (first step).
* Shell: 5 tabs for bump/flow/mommy (home + 2 scrolled states, tools, community, profile with its Mən/Ailə/Ayarlar
  segments, AI — paywall sheet for the free `flow` user), partner shell (Bu gün, Birlikdə, Mesajlar, Məsləhət, Profil).
* Sub-screens: settings (gear button), notifications, calendar (bump/flow/mommy), edit-profile, appearance, privacy,
  help, billing, referral, widgets, partner notifications.
* Tools (24): bump kick, maternity calculator, weight, hospital bag, names, mental health, safety, blood pressure,
  danger signs, fetal growth, vitamins, doctors; mommy baby tracker (+ growth, teething sections), vaccine calendar,
  first aid, sleep training, solid-food guide, white noise; flow mental health, horoscope, doctors, weight (paywall).

### Known gaps

* **Not reachable/captured yet:** brand splash (1.5 s, transient by design); email verification screen; force-update
  and blocked screens (need `app_update`/`user_blocks` fixtures + scenarios); AI chat conversation states (needs a
  `dr-anacan-chat` function fixture with streaming); community post detail/comments, stories, groups, DM threads;
  admin/moderator panels (out of scope); onboarding steps after the first; paywall/purchase flows beyond the sheet;
  remaining ~25 tools (photoshoot, cry translator, recipes, album, games, Word Garden…) and pages under `/legal`,
  `/blog`. All are reachable with the existing helpers once fixtures exist; none needs an in-app hook.
* Content-heavy tools whose tables are not fixtured render their real empty state (e.g. first aid scenarios,
  teething, Aptek products). `unmocked.json` names them.
* Desktop-Chromium differences listed under "Fonts and emoji" (emoji, ICU `az` region names, no safe areas).
* `contraction` (min week 28) is correctly locked for the week-24 persona; it needs a later-week persona.

## Determinism

`compare.mjs <runA> <runB>` compares two runs by sha256 and counts changed pixels (via `sharp`), split into
unscrolled and scrolled shots (`index.json` marks shots taken after `h.scroll(y>0)` with `scrolled: true`).

Measured (two clean runs each, DPR 3, same machine):

| Subset | Unscrolled identical | Scrolled identical | Overall flake |
|---|---|---|---|
| 11 scenarios × 2 viewports × light/dark × az/ar (352 shots) | 279/288 | 60/64 | 3.7 % |
| bump/mommy/flow tabs + settings + baby tracker, 2 vp × 2 themes × az/ar (240 shots) | 180/184 | 34/56 | 10.8 % |
| bump/flow/mommy tabs, 2 vp × light × az/ar (108 shots) | 81/84 | 15/24 | 11.1 % |

What still differs, and how to treat it:

* **Unscrolled shots:** byte-identical except ≤ 0.01 % of pixels (≤ ~250 px at DPR 3) of anti-aliasing on a few
  rounded controls, switch thumbs, gradient icons and small dots; visually identical. Ignore diffs below 0.1 %.
* **Scrolled shots (`home-2`, `home-3`, `settings-2`):** cards in part of the frame are rendered with a sub-pixel
  (≤ 1 px) vertical offset in some runs (0.1–3 % of pixels). The scroll is re-applied until position and scroll height
  are stable and scroll anchoring is off; the remaining offset comes from fractional layout heights settling in a
  different order. Compare scrolled references with layout tolerance (±1 px), or prefer the unscrolled shots and
  element-level comparisons for the gate.
* One real flake class was found and fixed: a tab tap during a screen change was dropped (63 % different frame);
  `h.tab()` now retries until the tab is active.
* Chromium raster flags (`--chrome-flags det`: no partial/threaded raster, no LCD text, single raster thread) were
  measured and did **not** reduce the noise (93/108 vs 96/108 identical), so they are opt-in only.
