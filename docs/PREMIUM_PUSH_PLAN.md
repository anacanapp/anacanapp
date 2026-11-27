# Premium push plan (2026-11-13)

Server-side automatic pushes around Premium. All run from `web-premium-renew` (no extra timer): the 15-minute
`anacan-web-premium-nudge` timer calls `{"mode":"nudge"}`, the daily `anacan-web-premium-renew` timer runs renewals.
The router catalog passes `FIREBASE_SERVICE_ACCOUNT_JSON` to this route (see `docs/FUNCTIONS_ROUTER_QUEUE.md`).
Each run returns `push_issues` codes (`no_device`, `fcm_unavailable`, provider codes). `{"mode":"push-check"}`
validates the reminder push with FCM `validate_only` and delivers nothing.

| Push | Who | When | Channels | Language | Opens |
|---|---|---|---|---|---|
| Abandoned anacan.az Premium checkout | Opened the Epoint page, did not pay | 30 min to 24 h later, once per 7 days; campaign copy while a campaign runs, otherwise standard price | e-mail + push | az | campaign page or `/premium/abune` |
| Store Premium ending (auto-renew off) | App Store / Google Play Premium, `subscriptions.cancelled_at` set, ends in 24-72 h, not anacan.az subscribers, not admins | once per period end (20-day guard), 10:00-20:00 user local time (`user_preferences.timezone`, default Baku) | push | 23 app languages | in-app Premium screen (`anacan://premium`) |
| anacan.az renewal failed | Saved-card renewal failed, will retry | daily run, once per charge | e-mail + push | az | Premium cabinet |
| anacan.az subscription ended | Renewal retries exhausted | daily run, once per charge | e-mail + push | az | `/premium/abune` |
| Partner link paused | Premium ended; both partners | daily 09:00 Baku (`expire-partner-links`) | push + in-app | user language | app |
| Abandoned PDF book checkout (not Premium) | Left the Epoint page for books | about 1 h later, once per 7 days | push | az | book store |

SQL: `20261108070000_web_premium_checkout_nudge.sql`, `20261113130000_book_checkout_nudge.sql`,
`20261113150000_premium_lifecycle_pushes.sql` (`premium_lifecycle_pushes`, CDC + writer guard).
Code: `supabase/functions/_shared/web-premium-nudge.ts`, `book-nudge.ts`, `premium-lifecycle-push.ts`.
