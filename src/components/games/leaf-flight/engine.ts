import { FLIGHT_HEIGHT, FLIGHT_PLAYER_X, FLIGHT_STEP, LEAF_FLIGHT_LEVELS, LEAF_FLIGHT_REVISION, type FlightGap, type FlightGate, type FlightLevel, type FlightState } from './model';

function random(seed: number) {
  let state = seed;
  return () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
export function flightLevel(level: number): FlightLevel {
  if (!Number.isSafeInteger(level) || level < 1 || level > LEAF_FLIGHT_LEVELS) throw new Error('LEAF_FLIGHT_LEVEL_INVALID');
  const rng = random(level * 7351 + 91657), chapter = Math.ceil(level / 6) as FlightLevel['chapter'];
  const speed = 122 + (chapter - 1) * 9 + level % 6;
  const count = 6 + chapter, gates: FlightGate[] = [];
  for (let index = 0; index < count; index++) {
    const center = 260 + rng() * 180;
    const height = 320 - (chapter - 1) * 24;
    const secret = chapter >= 5 && index % 3 === 1
      ? { center: center < 350 ? 616 : 100, height: 116 } : null;
    gates.push({ x: 650 + index * 425, width: 58 + chapter * 4, gap: { center, height },
      motion: chapter >= 4 && index % 2 === 1 ? 18 + chapter * 4 : 0, phase: rng() * Math.PI * 2, secret });
  }
  const stars: FlightLevel['stars'] = [];
  for (const [index, gate] of gates.entries()) {
    stars.push({ id: stars.length, x: gate.x - 145, y: gate.gap.center, secret: false });
    stars.push({ id: stars.length, x: gate.x + gate.width / 2, y: gate.gap.center, secret: false });
    if (gate.secret) stars.push({ id: stars.length, x: gate.x + gate.width / 2, y: gate.secret.center, secret: true });
    if (index === gates.length - 1) stars.push({ id: stars.length, x: gate.x + 210, y: 360, secret: false });
  }
  return { schema: 'anacan-leaf-flight-level-v1', revision: LEAF_FLIGHT_REVISION, level, chapter,
    speed, distance: gates.at(-1)!.x + 480, gates, stars,
    winds: chapter >= 2 ? gates.filter((_, index) => index % 3 === 1).map((gate, index) => ({
      from: gate.x - 280, to: gate.x + 110, force: (index % 2 ? 1 : -1) * (35 + chapter * 9),
    })) : [] };
}
export const createFlightState = (level: number): FlightState => ({ schema: 'anacan-leaf-flight-round-v1', level,
  time: 0, distance: 0, y: 360, velocity: 0, hearts: 3, shield: 1, collected: [], won: false, lost: false });
export function flightGateGaps(gate: FlightGate, time: number): FlightGap[] {
  const center = gate.gap.center + Math.sin(time * .85 + gate.phase) * gate.motion;
  return [{ center, height: gate.gap.height }, ...(gate.secret ? [gate.secret] : [])];
}
export const flightWind = (level: FlightLevel, x: number) => level.winds.filter(wind => x >= wind.from && x <= wind.to).reduce((force, wind) => force + wind.force, 0);
export function stepFlight(level: FlightLevel, state: FlightState, lifting: boolean): FlightState {
  if (state.won || state.lost) return state;
  const time = state.time + FLIGHT_STEP, distance = state.distance + level.speed * FLIGHT_STEP;
  const x = distance + FLIGHT_PLAYER_X, wind = flightWind(level, x);
  let velocity = Math.max(-210, Math.min(220, state.velocity + ((lifting ? -390 : 260) + wind - state.velocity * 1.5) * FLIGHT_STEP));
  let y = state.y + velocity * FLIGHT_STEP, hearts = state.hearts, shield = Math.max(0, state.shield - FLIGHT_STEP);
  let collision = y < 38 || y > FLIGHT_HEIGHT - 32;
  for (const gate of level.gates) {
    if (x + 12 < gate.x || x - 12 > gate.x + gate.width) continue;
    if (!flightGateGaps(gate, time).some(gap => y - 12 >= gap.center - gap.height / 2 && y + 12 <= gap.center + gap.height / 2)) collision = true;
  }
  if (collision && shield === 0) { hearts--; shield = 1.25; velocity *= -.35; }
  y = Math.max(39, Math.min(FLIGHT_HEIGHT - 33, y));
  const collected = [...state.collected];
  for (const star of level.stars) if (!collected.includes(star.id) && Math.abs(star.x - x) <= 22 && Math.abs(star.y - y) <= 30) collected.push(star.id);
  return { ...state, time, distance, velocity, y, hearts, shield, collected,
    lost: hearts <= 0, won: hearts > 0 && distance >= level.distance };
}
export function validFlightState(value: unknown, level: FlightLevel): value is FlightState {
  if (!value || typeof value !== 'object') return false;
  const state = value as FlightState;
  return state.schema === 'anacan-leaf-flight-round-v1' && state.level === level.level
    && [state.time, state.distance, state.y, state.velocity, state.shield].every(Number.isFinite)
    && state.time >= 0 && state.time <= 120 && state.distance >= 0 && state.distance <= level.distance + 5
    && Math.abs(state.distance - state.time * level.speed) < 1 && state.y >= 38 && state.y <= FLIGHT_HEIGHT - 32
    && Math.abs(state.velocity) <= 220 && Number.isInteger(state.hearts) && state.hearts >= 0 && state.hearts <= 3
    && state.shield >= 0 && state.shield <= 1.3 && typeof state.won === 'boolean' && typeof state.lost === 'boolean'
    && (!state.won || state.distance >= level.distance && state.hearts > 0) && (state.lost === (state.hearts === 0))
    && Array.isArray(state.collected) && state.collected.length <= level.stars.length && new Set(state.collected).size === state.collected.length
    && state.collected.every(id => Number.isInteger(id) && level.stars.some(star => star.id === id));
}
export function flightResult(level: FlightLevel, state: FlightState) {
  const main = level.stars.filter(star => !star.secret), found = main.filter(star => state.collected.includes(star.id)).length;
  const stars: 1 | 2 | 3 = found >= Math.ceil(main.length * .8) && state.hearts >= 2 ? 3 : found >= Math.ceil(main.length * .45) ? 2 : 1;
  return { stars, score: state.collected.length * 100 + state.hearts * 150 + level.chapter * 100, collected: state.collected.length };
}
/** Bounded frame accumulator: long frames never turn background time into damage. */
export function advanceFlight(level: FlightLevel, state: FlightState, lifting: boolean, elapsed: number, carry = 0) {
  let remaining = carry + Math.max(0, Math.min(.12, elapsed)), steps = 0, next = state;
  while (remaining >= FLIGHT_STEP && steps < 8 && !next.won && !next.lost) { next = stepFlight(level, next, lifting); remaining -= FLIGHT_STEP; steps++; }
  return { state: next, carry: Math.min(FLIGHT_STEP, remaining) };
}
