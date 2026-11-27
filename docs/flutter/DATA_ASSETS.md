# Flutter port: data and assets

Static content that becomes Flutter assets (or stays a download) instead of Dart code. Measured on
`claude/blissful-sagan-lqhvv9` (HEAD `8e2bac89`). "Consumers" are files of the native consumer graph (see
`PARITY_MATRIX.md`). Decision column: **bundle** = ship under `app/assets/`, load lazily per language;
**download** = fetched at runtime as today; **not needed** = no native use.

## 0. Common loading rules to keep

- **Per-language feature copy** (`createFeatureText`, `src/lib/feature-text.ts`, and the hand-written loaders in
  `baby-chat`, `pregnancy-loss`, `postpartum-partner`, `partner-missions`, `solid-food-guide`, `health-sync`,
  `email-verification`): file `./<lang>.json`, else `./en.json`, else `./az.json`. All files share the `az.json` shape
  (vitest checks this). Loaded asynchronously; the hook returns `null` until loaded (UI renders nothing/placeholder).
  `{name}` placeholders are filled by `fill()` (unknown names are left as `{name}`).
- **Language registries** (`parenting`, `play-together`, `kid-exercises`): an explicit loader map per language;
  a language missing from the map means "no content in this language" (the tile/entry is hidden or falls back to az,
  see each row), never an English fallback.
- 25 app languages: `az en ru tr kk de ar uz ka zh id fr es pt vi hi ja ko pl nl sv ky et tk uk`
  (`src/lib/app-languages.ts`; `ar` is RTL). The website stays on 21.

## 1. `src/data/**` (16 MB, ≈ 205 000 lines)

| Path | What it is | Format / layout | Size | Consumers | Decision |
|---|---|---|---|---|---|
| `parenting/` | Tərbiyə content: SOS cards, articles, programmes, quizzes, age bands | TS modules, one folder per language (25 × `{index,bands,sos,programmes,quizzes,articles-*}.ts`) + `index.ts` lazy registry + `types.ts`; default export `ParentingContent` | 327 files, 8.8 MB, 83 618 lines | `tool.parenting` (`lib/parenting*.ts`, `components/tools/parenting/*`) | **bundle** as JSON per language (convert TS → JSON at build); merge `parenting_content_overrides` by item id at runtime |
| `kid-exercises/` | Baby/kid exercise library (sets by age band) | `<lang>.json` × 25 + `index.ts` (az source + translated overlays) + `tile.ts`, `ui-az.ts`, `types.ts` | 30 files, 2.0 MB | `tool.kid-exercises`, `ToolsHub` tile | **bundle**; images `public/exercises/<band>/<id>.webp` (below) |
| `play-together/` | "Uşaqla oyun" game cards | TS per language (`<lang>.ts` × 24 + `az.ts` source) + `ui-az.ts`, `tile.ts`, `types.ts`; registry with az fallback | 30 files, 960 KB | `tool.play-together`, `ToolsHub` tile | **bundle** (TS → JSON) |
| `solid-food-guide/` + `solidFoodGuide.ts` | Solid food guide texts + food table | `<lang>.json` × 25 + `index.ts`; table in TS | 26 files, 484 KB + 4 KB | `tool.solid-food` | **bundle** |
| `baby-chat/` | "Körpəmdən mesajlar" daily scripted messages | `<lang>.json` × 25 + loader | 336 KB | `screen.baby-chat` (`useBabyChat`) | **bundle** |
| `pregnancy-loss/` | 8-week loss recovery guide, partner support, signs | `<lang>.json` × 25 + loader | 588 KB | `screen.loss-*`, `profile.pregnancy-card`, partner loss cards | **bundle** |
| `postpartum-partner/` | Partner "first 8 weeks" | `<lang>.json` × 25 | 380 KB | `screen.postpartum-support`, partner home cards | **bundle** |
| `recovery/` | Postpartum recovery weeks + Kegel | `<lang>.json` × 25 (feature text) | 272 KB | `screen.recovery` | **bundle** |
| `illness/` | Illness tracker copy | `<lang>.json` × 25 (feature text) | 224 KB | `screen.illness` | **bundle** |
| `partner-missions/` | Partner daily missions per stage `{key: [title, description]}` | `<lang>.json` × 25 | 228 KB | `partner.home-cards` (`usePartnerMissions`) | **bundle** |
| `ttc/` | Trying-to-conceive section copy | `<lang>.json` × 25 | 204 KB | `home.ttc` | **bundle** |
| `sleep-next/` | Next-nap section copy | `<lang>.json` × 25 | 172 KB | `home.next-nap` | **bundle** |
| `health-sync/` | Health sync screen copy | `<lang>.json` × 25 | 144 KB | `screen.health-sync` | **bundle** |
| `widgets/` | Home-widget labels + daily words (`words[]`) | `<lang>.json` × 25 | 132 KB | `svc.home-widgets`, `screen.widgets`, Profile | **bundle** (also feeds the native widget snapshot) |
| `email-verification/` | E-mail code screen copy | `<lang>.json` × 25 | 112 KB | `gate.email-verify` | **bundle** |
| `feedback/`, `lock-offer/`, `promo/`, `sponsor/` | Small feature copies | `<lang>.json` × 25 each | ~108 KB each | `overlay.feedback`, `overlay.lock-offer`, `promo.redeemer`/`route.promo-landing`/Auth/Profile, `paywall.sponsor` | **bundle** |
| `stories/az.ts` | Dashboard stories (weeks, months, phases rows; template text with `==x==`, `__x__`, `**x**`, `{var}` markers) | TS, Azerbaijani only | 60 KB | `home.stories` | **bundle** (TS → JSON) |
| `books/catalog.json` | PDF book catalogue (id, age, topic, title, about…) | JSON array, Azerbaijani | 48 KB | `screen.books` (`lib/books/catalog.ts`) | **bundle**; covers `public/books/covers/<id>.webp` |
| `maternityRules.ts` | Maternity benefit rules per country | TS tables | 44 KB | `tool.maternity` | port as Dart const or JSON asset |
| `maternity-regional.json` | Regional maternity rules with sources | JSON | 18 KB | `lib/maternity-regional.ts` | **bundle** |
| `maternity-regional.references.json` | Source notes | JSON | 7 KB | none | **not needed** (dead) |
| `olivia-products.json` | Curated Olivia.az catalogue (51 products, image `/olivia/<id>.webp`) | JSON | 24 KB | `screen.aptek` (`lib/olivia-catalog.ts`) | **bundle** + images |
| `rossmann-products.json` | Rossmann catalogue (collections → ids, products, image paths) | JSON | 90 KB | `screen.aptek` (`lib/rossmann-catalog.ts`) | **bundle** + images |
| `country-names-ky.json` | Kyrgyz country names | JSON | 7 KB | `lib/app-languages.ts` | **bundle** |

## 2. UI string catalogues (i18n, see `SERVICES.md` §4)

| Path | What | Size | Consumer | Decision |
|---|---|---|---|---|
| `src/locales/az.json` | az UI dictionary, **eager** (main bundle) | 586 KB | `lib/i18n.ts` | **bundle**, load at startup |
| `src/locales/en.json` | en UI dictionary (lazy) | 641 KB | `lib/i18n.ts` | **bundle** |
| `scripts/i18n/<lang>.seed.json` × 23 (all except az, en) | Bundled per-language seeds (also contain the build-generated `inline_<file>_<sha12>` keys) | 19.5 MB total (~850 KB each) | `lib/i18n.ts` via `import.meta.glob` | **bundle**, load one language lazily |
| `scripts/i18n/copy/<lang>.json` × 25 | Redesign/Aptek/baby-care copy (`copyText(section, key)`; en eager fallback) | 770 KB | `lib/ui-copy.ts` | **bundle** |
| `scripts/i18n/{feature37,maternity36,followup36,followup36-content,moderator,community-moderation,brand-ads,brand-lead,blog-editorial,books,onboarding-features,premium,privacy,regional,sticker}-copy.json` | One multi-language JSON per feature (`{lang: {key: text}}`) | 47 KB–642 KB each, ≈ 3.0 MB | `lib/*-i18n.ts`, `booksCopy.ts`, `privacyCopy.ts`, `lib/stickers.ts`, `lib/brand-ads.ts`, `lib/ads/leadForm.ts` | **bundle** (split per language at build if size matters) |
| `countries.json` (repo root) | Countries with base64 PNG flags, currency | 497 KB | `InitialLanguageScreen`, `CountrySelect`, `ProfileScreen` | **bundle** (consider extracting flags to files) |
| `src/lib/community-language-vocabulary.json` | Language-evidence words for post language detection | 1 KB | `lib/community-language-evidence.ts` | **bundle** |
| `src/lib/ads/placements.json` | Ad placement ids/policy table | 4 KB | `lib/ads/config.ts` | **bundle** |
| DB `translations` table | Admin overlay on top of the bundled dictionaries | remote | `lib/i18n.ts` | **download** (as today; cached in `anacan_i18n_cache:<lang>`) |

Inline copy: `scripts/i18n/inline-localization.mjs` rewrites literal JSX text at build time into
`tr('inline_<basename>_<sha256(text)[0..12]>', '<az text>')`. The Flutter port has no build step that sees JSX, so the
export script must emit these keys and their az defaults (same algorithm: key = `inline_` + lower-cased file basename
without extension + `_` + first 12 hex of sha256 of the trimmed text) so the existing seeds/overlay keep matching.

## 3. Content packs (16 languages, not bundled; **download** as today)

- Languages: `NEW_LANGUAGE_CODES` = `zh id fr es pt vi hi ja ko pl nl sv ky et tk uk`. Source bundles:
  `scripts/i18n/content/<lang>.json` (109 MB total; schema `anacan-content-translations-v1`,
  `{language, sourceHash (64 hex), values: {key: translated}}`), keys `${rowId}:${field}:${sha256(source text)}`
  (`scripts/i18n/content-translation-core.mjs`, `contentTranslationKey(row, field)`).
- Build (`scripts/i18n/content-packs.mjs`, web builds only; native builds emit nothing and Codemagic deletes
  `dist/content-packs`): per field, if total bytes ≥ 32 KB (TARGET 256 KB / 8) it gets `2^k` buckets (max 32) so each
  shard ≤ 256 KB; bucket = `parseInt(first 8 hex of the key's hash) % buckets`; ids `field` or `field.N`. Smaller fields
  are packed greedily (sorted) into shared `_misc.N` shards. Shard file `<id>.<sha256[0..16]>.json`, content =
  canonical JSON (object keys sorted by code unit) of `{schema:'anacan-content-pack-shard-v1', language, shard, values}`.
  Manifest `manifest.json` = canonical JSON `{schema:'anacan-content-pack-manifest-v1', language, sourceHash, keys,
  fields: {field: [shardIds]}, shards: {id: {file, sha256, count, bytes}}}`.
- URL: `https://app.anacan.az/content-packs/<lang>/manifest.json` and `/content-packs/<lang>/<file>` (override
  `VITE_CONTENT_PACKS_ORIGIN`). Native fetch uses CapacitorHttp (text), manifest with `Cache-Control: no-cache`.
  Timeouts: manifest 15 s, shard 20 s.
- Validation: manifest schema/language/sourceHash/shard id regex `^[a-z0-9_]+(\.[0-9]+)?$`, file regex
  `^<id>.<16 hex>.json`, file must start with `<id>.<sha256[0..16]>.`, every field id must exist. Shard: parse →
  re-serialize canonically → sha256 must equal manifest sha256 → schema/language/shard checks. Hash is computed on the
  canonical text, so transport re-encoding does not matter.
- Storage: IndexedDB `anacan-content-packs`, store `kv`: `m:<lang>` (canonical manifest text), `s:<lang>:<shardId>`
  (canonical shard text). Hot list `anacan_content_pack_hot:<lang>` in localStorage (≤ 64 most recently used shard ids,
  preloaded by `prepare`). In Flutter: files under app support dir with the same keys; re-download if lost.
- Runtime order: `prepare(lang)` (at language switch, never awaited before first render) loads cached manifest; if no
  manifest yet, awaits network revalidation; loads hot shards. `lookup(row, field, lang)` is synchronous: returns the
  value or `undefined` and triggers the shard load; a cached shard with an **older** sha256 is still served while the
  current one downloads. Failures: shard backoff `min(10 min, 15 s · 2^(n-1))`, manifest retry after 30 s, `online`
  event → `retry()`. After a revalidated manifest, cached shards no longer listed are deleted. Subscribers are notified
  when a missed lookup's shard arrives (React re-renders and re-maps cached queries via `content-pack-refresh.ts`).
- Fallback order for DB content (`lib/tr.ts` `mapRowTranslation`), pack languages: `row.<field>_<lang>` → content-pack
  value → (`ky`, `tk` only) `<field>_ru` → `<field>_en` → `<field>_az` → `<field>`. Other languages:
  `az`: `_az` → base; `kk`/`uz`/`ka`: own → `_ru` → base → `_az`; `de`/`ar`: own → `_en` → base → `_az`; rest: own →
  base → `_az`. Array fields stored as JSON strings are parsed (newline-split fallback).

## 4. `src/assets/**` (1.6 MB)

| Path | What | Consumers | Decision |
|---|---|---|---|
| `assets/onboarding/*.webp` (57 used) | Onboarding companion illustrations, picked by `import.meta.glob(..., {eager, query:'?url'})` | `gate.onboarding` (`OnboardingCompanion.tsx`) | **bundle** |
| `assets/fetus/month-1..9.svg` | Fetus illustrations (fallback when no remote illustration) | `home.dashboard`, `home.fetus-hero` | **bundle** (flutter_svg) |
| `assets/brand-mark.png` | Brand mark | StartupScreen, AuthScreen, OnboardingFrame, InitialLanguageScreen, AppLockScreen, PromoLanding | **bundle** |
| `assets/logo.png`, `assets/onboarding/{README.md,manifest.json}` | – | none | **not needed** |

## 5. `public/**` items the native bundle really uses (25 MB folder; 9.6 MB `website/` is deleted for native)

| Path | Size | Referenced by | Decision |
|---|---|---|---|
| `stickers/01..60.webp` | 3.0 MB | `lib/stickers.ts` (`/stickers/NN.webp`; mirrored in public storage for old builds) | **bundle** |
| `exercises/<band>/*.webp` (150) | 2.4 MB | `lib/kid-exercises.ts` `exerciseImage()` | **bundle** |
| `books/covers/*.webp` | 2.3 MB | `lib/books/catalog.ts` `bookCover()` | **bundle** |
| `rossmann/*.webp`, `olivia/*.webp` | 2.3 MB + 344 KB | `rossmann-products.json` / `olivia-products.json` image paths | **bundle** |
| `aptek/*.webp` | 920 KB | Aptek product rows in DB (`20261027090000_aptek_store.sql`) store app-relative `/aptek/...` paths | **bundle**, resolve relative image paths from DB against the asset folder (or `https://app.anacan.az`) |
| `partners/{olivia,rossmann}/{icon,logo}.png` | 44 KB | partner shop rows / admin | **bundle** (verify DB paths) |
| `recap/recap-2026.mp3`, `recap/fonts/*.woff2` (Plus Jakarta Sans subsets, Switzer 400/500/700) | 1.3 MB + 132 KB | `lib/recap/{model,fonts,export}.ts` | **bundle** (convert woff2 → ttf for Flutter) |
| `fonts/NotoSans-{Regular,Bold}.ttf`, `NotoNaskhArabic-{Regular,Bold}.ttf` | 1.4 MB | `lib/pdfReport.ts` (PDF embedding) | **bundle** (used by `pdf` package) |
| `blog-covers/*.webp` | 900 KB | `lib/blog-editorial.ts` uses the local path only when **not** native (`VITE_NATIVE_BUILD !== 'true'`); native keeps the remote URL | **not needed** (remote) |
| `templates/*` | 20 KB | admin only | **not needed** |
| `sdk/anacan-partner.js` | 12 KB | partner websites | **not needed** |
| `brand-mark.png`, `brand-mark-coral.png`, `brand-mark-white.png` | 28 + 20 + 48 KB | `RootErrorBoundary`, `lib/baby-chat-share.ts` (brand-mark); `ScreenCaptureGuard`, `PrivacyConsentSheet`, `lib/recap/export.ts` (coral); `lib/recap/export.ts` (white) | **bundle** |
| `placeholder.svg` | 4 KB | `AffiliateProductDetail.tsx` image fallback | **bundle** |
| `favicon*`, `icon-*.png`, `icon.png`, `manifest.json`, `robots.txt` | – | web shell | **not needed** (app icons live in native projects) |
| `website/**` | 9.6 MB | website | **not needed** |

## 6. Game data

| Path | What | Consumers | Decision |
|---|---|---|---|
| `components/games/word-garden/data/az.json` | Current lexicon `az-202611-v3` (7 745 words, 5 606 targets, locale `az-AZ`) | `game.word-garden` (`library.ts`, compiled in the worker) | **bundle**, load in an isolate |
| `word-garden/data/az-v1.json`, `az-v2.json` | Published older revisions `az-202610-v1/v2`, kept byte-identical so unfinished saved rounds reopen with the same words | `library.ts` `PUBLISHED_LIBRARIES` | **bundle** (must stay byte-identical; revision mismatch → `WORD_GARDEN_LIBRARY_REVISION_MISMATCH`) |
| `color-sort/catalog.json` (6 KB), `iki-dost/catalog.json` (16 KB), `parking/catalog.json` (29 KB) | Pre-generated level catalogues | `levels.ts` of each game | **bundle** |
| `saglam-sebet/levelConfig.ts`, `birlesdir/levelConfig.ts` + `tileDefs.ts` | Level tables in TS | those games | port as Dart consts |
| `games/*/messages.ts` (color-sort 260, iki-dost 257, qabarciq 138, casual 65, word-garden 65 lines) | 25-language game copy in TS | each game | port as JSON assets or Dart maps |
| `games/*/*.css` | Game visuals | each game | tokens/painters (counted in `core.design-tokens`) |

## 7. Fonts

- **Nunito** (400–900) and **Inter** (400–800, italics 400/600/700) are loaded at runtime from Google Fonts by
  `src/index.css` (`@import url(https://fonts.googleapis.com/...)`); offline first launch falls back to system fonts.
  Flutter: **bundle** (already present in `app/assets/fonts/{nunito,inter}`).
- **Noto Sans Arabic**: `@fontsource/noto-sans-arabic` (npm, bundled) for `ar`; `font-family: 'Noto Sans Arabic',
  'Nunito'`. Flutter: **bundle** (`app/assets/fonts/noto_sans_arabic`).
- PDF fonts (`public/fonts`) and Recap fonts (`public/recap/fonts`): see §5.

## 8. Other embedded tables worth moving to assets

Large text tables currently inside `src/lib/*.ts`: `lib/vaccine-labels.ts` (249), `lib/weaning-copy.ts` (390),
`lib/parenting-copy.ts` (199), `lib/qaygicash-copy.ts` (143), `lib/onboarding-i18n.ts` (258), `lib/tip-translations.ts`
(210), `lib/chat-i18n.ts` (157), `lib/recap/copy.ts` (186), `lib/appUpdate-i18n.ts` (38), `lib/whoGrowthData.ts`
(WHO growth curves, 102), `data/maternityRules.ts`. They are counted as code in the matrix; porting them as JSON
assets is optional.
