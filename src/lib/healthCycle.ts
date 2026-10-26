import { registerPlugin, Capacitor } from '@capacitor/core';
import { localPeriodDate, type PeriodFlowAction } from './period-flow';

/**
 * HealthCycle — menstruasiya məlumatının Apple Health / Health Connect-ə yazılması.
 * Native tərəf: ios/App/App/HealthCyclePlugin.swift + android .../HealthCyclePlugin.kt
 * Plugin yoxdursa (köhnə build / web) — qəzasız false qaytarır.
 */

interface HealthCyclePlugin {
  isAvailable(): Promise<{available: boolean; apiVersion?: number}>;
  requestWritePermission(): Promise<{granted: boolean;}>;
  writeMenstruation(options: {startDate: string;endDate: string;flow: PeriodFlowAction;cycleStart: boolean}): Promise<{written: number;}>;
}

const HealthCycle = registerPlugin<HealthCyclePlugin>('HealthCycle');

export const CYCLE_WRITE_KEY = 'anacan_health_cycle_write';

export const isCycleWriteEnabled = (): boolean => {
  try {return localStorage.getItem(CYCLE_WRITE_KEY) === '1';} catch {return false;}
};

export const setCycleWriteEnabled = (on: boolean): void => {
  try {
    if (on) localStorage.setItem(CYCLE_WRITE_KEY, '1');else
    localStorage.removeItem(CYCLE_WRITE_KEY);
  } catch {/* boş */}
};

export async function isCycleWriteAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { available, apiVersion } = await HealthCycle.isAvailable();
    return available && (apiVersion ?? 1) >= 2;
  } catch {
    return false; // plugin qeydiyyatda yoxdur (köhnə native build)
  }
}

export async function requestCycleWritePermission(): Promise<boolean> {
  try {
    const { granted } = await HealthCycle.requestWritePermission();
    return granted;
  } catch (e) {
    console.warn('HealthCycle permission failed:', e);
    return false;
  }
}

let pendingWrites = Promise.resolve();

/** Export only saved daily observations. Never manufacture an expected 4–5 days. */
export async function syncPeriodDaysToHealth(days: { date: string; flow: PeriodFlowAction; cycleStart: boolean }[]): Promise<boolean> {
  if (!isCycleWriteEnabled()) return false;
  if (!(await isCycleWriteAvailable())) return false;
  let success = true;
  const today = localPeriodDate(new Date());
  const work = pendingWrites.then(async () => {
    for (const day of days) {
      const date = localPeriodDate(day.date);
      if (date > today) continue;
      try {
        await HealthCycle.writeMenstruation({ startDate: date, endDate: date,
          flow: day.flow === 'spotting' ? 'clear' : day.flow, cycleStart: day.cycleStart });
      } catch { success = false; console.warn('HealthCycle daily sync unavailable'); }
    }
  });
  pendingWrites = work.catch(() => {});
  await work;
  return success;
}
