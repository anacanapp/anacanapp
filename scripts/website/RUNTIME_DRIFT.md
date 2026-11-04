# Website runtime — production drift notice (2026-11-01)

The public marketing site (`anacan-website` Node SSR container) runs from a source tree that is **newer
than this branch**. On 2026-11-01 the hand-written runtime files here were re-synced from the live
container (`/app/server/`) so they match production:

- `server.mjs` — live production server (incl. the `/<lang>/p/` sponsor pay route added 2026-11-01).
- `prerender.mjs`, `indexnow.mjs`, `llm-policy.mjs`, `llm-runtime.mjs` — live production runtime modules.

## (Historical, resolved 2026-11-04) The renderer source was NOT in this branch

`server.mjs` imports from `./renderer.mjs`:

```
renderWebsite, renderArticleContent, resolveWebsiteRoute, routePath, PAGE_SLUGS, sitePath,
localizedSlug, WEBSITE_ORIGIN, APP_LANGUAGES, renderLlmDocument, renderLlmIndex, renderLlmHub,
renderLlmManifest, renderLlmJournal, discoveryLinks, discoveryLinkHeader, markdownPath
```

The `renderLlm*` / `discoveryLinks` / `markdownPath` exports (LLM docs `/llms.txt`, per-locale sitemaps,
`index.md` markdown routes, IndexNow, discovery link headers) come from **`src/website/` TypeScript that
does not exist in this branch** — `grep -r renderLlm src` returns nothing here. `renderer.mjs` is a
~977 KB build artifact (`build-server.mjs` → from `src/website/server-render.tsx`); the live one is
`sha256:02bc1985f9e5cf8ac5c8f91fdb66ed9a93e9f8ff3f02ffe0791884783accf1a8` and is intentionally **not**
committed.

**Consequence:** running `node scripts/website/build-server.mjs` from this branch produces a
`renderer.mjs` WITHOUT those exports. Shipping that image would crash the server (missing imports) and
regress the live site's SEO/LLM/sitemap/markdown features.

## To rebuild the website image safely

1. Recover the upstream `src/website/` source that built the live `renderer.mjs` (the branch/commit that
   added the LLM/SEO/markdown/IndexNow work) and merge it into this repo.
2. Then `npm run build:website && node scripts/website/build-server.mjs` will produce a `renderer.mjs`
   that matches the committed `server.mjs`.

Until then, build the website image only from that upstream source — not from this branch. The
`/<lang>/p/` route in the live image was added by patching the live `server.mjs` directly (see
`docs/REDESIGN_APTEK_HANDOFF.md`, "Widgets redesign … sponsor pay" deploy entry).

## Resolution (2026-11-04): renderer source recovered

The missing `src/website/` source was recovered from the live `renderer.mjs` (unminified SSR bundle,
`sha256:02bc1985…`) and the live client bundle, so `npm run build:website` and
`node scripts/website/build-server.mjs` from this branch now produce output equivalent to production:

- `src/website/discovery.ts` — `markdownPath`, `llmIndexPath`, `llmFullPath`, `localeSitemapPath`,
  `discoveryLinks`, `discoveryLinkHeader`.
- `src/website/llm-content.ts` — `LLM_COPY`, `LLM_PAGE_KINDS`, `LLM_FORMAT_VERSION`, `llmLanguageName`,
  `renderLlmDocument`/`Index`/`Hub`/`FullHeader`/`Manifest`/`Journal` (HTML→Markdown via
  `unified` + `rehype-parse@9.0.1` + `rehype-remark@10.0.1` + `remark-gfm` + `remark-stringify`;
  `hast-util-to-text` is pinned to 4.0.2 through `overrides` to match the bundled production code).
- `src/website/llm-copy.json` — per-locale LLM index/footer labels (21 website languages).
- `server-render.tsx` exports exactly the live renderer's 26 names. `APP_LANGUAGES` is the website's
  21-language list (`WEBSITE_LANGUAGES`); app-only `ky`/`et` stay excluded from the website.
- Ported component/schema drift: coral brand mark (`/website/brand-mark-coral.png`), footer
  `site-machine-links` (LLM/Markdown links) and `--site-logo` CSS, `websiteSchema` (`legalName`,
  `APP_ID`, Markdown `encoding`, localized `articleSection`, MobileApplication on every page),
  and client `updateWebsiteHead` discovery links / `apple-itunes-app` / `og:locale:alternate`.

Verified against the live artifacts: identical export list; every renderer function body matches the
live bundle except intended differences (21-language `WEBSITE_LANGUAGES` naming, the new `/az/` shop
routes/pages, formatting). `llms.txt`, `robots.txt`, `sitemap.xml` and `404.html` (modulo asset hashes)
are byte-identical; all 441 non-article Markdown documents in `llms-full.txt` and all manifest page
entries are identical; article/sitemap differences come only from the newer live catalog data.
