import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Independent grid reference checks the catalog rather than asking the runtime
// engine to validate its own movement. It proves gate dependencies and optimality.
const root = fileURLToPath(new URL('../../', import.meta.url));
const bytes = await readFile(join(root, 'src/components/games/iki-dost/catalog.json'));
const catalog = JSON.parse(bytes), receipt = JSON.parse(await readFile(join(root, 'scripts/iki-dost/level-build.json'), 'utf8'));
const directions = ['up', 'right', 'down', 'left'], delta = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const assert = (value, code) => { if (!value) throw new Error(code); };
const tileAt = (world, position) => world.rows[Math.floor(position / world.rows[0].length)]?.[position % world.rows[0].length];
function step(level, state, command, forceClosed = '') {
  const [left, right, keys] = state;
  const held = ['a', 'b'].map(tile => level.worlds.filter((world, side) => tileAt(world, side ? right : left) === tile).length);
  let moved = false;
  const positions = level.worlds.map((world, side) => {
    const p = side ? right : left, row = Math.floor(p / world.rows[0].length), column = p % world.rows[0].length;
    let [dr, dc] = delta[command];
    if (side && ['opposite', 'mirror-y'].includes(level.control)) dr = -dr;
    if (side && ['opposite', 'mirror-x'].includes(level.control)) dc = -dc;
    const r = row + dr, c = column + dc;
    if (r < 0 || c < 0 || r >= world.rows.length || c >= world.rows[0].length) return p;
    const next = r * world.rows[0].length + c, tile = tileAt(world, next);
    if (tile === '#' || forceClosed.includes(tile)
      || tile === 'K' && !(keys & 1) || tile === 'L' && !(keys & 2)
      || tile === 'A' && held[0] < level.plateCounts[0] || tile === 'B' && held[1] < level.plateCounts[1]) return p;
    moved = true; return next;
  });
  if (!moved || positions.some((p, side) => tileAt(level.worlds[side], p) === '!')) return null;
  return [...positions, positions.reduce((mask, p, side) => mask | (tileAt(level.worlds[side], p) === 'k' ? 1 : tileAt(level.worlds[side], p) === 'l' ? 2 : 0), keys)];
}
const solved = (level, state) => state[0] === level.worlds[0].home && state[1] === level.worlds[1].home;
function optimal(level, forceClosed = '') {
  const queue = [[...level.worlds.map(world => world.start), 0, 0]], seen = new Set([queue[0].slice(0, 3).join(':')]);
  for (let index = 0; index < queue.length; index++) {
    const [left, right, keys, depth] = queue[index];
    for (let command = 0; command < 4; command++) {
      const next = step(level, [left, right, keys], command, forceClosed); if (!next) continue;
      if (solved(level, next)) return depth + 1;
      const key = next.join(':'); if (seen.has(key)) continue; seen.add(key); queue.push([...next, depth + 1]);
    }
  }
  return null;
}
const report = { schema: 'anacan-two-friends-level-acceptance-v1', at: new Date().toISOString(), passed: false, levels: 0, keysRequired: 0,
  pressureDoorsRequired: 0, doubleSwitchLevels: 0, coordinatedLevels: 0, catalogSha256: createHash('sha256').update(bytes).digest('hex'), failures: [] };
try {
  assert(catalog.schema === 'anacan-two-friends-catalog-v1' && catalog.levels.length === 40 && report.catalogSha256 === receipt.catalogSha256, 'TWO_FRIENDS_CATALOG_RECEIPT_INVALID');
  const unique = new Set();
  for (const level of catalog.levels) {
    assert(level.level === report.levels + 1 && level.chapter === Math.ceil(level.level / 8), 'TWO_FRIENDS_LEVEL_ORDER_INVALID');
    const signature = JSON.stringify([level.worlds.map(world => world.rows), level.control]);
    assert(!unique.has(signature), 'TWO_FRIENDS_LEVEL_DUPLICATED'); unique.add(signature);
    for (const world of level.worlds) {
      const tiles = world.rows.join('');
      assert(world.rows.every(row => row.length === world.rows[0].length) && /^[#.SH!klKLabAB]+$/.test(tiles), 'TWO_FRIENDS_WORLD_INVALID');
      assert(tiles.indexOf('S') === world.start && tiles.lastIndexOf('S') === world.start
        && tiles.indexOf('H') === world.home && tiles.lastIndexOf('H') === world.home, 'TWO_FRIENDS_ENDPOINTS_INVALID');
    }
    assert(optimal(level) === level.par && level.solution.length === level.par, 'TWO_FRIENDS_SHORTEST_SOLUTION_INVALID');
    let state = [...level.worlds.map(world => world.start), 0], asynchronous = false;
    for (const value of level.solution) {
      assert(directions.includes(value), 'TWO_FRIENDS_SOLUTION_DIRECTION_INVALID');
      const next = step(level, state, directions.indexOf(value)); assert(next, 'TWO_FRIENDS_SOLUTION_COLLISION');
      if ((state[0] !== next[0]) !== (state[1] !== next[1])) asynchronous = true;
      state = next;
    }
    assert(solved(level, state), 'TWO_FRIENDS_SOLUTION_GOAL_INVALID');
    if (asynchronous) report.coordinatedLevels++;
    if (level.chapter === 3 || level.chapter === 5) { assert(optimal(level, 'KL') === null, 'TWO_FRIENDS_KEY_NOT_NEEDED'); report.keysRequired++; }
    if (level.chapter >= 4) { assert(optimal(level, 'AB') === null, 'TWO_FRIENDS_SWITCH_NOT_NEEDED'); report.pressureDoorsRequired++; }
    if (level.plateCounts[0] === 2) report.doubleSwitchLevels++;
    report.levels++;
  }
  assert(report.coordinatedLevels >= 30 && report.doubleSwitchLevels >= 6, 'TWO_FRIENDS_COORDINATION_REQUIRED');
  report.passed = true;
} catch (error) { report.error = error.message; process.exitCode = 1; }
await writeFile(join(root, 'scripts/iki-dost/level-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
