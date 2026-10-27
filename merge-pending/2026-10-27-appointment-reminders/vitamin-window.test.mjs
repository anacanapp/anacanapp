import assert from 'node:assert/strict';
import test from 'node:test';
import { vitaminSlices } from './vitamin-window.mjs';

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const UTC_DAY = Date.UTC(2026, 9, 27, 0, 0, 0); // Tue 2026-10-27 00:00 UTC = 04:00 Baku

test('a full day of 5-minute runs covers every Baku minute exactly once, 3–7 minutes ahead', () => {
  const seen = new Map(); // "date minute" -> lead
  for (let i = 0; i < 288 * 2; i++) {
    const tick = UTC_DAY + i * 300000;
    const bakuTickMin = Math.floor((tick + 4 * 3600000 - Date.UTC(2026, 9, 27)) / 60000);
    for (const w of vitaminSlices(new Date(tick + 7000))) { // runs start a few seconds late
      const dayOffset = (Date.parse(w.date) - Date.UTC(2026, 9, 27)) / 86400000;
      for (let m = toMin(w.from); m < toMin(w.to); m++) {
        const key = `${w.date} ${m}`;
        assert.ok(!seen.has(key), `minute ${key} handled twice`);
        const lead = dayOffset * 1440 + m - bakuTickMin;
        assert.ok(lead >= 3 && lead <= 7, `lead ${lead} for ${key}`);
        seen.set(key, lead);
      }
    }
  }
  // 2026-10-28 (Baku) lies fully inside the simulated two UTC days.
  for (let m = 0; m < 1440; m++) assert.ok(seen.has(`2026-10-28 ${m}`), `minute ${m} never handled`);
});

test('09:12 is handled by the 09:05 run (the old window skipped it)', () => {
  const run = new Date(Date.UTC(2026, 9, 27, 5, 5, 3)); // 09:05:03 Baku
  assert.deepEqual(vitaminSlices(run), [{ from: '09:08:00', to: '09:13:00', date: '2026-10-27', dow: 2 }]);
});

test('a slice that crosses midnight is split by date and weekday', () => {
  const run = new Date(Date.UTC(2026, 9, 27, 19, 55, 0)); // 23:55 Baku, Tuesday
  assert.deepEqual(vitaminSlices(run), [
    { from: '23:58:00', to: '24:00:00', date: '2026-10-27', dow: 2 },
    { from: '00:00:00', to: '00:03:00', date: '2026-10-28', dow: 3 },
  ]);
});
