# Notification jobs (live copies)

These are the exact files running in the Google `notification-jobs` images (Node, `/app`):

| Job (systemd timer) | File | Image digest |
|---|---|---|
| `anacan-job-flow-reminders` (hourly) | `send-flow-reminders.mjs` | `b61f6ad85498…` (base `ad092e799e93…`) |
| `anacan-job-vitamin-reminders` (every 5 min) | `send-vitamin-reminders.mjs` | `fb5dfe4c7e54…` (base `19456c478d3d…`) |
| `anacan-job-daily-notif-slots` / `-halfhour` | `shared/language.mjs` (only this file is kept here) | `ccaa7bf6683f…` (base `496787ef665c…`) |

All send texts in all 23 app languages (ky/et added 2026-11-03; daily templates read `title_ky/body_ky/title_et/body_et`, Duzelis86). The `shared/` modules and other jobs live only in the images. To change a job: build an
image `FROM <current digest>` that replaces only the file, then update `image` in
`/srv/anacan/runtime/jobs/<job>.json` (a `.before-*` backup is kept) and tag it `anacan-pinned/<job>:<digest12>`.
Never run `docker image prune` on the server.
