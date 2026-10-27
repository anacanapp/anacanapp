// Admin "test send" requests (public.notification_test_requests), run inside the
// anacan-job-vitamin-reminders run. Each request executes the real job script in its
// single-user test mode (TEST_USER_ID = the requesting admin), so a test can never broadcast,
// and records the job's own run-log counts as the result.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const SCRIPTS = Object.freeze({
  daily: 'send-daily-notifications',
  flow: 'send-flow-reminders',
  vitamin: 'send-vitamin-reminders',
});
const HERE = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = 180_000;

/** Runs `node <name>.mjs` with extra env; resolves { code, tail } (last ~1.5 kB of output). */
export function runNode(name, env) {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(process.execPath, [join(HERE, `${name}.mjs`)], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const keep = (chunk) => { out = (out + chunk).slice(-1500); };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    const timer = setTimeout(() => { keep('\n[timeout]'); child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, tail: out.trim() }); });
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: 1, tail: String(err?.message || err) }); });
  });
}

export async function runNotificationTests({ query, runScript = runNode, log = console }) {
  await query(
    `UPDATE notification_test_requests SET status = 'expired', finished_at = now()
      WHERE status = 'pending' AND created_at < now() - interval '30 minutes'`,
  );
  const claimed = await query(
    `UPDATE notification_test_requests r SET status = 'running', started_at = now()
      WHERE r.id IN (SELECT id FROM notification_test_requests WHERE status = 'pending'
                      ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED)
      RETURNING r.id, r.requested_by, r.kind`,
  );
  for (const req of claimed) {
    const name = SCRIPTS[req.kind];
    const startedAt = new Date(Date.now() - 1000);
    let result;
    try {
      const out = await runScript(name, { TEST_USER_ID: String(req.requested_by), SKIP_DEDUP: 'true' });
      const run = (await query(
        `SELECT status, sent_count, failed_count, skipped_count, eligible_count, reasons, error_message
           FROM notification_run_log
          WHERE function_name = $1 AND triggered_by = 'admin-test' AND started_at >= $2
          ORDER BY started_at DESC LIMIT 1`,
        [name, startedAt],
      ))[0];
      const ok = out.code === 0 && run?.status !== 'error';
      result = {
        status: ok ? 'done' : 'error',
        payload: {
          job: name,
          exitCode: out.code,
          sent: run?.sent_count ?? 0,
          failed: run?.failed_count ?? 0,
          skipped: run?.skipped_count ?? 0,
          eligible: run?.eligible_count ?? null,
          reasons: run?.reasons ?? null,
          error: run?.error_message ?? (ok ? null : out.tail.split('\n').slice(-3).join('\n')),
          log: out.tail.split('\n').slice(-8).join('\n'),
        },
      };
    } catch (err) {
      result = { status: 'error', payload: { job: name, error: err instanceof Error ? err.message : String(err) } };
    }
    await query(
      `UPDATE notification_test_requests SET status = $2, result = $3::jsonb, finished_at = now() WHERE id = $1`,
      [req.id, result.status, JSON.stringify(result.payload)],
    );
    log.log(`Notification test ${req.kind} for admin: ${result.status}, sent ${result.payload.sent ?? 0}`);
  }
  return claimed.length;
}
