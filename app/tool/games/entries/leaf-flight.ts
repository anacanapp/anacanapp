import { mulberry32 } from './setup';
import { advanceFlight, createFlightState, flightGateGaps, flightLevel, flightResult, flightWind, stepFlight, validFlightState } from '@/components/games/leaf-flight/engine';
import type { FlightState } from '@/components/games/leaf-flight/model';

export function all() {
  const levels = Array.from({ length: 30 }, (_, index) => flightLevel(index + 1));
  const random = mulberry32(99);
  const sinArgs = [0, 1e-9, 0.5, Math.PI / 4, 1, 2.5, 3.14159, 4.71238898038469, 6.283185307179586, 10, 33.3, 77.7, 102.5, 123.456,
    ...Array.from({ length: 3000 }, () => random() * 110)];
  const sin = sinArgs.map(value => [value, Math.sin(value), Math.cos(value)]);
  const autopilot = levels.map(level => {
    let state = createFlightState(level.level), steps = 0;
    const samples: FlightState[] = [];
    while (!state.won && !state.lost && state.time < 110) {
      const next = level.gates.find(gate => gate.x + gate.width + 50 > state.distance + 100);
      const target = next ? flightGateGaps(next, state.time)[0].center : 360;
      state = stepFlight(level, state, state.y + state.velocity * .35 > target);
      if (++steps % 97 === 0) samples.push(state);
    }
    return { level: level.level, steps, final: state, samples, result: flightResult(level, state), valid: validFlightState(state, level) };
  });
  const erratic = [1, 7, 13, 19, 25, 30].map(n => {
    const level = flightLevel(n), rng = mulberry32(n * 31);
    let state = createFlightState(n), carry = 0, frames = 0, lifting = false;
    const samples: unknown[] = [];
    while (!state.won && !state.lost && frames < 3000) {
      if (rng() < 0.08) lifting = !lifting;
      const elapsed = [1 / 60, 1 / 30, 1 / 120, 0.2, 0, 0.0161][Math.floor(rng() * 6)];
      const result = advanceFlight(level, state, lifting, elapsed, carry);
      state = result.state; carry = result.carry; frames++;
      if (frames % 50 === 0) samples.push({ frames, carry, state });
    }
    return { level: n, frames, carry, final: state, samples, result: flightResult(level, state), valid: validFlightState(state, level) };
  });
  const winds = levels.slice(6, 12).map(level => ({ level: level.level, values: [0, 500, 800, 1000, 1500, 2000, 2400, 3000].map(x => flightWind(level, x)) }));
  const base = createFlightState(4);
  const validity = [base, { ...base, level: 5 }, { ...base, collected: [9000] }, { ...base, time: 1, distance: 125 }, { ...base, y: 37 }, { ...base, hearts: 0, lost: true },
    { ...base, hearts: 0 }, { ...base, shield: 1.31 }, { ...base, won: true }, { ...base, collected: [0, 0] }, { ...base, velocity: 221 }, { ...base, time: NaN }]
    .map(state => ({ state, valid: validFlightState(state, flightLevel(4)) }));
  const stepped = advanceFlight(flightLevel(1), createFlightState(1), true, 1 / 60 * 3);
  return { levels, sin, autopilot, erratic, winds, validity, stepped };
}
