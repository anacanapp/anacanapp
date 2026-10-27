import assert from 'node:assert/strict';
import test from 'node:test';
import { reminderMessage, runAppointmentReminders } from './send-appointment-reminders.mjs';

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
const U3 = '00000000-0000-4000-8000-000000000003';

function harness({ day = [], soon = [], prefs = [], tokens = [], fcm = () => ({ success: true }) } = {}) {
  const pushes = [], stored = [], logs = [], failed = [], deleted = [], runs = [];
  const query = async (sql, params = []) => {
    if (sql.includes('SET reminder_day_sent_at')) return day;
    if (sql.includes('SET reminder_soon_sent_at')) return soon;
    if (sql.includes('FROM user_preferences')) return prefs;
    if (sql.includes('DELETE FROM device_tokens')) { deleted.push(params[0]); return []; }
    if (sql.includes('FROM device_tokens')) return tokens;
    if (sql.includes('INSERT INTO notifications')) { stored.push(params); return []; }
    if (sql.includes('INSERT INTO notification_send_log')) { logs.push(params); return []; }
    throw new Error('unexpected SQL: ' + sql.slice(0, 60));
  };
  const deps = {
    query,
    getFirebaseAccessToken: async () => ({ accessToken: 'a', projectId: 'p' }),
    sendFCMv1: async (_a, _p, token, title, body, data) => { pushes.push({ token, title, body, data }); return fcm(token); },
    startRunLog: async (...a) => { runs.push(a); return 'run'; },
    finishRunLog: async (_id, patch) => { runs.push(patch); },
    logFailedSend: async (row) => { failed.push(row); },
    bumpReason: (reasons, key) => { reasons[key] = (reasons[key] || 0) + 1; },
    now: () => new Date('2026-10-27T06:00:00Z'),
  };
  return { deps, pushes, stored, logs, failed, deleted, runs };
}

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '{}';

test('messages follow the user language and include the time', () => {
  const row = { title: 'Həkim', event_time: '14:30:00' };
  assert.deepEqual(reminderMessage('day', row, 'az'), { title: '📅 Sabah görüşünüz var', body: 'Həkim · 14:30' });
  assert.deepEqual(reminderMessage('soon', row, 'ru'), { title: '⏰ Приём в 14:30', body: 'Həkim' });
  assert.equal(reminderMessage('day', { title: 'X', event_time: null }, 'en').body, 'X');
  assert.equal(reminderMessage('day', row, 'xx-YY').title, '📅 Sabah görüşünüz var');
  assert.equal(reminderMessage('soon', row, 'pt_BR').title, '⏰ Consulta às 14:30');
});

test('nothing due: no run log, no push', async () => {
  const h = harness();
  assert.deepEqual(await runAppointmentReminders(h.deps), { sent: 0, failed: 0, skipped: 0, claimed: 0 });
  assert.equal(h.runs.length, 0);
  assert.equal(h.pushes.length, 0);
});

test('claimed reminders go to every device, are stored once and logged once', async () => {
  const h = harness({
    day: [{ id: 'a1', user_id: U1, title: 'USM', event_date: '2026-10-28', event_time: '09:00:00' }],
    soon: [{ id: 'a2', user_id: U2, title: 'Analiz', event_date: '2026-10-27', event_time: '11:30:00' }],
    prefs: [{ user_id: U1, language: 'en', push_enabled: true }, { user_id: U2, language: 'az', push_enabled: true }],
    tokens: [{ user_id: U1, token: 't1' }, { user_id: U1, token: 't1b' }, { user_id: U2, token: 't2' }],
  });
  const result = await runAppointmentReminders(h.deps);
  assert.deepEqual(result, { sent: 2, failed: 0, skipped: 0, claimed: 2 });
  assert.deepEqual(h.pushes.map((p) => p.token), ['t1', 't1b', 't2']);
  assert.equal(h.pushes[0].title, '📅 You have an appointment tomorrow');
  assert.equal(h.pushes[2].title, '⏰ Görüş vaxtı: saat 11:30');
  assert.deepEqual(h.pushes[0].data, { type: 'appointment_reminder', screen: 'calendar', appointment_id: 'a1', reminder: 'day' });
  for (const p of h.pushes) for (const v of Object.values(p.data)) assert.equal(typeof v, 'string');
  assert.equal(h.stored.length, 2);
  assert.equal(h.logs.length, 2);
  assert.equal(h.runs.at(-1).status, 'success');
  assert.equal(h.runs.at(-1).sent_count, 2);
});

test('push disabled, no token and dead tokens are handled', async () => {
  const h = harness({
    day: [
      { id: 'b1', user_id: U1, title: 'A', event_date: '2026-10-28', event_time: null },
      { id: 'b2', user_id: U2, title: 'B', event_date: '2026-10-28', event_time: null },
      { id: 'b3', user_id: U3, title: 'C', event_date: '2026-10-28', event_time: null },
    ],
    prefs: [{ user_id: U1, language: 'az', push_enabled: false }],
    tokens: [{ user_id: U3, token: 'dead' }],
    fcm: () => ({ success: false, unregistered: true, errorCode: 'UNREGISTERED', error: 'gone' }),
  });
  const result = await runAppointmentReminders(h.deps);
  assert.deepEqual(result, { sent: 0, failed: 1, skipped: 2, claimed: 3 });
  assert.deepEqual(h.deleted, ['dead']);
  assert.equal(h.failed[0].source_notification_id, 'b3');
  assert.equal(h.stored.length, 2, 'in-app notification kept for users without a device');
  assert.deepEqual(h.runs.at(-1).reasons, { push_disabled: 1, no_device_token: 1, 'fcm:UNREGISTERED': 1 });
});
