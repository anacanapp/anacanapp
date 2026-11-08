import { useCallback, useSyncExternalStore } from 'react';
import { readTempUnit, saveTempUnit, type TempUnit } from '@/lib/illness';

// The °C / °F choice of this device, shared by the illness screen, its sheets and the home card.
let current: TempUnit | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = (): TempUnit => (current ??= readTempUnit());

export function useTempUnit(): [TempUnit, (unit: TempUnit) => void] {
  const unit = useSyncExternalStore(subscribe, snapshot, () => 'C' as TempUnit);
  const setUnit = useCallback((next: TempUnit) => {
    current = next;
    saveTempUnit(next);
    listeners.forEach((listener) => listener());
  }, []);
  return [unit, setUnit];
}
