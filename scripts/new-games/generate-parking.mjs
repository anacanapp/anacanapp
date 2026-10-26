import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = join(root, 'src/components/games/parking/catalog.json');
try { await readFile(output); throw new Error('PARKING_PUBLISHED_CATALOG_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const bundled = await build({ stdin: { contents: 'export * from "./src/components/games/parking/engine.ts";', resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const engine = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
function random(seed) { let state = seed; return () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
const revision = 'parking-202610-v1', draftPath = join(root, 'scripts/new-games/parking-draft.json');
let levels = [];
try { const draft = JSON.parse(await readFile(draftPath, 'utf8')); if (draft.revision !== revision) throw new Error('PARKING_DRAFT_REVISION_CHANGED'); levels = draft.levels; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const unique = new Set(levels.map(level => JSON.stringify([level.cars.map(car => [car.axis, car.lane, car.length]), level.positions, level.keyBay])));
for (let number = levels.length + 1; number <= 40; number++) {
  const rng = random(number * 9811 + 21345), chapter = Math.ceil(number / 8);
  const minimum = [2, 4, 6, 8, 10][chapter - 1], maximum = [5, 8, 12, 16, 25][chapter - 1];
  let selected;
  for (let attempt = 0; attempt < 1800 && !selected; attempt++) {
    const cars = [{ id: 'Q', axis: 'h', lane: 2, length: 2, color: 0 }], positions = [4], occupied = new Set([16, 17]);
    const goalCount = 6 + Math.min(chapter, 4);
    for (let trial = 0; trial < 200 && cars.length < goalCount; trial++) {
      const axis = rng() < .6 ? 'v' : 'h', lane = Math.floor(rng() * 6), length = rng() < .35 ? 3 : 2;
      if (axis === 'h' && lane === 2) continue;
      const position = Math.floor(rng() * (7 - length));
      const car = { id: String.fromCharCode(64 + cars.length), axis, lane, length, color: cars.length };
      const cells = engine.parkingCells(car, position);
      if (cells.some(cell => occupied.has(cell))) continue;
      cells.forEach(cell => occupied.add(cell)); cars.push(car); positions.push(position);
    }
    if (cars.length < goalCount - 1) continue;
    const keyCar = chapter >= 4 ? 1 + Math.floor(rng() * (cars.length - 1)) : null;
    const keyBay = keyCar === null ? null : { car: keyCar, position: positions[keyCar] };
    const level = { schema: 'anacan-parking-level-v1', revision, level: number, chapter, cars, positions, keyBay, par: 0, solution: [] };
    let state = { positions: [...positions], open: true }, lastCar = -1;
    for (let step = 0; step < 60 + chapter * 28; step++) {
      const moves = engine.parkingMoves(level, state).filter(move => move.to !== 6 && move.car !== lastCar);
      if (!moves.length) break;
      const move = moves[Math.floor(rng() * moves.length)]; state = engine.moveParking(level, state, move); lastCar = move.car;
    }
    if (keyBay && state.positions[keyBay.car] === keyBay.position) continue;
    level.positions = state.positions;
    const start = engine.initialParkingState(level);
    if (engine.moveParking(level, start, { car: 0, to: 6 })) continue;
    const signature = JSON.stringify([cars.map(car => [car.axis, car.lane, car.length]), level.positions, keyBay]);
    if (unique.has(signature)) continue;
    const solution = engine.solveParking(level, start, chapter === 5 ? 65000 : 28000);
    if (!solution.path || solution.path.length < minimum || solution.path.length > maximum) continue;
    selected = { ...level, par: solution.path.length, solution: solution.path }; unique.add(signature);
  }
  if (!selected) throw new Error(`PARKING_LEVEL_${number}_REQUIRED`);
  levels.push(selected); await writeFile(draftPath, JSON.stringify({ revision, levels }) + '\n');
  console.log(JSON.stringify({ level: number, par: selected.par, cars: selected.cars.length, key: !!selected.keyBay }));
}
const catalog = { schema: 'anacan-parking-catalog-v1', revision, levels };
const bytes = JSON.stringify(catalog) + '\n'; await writeFile(output, bytes);
const report = { at: new Date().toISOString(), passed: true, levels: levels.length, revision,
  catalogSha256: createHash('sha256').update(bytes).digest('hex'), minimumMoves: Math.min(...levels.map(level => level.par)), maximumMoves: Math.max(...levels.map(level => level.par)) };
await writeFile(join(root, 'scripts/new-games/parking-generation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
