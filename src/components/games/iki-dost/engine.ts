import { FRIEND_DIRECTIONS, friendCell, friendPosition, type FriendDirection, type FriendControl, type FriendsLevel, type FriendsMove, type FriendsState, type FriendWorld } from './model';

const deltas: Record<FriendDirection, [number, number]> = { up: [-1, 0], right: [0, 1], down: [1, 0], left: [0, -1] };
export function friendDirection(direction: FriendDirection, control: FriendControl): FriendDirection {
  if (control === 'opposite') return FRIEND_DIRECTIONS[(FRIEND_DIRECTIONS.indexOf(direction) + 2) % 4];
  if (control === 'mirror-x' && ['left', 'right'].includes(direction)) return direction === 'left' ? 'right' : 'left';
  if (control === 'mirror-y' && ['up', 'down'].includes(direction)) return direction === 'up' ? 'down' : 'up';
  return direction;
}
export const initialFriendsState = (level: FriendsLevel): FriendsState => ({ positions: [level.worlds[0].start, level.worlds[1].start], keys: 0 });
export const friendsAtHome = (level: FriendsLevel, state: FriendsState): [boolean, boolean] => [state.positions[0] === level.worlds[0].home, state.positions[1] === level.worlds[1].home];
export const friendsSolved = (level: FriendsLevel, state: FriendsState) => friendsAtHome(level, state).every(Boolean);
export function friendsPlateMask(level: FriendsLevel, state: FriendsState): number {
  let mask = 0;
  for (let channel = 0; channel < 2; channel++) {
    const tile = channel === 0 ? 'a' : 'b';
    const held = state.positions.filter((position, side) => friendCell(level.worlds[side], position) === tile).length;
    if (level.plateCounts[channel] > 0 && held >= level.plateCounts[channel]) mask |= 1 << channel;
  }
  return mask;
}
export function friendsDoorOpen(tile: string | undefined, state: FriendsState, plates: number): boolean {
  if (tile === 'K' || tile === 'L') return !!(state.keys & (tile === 'K' ? 1 : 2));
  if (tile === 'A' || tile === 'B') return !!(plates & (tile === 'A' ? 1 : 2));
  return true;
}
export function moveFriends(level: FriendsLevel, state: FriendsState, direction: FriendDirection): FriendsMove {
  if (!FRIEND_DIRECTIONS.includes(direction)) throw new Error('TWO_FRIENDS_DIRECTION_INVALID');
  const plates = friendsPlateMask(level, state);
  const positions = state.positions.map((position, side) => {
    const world = level.worlds[side], { row, column } = friendPosition(world, position);
    const [dr, dc] = deltas[side === 0 ? direction : friendDirection(direction, level.control)];
    const r = row + dr, c = column + dc;
    if (r < 0 || r >= world.rows.length || c < 0 || c >= world.rows[0].length) return position;
    const target = r * world.rows[0].length + c, tile = friendCell(world, target);
    return tile === '#' || !friendsDoorOpen(tile, state, plates) ? position : target;
  }) as [number, number];
  const moved = positions.map((position, side) => position !== state.positions[side]) as [boolean, boolean];
  const lost = positions.some((position, side) => friendCell(level.worlds[side], position) === '!');
  const keys = lost ? state.keys : positions.reduce((mask, position, side) => {
    const tile = friendCell(level.worlds[side], position);
    return mask | (tile === 'k' ? 1 : tile === 'l' ? 2 : 0);
  }, state.keys);
  const next = { positions, keys };
  const newPlates = friendsPlateMask(level, next);
  return { state: next, moved, changed: moved.some(Boolean), lost, won: !lost && friendsSolved(level, next),
    collectedKeys: keys & ~state.keys, openedDoors: (newPlates & ~plates) | (keys & ~state.keys) };
}
export function readFriendWorld(rows: string[]): FriendWorld {
  if (rows.length < 3 || rows.length > 7 || rows[0].length < 3 || rows[0].length > 7
    || rows.some(row => row.length !== rows[0].length || !/^[#.SH!klKLabAB]+$/.test(row))) throw new Error('TWO_FRIENDS_WORLD_INVALID');
  const tiles = rows.join(''), start = tiles.indexOf('S'), home = tiles.indexOf('H');
  if (start < 0 || home < 0 || start === home || start !== tiles.lastIndexOf('S') || home !== tiles.lastIndexOf('H')) throw new Error('TWO_FRIENDS_WORLD_ENDPOINTS_REQUIRED');
  return { rows, start, home };
}
export const friendsStateKey = (state: FriendsState) => `${state.positions[0]}:${state.positions[1]}:${state.keys}`;
export function replayFriends(level: FriendsLevel, path: readonly FriendDirection[]): { state: FriendsState; lost: boolean } {
  let state = initialFriendsState(level), lost = false;
  for (const direction of path) {
    const move = moveFriends(level, state, direction);
    if (!move.changed || lost) throw new Error('TWO_FRIENDS_SAVED_PATH_INVALID');
    state = move.state; lost = move.lost;
  }
  return { state, lost };
}
export function solveFriends(level: FriendsLevel, start = initialFriendsState(level), budget = 12000): { path: FriendDirection[] | null; visited: number; exhausted: boolean } {
  if (friendsSolved(level, start)) return { path: [], visited: 1, exhausted: false };
  const queue = [start], records = new Map<string, { previous: string | null; direction: FriendDirection | null }>([[friendsStateKey(start), { previous: null, direction: null }]]);
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head], key = friendsStateKey(state);
    for (const direction of FRIEND_DIRECTIONS) {
      const move = moveFriends(level, state, direction), nextKey = friendsStateKey(move.state);
      if (!move.changed || move.lost || records.has(nextKey)) continue;
      records.set(nextKey, { previous: key, direction });
      if (move.won) {
        const path: FriendDirection[] = []; let current = nextKey;
        while (records.get(current)?.previous !== null) {
          const record = records.get(current)!; path.push(record.direction!); current = record.previous!;
        }
        return { path: path.reverse(), visited: records.size, exhausted: false };
      }
      if (records.size >= budget) return { path: null, visited: records.size, exhausted: true };
      queue.push(move.state);
    }
  }
  return { path: null, visited: records.size, exhausted: false };
}
