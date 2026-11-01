import { Capacitor } from '@capacitor/core';
import { Health, type HealthPermission } from 'capacitor-health';

/**
 * Reads from Apple Health (iOS) and Health Connect (Android): daily steps, workouts and, on iOS,
 * mindful minutes. Everything is read on the device and shown only on the Health screen; nothing
 * read here is sent to Anacan's servers. Writes live in healthVitals.ts / healthCycle.ts.
 */

export const HEALTH_CONNECTED_KEY = 'anacan_health_connected';

export type HealthPlatform = 'ios' | 'android';

const IOS_PERMISSIONS: HealthPermission[] = ['READ_STEPS', 'READ_WORKOUTS', 'READ_MINDFULNESS'];
// Health Connect: steps and exercise sessions only (no heart rate, route, distance or calories).
const ANDROID_PERMISSIONS: HealthPermission[] = ['READ_STEPS', 'READ_WORKOUTS'];

export const healthPlatform = (): HealthPlatform | null => {
  if (!Capacitor.isNativePlatform()) return null;
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' ? platform : null;
};

export const isNativeHealthPlatform = (): boolean => healthPlatform() !== null;
export const readsSupported = (): boolean => healthPlatform() !== null;
/** Health Connect has no mindfulness reads in the plugin; Apple Health does. */
export const mindfulnessSupported = (): boolean => healthPlatform() === 'ios';

let androidClientReady: Promise<boolean> | null = null;

/** Whether Apple Health / Health Connect can be used on this device. On Android this also creates
 *  the Health Connect client, which every later call needs, so it runs before any query. */
export async function isHealthAvailable(): Promise<boolean> {
  if (!readsSupported()) return false;
  try {
    const { available } = await Health.isHealthAvailable();
    return available;
  } catch {
    return false;
  }
}

async function ready(): Promise<boolean> {
  if (healthPlatform() !== 'android') return readsSupported();
  if (!androidClientReady) {
    androidClientReady = isHealthAvailable().then((ok) => {
      if (!ok) androidClientReady = null;
      return ok;
    });
  }
  return androidClientReady;
}

export interface HealthReadAccess {
  steps: boolean;
  workouts: boolean;
}

/**
 * Real read access on Android. iOS never tells an app whether reading was allowed (HealthKit privacy),
 * so iOS answers null and the screen explains where to check instead.
 */
export async function getReadAccess(): Promise<HealthReadAccess | null> {
  if (healthPlatform() !== 'android' || !(await ready())) return null;
  try {
    const { permissions } = await Health.checkHealthPermissions({ permissions: ANDROID_PERMISSIONS });
    const granted = permissions as unknown as Record<string, boolean>;
    return { steps: !!granted.READ_STEPS, workouts: !!granted.READ_WORKOUTS };
  } catch {
    return null;
  }
}

/** Ask for read access. Answers true when the person can now see data (on iOS always after the sheet). */
export async function requestHealthPermissions(): Promise<boolean> {
  const platform = healthPlatform();
  if (!platform || !(await ready())) return false;
  try {
    const result = await Health.requestHealthPermissions({ permissions: platform === 'ios' ? IOS_PERMISSIONS : ANDROID_PERMISSIONS });
    if (platform === 'android') {
      const granted = (result?.permissions ?? {}) as unknown as Record<string, boolean>;
      if (!granted.READ_STEPS && !granted.READ_WORKOUTS) return false;
    }
    localStorage.setItem(HEALTH_CONNECTED_KEY, String(Date.now()));
    return true;
  } catch (e) {
    console.error('Health permission request failed:', e);
    return false;
  }
}

/** Whether the person turned on reading on this device (local choice; permissions live in the OS). */
export function isHealthConnected(): boolean {
  if (!readsSupported()) return false;
  try {
    return !!localStorage.getItem(HEALTH_CONNECTED_KEY);
  } catch {
    return false;
  }
}

export function disconnectHealth(): void {
  try {
    localStorage.removeItem(HEALTH_CONNECTED_KEY);
  } catch {/* boş */}
}

export interface DailyHealthSample {
  /** Local calendar day, yyyy-MM-dd */
  date: string;
  value: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a Date (never UTC: a 01:00 walk in Baku belongs to that day). */
export const localDayKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Bucket starts arrive in three shapes: iOS steps send epoch milliseconds, iOS mindfulness sends an
 * ISO timestamp, Health Connect sends a zone-less local date-time ("2026-10-31T00:00"). The old code
 * called .split on a number, threw, and showed nothing on iOS.
 */
export function bucketDayKey(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return localDayKey(new Date(value));
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?$/.test(value)) return value.slice(0, 10);
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : localDayKey(new Date(parsed));
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localDayKey(value);
  return null;
}

/** The last `days` local days, oldest first. */
export function lastDays(days: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12);
    keys.push(localDayKey(d));
  }
  return keys;
}

/** Sum raw buckets per local day and return every day in the window (missing days are 0). */
export function fillDays(raw: { startDate: unknown; value: unknown }[], days: number, scale = 1, now = new Date()): DailyHealthSample[] {
  const totals = new Map<string, number>();
  for (const sample of raw) {
    const key = bucketDayKey(sample.startDate);
    const value = typeof sample.value === 'number' && sample.value > 0 ? sample.value : 0;
    if (key) totals.set(key, (totals.get(key) ?? 0) + value);
  }
  return lastDays(days, now).map((date) => ({ date, value: Math.round((totals.get(date) ?? 0) * scale) }));
}

async function queryDaily(dataType: 'steps' | 'mindfulness', days: number): Promise<DailyHealthSample[]> {
  if (!(await ready())) return [];
  if (dataType === 'mindfulness' && !mindfulnessSupported()) return [];
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
  const { aggregatedData } = await Health.queryAggregated({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    dataType,
    bucket: 'day'
  });
  // iOS mindfulness values are seconds; show minutes.
  return fillDays((aggregatedData || []) as unknown as { startDate: unknown; value: unknown }[], days, dataType === 'mindfulness' ? 1 / 60 : 1, end);
}

export const getDailySteps = (days = 7) => queryDaily('steps', days);
export const getDailyMindfulness = (days = 7) => queryDaily('mindfulness', days);

export interface HealthWorkout {
  startDate: string;
  endDate: string;
  workoutType: string;
  /** seconds */
  duration: number;
  calories: number;
}

/** Recent workouts, without heart rate, route or step details. */
export async function getRecentWorkouts(days = 7): Promise<HealthWorkout[]> {
  if (!(await ready())) return [];
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
  const { workouts } = await Health.queryWorkouts({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    includeHeartRate: false,
    includeRoute: false,
    includeSteps: false
  });
  return (workouts || []).map((w) => {
    const raw = w as unknown as Record<string, unknown>;
    return {
      startDate: String(raw.startDate ?? ''),
      endDate: String(raw.endDate ?? ''),
      workoutType: String(raw.workoutType || 'workout'),
      duration: Number(raw.duration) || 0,
      calories: Math.round(Number(raw.calories) || 0)
    };
  }).sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
}

/** Platform permission settings (iOS opens the app's Settings page; Android opens Health Connect). */
export async function openHealthSettings(): Promise<void> {
  const platform = healthPlatform();
  if (!platform) return;
  try {
    if (platform === 'ios') {
      await Health.openAppleHealthSettings();
    } else {
      await ready();
      await Health.openHealthConnectSettings();
    }
  } catch (e) {
    console.error('Open health settings failed:', e);
  }
}

/** Android: show Health Connect in the Play Store. */
export async function installHealthConnect(): Promise<void> {
  try {
    await Health.showHealthConnectInPlayStore();
  } catch (e) {
    console.error('Show Health Connect in Play Store failed:', e);
  }
}
