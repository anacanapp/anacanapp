# Notification jobs (live copies)

These are the exact files running in the Google `notification-jobs` images (Node, `/app`):

| Job (systemd timer) | File | Image digest |
|---|---|---|
| `anacan-job-flow-reminders` (hourly) | `send-flow-reminders.mjs` | `ef086ba3b5e3…` (base `b61f6ad85498…`) |
| `anacan-job-vitamin-reminders` (every 5 min) | `send-vitamin-reminders.mjs` | `d2af19b99a87…` (base `ebc085e9e0d8…`) |
| `anacan-job-daily-notif-slots` / `anacan-job-daily-notif-halfhour` | `shared/language.mjs` (only this file is kept here) | `6d7495b4d5d0…` (base `ccaa7bf6683f…`) |

All send texts in all 25 app languages (ky/et added 2026-11-03; daily templates read `title_ky/body_ky/title_et/body_et`, Duzelis86; tk/uk added 2026-11-17; daily templates read `title_tk/body_tk/title_uk/body_uk`, Duzelis87; all four images rebuilt and switched the same day, `.before-tkuk` json backups kept). The `shared/` modules and other jobs live only in the images. To change a job: build an
image `FROM <current digest>` that replaces only the file, then update `image` in
`/srv/anacan/runtime/jobs/<job>.json` (a `.before-*` backup is kept) and tag it `anacan-pinned/<job>:<digest12>`.
Never run `docker image prune` on the server.
