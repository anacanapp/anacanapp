import assert from 'node:assert/strict';
import test from 'node:test';
import { sliceKey, sliceAlreadySent } from './vitamin-guard.mjs';
import { vitaminSlices } from './vitamin-window.mjs';

test('slice key is the Baku date and slice start; a midnight split keeps one key', () => {
  assert.equal(sliceKey(vitaminSlices(new Date(Date.UTC(2026, 9, 27, 10, 55, 3)))), '2026-10-27T14:58');
  assert.equal(sliceKey(vitaminSlices(new Date(Date.UTC(2026, 9, 27, 19, 55, 0)))), '2026-10-27T23:58');
  // a manual start two minutes after the tick handles the same slice → same key
  assert.equal(sliceKey(vitaminSlices(new Date(Date.UTC(2026, 9, 27, 10, 57, 4)))), '2026-10-27T14:58');
  assert.equal(sliceKey(vitaminSlices(new Date(Date.UTC(2026, 9, 27, 11, 0, 2)))), '2026-10-27T15:03');
});

test('guard asks only for successful scheduled runs of the same slice, excluding this run', async () => {
  let seen;
  const query = async (sql, params) => { seen = { sql, params }; return [{ '?column?': 1 }]; };
  assert.equal(await sliceAlreadySent({ query, key: '2026-10-27T14:58', runId: 'r2' }), true);
  assert.deepEqual(seen.params, ['2026-10-27T14:58', 'r2']);
  assert.match(seen.sql, /function_name = 'send-vitamin-reminders'/);
  assert.match(seen.sql, /triggered_by = 'cron'/);
  assert.match(seen.sql, /status = 'success'/);
  assert.match(seen.sql, /id IS DISTINCT FROM \$2::uuid/);
  assert.equal(await sliceAlreadySent({ query: async () => [], key: 'k', runId: null }), false);
});
