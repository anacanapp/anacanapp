// Per-slice "already sent" guard for the 5-minute vitamin run.
//
// Each scheduled run records its slice key (Baku date + slice start, e.g. 2026-10-27T14:58) in
// notification_run_log.active_slot. A later run for the same slice — a manual start between ticks
// or a retried timer — skips sending when a successful scheduled run already handled it. Runs of
// the job are serialized by run-job.py's flock, so check-then-send cannot race. A run that ended in
// error does not count, so it can be retried; admin test runs (TEST_USER_ID) bypass the guard.

/** Key of the slice a run handles (its first part, so a midnight split keeps one key). */
export function sliceKey(slices) {
  const first = slices[0];
  return `${first.date}T${first.from.slice(0, 5)}`;
}

export async function sliceAlreadySent({ query, key, runId }) {
  const rows = await query(
    `SELECT 1 FROM notification_run_log
      WHERE function_name = 'send-vitamin-reminders' AND triggered_by = 'cron'
        AND active_slot = $1 AND status = 'success'
        AND id IS DISTINCT FROM $2::uuid
        AND started_at > now() - interval '1 day'
      LIMIT 1`,
    [key, runId],
  );
  return rows.length > 0;
}
