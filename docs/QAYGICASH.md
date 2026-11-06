# QayğıCash (cashback)

The owner approved this on 2026-11-06. The product plan is the PDF "QayğıCash · Məhsul planı v1.0"; the prototype is https://claude.ai/artifact/SfqHp1ep56ni4pXTq8T9eR.

QayğıCash is Anacan's own bonus programme:

- **Earning:** buying Anacan's own products earns 0.5–5 % back as bonus. Partner products earn 0 %.
- **Spending:** the bonus can be spent on later Aptek, cake and book orders, up to 30 % of the order.
- **Premium with bonus:** paying for Premium with the bonus is built but off by default. The admin turns it on per plan, per price and per platform.
- **Not money:** the bonus cannot be cashed out or transferred.

## Live state

| Part | State |
| --- | --- |
| Database | Migration `supabase/migrations/20261106150000_qaygicash.sql` is applied on Google. The AZ / AZN programme is `live`. Its `.cdc.json` enrolls 7 new relations with CDC and writer guards. |
| Functions | Image `functions@sha256:2b0f6caa…`, with `qaygicash-premium` enabled. Previous image: `9e48ec0e…`. |
| App UI | Wallet, cards, badges, checkout rows and the hidden Premium-with-bonus option ship with the web app and the next native build. |
| Admin | Admin panel → QayğıCash. |

## Rules (AZ)

| Channel | Rate | Base | Becomes available |
| --- | --- | --- | --- |
| Premium yearly (App Store / Google Play) | 5 % | Fixed 26,99 ₼ | 7 days after purchase |
| Premium monthly (each renewal) | 3 % | Fixed 3,99 ₼ | 7 days after purchase |
| Premium on anacan.az (Epoint pass) | 5 % / 3 % | Price paid | 7 days after purchase |
| PDF books | 5 % | Amount charged | 7 days after payment |
| Cakes (app) | 3 % | Net total | 14 days after delivery |
| Aptek, Anacan-brand products (`products.cashback_own`) | 5 % | Paid share of those lines | 14 days after delivery |
| Partner products, affiliate | 0 % | — | — |

**Earning**

- Rates are fixed at the moment of earning. Bonus is floored to the qəpik.
- A user earns at most 100 ₼ per month (Baku calendar month).
- Bonus expires 12 months after it becomes available.

**Spending**

- At most 30 % of the goods total after discounts. Delivery is not counted.
- Minimum 1 ₼ per order.
- The bonus that expires soonest is spent first.

**Refunds and cancellations**

- The earned bonus is reversed.
- If that bonus was already spent, the amount is taken from the user's other bonus first. Anything still missing becomes a debt, settled from the next earning.
- Bonus spent on a cancelled order goes back to the user.

**Control group (`control_pct`, default 0)**

- That share of users never sees QayğıCash. It exists only to measure the programme's effect.
- 0 means everyone sees it.

## How earning and spending are wired

All money is kept in integer qəpik (`*_minor`). There is no cron and no new timer: whether a bonus is pending, available or expired is computed from time on every read.

**Tables**

| Table | Role |
| --- | --- |
| `cashback_lots` | Bonus earned; spent FIFO by expiry |
| `cashback_redemptions` | Bonus spent per order: `reserved`, `committed` or `released` |
| `cashback_ledger` | Movement log; append-only, enforced by a trigger |
| `cashback_wallets` | Debt and cohort per user |
| `cashback_programs` | Settings per country |
| `cashback_rules` | Rate per channel |
| `cashback_admin_log` | Admin actions |

**Status triggers**

Each trigger catches its own errors and logs a warning, so the order flow is never blocked.

| Table | Event | Effect |
| --- | --- | --- |
| `orders` (store `aptek`) | `delivered` | Commit spent bonus; earn on `cashback_own` lines |
| `orders` (store `aptek`) | `cancelled` | Release spent bonus; reverse earned bonus |
| `cake_orders` (app) | `delivered` | Commit + earn |
| `cake_orders` (app) | `cancelled` | Release + reverse |
| `book_orders` | `paid` | Commit + earn |
| `book_orders` | `failed`, `cancelled` | Release |
| `book_orders` | `refunded` | Release + reverse |
| `web_subscriptions` | Epoint pass linked to a user | Earn |

**Spending, per channel**

| Channel | How |
| --- | --- |
| Aptek | `place_aptek_order(..., p_cashback numeric DEFAULT 0)`. `total_amount` is the net amount the courier collects. Older clients still work without the new argument. |
| Cakes | In-app cakes are paid **only by card through Epoint** (owner decision 2026-11-06; cash and card-to-card removed). `cake-checkout` prices the order on the server and reserves the bonus (60 min); the shared Epoint callback (`_shared/web-cake-result.ts`) marks the order paid and commits the bonus, or cancels the order on failure, which releases the bonus. `total_price` is the charged amount. The older `qaygicash_redeem_cake_v1` RPC is no longer used by the app. |
| Books | `book-checkout` takes `cashback` in the body. `amount` is the charged amount; `cashback_used` holds the bonus. The reservation is released after 40 minutes if the checkout is not completed. |

**Store Premium earning (`revenuecat-webhook` → `_shared/qaygicash.ts`)**

- Earns on `INITIAL_PURCHASE`, `RENEWAL` and `NON_RENEWING_PURCHASE`. Only PRODUCTION events from APP_STORE or PLAY_STORE count; trials and zero-price events do not.
- The plan comes from the purchase period: 200 days or more is yearly, 20 days or more is monthly. The country is the storefront `country_code`.
- `CANCELLATION` with `cancel_reason = CUSTOMER_SUPPORT` (a refund) reverses the bonus.
- Earning is idempotent per `transaction_id` and never fails the webhook.

## Premium with bonus (off by default)

**Settings.** `cashback_programs.premium_redeem` holds:

```
{enabled, monthly:{enabled, price_minor}, yearly:{enabled, price_minor}, platforms:{ios, android, web}}
```

The admin edits it on the "Premium bonusla" tab.

**Flow (`qaygicash-premium` function, POST `{plan, platform}`)**

1. Refuse when the user has an auto-renewing App Store or Google Play subscription, or lifetime Premium.
2. Work out when the new period starts: the latest of now, the end of a running promotional or one-time pass, and the end of a web pass.
3. Reserve the bonus with `qc_premium_reserve_v1`. The price is the admin price, and the 30 % limit does not apply.
4. Grant the RevenueCat promotional entitlement `POST /v1/subscribers/{id}/entitlements/Anacan LLC Pro/promotional` with `{duration: monthly|yearly, start_time_ms}`. The product is `rc_promo_Anacan LLC Pro_monthly|yearly`, which is already in `REVENUECAT_PRODUCT_PLANS_JSON`.
5. Commit the bonus (3 attempts), then run `syncEntitlementForUser`.
6. If RevenueCat refuses, release the bonus.

**Store rules.** Apple 3.1.1 and Google Play billing do not allow digital content (Premium) to be bought inside the app with an in-app currency. Turn on **Web** first, and enable iOS or Android only after a store review decision.

## Operations notes (Google)

These live outside the repo and must be kept on future functions deploys:

- `qaygicash-premium` has a route in the image's `/home/deno/functions/main/catalog.mjs`: `route('user', REVENUECAT, { gates: ['ENABLE_REVENUECAT'], provider: 'revenuecat' })`.
- `cake-checkout` has a route next to it: `route('user', [], { gates: ['ENABLE_EPOINT_PAYMENTS'], methods: ['GET', 'POST'] })`, and is in `ENABLED_FUNCTIONS` too. Current image: `functions@sha256:52c4688e…` (deploy script `/root/functions-cake-checkout.py`, env backup `functions.env.before-cake-checkout`).
- `qaygicash-premium` is listed in `ENABLED_FUNCTIONS` in `/srv/anacan/runtime/secrets/functions.env`. The earlier env is backed up as `functions.env.before-qaygicash-route`.
- Deploy scripts on the instance:
  - `/root/functions-qaygicash.py` — image `cb255d7d…`
  - `/root/functions-qaygicash2.py` — catalog route, image `2b0f6caa…`
  - `/root/functions-qaygicash-route.py` — env change only

**Kill switch.** Set the programme to `paused`: earning continues, spending stops. Set it to `draft`: QayğıCash is hidden and nothing new is earned.

**Opening a new country.** On the admin "Proqramlar" tab, create the country (draft), set its rates, then set it to live. No app release is needed.
