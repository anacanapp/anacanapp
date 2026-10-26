import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bytes = await readFile(join(root, 'src/components/games/parking/catalog.json'));
const catalog = JSON.parse(bytes), generation = JSON.parse(await readFile(join(root, 'scripts/new-games/parking-generation.json'), 'utf8'));
const assert = (value, code) => { if (!value) throw new Error(code); };
// Independent parking reference: each arbitrary-length slide costs one move,
// checks every intermediate square, and keeps the exit key in shared state.
function moves(level, positions, open) {
  const occupancy = Array(36).fill(-1), result = [];
  const cells = (car, pos) => Array.from({ length: car.length }, (_, i) => car.axis === 'h' ? car.lane * 6 + pos + i : (pos + i) * 6 + car.lane);
  for (const [index, car] of level.cars.entries()) {
    assert(positions[index] >= 0 && positions[index] <= 6 - car.length, 'PARKING_REFERENCE_BOUNDS');
    for (const cell of cells(car, positions[index])) { assert(occupancy[cell] === -1, 'PARKING_REFERENCE_OVERLAP'); occupancy[cell] = index; }
  }
  for (let car = 0; car < level.cars.length; car++) {
    const definition = level.cars[car];
    for (const sign of [-1, 1]) for (let to = positions[car] + sign; to >= 0 && to <= 6 - definition.length; to += sign) {
      if (cells(definition, to).some(cell => occupancy[cell] !== -1 && occupancy[cell] !== car)) break;
      result.push({ car, to });
    }
  }
  if (open && Array.from({ length: 4 - positions[0] }, (_, i) => 12 + positions[0] + 2 + i).every(cell => occupancy[cell] === -1)) result.push({ car: 0, to: 6 });
  return result;
}
function shortest(level, forcedLocked = false) {
  const open = !level.keyBay || level.positions[level.keyBay.car] === level.keyBay.position;
  const queue = [{ positions: level.positions, open, depth: 0 }], seen = new Set();
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const move of moves(level, current.positions, current.open && !forcedLocked)) {
      if (move.to === 6) return current.depth + 1;
      const next = [...current.positions]; next[move.car] = move.to;
      const open = current.open || !!level.keyBay && move.car === level.keyBay.car && move.to === level.keyBay.position;
      const key = `${next.join(',')}:${open}`; if (seen.has(key)) continue; seen.add(key);
      queue.push({ positions: next, open, depth: current.depth + 1 });
      assert(queue.length <= 120000, 'PARKING_REFERENCE_BUDGET');
    }
  }
  return null;
}
const report = { schema: 'anacan-new-games-level-acceptance-v1', at: new Date().toISOString(), passed: false,
  parking: { levels: 0, lockedExitLevels: 0, buses: 0, shortestSolutions: true, catalogSha256: createHash('sha256').update(bytes).digest('hex'), parRange: [100, 0] },
  flight: { levels: 0, safeControlSolutions: 0, secretRoutes: 0, minimumHearts: 3, durationRange: [100, 0] } };
try {
  assert(catalog.levels.length === 40 && report.parking.catalogSha256 === generation.catalogSha256, 'PARKING_CATALOG_RECEIPT_CHANGED');
  const signatures = new Set();
  for (const level of catalog.levels) {
    assert(level.level === report.parking.levels + 1 && level.chapter === Math.ceil(level.level / 8), 'PARKING_LEVEL_ORDER_INVALID');
    assert(level.cars[0].id === 'Q' && level.cars[0].axis === 'h' && level.cars[0].lane === 2 && level.cars[0].length === 2, 'PARKING_TARGET_CAR_INVALID');
    assert(level.cars.every(car => ['h', 'v'].includes(car.axis) && [2, 3].includes(car.length) && Number.isInteger(car.lane) && car.lane >= 0 && car.lane < 6), 'PARKING_CAR_INVALID');
    const signature = JSON.stringify([level.cars, level.positions, level.keyBay]); assert(!signatures.has(signature), 'PARKING_DUPLICATED_LEVEL'); signatures.add(signature);
    assert(shortest(level) === level.par && level.solution.length === level.par, 'PARKING_SHORTEST_SOLUTION_INVALID');
    let positions = level.positions, open = !level.keyBay || positions[level.keyBay.car] === level.keyBay.position, won = false;
    for (const move of level.solution) {
      assert(moves(level, positions, open).some(legal => legal.car === move.car && legal.to === move.to), 'PARKING_REFERENCE_SOLUTION_INVALID');
      positions = [...positions]; positions[move.car] = move.to;
      if (move.to === 6) { won = true; break; }
      open ||= !!level.keyBay && move.car === level.keyBay.car && move.to === level.keyBay.position;
    }
    assert(won, 'PARKING_REFERENCE_NO_EXIT');
    if (level.keyBay) { assert(!(!level.keyBay || level.positions[level.keyBay.car] === level.keyBay.position), 'PARKING_KEY_ALREADY_OPEN'); report.parking.lockedExitLevels++; }
    report.parking.buses += level.cars.filter(car => car.length === 3).length;
    report.parking.parRange[0] = Math.min(report.parking.parRange[0], level.par); report.parking.parRange[1] = Math.max(report.parking.parRange[1], level.par); report.parking.levels++;
  }
  const bundled = await build({ stdin: { contents: 'export * from "./src/components/games/leaf-flight/engine.ts";', resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
  const engine = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  for (let n = 1; n <= 30; n++) {
    const level = engine.flightLevel(n); assert(JSON.stringify(level) === JSON.stringify(engine.flightLevel(n)), 'FLIGHT_NONDETERMINISTIC_LEVEL');
    let state = engine.createFlightState(n);
    while (!state.won && !state.lost && state.time < 110) {
      const gate = level.gates.find(gate => gate.x + gate.width + 50 > state.distance + 100), target = gate ? engine.flightGateGaps(gate, state.time)[0].center : 360;
      state = engine.stepFlight(level, state, state.y + state.velocity * .35 > target);
      // Independently assert the recorded trajectory stays inside the moving gap.
      const x = state.distance + 100;
      for (const obstacle of level.gates) if (x + 12 >= obstacle.x && x - 12 <= obstacle.x + obstacle.width) {
        const center = obstacle.gap.center + Math.sin(state.time * .85 + obstacle.phase) * obstacle.motion;
        assert(state.y - 12 >= center - obstacle.gap.height / 2 && state.y + 12 <= center + obstacle.gap.height / 2, 'FLIGHT_REFERENCE_COLLISION');
      }
    }
    assert(state.won && !state.lost && engine.validFlightState(state, level), 'FLIGHT_UNREACHABLE_FINISH');
    report.flight.minimumHearts = Math.min(report.flight.minimumHearts, state.hearts);
    report.flight.durationRange[0] = Math.min(report.flight.durationRange[0], Math.floor(state.time)); report.flight.durationRange[1] = Math.max(report.flight.durationRange[1], Math.ceil(state.time));
    for (const gate of level.gates) if (gate.secret) {
      assert(gate.secret.center - gate.secret.height / 2 >= 38 && gate.secret.center + gate.secret.height / 2 <= 688, 'FLIGHT_SECRET_OUTSIDE_BOUNDS');
      const initial = { ...engine.createFlightState(n), distance: gate.x - 100, time: (gate.x - 100) / level.speed, y: gate.secret.center, shield: 0 };
      assert(engine.stepFlight(level, initial, false).hearts === 3, 'FLIGHT_SECRET_NOT_PASSABLE'); report.flight.secretRoutes++;
    }
    report.flight.levels++; report.flight.safeControlSolutions++;
  }
  report.passed = true;
} catch (error) { report.error = error.message; process.exitCode = 1; }
await writeFile(join(root, 'scripts/new-games/level-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
