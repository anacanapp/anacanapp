# Website → app store attribution (2026-11-14)

Every App Store / Google Play link on anacan.az carries a campaign that names where the link was.

## Campaign names
`web_<placement>`:
- `web_download_page` — download page opened directly; `web_download_page_from_<page>_<section>` when the visitor came
  from another page (`<page>` = route kind such as home, article, news, faq, ovulation; `<section>` = card, header, footer,
  tool, link). Remembered in sessionStorage (`anacan_download_from`) by the click handler in `Website.tsx`.
- `web_tool_<tool>` — store buttons under the "open in app" card on tool pages; `web_tool_<tool>_open` is the Android
  intent fallback when the app is not installed.
- `web_premium_abune_hero`, `web_premium_kampaniya_hero`, `web_premium_1111_hero`, `web_premium_app_page`,
  `web_premium_app_page_open`, `web_premium_checkout_done` — static Premium pages.

## Parameters
- Google Play: `&referrer=utm_source=anacan.az&utm_medium=website&utm_campaign=<campaign>&utm_content=<language>`.
  Visible in Play Console (Statistics / store listing acquisition by UTM) and in the app's Firebase `first_open` campaign.
- App Store: `https://apps.apple.com/app/anacan/id6758301924?pt=<provider>&ct=<campaign>&mt=8`. App Store Connect →
  App Analytics → Acquisition → Campaigns. `ct` counts only when `pt` (the App Store Connect provider ID) is set:
  `APPLE_PROVIDER_TOKEN` in `src/website/store-links.ts` and `public/website/analytics.js` (empty until the owner gives it).

## GA4
Each click sends `store_click` with `store` (ios/android), `link_campaign`, `placement`, `page_type`, `language`,
`link_url`. Code: `src/website/store-links.ts` (React site) and the `data-store` / `data-store-placement` handler in
`public/website/analytics.js` (static pages). The custom dimensions must be registered once in GA4 Admin.

## Deploy
Gateway `sha256:2717cb92…` (plan `storelinks-web-plan.json`, rollback `rollback-storelinks-web-plan.json`), website
`sha256:d844a5da…` (backup plan `website-runtime-plan.before-storelinks.json`).

# SEO weeks 1-2 (2026-11-15)
- Week 1: question-style seoTitle/seoDescription for the 30 pages with the largest Search Console click gap
  (`20261115100000_seo_week1_titles.sql`), names pages 2026-2027, calculator meta in 21 languages, `/index` 301.
- Week 2 (E-E-A-T): verified WHO-first source lists for all 93 articles (`20261115120000_eeat_article_sources.sql`,
  63 cite WHO, every URL opened on 2026-11-15) and the editorial team page (`editorial` route, 21 localized slugs,
  linked from the article byline with rel=author, footer and Organization `publishingPrinciples`).
- The website image was flattened (it had reached Docker's layer limit, 124 layers): website `sha256:e3bce6ba…`
  is built `FROM scratch` + `COPY --from=<previous> / /` with the same ENV/WORKDIR/USER/ENTRYPOINT/CMD/label.
  Gateway `sha256:dc91e65a…`. Plans: `eeat-web-plan.json` / `rollback-eeat-web-plan.json`,
  `website-runtime-plan.before-eeat.json`.

# SEO content pages (2026-11-15)
- Owner request: short answer on the website, the full guide in the app. Code `src/website/seo-hubs/` (texts `content-az.ts`,
  routes `routes.ts`, conversion blocks `AppConvert.tsx`), az only, published (`SEO_HUBS_PUBLISHED`):
  `/az/usaqda-qizdirma/`, `/az/elave-qida/` + `6-ay`..`12-ay`, `/az/hamilelikde-olar-olmaz/` + 20 answers,
  `/az/ana-sudu-saxlama/`, `/az/aybasi/` (also 301 from `/az/menstruasiya/`, `/az/period/`, `/az/regl/`).
- Pregnancy week pages are back as teasers (`PREGNANCY_WEEKS_ENABLED`/`PUBLISHED` true): quick answer, facts, one baby
  paragraph, danger signs, 2 FAQ; the rest is listed as locked sections in the app.
- Every page: app pill under the heading, dark inline banner, locked-section gate, sticky bottom bar. Store campaigns
  `web_seo_<area>_<pill|inline|gate|sticky>` (e.g. `web_seo_week_12_gate`, `web_seo_fever_gate`, `web_seo_solid_6_gate`).
  Safety content (fever decision, danger signs) is never gated.
- Every medical number checked on the cited NHS/ACOG/AAP/WHO/NICE/CDC page on 2026-11-15.
- Deploy: gateway `sha256:a888241d…` (plan `hubs-web-plan.json`, rollback `rollback-hubs-web-plan.json`), website
  `sha256:924304ab…` (backup plan `website-runtime-plan.before-hubs.json`). After the website container is recreated, run
  `docker exec anacan-gateway nginx -s reload`: the gateway kept the old container address and answered 502 for about
  4 minutes until reloaded.
