import assert from 'node:assert/strict';
import test from 'node:test';
import { runDailyNotifications, spreadOrder, spreadSeconds } from './send-daily-notifications.mjs';

const USERS = 103;

function harness() {
  const ids = Array.from({ length: USERS }, (_, n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  const sent = [], sleeps = [], inserts = [];
  let clock = 0;
  const query = async (sql, params = []) => {
    if (sql.includes('FROM scheduled_notifications')) return [{ id: 's1', target_audience: 'all', title: 'T', body: 'B', emoji: '' }];
    if (sql.includes('pregnancy_day_notifications') || sql.includes('mommy_day_notifications')) return [];
    if (sql.includes('FROM profiles')) return ids.map((user_id) => ({ user_id, life_stage: 'flow', role: 'user' }));
    if (sql.includes('FROM user_children')) return [];
    if (sql.startsWith('SELECT language')) return [{ language: 'az', push_enabled: true, daily_push_enabled: true }];
    if (sql.includes('FROM user_preferences')) return ids.map((user_id) => ({ user_id, push_enabled: true, daily_push_enabled: true, language: 'az' }));
    if (sql.includes('FROM device_tokens')) return ids.map((user_id) => ({ user_id, token: 'tok-' + user_id, platform: 'ios' }));
    if (sql.includes('FROM notification_send_log')) return [];
    if (sql.includes('INSERT INTO notification_send_log')) { inserts.push(params[0]); return []; }
    return [];
  };
  const dependencies = {
    query, closePool: async () => {}, getFirebaseAccessToken: async () => ({ accessToken: 'a', projectId: 'p' }),
    sendFCMv1: async (_a, _p, token) => { sent.push({ token, at: clock }); return { success: true }; },
    startRunLog: async () => 'run', finishRunLog: async () => {}, logFailedSend: async () => {},
    now: () => new Date('2026-10-26T08:00:00Z'),
    sleep: async (ms) => { sleeps.push(ms); clock += ms; }, elapsedMs: () => clock,
  };
  return { ids, sent, sleeps, inserts, dependencies };
}

test('spread setting defaults, caps and rejects bad values', () => {
  assert.equal(spreadSeconds(undefined), 600);
  assert.equal(spreadSeconds(''), 600);
  assert.equal(spreadSeconds('0'), 0);
  assert.equal(spreadSeconds('120'), 120);
  assert.equal(spreadSeconds('5000'), 900);
  assert.equal(spreadSeconds('-1'), 600);
  assert.equal(spreadSeconds('abc'), 600);
});

test('group order is stable and independent of input order', () => {
  const users = Array.from({ length: 50 }, (_, n) => ({ user_id: `u${n}` }));
  const a = spreadOrder(users).map((u) => u.user_id);
  const b = spreadOrder([...users].reverse()).map((u) => u.user_id);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 50);
});

test('every user is sent once and sends are paced across the window', async () => {
  const h = harness();
  await runDailyNotifications({ FIREBASE_SERVICE_ACCOUNT_JSON: '{}' }, h.dependencies);
  assert.equal(h.sent.length, USERS);
  assert.equal(new Set(h.inserts).size, USERS);
  assert.deepEqual([...h.inserts].sort(), [...h.ids].sort());
  // 5 batches of 25 → batch starts at 0, 25/103, 50/103, 75/103, 100/103 of 600 s.
  const starts = [...new Set(h.sent.map((s) => s.at))];
  assert.equal(starts.length, 5);
  assert.equal(starts[0], 0);
  assert.ok(Math.abs(starts.at(-1) - (600000 * 100) / USERS) < 1);
  assert.ok(starts.at(-1) < 600000);
});

test('zero spread and manual admin tests never wait', async () => {
  const off = harness();
  await runDailyNotifications({ FIREBASE_SERVICE_ACCOUNT_JSON: '{}', DAILY_PUSH_SPREAD_SECONDS: '0' }, off.dependencies);
  assert.equal(off.sent.length, USERS);
  assert.equal(off.sleeps.length, 0);
  const manual = harness();
  await runDailyNotifications({ FIREBASE_SERVICE_ACCOUNT_JSON: '{}', TEST_USER_ID: manual.ids[0] }, manual.dependencies);
  assert.equal(manual.sleeps.length, 0);
});
