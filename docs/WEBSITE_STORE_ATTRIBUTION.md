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
