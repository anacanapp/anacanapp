/** NHS "High temperature (fever) in children" (checked 2026-11-15): which advice applies. Texts live in content-<lang>.ts. */
export type FeverAge = 0 | 1 | 2 | 3;
export interface FeverInput { age: FeverAge; temp: number; days: number; redFlag: boolean; dehydrated: boolean }
export type FeverLevel = 'emergency' | 'doctor' | 'home' | 'normal' | 'low';
export type FeverCase = 'redFlag' | 'under3m' | 'm3to6' | 'fiveDays' | 'dehydrated' | 'home' | 'low' | 'raised' | 'normal';
export const FEVER_CASE_LEVEL: Record<FeverCase, FeverLevel> = { redFlag: 'emergency', under3m: 'doctor', m3to6: 'doctor', fiveDays: 'doctor', dehydrated: 'doctor', home: 'home', low: 'low', raised: 'normal', normal: 'normal' };
export function feverCase(input: FeverInput): FeverCase {
  if (input.redFlag) return 'redFlag';
  if (input.temp >= 38 && input.age === 0) return 'under3m';
  if (input.temp >= 39 && input.age === 1) return 'm3to6';
  if (input.temp >= 38 && input.days >= 5) return 'fiveDays';
  if (input.dehydrated) return 'dehydrated';
  if (input.temp >= 38) return 'home';
  if (input.temp < 36) return 'low';
  if (input.temp >= 37.6) return 'raised';
  return 'normal';
}
