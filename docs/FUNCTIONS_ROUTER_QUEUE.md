# Functions router: wait queue instead of instant 429 (2026-11-12)

Crash reports showed `[push:group_message] invoke error: Edge Function returned a non-2xx status code` (hundreds
per day, builds 39/45/48/49). Older builds send one `send-push-notification` call per group member, so a message in
a busy group arrives as a burst. The functions router (`/home/deno/functions/main/router.mjs` in the functions
image; Google runtime tooling, not in this repository) admitted at most 8 requests and 1536 MB of worker memory
budget (6 push workers) and answered every other request at once with `429 concurrency_limit`.

Change (functions image `sha256:8fec82f3…`, env unchanged, recreate with automatic rollback):
- A request that finds no free slot waits in a FIFO queue (at most 300 waiting, at most 10 s each) and runs as
  soon as a slot is released; the slot is reserved before the waiter resumes, so limits stay exact.
- Only a request still waiting after 10 s (or beyond 300 waiting) gets `429 concurrency_limit`.
- The per-minute public rate check now runs before the slot wait.

Local burst test (40 simultaneous push calls, 300 ms each): before 6 × 200 and 34 × 429; after 40 × 200 in about
2.2 s with at most 6 running at once. Previous image for rollback: `sha256:d73c6611…`.
