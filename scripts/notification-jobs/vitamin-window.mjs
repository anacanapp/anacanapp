// Which vitamin schedule times one run of the 5-minute timer must handle.
//
// The timer fires at :00, :05, :10 … UTC. Each run takes the slice
// [tick + LEAD - 2 min, tick + LEAD + 3 min) in Baku time, so consecutive runs tile the whole day:
// every minute belongs to exactly one run, and the reminder comes 3–7 minutes before the
// scheduled time (5 on average, as before). The old ±1 minute window around "now + 5" only
// covered minutes ending in 4–6 and 9–1, so a time such as 09:12 was never sent.
// A slice that crosses midnight is split, with each part using its own date and weekday.
export const STEP_MINUTES = 5;
export const LEAD_MINUTES = 5;
const BAKU_OFFSET_MS = 4 * 3600 * 1000; // Asia/Baku, no DST

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;

/**
 * @returns {{ from: string, to: string, date: string, dow: number }[]} half-open time ranges
 *   (`to` of '24:00:00' means end of day) with the Baku date and weekday they belong to.
 */
export function vitaminSlices(now = new Date()) {
  const baku = new Date(now.getTime() + BAKU_OFFSET_MS);
  const dayStart = Date.UTC(baku.getUTCFullYear(), baku.getUTCMonth(), baku.getUTCDate());
  const minuteOfDay = baku.getUTCHours() * 60 + baku.getUTCMinutes();
  const tick = minuteOfDay - (minuteOfDay % STEP_MINUTES); // robust to a few seconds of start delay
  const start = tick + LEAD_MINUTES - 2;
  const end = start + STEP_MINUTES;
  const slices = [];
  for (let day = Math.floor(start / 1440); day * 1440 < end; day++) {
    const from = Math.max(start, day * 1440) - day * 1440;
    const to = Math.min(end, (day + 1) * 1440) - day * 1440;
    const date = new Date(dayStart + day * 86400000);
    slices.push({ from: hhmm(from), to: to === 1440 ? '24:00:00' : hhmm(to), date: date.toISOString().slice(0, 10), dow: date.getUTCDay() });
  }
  return slices;
}
