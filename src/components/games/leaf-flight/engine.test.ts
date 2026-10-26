import { describe, expect, it } from 'vitest';
import { advanceFlight, createFlightState, flightGateGaps, flightLevel, stepFlight, validFlightState } from './engine';
import { FLIGHT_STEP } from './model';

describe('leaf parachute flight', () => {
  it('rises while held, descends when released and processes the same fixed steps at different frame rates', () => {
    const level = flightLevel(1), initial = createFlightState(1);
    let up = initial, down = initial;
    for (let i = 0; i < 45; i++) { up = stepFlight(level, up, true); down = stepFlight(level, down, false); }
    expect(up.y).toBeLessThan(initial.y); expect(down.y).toBeGreaterThan(initial.y);
    expect(advanceFlight(level, initial, true, FLIGHT_STEP * 3).state).toEqual(stepFlight(level, stepFlight(level, stepFlight(level, initial, true), true), true));
    expect(advanceFlight(level, initial, true, 600).state.distance).toBeLessThan(level.speed * .13);
  });
  it('handles collision shields and collects each star only once', () => {
    const level = flightLevel(1), gate = level.gates[0];
    const state = { ...createFlightState(1), shield: 0, time: (gate.x - 100) / level.speed, distance: gate.x - 100, y: 50 };
    const hit = stepFlight(level, state, false); expect(hit.hearts).toBe(2);
    expect(stepFlight(level, hit, false).hearts).toBe(2);
    const star = level.stars[0], near = { ...createFlightState(1), distance: star.x - 100, time: (star.x - 100) / level.speed, y: star.y };
    const collected = stepFlight(level, near, false); expect(collected.collected).toEqual([star.id]);
    expect(stepFlight(level, collected, false).collected).toEqual([star.id]);
  });
  it('makes every level safely completable with responsive hold/release control', () => {
    for (let n = 1; n <= 30; n++) {
      const level = flightLevel(n); let state = createFlightState(n);
      while (!state.won && !state.lost && state.time < 110) {
        const next = level.gates.find(gate => gate.x + gate.width + 50 > state.distance + 100);
        const target = next ? flightGateGaps(next, state.time)[0].center : 360;
        state = stepFlight(level, state, state.y + state.velocity * .35 > target);
      }
      expect(state.won, `level ${n}`).toBe(true); expect(state.hearts, `level ${n}`).toBeGreaterThan(0); expect(validFlightState(state, level)).toBe(true);
    }
  });
  it('adds wind, narrower gaps, moving branches and real alternative secret gaps by chapter', () => {
    expect(flightLevel(1).winds).toHaveLength(0); expect(flightLevel(7).winds.length).toBeGreaterThan(0);
    expect(flightLevel(13).gates[0].gap.height).toBeLessThan(flightLevel(1).gates[0].gap.height);
    expect(flightLevel(19).gates.some(gate => gate.motion > 0)).toBe(true);
    expect(flightLevel(25).gates.some(gate => flightGateGaps(gate, 0).length === 2)).toBe(true);
    expect(validFlightState({ ...createFlightState(1), collected: [9000] }, flightLevel(1))).toBe(false);
  });
});
