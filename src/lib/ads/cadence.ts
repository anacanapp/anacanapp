export interface AdCadence { count: number; seen: string[] }
export function advanceAdCadence(previous: AdCadence, key: string, every: number): { state: AdCadence; due: boolean; counted: boolean } {
  if (!key || !Number.isInteger(every) || every < 1) return { state: previous, due: false, counted: false };
  if (previous.seen.includes(key)) return { state: previous, due: false, counted: false };
  const state = { count: Math.min(every, previous.count + 1), seen: [...previous.seen.slice(-99), key] };
  return { state, due: state.count >= every, counted: true };
}
export const consumeAdCadence = (state: AdCadence): AdCadence => ({ ...state, count: 0 });
