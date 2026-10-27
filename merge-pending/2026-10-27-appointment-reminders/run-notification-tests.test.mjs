import assert from 'node:assert/strict';
import test from 'node:test';
import { runNotificationTests, SCRIPTS } from './run-notification-tests.mjs';

const ADMIN = '00000000-0000-4000-8000-0000000000ad';

function harness({ claimed = [], run = null, out = { code: 0, tail: 'ok' } } = {}) {
  const updates = [], runs = [], sql = [];
  const query = async (text, params = []) => {
    sql.push(text);
    if (text.includes("SET status = 'expired'")) return [];
    if (text.includes("SET status = 'running'")) return claimed;
    if (text.includes('FROM notification_run_log')) return run ? [run] : [];
    if (text.includes('SET status = $2')) { updates.push({ id: params[0], status: params[1], payload: JSON.parse(params[2]) }); return []; }
    throw new Error('unexpected SQL ' + text.slice(0, 40));
  };
  const runScript = async (name, env) => { runs.push({ name, env }); return out; };
  return { deps: { query, runScript, log: { log() {} } }, updates, runs, sql };
}

test('no pending request: only housekeeping, no job started', async () => {
  const h = harness();
  assert.equal(await runNotificationTests(h.deps), 0);
  assert.equal(h.runs.length, 0);
  assert.ok(h.sql[0].includes("'expired'"));
});

test('each request runs the real job for the requesting admin only', async () => {
  const h = harness({
    claimed: [{ id: 'r1', requested_by: ADMIN, kind: 'daily' }, { id: 'r2', requested_by: ADMIN, kind: 'flow' }],
    run: { status: 'success', sent_count: 1, failed_count: 0, skipped_count: 0, eligible_count: 1, reasons: {}, error_message: null },
  });
  assert.equal(await runNotificationTests(h.deps), 2);
  assert.deepEqual(h.runs.map((r) => r.name), [SCRIPTS.daily, SCRIPTS.flow]);
  for (const r of h.runs) assert.deepEqual(r.env, { TEST_USER_ID: ADMIN, SKIP_DEDUP: 'true' });
  assert.deepEqual(h.updates.map((u) => [u.id, u.status, u.payload.sent]), [['r1', 'done', 1], ['r2', 'done', 1]]);
});

test('a failing job or an error run log marks the request as error with a short reason', async () => {
  const h = harness({ claimed: [{ id: 'r3', requested_by: ADMIN, kind: 'vitamin' }], out: { code: 1, tail: 'a\nb\nboom' } });
  await runNotificationTests(h.deps);
  assert.equal(h.updates[0].status, 'error');
  assert.equal(h.updates[0].payload.error, 'a\nb\nboom');

  const h2 = harness({ claimed: [{ id: 'r4', requested_by: ADMIN, kind: 'flow' }], run: { status: 'error', error_message: 'FCM not configured' } });
  await runNotificationTests(h2.deps);
  assert.equal(h2.updates[0].status, 'error');
  assert.equal(h2.updates[0].payload.error, 'FCM not configured');
});
