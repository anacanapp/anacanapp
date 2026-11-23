# Mərcan Cümə (Black Friday 2026)

Owner request 2026-11-23: Anacan Premium campaign from today to 30 November 2026 23:59:59 Baku (19:59:59Z), from the
design hand-off `MERCAN_CUME_HANDOFF.md` (prototype `mercan-cume.html`).

## Owner decisions (2026-11-23)
- Renewal: subscribers keep the discounted price on every renewal until they cancel (existing web Premium rule).
- Prices: yearly $9.99 (was $29.99, −67%), monthly $1.99 (was $3.99, −50%). Epoint charges AZN 16.99 / 3.39
  (display rate 1 USD = 1.70 AZN, stated before paying).
- Audience: Azerbaijani + every website language (21). Payment: Epoint (AZN) for Azerbaijani and for visitors in
  Azerbaijan (Asia/Baku or an -AZ locale) whatever the language; Dodo Payments (USD) for everyone else.
- App banners on the five 11.11 placements; PDF book banners pause until the campaign ends.
- Banner style (owner feedback): no photos, no dark fields; coral, peach and white with the characters.
- An account that already has Premium (store or web) sees "Premium is already active" (the server refuses a second
  subscription), so the offer is for accounts without Premium.

## Pieces
- Page: `public/website/premium/mercan/` (`index.html`, `mercan.css`, `mercan.js`, `copy/<lang>.json` for 21
  languages, `banners/`). Sign-in is the shared `account.js` (texts now in 21 languages). Checkout: 3 steps (plan,
  account, payment) in a full-screen sheet; Epoint returns through `/website/premium/kampaniya/` (forwards here
  2026-11-23…30 and on 1 Dec for late returns), Dodo returns with `?done=1`.
- Server: `supabase/migrations/20261123090000_mercan_cume_campaign.sql` (+ `.cdc.json`):
  `app_settings.web_premium_campaign` = `mercan-2026` (previous value in `web_premium_campaign_before_mercan`),
  `app_settings.dodo_campaign` = `{campaign: 'mercan', codes: {yearly: 'MERCAN', monthly: 'MERCANAY'}, page, window}`,
  105 in-app banners, book banners start after the campaign.
- Dodo discount codes (live, created on the server with the functions' key): `MERCAN` 66.69% off the yearly product
  ($29.99 → $9.99), `MERCANAY` 50.13% off the monthly product ($3.99 → $1.99), every renewal, expire 2026-11-30T19:59:59Z.
- `dodo-checkout`: per-plan campaign codes and the campaign return page (`_shared/dodo-campaign.ts`, tested in
  `src/lib/dodo-campaign.test.ts`); the 11.11 shape still works.
- Banners: `scripts/banners/mercan/render-mercan-banners.mjs` renders 3 designs × 21 languages in 1200×500 (app,
  phones) and 2240×320 (website wide). App: `assets/banners/promo/mercan-<design>-<lang>-20261123.jpg`; home_top coral,
  tools_top + community_top peach, profile_top + ai_chat_top light; English also serves ky, et, tk, uk; free users only.
  Website: `src/website/CampaignMercan.tsx` (coral above the home hero, peach above the journal, light after articles),
  hidden outside the window.

## After the campaign
Nothing has to be switched off: the server campaign, the Dodo codes, the banners and the website component all end at
2026-11-30T19:59:59Z; the page then shows "Mərcan Cümə bitdi". Restore the previous campaign value only if a later
campaign needs it (`web_premium_campaign_before_mercan`).
