# Web Premium funnels (2026-11-24)

Owner request: build a clean, logical web funnel system for Anacan that sells Premium and raises MRR, including the
Black Friday (Mərcan Cümə) page. Analyse the Deepstash growth-plan funnel and the Mobbin funnels, deliver 5-6 funnel
prototypes and a sales system.

Prototype (clickable, 6 funnels + system view): `docs/prototypes/web-funnels/index.html` (images in `img/`).
Prices in the prototype are the live web prices: yearly 50.98 ₼ (= $29.99), monthly 6.78 ₼ (= $3.99);
Mərcan Cümə 16.99 / 3.39 ₼. Offers marked as proposals (downsell, win-back -40%, gift) do not exist yet.

## Deepstash growth-plan, walked on 2026-11-24 (390 px, en-US)
31 steps before the email gate; the paywall (`/growth-plan/web-paywall`) is only reachable after sign-up, so its
wording comes from the site's own JS bundle.

1. Landing: "Replace doomscrolling with microlearning", 10M+ users, award badge, one Continue.
2. Gender (the first answer moves you forward), age group.
3. Topics (multi-select), frustrations (single), 8 agree/disagree statements (1-5 scale), learning style,
   big-picture vs detail, introvert/extrovert, information sources, best time of day.
4. "Let's find your perfect content mix", 5 "Does this book seem interesting? Yes/No" cards.
5. Reason for self-growth, daily goal (5/10/15 min).
6. Loader "We are crafting your growth plan…" with three bars and review carousel; at ~45% of each bar a modal
   question ("To move forward, specify: Do you self-reflect? No/Yes") pauses the loader.
7. "Your growth plan is ready!" (Goals, Topics, Content), then the email gate ("create your personal account").
8. Paywall (bundle strings): "Based on your answers, we crafted a self-growth plan", "Your personal growth plan",
   "Choose your plan", "Total per day", "Total due today", "Trial reminder", "Flip the switch to get the deal",
   seasonal banners ("Black Friday Sale!", "Christmas Offer!", "Mother's Day!", "Secret Offer!"),
   "Claim bonus offer", "People reported this top 6 benefits after the first month", "Join over 10M+ people",
   discount and promo-code support.

Patterns taken: personalised plan as the product, many short single-tap questions, agree/disagree statements,
"investment" before the price, a loader with an embedded question, plan before email, email before paywall,
per-day price, trial toggle and reminder, seasonal offer banner, exit/bonus offer.

## Mobbin references (iOS)
- Noom, personalised plan setup: interstitials ("Great job, Sam!"), "Cross-checking with user database…" loader,
  "Based on your answers…", 7-day trial with "Personalized plan reserved for 15 minutes" timer.
- Flo onboarding: "Are you pregnant?" first split, consent screen, multi-select goals, plan screen with a free-trial
  toggle, Yearly "Most popular" and a Friends Plan (up to 5 friends).
- Stardust: "Choose your journey" (cycle, TTC, pregnancy, following my partner), trial timeline
  (today / this week / in 7 days).
- 5 Minute Journal: "How your free trial works" (today, day 6 reminder, day 7 charge), "No payment now".
- Alma: 7-day trial paywall with rating, five benefits, yearly pre-selected with % off.
- Lifesum "Find your plan" test, Life Reset "Based on your answers" and story timeline, Superpower lifestyle quiz.

## The six funnels
1. **Şəxsi plan quiz-i** (main, all year): ad → 12 questions → loader with question → personal plan → account →
   paywall (plan reserved 15 min, yearly pre-selected at 0,14 ₼/day) → checkout → success + partner invite.
2. **Mərcan Cümə**: ad → offer landing with countdown → "for me / gift" → stage → personalised offer → checkout →
   share the same price with a friend. Exit offer: monthly 3,39 ₼.
3. **Free tool → Premium** (SEO): due-date calculator → free result + blurred weekly plan → email → soft paywall.
4. **Gift (fathers, family)**: "the most useful gift" → recipient → note → one-off 1-year Premium → gift card sent by
   WhatsApp; redemption through the existing promo system (`/h/:code`, promo-redeem).
5. **7-day trial** (test, Dodo first): 3 questions → trial timeline with day-5 reminder → 0 ₼ today.
6. **Win-back for free users**: email/push at a stage change ("Lily is 6 months") → personal recap → 48-hour
   one-time yearly offer → checkout (already signed in). Only by email/push: linking from the app to web purchase
   is not allowed by Apple in this region.

## What exists and what is missing
- Exists: shared account (`account.js`), Epoint (AZN, saved card) and Dodo (USD) checkout, `web_premium_campaign`,
  abandoned-checkout reminder (`web-premium-nudge`), Customer.io email, push segments, promo codes,
  analytics events `checkout_open`, `checkout_start`, `purchase_confirmed`.
- Missing: funnel step events (`funnel_view`, `funnel_start`, `funnel_step`, `plan_view`, `lead`, `paywall_view`),
  Meta Pixel + Conversions API on the site, quiz answers written to the profile, a shared paywall component with
  downsell, per-account one-time offers (win-back), gift purchase (one-off) → promo code, trials (Dodo
  `trial_period_days`; Epoint card binding without a charge needs the bank).

## Build order
1. Analytics events + Meta Pixel/CAPI + UTM stored on the account.
2. Funnel 1 at `/website/premium/plan/`, answers saved to the profile.
3. One paywall component for all funnels, with downsell.
4. Five-email sequence (Customer.io).
5. Funnel 6 + per-account offer.
6. Funnel 4 (gift) on the promo system.
7. Funnel 3 on the website (needs a website build and deploy; ship `dist/assets/` to the gateway too, see
   `docs/WEBSITE_GOOGLE_20261006.md`).
8. Funnel 5 (trial), Dodo first.

Rules: no fake timers (the 15-minute reservation must really end, or show no timer), no invented numbers (46,000+
downloads and 4.84 ★ are the deck figures), annual pre-selected with the per-day price, discounts only in dated
campaigns or one-time personal offers, "discount kept on every renewal" stays for campaign prices.

## Live funnel: personal plan + Mərcan Cümə (2026-11-24)
`/website/premium/plan/` (`index.html`, `plan.css` on top of `mercan.css`, `plan.js`), az / en / ru (other
languages fall back to en). Steps: intro → stage → week / baby age / own age → worries (multi) → social proof →
two agree statements → partner → minutes a day → loader with one question → personal plan → account (shared
`account.js`, same account as the app) → paywall → Epoint (AZN) or Dodo (USD).
- Prices: the server's current offer (`web-premium` status `offer`): Mərcan Cümə 16.99 / 3.39 ₼ while it runs,
  the standard 50.98 / 6.78 ₼ after; Dodo $9.99 / $1.99 with the `mercan` campaign codes while it runs, $29.99 /
  $3.99 after. Before sign-in the page shows the same prices from the campaign window. No backend change.
- Campaign only: real countdown (ends 2026-11-30T19:59:59Z), "price kept on every renewal" line, one-time
  downsell on ✕ (monthly 3.39 ₼ / $1.99, an existing price, no new offer).
- Returns: Epoint comes back to `kampaniya/`, Dodo to `mercan/` or `premium/`; each has a head script that sends a tab
  marked `sessionStorage.anacan_funnel = 'plan'` back to the funnel (and sets `ANACAN_FUNNEL_FWD` so `kampaniya.js`
  and `premium.js` do not redirect elsewhere). The funnel then polls `status` until Premium is on.
- Answers live in this tab only (sessionStorage) and go to analytics: `funnel_view`, `funnel_start`, `funnel_step`,
  `plan_view`, `lead`, `paywall_view`, `downsell_view`, `downsell_take`, `checkout_start`, `purchase_confirmed`
  (all with `funnel_id: 'plan'`). Saving answers to the profile is a later step (needs a column + RPC).
- The cookie banner no longer covers the main button: the button bar sits above it until it is accepted.
- Ad links: `https://anacan.az/website/premium/plan/index.html?lang=az&utm_source=meta&utm_medium=paid&utm_campaign=plan`.
