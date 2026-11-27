// Per-user time zones for the 5-minute vitamin run.
//
// vitamin-window.mjs (in the job image) computes the run's slice in Baku time (fixed UTC+4), so a
// user abroad whose schedule says 09:00 gets the reminder at 09:00 Baku time, not 09:00 local.
// This module computes the same slice in any IANA zone: the run's UTC tick (floored to 5 minutes)
// is shown as local wall-clock time, and the slice [tick + LEAD - 2, tick + LEAD + 3) minutes is
// taken in that zone, split at local midnight with the local date and weekday of each part. The
// local date is also the "taken today" day (vitamin_intake_logs.log_date) for that user.
//
// For DEFAULT_TIME_ZONE the result equals vitaminSlices() from vitamin-window.mjs.
// Zones are grouped by identical slices so the job runs one schedule query per distinct offset,
// not per user. Unknown or invalid zone strings fall back to DEFAULT_TIME_ZONE.

export const STEP_MINUTES = 5;
export const LEAD_MINUTES = 5;
export const DEFAULT_TIME_ZONE = 'Asia/Baku';

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;

const formatterCache = new Map();
function formatter(timeZone) {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** A valid IANA zone name (canonical spelling), or null. */
export function normalizeTimeZone(value) {
  if (typeof value !== 'string') return null;
  const zone = value.trim();
  if (!zone || zone.length > 64) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** Local wall-clock parts of an instant in a zone. */
function localParts(date, timeZone) {
  const parts = {};
  for (const { type, value } of formatter(timeZone).formatToParts(date)) parts[type] = value;
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

/**
 * @returns {{ from: string, to: string, date: string, dow: number }[]} half-open local time ranges
 *   (`to` of '24:00:00' means end of day) with the local date and weekday they belong to.
 */
export function vitaminSlicesForZone(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const zone = normalizeTimeZone(timeZone) || DEFAULT_TIME_ZONE;
  const stepMs = STEP_MINUTES * 60000;
  const tick = new Date(Math.floor(now.getTime() / stepMs) * stepMs); // robust to a few seconds of start delay
  const local = localParts(tick, zone);
  const dayStart = Date.UTC(local.y, local.m - 1, local.d);
  const start = local.minute + LEAD_MINUTES - 2;
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

const sliceSignature = (slices) => slices.map((s) => `${s.date}|${s.from}|${s.to}`).join(',');

/**
 * Groups stored zone values by the slices they need this run.
 * @param {(string|null)[]} storedZones raw values from the database (null = not set)
 * @returns {{ slices: ReturnType<typeof vitaminSlicesForZone>, zones: string[], includesDefault: boolean }[]}
 *   `zones` are the raw stored strings to match in SQL; `includesDefault` means rows without a
 *   zone (NULL) belong to this group too.
 */
export function groupZonesBySlices(storedZones, now = new Date()) {
  const groups = new Map();
  const add = (raw, zone, isDefault) => {
    const slices = vitaminSlicesForZone(now, zone);
    const key = sliceSignature(slices);
    let group = groups.get(key);
    if (!group) {
      group = { slices, zones: [], includesDefault: false };
      groups.set(key, group);
    }
    if (raw != null && !group.zones.includes(raw)) group.zones.push(raw);
    if (isDefault) group.includesDefault = true;
  };
  add(DEFAULT_TIME_ZONE, DEFAULT_TIME_ZONE, true);
  for (const raw of new Set(storedZones)) {
    if (raw == null || raw === DEFAULT_TIME_ZONE) continue;
    const zone = normalizeTimeZone(raw);
    // Invalid strings are matched with the default zone's group.
    add(raw, zone || DEFAULT_TIME_ZONE, false);
  }
  return [...groups.values()];
}
