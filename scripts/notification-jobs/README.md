# Notification jobs (live copies)

These are the exact files running in the Google `notification-jobs` images (Node, `/app`):

| Job (systemd timer) | File | Image digest |
|---|---|---|
| `anacan-job-flow-reminders` (hourly) | `send-flow-reminders.mjs` | `ad092e799e93…` (base `c4ae4731…`) |
| `anacan-job-vitamin-reminders` (every 5 min) | `send-vitamin-reminders.mjs` | `19456c478d3d…` (base `33c829f3…`) |

Both send reminder texts in all 21 app languages (2026-11-02; before that 12 languages fell back to
Azerbaijani). The `shared/` modules and other jobs live only in the images. To change a job: build an
image `FROM <current digest>` that replaces only the file, then update `image` in
`/srv/anacan/runtime/jobs/<job>.json` (a `.before-*` backup is kept) and tag it `anacan-pinned/<job>:<digest12>`.
Never run `docker image prune` on the server.
