import { registerPlugin, Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Optional copies of weight, blood pressure and blood glucose records to Apple Health (iOS) and
 * Health Connect (Android). The account records stay the source of truth; this only copies saved
 * records onto the device's health store.
 *
 * Every copy goes through syncVitalsToHealth, which remembers per account and per measurement the
 * newest record already copied, so saving a record, turning the switch on and "Sync now" never copy
 * the same record twice. Turning the switch on copies the last 30 days once.
 */

interface HealthVitalsPlugin {
  isAvailable(): Promise<{available: boolean;}>;
  requestWritePermission(): Promise<{granted: boolean;}>;
  writeWeight(options: {kg: number;date?: string;}): Promise<{written: boolean;}>;
  writeBloodPressure(options: {systolic: number;diastolic: number;date?: string;}): Promise<{written: boolean;}>;
  writeBloodGlucose(options: {mgdl: number;date?: string;}): Promise<{written: boolean;}>;
}

const HealthVitals = registerPlugin<HealthVitalsPlugin>('HealthVitals');

export const VITALS_WRITE_KEY = 'anacan_health_vitals_write';
const WATERMARK_PREFIX = 'anacan_health_vitals_synced:';
const LAST_SYNC_PREFIX = 'anacan_health_vitals_last:';
export const BACKFILL_DAYS = 30;
const MAX_PER_SYNC = 200;

export type VitalKind = 'weight' | 'bp' | 'glucose';
type Watermarks = Partial<Record<VitalKind, string>>;

const writesSupported = (): boolean => {
  if (!Capacitor.isNativePlatform()) return false;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
};

export const isVitalsWriteEnabled = (): boolean => {
  if (!writesSupported()) return false;
  try {return localStorage.getItem(VITALS_WRITE_KEY) === '1';} catch {return false;}
};

export const setVitalsWriteEnabled = (on: boolean): void => {
  try {
    if (on && writesSupported()) localStorage.setItem(VITALS_WRITE_KEY, '1');else
    localStorage.removeItem(VITALS_WRITE_KEY);
  } catch {/* boş */}
};

export async function isVitalsWriteAvailable(): Promise<boolean> {
  if (!writesSupported()) return false;
  try {
    const { available } = await HealthVitals.isAvailable();
    return available;
  } catch {
    return false; // older native build without the plugin
  }
}

export async function requestVitalsWritePermission(): Promise<boolean> {
  if (!writesSupported()) return false;
  try {
    const { granted } = await HealthVitals.requestWritePermission();
    return granted;
  } catch (e) {
    console.warn('HealthVitals permission failed:', e);
    return false;
  }
}

function readWatermarks(userId: string): Watermarks {
  try {
    const raw = localStorage.getItem(WATERMARK_PREFIX + userId);
    return raw ? JSON.parse(raw) as Watermarks : {};
  } catch {
    return {};
  }
}

function writeWatermarks(userId: string, marks: Watermarks): void {
  try {localStorage.setItem(WATERMARK_PREFIX + userId, JSON.stringify(marks));} catch {/* boş */}
}

export function getLastVitalsSync(userId: string): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_PREFIX + userId);
    return raw ? Number(raw) || null : null;
  } catch {
    return null;
  }
}

/** A weight entry has only a day; use its save time on that day, otherwise noon of that day. */
export function weightMoment(entryDate: string, createdAt: string): string {
  const created = new Date(createdAt);
  const [y, m, d] = entryDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return Number.isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString();
  if (!Number.isNaN(created.getTime()) && created.getFullYear() === y && created.getMonth() === m - 1 && created.getDate() === d) {
    return created.toISOString();
  }
  return new Date(y, m - 1, d, 12).toISOString();
}

export interface VitalsSyncResult {
  written: number;
  failed: number;
  skipped: boolean;
}

interface PendingWrite {
  kind: VitalKind;
  createdAt: string;
  write: () => Promise<unknown>;
}

/** One ISO shape both native sides parse: UTC with milliseconds ("…T10:00:00.000Z"). */
const iso = (value: string | null | undefined, fallback: string): string => {
  const parsed = Date.parse(value || fallback);
  return new Date(Number.isNaN(parsed) ? Date.now() : parsed).toISOString();
};

async function loadPending(userId: string, marks: Watermarks): Promise<PendingWrite[]> {
  const floor = new Date(Date.now() - BACKFILL_DAYS * 86400_000).toISOString();
  const since = (kind: VitalKind) => marks[kind] && marks[kind]! > floor ? marks[kind]! : floor;
  const [weight, bp, glucose] = await Promise.all([
    supabase.from('weight_entries').select('weight, entry_date, created_at').eq('user_id', userId).gt('created_at', since('weight')).order('created_at', { ascending: true }).limit(MAX_PER_SYNC),
    supabase.from('blood_pressure_logs').select('systolic, diastolic, measured_at, created_at').eq('user_id', userId).gt('created_at', since('bp')).order('created_at', { ascending: true }).limit(MAX_PER_SYNC),
    supabase.from('blood_sugar_logs').select('reading_value, logged_at, created_at').eq('user_id', userId).gt('created_at', since('glucose')).order('created_at', { ascending: true }).limit(MAX_PER_SYNC)]
  );
  if (weight.error || bp.error || glucose.error) throw new Error('vitals_read_failed');

  const pending: PendingWrite[] = [];
  for (const row of weight.data ?? []) {
    const kg = Number(row.weight);
    if (kg > 0 && kg < 400) pending.push({ kind: 'weight', createdAt: row.created_at, write: () => HealthVitals.writeWeight({ kg, date: weightMoment(row.entry_date, row.created_at) }) });
  }
  for (const row of bp.data ?? []) {
    const systolic = Number(row.systolic);
    const diastolic = Number(row.diastolic);
    if (systolic > 0 && diastolic > 0) pending.push({ kind: 'bp', createdAt: row.created_at, write: () => HealthVitals.writeBloodPressure({ systolic, diastolic, date: iso(row.measured_at, row.created_at) }) });
  }
  for (const row of glucose.data ?? []) {
    const mgdl = Number(row.reading_value);
    if (mgdl > 0 && mgdl < 1000 && row.created_at) pending.push({ kind: 'glucose', createdAt: row.created_at, write: () => HealthVitals.writeBloodGlucose({ mgdl, date: iso(row.logged_at, row.created_at) }) });
  }
  return pending;
}

let running: Promise<VitalsSyncResult> | null = null;

/**
 * Copy saved records that were not copied yet. Records are copied oldest first per measurement and
 * the watermark only moves past a record after it was written, so a failure is retried next time.
 */
export function syncVitalsToHealth(userId: string | null | undefined): Promise<VitalsSyncResult> {
  if (!userId || !isVitalsWriteEnabled()) return Promise.resolve({ written: 0, failed: 0, skipped: true });
  if (running) return running.then(() => syncVitalsToHealth(userId));
  running = (async () => {
    if (!(await isVitalsWriteAvailable())) return { written: 0, failed: 0, skipped: true };
    const marks = readWatermarks(userId);
    const pending = await loadPending(userId, marks);
    let written = 0;
    let failed = 0;
    const blocked = new Set<VitalKind>();
    for (const item of pending) {
      if (blocked.has(item.kind)) continue;
      try {
        await item.write();
        marks[item.kind] = item.createdAt;
        written++;
      } catch (e) {
        console.warn('HealthVitals write failed:', e);
        failed++;
        blocked.add(item.kind); // keep order: retry this measurement from here next time
      }
    }
    writeWatermarks(userId, marks);
    if (failed === 0) {
      try {localStorage.setItem(LAST_SYNC_PREFIX + userId, String(Date.now()));} catch {/* boş */}
    }
    return { written, failed, skipped: false };
  })().finally(() => {running = null;});
  return running;
}

/** After saving a record in a tracker: copy it (and anything missed) in the background. */
export function syncVitalsInBackground(userId: string | null | undefined): void {
  if (!isVitalsWriteEnabled()) return;
  void syncVitalsToHealth(userId).catch((e) => console.warn('HealthVitals sync failed:', e));
}
