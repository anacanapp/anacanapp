import { supabase } from '@/integrations/supabase/client';

/**
 * Baby illness journal (Duzelis75). The family — the mother and her mutually linked partner — reads
 * and writes episodes and entries through SECURITY DEFINER RPCs. The app never calculates a dose: the
 * dose and interval are stored exactly as entered (what the doctor or the leaflet said).
 */

export type IllnessKind = 'fever' | 'cold' | 'stomach' | 'ear' | 'rash' | 'teething' | 'vaccine' | 'other';
export const ILLNESS_KINDS: IllnessKind[] = ['fever', 'cold', 'stomach', 'ear', 'rash', 'teething', 'vaccine', 'other'];
export const KIND_EMOJI: Record<IllnessKind, string> = {
  fever: '🤒', cold: '🤧', stomach: '🤢', ear: '👂', rash: '🔴', teething: '🦷', vaccine: '💉', other: '🩺'
};

export type TempMethod = 'armpit' | 'ear' | 'forehead' | 'rectal' | 'oral';
export const TEMP_METHODS: TempMethod[] = ['armpit', 'ear', 'forehead', 'rectal', 'oral'];
export const SYMPTOMS = ['cough', 'runny_nose', 'vomit', 'diarrhea', 'poor_feeding', 'fewer_diapers', 'rash', 'sleepy', 'irritable', 'breathing', 'ear_pull'] as const;
export type Symptom = typeof SYMPTOMS[number];

export interface IllnessEpisode {
  id: string;
  child_id: string | null;
  child_name: string | null;
  kind: IllnessKind;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  entries: number;
  last_temp: number | null;
  max_temp: number | null;
}

export interface IllnessEntry {
  id: string;
  kind: 'temp' | 'med' | 'symptom';
  at: string;
  temp_c: number | null;
  temp_method: TempMethod | null;
  med_name: string | null;
  dose: string | null;
  interval_hours: number | null;
  remind: boolean;
  symptoms: string[] | null;
  note: string | null;
  by: 'mother' | 'partner' | null;
  by_me: boolean;
}

export type NewIllnessEntry =
  | { kind: 'temp'; at: string; temp_c: number; temp_method: TempMethod; note?: string }
  | { kind: 'med'; at: string; med_name: string; dose: string; interval_hours: number; remind: boolean; note?: string }
  | { kind: 'symptom'; at: string; symptoms: string[]; note?: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables/RPCs newer than the generated types
const rpc = (name: string, args?: Record<string, unknown>): Promise<{ data: any; error: any }> => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const listEpisodes = () => call<IllnessEpisode[]>('illness_episodes_v1', { p_limit: 20 }).then((rows) => rows ?? []);
export const listEntries = (episodeId: string) =>
  call<IllnessEntry[]>('illness_entries_v1', { p_episode: episodeId }).then((rows) => (rows ?? []).map((row) => ({
    ...row,
    temp_c: row.temp_c == null ? null : Number(row.temp_c),
    interval_hours: row.interval_hours == null ? null : Number(row.interval_hours)
  })));
export const startEpisode = (kind: IllnessKind, childId: string | null, childName: string | null) =>
  call<string>('illness_episode_start_v1', { p_kind: kind, p_child_id: childId, p_child_name: childName });
export const closeEpisode = (episodeId: string, ended: boolean) => call<void>('illness_episode_close_v1', { p_episode: episodeId, p_ended: ended });
export const deleteEpisode = (episodeId: string) => call<void>('illness_episode_delete_v1', { p_episode: episodeId });
export const addEntry = (episodeId: string, entry: NewIllnessEntry) => call<string>('illness_entry_add_v1', { p_episode: episodeId, p_entry: entry });
export const deleteEntry = (entryId: string) => call<void>('illness_entry_delete_v1', { p_entry: entryId });

// ── Temperature ──────────────────────────────────────────────────────────────────────
export type TempBand = 'low' | 'normal' | 'subfebrile' | 'fever' | 'high';
export function tempBand(temp: number): TempBand {
  if (temp < 36) return 'low';
  if (temp < 37.5) return 'normal';
  if (temp < 38) return 'subfebrile';
  if (temp < 39.5) return 'fever';
  return 'high';
}
export const BAND_COLOR: Record<TempBand, string> = {
  low: '#3b82c4', normal: '#1c7a4d', subfebrile: '#b7791f', fever: '#e8590c', high: '#c92a2a'
};

// ── Medicines ────────────────────────────────────────────────────────────────────────
export interface MedStatus {
  name: string;
  dose: string | null;
  lastAt: Date;
  intervalHours: number;
  nextAt: Date;
  remind: boolean;
  by: IllnessEntry['by'];
  byMe: boolean;
}

/** The latest dose of each medicine (by name, case-insensitive) with the next allowed time. */
export function medStatuses(entries: IllnessEntry[]): MedStatus[] {
  const seen = new Map<string, MedStatus>();
  for (const entry of entries) {
    if (entry.kind !== 'med' || !entry.med_name || !entry.interval_hours) continue;
    const key = entry.med_name.trim().toLowerCase();
    const at = new Date(entry.at);
    const current = seen.get(key);
    if (current && current.lastAt >= at) continue;
    seen.set(key, {
      name: entry.med_name, dose: entry.dose, lastAt: at, intervalHours: entry.interval_hours,
      nextAt: new Date(at.getTime() + entry.interval_hours * 3600_000), remind: entry.remind, by: entry.by, byMe: entry.by_me
    });
  }
  return [...seen.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}

/** A dose logged before the previous one's interval ended (same medicine). */
export function earlyDose(entries: IllnessEntry[], medName: string, at: Date): { last: MedStatus; minutesAgo: number } | null {
  const last = medStatuses(entries).find((m) => m.name.trim().toLowerCase() === medName.trim().toLowerCase());
  if (!last || at <= last.lastAt || at >= last.nextAt) return null;
  return { last, minutesAgo: Math.round((at.getTime() - last.lastAt.getTime()) / 60000) };
}

// ── Warning signs (from entries) ─────────────────────────────────────────────────────
export type IllnessAlert =
  | { kind: 'infant'; temp: number; months: number }
  | { kind: 'breathing' }
  | { kind: 'high'; temp: number }
  | { kind: 'long' };

/**
 * Alerts the screen must show: fever in a baby under 3 months, breathing difficulty, 40 °C or more,
 * fever for more than 3 days. Age in months is null when unknown (then the infant rule is skipped).
 */
export function illnessAlerts(episode: Pick<IllnessEpisode, 'started_at' | 'ended_at'>, entries: IllnessEntry[], ageMonths: number | null, now = new Date()): IllnessAlert[] {
  if (episode.ended_at) return [];
  const alerts: IllnessAlert[] = [];
  const temps = entries.filter((e) => e.kind === 'temp' && e.temp_c != null);
  const latest = temps[0]?.temp_c ?? null;
  if (latest != null && ageMonths != null && ageMonths < 3 && latest >= 38) alerts.push({ kind: 'infant', temp: latest, months: ageMonths });
  if (entries.some((e) => e.kind === 'symptom' && e.symptoms?.includes('breathing') && now.getTime() - new Date(e.at).getTime() < 24 * 3600_000)) {
    alerts.push({ kind: 'breathing' });
  }
  if (latest != null && latest >= 40) alerts.push({ kind: 'high', temp: latest });
  const feverTemps = temps.filter((e) => (e.temp_c ?? 0) >= 38);
  if (feverTemps.length >= 2) {
    const first = new Date(feverTemps[feverTemps.length - 1].at).getTime();
    const last = new Date(feverTemps[0].at).getTime();
    if (last - first > 72 * 3600_000) alerts.push({ kind: 'long' });
  }
  return alerts;
}

/** Days since the episode started, counting the first day as 1. */
export function episodeDay(startedAt: string, now = new Date()): number {
  const start = new Date(startedAt);
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400_000) + 1);
}

// ── Next-dose reminders on this device ─────────────────────────────────────────────────
/** Stable notification id per medicine and episode (31-bit positive). */
export function reminderId(episodeId: string, medName: string): number {
  let hash = 7;
  for (const char of `${episodeId}:${medName.trim().toLowerCase()}`) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return 900_000_000 + (Math.abs(hash) % 99_000_000);
}

/**
 * Schedule (or cancel) a local reminder for each medicine's next dose. Both family phones schedule
 * it when they open the episode, so whoever is with the baby gets it.
 */
export async function syncDoseReminders(episode: IllnessEpisode, entries: IllnessEntry[], text: { title: (med: string) => string; body: string }): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const statuses = medStatuses(entries);
    const now = Date.now();
    const cancel = statuses.map((m) => ({ id: reminderId(episode.id, m.name) }));
    if (cancel.length) await LocalNotifications.cancel({ notifications: cancel });
    if (episode.ended_at) return;
    const due = statuses.filter((m) => m.remind && m.nextAt.getTime() > now + 60_000);
    if (!due.length) return;
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;
    await LocalNotifications.schedule({
      notifications: due.map((m) => ({
        id: reminderId(episode.id, m.name),
        title: text.title(m.name),
        body: text.body,
        schedule: { at: m.nextAt, allowWhileIdle: true }
      }))
    });
  } catch {/* reminders are a convenience; the screen still shows the next time */}
}
