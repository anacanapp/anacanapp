// Pure statistics over baby_logs rows (feeding / sleep / diaper) for the Baby tracker
// and Sleep training tools. No I/O here so it stays unit-testable.

export interface BabyLogRow {
  id: string;
  log_type: string;
  start_time: string;
  end_time?: string | null;
  feed_type?: string | null;
  diaper_type?: string | null;
  notes?: string | null;
}

export type FeedKind = 'left' | 'right' | 'formula' | 'solid';
export type DiaperKind = 'wet' | 'dirty' | 'mixed';

const MINUTE = 60_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day key, e.g. 2026-10-26. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const startOfDayOffset = (d: Date, offset = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);

export function feedKind(feedType?: string | null): FeedKind | null {
  switch (feedType) {
    case 'breast_left': case 'left': return 'left';
    case 'breast_right': case 'right': return 'right';
    case 'formula': return 'formula';
    case 'solid': return 'solid';
    default: return null;
  }
}

export const diaperKind = (t?: string | null): DiaperKind | null => (t === 'wet' || t === 'dirty' || t === 'mixed' ? t : null);

/** "120 ml" in a formula log's notes → 120. */
export function mlFromNotes(notes?: string | null): number | null {
  const m = notes ? /(\d+(?:[.,]\d+)?)\s*ml/i.exec(notes) : null;
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Logs that started on the given local day, oldest first. */
export function logsOfDay(logs: BabyLogRow[], day: Date): BabyLogRow[] {
  const key = dayKey(day);
  return logs.filter((l) => dayKey(new Date(l.start_time)) === key)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
}

/** Logs from the last `days` local days (today included). */
export function logsInWindow(logs: BabyLogRow[], now: Date, days: number): BabyLogRow[] {
  const from = startOfDayOffset(now, -(days - 1)).getTime();
  return logs.filter((l) => new Date(l.start_time).getTime() >= from);
}

const averageGapMinutes = (times: number[]) => {
  if (times.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < times.length; i++) sum += times[i] - times[i - 1];
  return sum / (times.length - 1) / MINUTE;
};

export interface FeedingStats {
  total: number; left: number; right: number; breastMinutes: number; formulaCount: number; formulaMl: number;
  solidCount: number; averageGapMinutes: number | null; last: { at: Date; kind: FeedKind } | null;
}

export function feedingStats(logs: BabyLogRow[]): FeedingStats {
  const feeds = logs.filter((l) => l.log_type === 'feeding')
    .map((log) => ({ log, kind: feedKind(log.feed_type), at: new Date(log.start_time) }))
    .filter((f): f is { log: BabyLogRow; kind: FeedKind; at: Date } => f.kind !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const s: FeedingStats = {
    total: feeds.length, left: 0, right: 0, breastMinutes: 0, formulaCount: 0, formulaMl: 0, solidCount: 0,
    averageGapMinutes: averageGapMinutes(feeds.map((f) => f.at.getTime())),
    last: feeds.length ? { at: feeds[feeds.length - 1].at, kind: feeds[feeds.length - 1].kind } : null,
  };
  for (const { log, kind } of feeds) {
    if (kind === 'left' || kind === 'right') {
      if (kind === 'left') s.left++; else s.right++;
      if (log.end_time) {
        const m = (new Date(log.end_time).getTime() - new Date(log.start_time).getTime()) / MINUTE;
        if (m > 0) s.breastMinutes += m;
      }
    } else if (kind === 'formula') {
      s.formulaCount++;
      s.formulaMl += mlFromNotes(log.notes) ?? 0;
    } else {
      s.solidCount++;
    }
  }
  return s;
}

export interface SleepSession { id: string; start: Date; end: Date; minutes: number }
export interface SleepStats {
  sessions: SleepSession[]; totalMinutes: number; averageMinutes: number | null; longestMinutes: number | null; lastEnd: Date | null;
}

export function sleepStats(logs: BabyLogRow[]): SleepStats {
  const sessions = logs.filter((l) => l.log_type === 'sleep' && l.end_time)
    .map((l) => {
      const start = new Date(l.start_time), end = new Date(l.end_time as string);
      return { id: l.id, start, end, minutes: (end.getTime() - start.getTime()) / MINUTE };
    })
    .filter((s) => s.minutes > 0)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (!sessions.length) return { sessions, totalMinutes: 0, averageMinutes: null, longestMinutes: null, lastEnd: null };
  const total = sessions.reduce((sum, s) => sum + s.minutes, 0);
  return {
    sessions, totalMinutes: total, averageMinutes: total / sessions.length,
    longestMinutes: Math.max(...sessions.map((s) => s.minutes)),
    lastEnd: sessions.reduce((last, s) => (s.end > last ? s.end : last), sessions[0].end),
  };
}

export interface DiaperStats { total: number; wet: number; dirty: number; mixed: number; averageGapMinutes: number | null; last: Date | null }

export function diaperStats(logs: BabyLogRow[]): DiaperStats {
  const items = logs.filter((l) => l.log_type === 'diaper')
    .map((l) => ({ kind: diaperKind(l.diaper_type), at: new Date(l.start_time) }))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const s: DiaperStats = {
    total: items.length, wet: 0, dirty: 0, mixed: 0,
    averageGapMinutes: averageGapMinutes(items.map((i) => i.at.getTime())),
    last: items.length ? items[items.length - 1].at : null,
  };
  for (const i of items) if (i.kind) s[i.kind]++;
  return s;
}

export interface TrendPoint { key: string; day: Date; count: number; minutes: number }

/** Per-day counts (and sleep minutes) for one log type; weekly buckets beyond 30 days. */
export function trendPoints(logs: BabyLogRow[], type: string, now: Date, days: number): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDayOffset(now, -i);
    points.push({ key: dayKey(day), day, count: 0, minutes: 0 });
  }
  const index = new Map(points.map((p, i) => [p.key, i]));
  for (const l of logs) {
    if (l.log_type !== type) continue;
    const i = index.get(dayKey(new Date(l.start_time)));
    if (i === undefined) continue;
    points[i].count++;
    if (type === 'sleep' && l.end_time) {
      const m = (new Date(l.end_time).getTime() - new Date(l.start_time).getTime()) / MINUTE;
      if (m > 0) points[i].minutes += m;
    }
  }
  if (days <= 30) return points;
  const weeks: TrendPoint[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const chunk = points.slice(i, i + 7);
    weeks.push({ key: chunk[0].key, day: chunk[0].day, count: chunk.reduce((s, p) => s + p.count, 0), minutes: chunk.reduce((s, p) => s + p.minutes, 0) });
  }
  return weeks;
}

export interface HistoryRow { key: string; day: Date; feedings: number; formulaMl: number; sleepMinutes: number; diapers: number }

/** Newest-first daily summary rows for the last `days` days. */
export function dailyHistory(logs: BabyLogRow[], now: Date, days: number): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (let i = 0; i < days; i++) {
    const day = startOfDayOffset(now, -i);
    rows.push({ key: dayKey(day), day, feedings: 0, formulaMl: 0, sleepMinutes: 0, diapers: 0 });
  }
  const index = new Map(rows.map((r, i) => [r.key, i]));
  for (const l of logs) {
    const i = index.get(dayKey(new Date(l.start_time)));
    if (i === undefined) continue;
    const row = rows[i], kind = feedKind(l.feed_type);
    if (l.log_type === 'feeding' && kind) {
      row.feedings++;
      if (kind === 'formula') row.formulaMl += mlFromNotes(l.notes) ?? 0;
    } else if (l.log_type === 'sleep' && l.end_time) {
      const m = (new Date(l.end_time).getTime() - new Date(l.start_time).getTime()) / MINUTE;
      if (m > 0) row.sleepMinutes += m;
    } else if (l.log_type === 'diaper') {
      row.diapers++;
    }
  }
  return rows;
}

/** "1 h 30 min" with localized unit abbreviations. */
export function formatMinutes(minutes: number, units: { hour: string; minute: string }): string {
  const total = Math.max(0, Math.round(minutes)), h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m} ${units.minute}`;
  return m === 0 ? `${h} ${units.hour}` : `${h} ${units.hour} ${m} ${units.minute}`;
}

/** Timer display: 1:05:09 or 5:09. */
export function formatClockSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export const timeOfDay = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const minutesBetween = (from: Date, to: Date) => Math.max(0, Math.round((to.getTime() - from.getTime()) / MINUTE));
