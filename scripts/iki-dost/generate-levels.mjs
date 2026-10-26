import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundled = await build({ stdin: { contents: 'export * from "./src/components/games/iki-dost/engine.ts";', resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
const engine = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const revision = 'friends-202610-v1';
const destination = join(root, 'src/components/games/iki-dost/catalog.json');
try { await readFile(destination); throw new Error('TWO_FRIENDS_PUBLISHED_CATALOG_ALREADY_EXISTS'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
function random(seed) {
  let state = seed;
  return () => { state += 0x6D2B79F5; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const assert = (value, code) => { if (!value) throw new Error(code); };
function makeWorld(size, side, control, chapter, bothPlates, rng) {
  const grid = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => !r || !c || r === size - 1 || c === size - 1 ? '#' : rng() < .14 ? '#' : '.'));
  const start = [1, 1], home = [size - 2, size - 2];
  const doors = [];
  if ((chapter === 3 || chapter === 4) && (side === 1 || bothPlates)) doors.push(chapter === 3 ? 'K' : 'A');
  if (chapter === 5) doors.push(side === 0 ? 'K' : 'A');
  if (doors.length) {
    const row = size === 5 ? 2 : 3, column = 1 + Math.floor(rng() * (size - 2));
    for (let c = 1; c < size - 1; c++) grid[row][c] = '#';
    grid[row][column] = doors[0];
    // Guarantee space on both sides of the required gate.
    grid[row - 1][column] = '.'; grid[row + 1][column] = '.';
  }
  grid[start[0]][start[1]] = 'S'; grid[home[0]][home[1]] = 'H';
  const place = (tile, region) => {
    const available = [];
    for (let r = 1; r < size - 1; r++) for (let c = 1; c < size - 1; c++) if (grid[r][c] === '.' && region(r, c)) available.push([r, c]);
    if (!available.length) return false;
    const [r, c] = available[Math.floor(rng() * available.length)]; grid[r][c] = tile; return true;
  };
  if (chapter === 3 && side === 0) place('k', () => true);
  if (chapter === 4 && (side === 0 || bothPlates)) place('a', bothPlates ? r => r < 3 : () => true);
  if (chapter === 5) {
    if (side === 1) place('k', r => r < 3);
    if (side === 0) place('a', r => r > 3);
    if (bothPlates && side === 1) place('a', r => r < 3);
  }
  if (chapter > 1 && rng() > .35) place('!', () => true);
  let rows = grid.map(row => row.join(''));
  if (side === 1 && ['mirror-x', 'opposite'].includes(control)) rows = rows.map(row => [...row].reverse().join(''));
  if (side === 1 && ['mirror-y', 'opposite'].includes(control)) rows.reverse();
  return engine.readFriendWorld(rows);
}
const levels = [], seen = new Set();
for (let number = 1; number <= 40; number++) {
  const chapter = Math.ceil(number / 8), rng = random(913205 + number * 3797);
  const control = chapter === 1 ? 'same' : number % 4 === 0 ? 'opposite' : number % 3 === 0 ? 'mirror-y' : chapter === 4 && number < 29 ? 'same' : 'mirror-x';
  const bothPlates = chapter === 4 && number >= 29 || chapter === 5 && number >= 39;
  let selected;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const size = number <= 4 ? 5 : 6;
    const worlds = [makeWorld(size, 0, control, chapter, bothPlates, rng), makeWorld(size, 1, control, chapter, bothPlates, rng)];
    const level = { schema: 'anacan-two-friends-level-v1', revision, level: number, chapter, worlds, control, plateCounts: [chapter >= 4 ? bothPlates ? 2 : 1 : 0, 0], par: 0, solution: [] };
    if (JSON.stringify(worlds[0].rows) === JSON.stringify(worlds[1].rows)) continue;
    const signature = JSON.stringify({ worlds: worlds.map(world => world.rows), control });
    if (seen.has(signature)) continue;
    const solution = engine.solveFriends(level);
    if (!solution.path || solution.path.length < (number <= 4 ? 4 : chapter === 1 ? 6 : chapter === 5 ? 14 : 8) || solution.path.length > 40) continue;
    let state = engine.initialFriendsState(level), coordinatedMoves = 0;
    for (const direction of solution.path) { const move = engine.moveFriends(level, state, direction); if (move.moved[0] !== move.moved[1]) coordinatedMoves++; state = move.state; }
    if (number > 4 && !coordinatedMoves) continue;
    const tiles = worlds.map(world => world.rows.join('')).join('');
    if (chapter === 3 && (!tiles.includes('k') || !tiles.includes('K')) || chapter >= 4 && (!tiles.includes('a') || !tiles.includes('A'))) continue;
    selected = { ...level, par: solution.path.length, solution: solution.path }; seen.add(signature); break;
  }
  assert(selected, `TWO_FRIENDS_LEVEL_${number}_SOLUTION_REQUIRED`);
  levels.push(selected);
}
const catalog = { schema: 'anacan-two-friends-catalog-v1', revision, levels };
const bytes = JSON.stringify(catalog) + '\n'; await writeFile(destination, bytes);
const report = { schema: 'anacan-two-friends-level-build-v1', at: new Date().toISOString(), passed: true, revision, levels: levels.length,
  catalogSha256: createHash('sha256').update(bytes).digest('hex'), minimumMoves: Math.min(...levels.map(level => level.par)),
  maximumMoves: Math.max(...levels.map(level => level.par)), chapters: levels.map(level => ({ level: level.level, par: level.par, control: level.control, plates: level.plateCounts[0] })) };
await writeFile(join(root, 'scripts/iki-dost/level-build.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
