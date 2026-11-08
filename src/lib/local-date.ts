/**
 * Calendar-day keys in the phone's own time zone. `toISOString().split('T')[0]` gives the UTC day, so in Baku
 * (UTC+4) anything saved between 00:00 and 04:00 landed on the previous day. Use these for every "today" /
 * log_date / entry_date key.
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD of `d` in local time. */
export const localDateKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Today's local YYYY-MM-DD. */
export const todayKey = () => localDateKey(new Date());

/** Local YYYY-MM-DD `days` days before (negative: after) `from`. */
export const daysAgoKey = (days: number, from: Date = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - days);
  return localDateKey(d);
};
