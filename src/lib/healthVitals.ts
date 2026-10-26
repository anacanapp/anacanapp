import { registerPlugin, Capacitor } from '@capacitor/core';

/** Optional Apple Health vitals writes on native iOS, separate from Supabase logs. */

interface HealthVitalsPlugin {
  isAvailable(): Promise<{available: boolean;}>;
  requestWritePermission(): Promise<{granted: boolean;}>;
  writeWeight(options: {kg: number;date?: string;}): Promise<{written: boolean;}>;
  writeBloodPressure(options: {systolic: number;diastolic: number;date?: string;}): Promise<{written: boolean;}>;
  writeBloodGlucose(options: {mgdl: number;date?: string;}): Promise<{written: boolean;}>;
}

const HealthVitals = registerPlugin<HealthVitalsPlugin>('HealthVitals');

export const VITALS_WRITE_KEY = 'anacan_health_vitals_write';

const writesSupported = (): boolean => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

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
    return false; // plugin qeydiyyatda yoxdur (köhnə native build)
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

/** Çəkini Health-ə yaz (kq) — toggle deaktivdirsə/plugin yoxdursa səssizcə heç nə etmir. */
export async function writeWeightToHealth(kg: number, date?: Date): Promise<boolean> {
  if (!isVitalsWriteEnabled()) return false;
  if (!(await isVitalsWriteAvailable())) return false;
  try {
    await HealthVitals.writeWeight({ kg, date: (date || new Date()).toISOString() });
    return true;
  } catch (e) {
    console.warn('HealthVitals weight write failed:', e);
    return false;
  }
}

/** Qan təzyiqini Health-ə yaz (sistolik/diastolik, mmHg). */
export async function writeBloodPressureToHealth(systolic: number, diastolic: number, date?: Date): Promise<boolean> {
  if (!isVitalsWriteEnabled()) return false;
  if (!(await isVitalsWriteAvailable())) return false;
  try {
    await HealthVitals.writeBloodPressure({ systolic, diastolic, date: (date || new Date()).toISOString() });
    return true;
  } catch (e) {
    console.warn('HealthVitals blood pressure write failed:', e);
    return false;
  }
}

/** Qan şəkərini Health-ə yaz (mg/dL). */
export async function writeBloodGlucoseToHealth(mgdl: number, date?: Date): Promise<boolean> {
  if (!isVitalsWriteEnabled()) return false;
  if (!(await isVitalsWriteAvailable())) return false;
  try {
    await HealthVitals.writeBloodGlucose({ mgdl, date: (date || new Date()).toISOString() });
    return true;
  } catch (e) {
    console.warn('HealthVitals blood glucose write failed:', e);
    return false;
  }
}
