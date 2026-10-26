import { Capacitor } from '@capacitor/core';
import { Health, type HealthPermission } from 'capacitor-health';

/** Apple Health reads on native iOS; Android cycle writes live in healthCycle.ts. */

export const HEALTH_CONNECTED_KEY = 'anacan_health_connected';

// iOS only. Android must not request health read permissions.
const PERMISSIONS: HealthPermission[] = [
  'READ_STEPS',
  'READ_WORKOUTS',
  'READ_MINDFULNESS'
];

export const isNativeHealthPlatform = (): boolean => Capacitor.isNativePlatform();
export const readsSupported = (): boolean => isNativeHealthPlatform() && Capacitor.getPlatform() === 'ios';

/** Whether Apple Health reads are available on this device. */
export async function isHealthAvailable(): Promise<boolean> {
  if (!readsSupported()) return false;
  try {
    const { available } = await Health.isHealthAvailable();
    return available;
  } catch {
    return false;
  }
}

/** İcazələri istə. iOS-da nəticə həmişə "granted" fərz olunur (HealthKit gizlilik modeli). */
export async function requestHealthPermissions(): Promise<boolean> {
  if (!readsSupported()) return false;
  try {
    await Health.requestHealthPermissions({ permissions: PERMISSIONS });
    localStorage.setItem(HEALTH_CONNECTED_KEY, String(Date.now()));
    return true;
  } catch (e) {
    console.error('Health permission request failed:', e);
    return false;
  }
}

/** İstifadəçi bu cihazda health-i qoşub? (lokal bayraq) */
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
  /** yyyy-MM-dd */
  date: string;
  value: number;
}

/** Günlük bucket-lərlə aqreqasiya (addım və ya mindfulness dəqiqəsi). */
async function queryDaily(dataType: 'steps' | 'mindfulness', days: number): Promise<DailyHealthSample[]> {
  if (!readsSupported()) return [];
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  try {
    const { aggregatedData } = await Health.queryAggregated({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dataType,
      bucket: 'day'
    });
    return (aggregatedData || []).map((s) => ({
      date: s.startDate.split('T')[0],
      value: Math.round(s.value || 0)
    }));
  } catch (e) {
    console.error(`Health ${dataType} query failed:`, e);
    return [];
  }
}

export const getDailySteps = (days = 7) => queryDaily('steps', days);
/** Read mindfulness minutes from Apple Health; no mindfulness writes. */
export const getDailyMindfulness = (days = 7) => queryDaily('mindfulness', days);

export async function getTodaySteps(): Promise<number> {
  const samples = await getDailySteps(1);
  return samples.reduce((sum, s) => sum + s.value, 0);
}

export async function getWeekMindfulnessMinutes(): Promise<number> {
  const samples = await getDailyMindfulness(7);
  // Native tərəf saniyə/dəqiqə vahidini bucket-in özündə "value" kimi qaytarır —
  // steps/calories ilə eyni struktur, vahid mindful "sessiyaların cəm müddəti (dəq)".
  return samples.reduce((sum, s) => sum + s.value, 0);
}

export interface HealthWorkout {
  startDate: string;
  endDate: string;
  workoutType: string;
  duration: number;
  calories: number;
  sourceName: string;
}

/** Recent Apple Health workouts, without heart rate, route or step details. */
export async function getRecentWorkouts(days = 7): Promise<HealthWorkout[]> {
  if (!readsSupported()) return [];
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  try {
    const { workouts } = await Health.queryWorkouts({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      includeHeartRate: false,
      includeRoute: false,
      includeSteps: false
    });
    return (workouts || []).map((w) => ({
      startDate: w.startDate,
      endDate: w.endDate,
      workoutType: w.workoutType || 'workout',
      duration: w.duration || 0,
      calories: Math.round(w.calories || 0),
      sourceName: w.sourceName || ''
    }));
  } catch (e) {
    console.error('Health workouts query failed:', e);
    return [];
  }
}

/** Platform ayarlarını aç (icazələri idarə etmək üçün). */
export async function openHealthSettings(): Promise<void> {
  if (!isNativeHealthPlatform()) return;
  try {
    if (Capacitor.getPlatform() === 'ios') {
      await Health.openAppleHealthSettings();
    } else {
      await Health.openHealthConnectSettings();
    }
  } catch (e) {
    console.error('Open health settings failed:', e);
  }
}

/** Android: Health Connect tətbiqini Play Store-da göstər. */
export async function installHealthConnect(): Promise<void> {
  try {
    await Health.showHealthConnectInPlayStore();
  } catch (e) {
    console.error('Show Health Connect in Play Store failed:', e);
  }
}
