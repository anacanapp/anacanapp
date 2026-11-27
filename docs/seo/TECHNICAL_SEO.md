# Technical SEO: anacan.az

Scope: the public website (`src/website/`, SSR renderer built by `scripts/website/build-server.mjs`,
runtime `scripts/website/server.mjs`, standalone prerender `scripts/website/build.mjs` + `prerender.mjs`).
21 website languages; Azerbaijani-only news, shop and dekret pages; baby-name pages in `az` and `ka`.

## What exists

| Area | Where | Notes |
|---|---|---|
| Title / description / canonical / hreflang | `src/website/seo.ts` `websiteMeta()` | One function feeds SSR, prerender and the client head update. |
| Structured data (`@graph`) | `seo.ts` `websiteSchema()` | Organization, WebSite, WebPage/CollectionPage/ContactPage, BreadcrumbList, FAQPage, BlogPosting, tool nodes (`tools/tool-schema.ts`). |
| Robots | `scripts/website/llm-policy.mjs` `websiteRobots()` | `User-agent: *` + `Allow: /`; only private prefixes are disallowed (`/website/data/`, `/auth/`, `/rest/`, `/functions/`, `/admin/`, `/brands/`). No per-bot rules, so Googlebot, Bingbot and Yandex are allowed. |
| Sitemap index | `llm-policy.mjs` `sitemapIndex()` -> `/sitemap.xml` | Lists the 21 locale sitemaps and `sitemap-pages.xml` / `sitemap-blog.xml`. |
| Locale sitemaps | `server.mjs` `localeSitemap()`, prerender `sitemap-<lang>.xml` | Pages, journal pages 2+, tools (names, dekret), az news/shop, articles; each with its hreflang cluster. |
| Pages / blog sitemaps | `server.mjs` `sitemap()`, prerender | Cross-language views of the same URLs, kept for existing Search Console submissions. |
| IndexNow | `scripts/website/indexnow.mjs` | Bing/Yandex push on article changes (needs `indexnow-key.txt` in the runtime root). |
| LLM discovery | `llms.txt`, `llms-full.txt`, `/<lang>/index.md` | Unchanged by this work. |

## What changed (2026-11)

- **Metadata lengths.** Static page copy values in `src/website/copy/*.json` and `details/*.json` were shortened or
  extended (values only, no keys added or removed) so every static page in every language has a title of 60 or fewer
  and a description of 70 to 160 (display width: Han, Kana and Hangul count double). ` | Anacan` is appended only
  when it still fits (`brandTitle`). News titles keep the part before the colon when too long; long leads are cut at
  a sentence or word (`fitDescription`).
- **Journal pagination.** `/<lang>/<journal>/2/` and later pages have their own title (`… – Səhifə 2`, `… – Page 2`,
  localized from `copy.page`) and description, a self canonical, `index,follow`, and are in the sitemaps.
- **Organization schema.** Logo `ImageObject` with width/height, `foundingDate: 2026-03-01`, founders Türkan Sultanlı and
  Camil Sultanlı, `address.addressCountry: AZ`, and `sameAs` limited to the Instagram/Facebook profiles the footer
  links to plus the App Store and Google Play listings (the unlinked YouTube URL was removed).
- **BlogPosting schema.** `inLanguage`, `datePublished`/`dateModified`, image with real pixel width/height
  (`src/website/cover-sizes.json`, written by `node scripts/website/cover-sizes.mjs`; CMS covers not on disk get no size
  rather than a guessed one), `keywords` and `about` from tags, `isPartOf` the WebSite, `wordCount` (not for zh/ja).
  No `reviewedBy` or medical reviewer is claimed. `og:image:width/height` follow the same sizes.
- **Image sitemaps.** Every article `<url>` in the locale and blog sitemaps carries `<image:image>` with the absolute
  cover URL and the localized title; all urlsets declare `xmlns:image`.
- **Sitemap index** now also lists `sitemap-pages.xml` and `sitemap-blog.xml`; az shop pages (`/az/kitablar/`,
  `/az/tortlar/`) were added to the az/pages sitemaps (they were indexable but unlisted).
- **Core Web Vitals.** `fetchpriority="high"` is now emitted as the lowercase DOM attribute (`images.ts`
  `HIGH_PRIORITY`): React 18 dropped the camelCase prop and logged a warning on article and news pages. The image
  preload for the LCP cover also carries `fetchpriority="high"`. Switzer 400 (body font) is preloaded.

## Core Web Vitals measurements

Standalone build served locally (`scripts/website/preview.mjs`, no compression), Playwright Chromium, Pixel 7
emulation, 150 ms RTT / 1.6 Mbps / 4x CPU, median of 3 runs.

| Page | LCP before | LCP after | CLS before | CLS after | Transfer |
|---|---|---|---|---|---|
| `/az/` | 2392 ms | 2476 ms | 0.0027 | 0.0015 | 1.62 MB |
| `/en/` | 2276 ms | 2344 ms | 0.1104 | 0.0009 | 1.60 MB |
| article (`/az/ana-sudunun-merheleleri-…/`) | 2264 ms | 2368 ms | 0.0001 | 0 | 1.62 MB |
| `/az/ovulyasiya-kalkulyatoru/` | 1840 ms | 1912 ms | 0.007 | 0.0001 | 1.53 MB |

The font preload trades about 70 to 100 ms of LCP on slow 4G for removing the `/en/` hero shift (CLS from "needs
improvement" to good). Preloading all four above-the-fold faces (82 KB) removed every shift but cost about 400 ms LCP,
so only Switzer 400 is preloaded. The article page no longer logs the React `fetchPriority` warning.

Not changed (bigger work): the single JS bundle is 1.2 MB uncompressed (about 75% of every page's transfer) and is
the main remaining cost; route-level code splitting would help most. Nine partner logos on the home/news pages have
no width/height; they are lazy, below the fold and sized by CSS, so they did not register as shifts.

## Running the audits

```sh
npx vitest run src/website/seo-audit.test.ts            # hard checks (static lengths, hreflang, canonical, schema, robots)
SEO_AUDIT_REPORT=1 npx vitest run src/website/seo-audit.test.ts -t 'article metadata'   # rewrite docs/seo/article-meta-audit.md
npx vitest run src/website && npx tsc --noEmit -p tsconfig.app.json
```

`seo-audit.test.ts` covers every static page in every language (home, the `PAGE_SLUGS` pages, journal pages 2+,
az news/shop, and all tool pages from `toolSitemapEntries()`: names hub/gender/letter/detail in az and ka and the
dekret calculator): 1 027 page routes plus 1 575 article language versions from `scripts/website/catalog`, about
48 000 alternates. Checks:

- static titles of 60 or fewer and descriptions of 70 to 160 (failure); CMS articles are reported only
  (`docs/seo/article-meta-audit.md`, fix them in the CMS `editorial_metadata.locales.<lang>.seoTitle/seoDescription`);
- canonical = `https://anacan.az` + the route's own path with a trailing slash, resolving without a redirect;
- hreflang: exactly one `x-default`, a self entry, no duplicate codes, every alternate resolves (no 404, no
  redirect) to the same page kind/article/slug in its language, and lists the identical cluster (reciprocity);
  name detail and letter pages are single-language by design (self + `x-default` only);
- Organization and BlogPosting fields; robots allows crawlers and lists the sitemap index; image sitemap output.

Live check after a build (`build:website` + `build-server.mjs`, run `server.mjs` with a root that has the built
site, `copy/`, `details/` and `article-routes.json`): fetch `/sitemap.xml`, every listed sitemap must return 200
with `xmlns:image` where images appear, and sampled URLs must return 200 with a self canonical. On 2026-11-10 that
gave 23 sitemaps, 3 001 unique URLs, 3 906 image entries and 0 failures in a 121-URL sample.

## Checklist for search engines

Google Search Console (domain property `anacan.az`):
- Submit `https://anacan.az/sitemap.xml` only (it lists all others); remove stale individual submissions if they error.
- Indexing > Pages: watch "Alternate page with proper canonical" and "Duplicate without user-selected canonical"
  after journal pagination became indexable; check the Image sitemap counts under Sitemaps.
- Enhancements: Breadcrumbs, FAQ and Article reports should show no errors; run the Rich Results Test on one
  article, `/az/`, the dekret page and a name detail page.
- International targeting is hreflang-driven; no country targeting needed.
- Core Web Vitals report (mobile): confirm CLS on `/en/`-type pages after the font preload has field data (28 days).

Bing Webmaster Tools:
- Import from Search Console or submit `https://anacan.az/sitemap.xml`; confirm IndexNow is "Active" (key file served
  at the root) and that URL submissions appear after article updates.
- Site Explorer: check that `/brands/` and API prefixes are shown as blocked by robots and nothing public is.

Yandex Webmaster:
- Add and verify `https://anacan.az`, submit `https://anacan.az/sitemap.xml`, check Indexing > Sitemap files for
  parse errors (image namespace is supported) and enable IndexNow.
- Robots.txt analysis: `User-agent: *` rules apply to Yandex; no `Clean-param` needed (no tracking parameters in
  canonical URLs).
