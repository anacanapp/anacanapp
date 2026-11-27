import { mulberry32 } from './setup';
import { friendDirection, friendsPlateMask, initialFriendsState, moveFriends, readFriendWorld, replayFriends, solveFriends, friendsStateKey } from '@/components/games/iki-dost/engine';
import { friendsLevel } from '@/components/games/iki-dost/levels';
import { completeFriendsLevel, createFriendsProfile, createFriendsRound, friendsResult, FRIENDS_STORAGE_KEY, readFriendsProfile, writeFriendsProfile } from '@/components/games/iki-dost/state';
import { FRIEND_DIRECTIONS, type FriendsProfile } from '@/components/games/iki-dost/model';

export function all() {
  const levels = Array.from({ length: 40 }, (_, index) => {
    const level = friendsLevel(index + 1);
    const half = replayFriends(level, level.solution.slice(0, Math.floor(level.solution.length / 2))).state;
    let state = initialFriendsState(level);
    const trace = level.solution.map(direction => { const move = moveFriends(level, state, direction); state = move.state; return move; });
    const random = mulberry32(index + 1);
    let walkState = initialFriendsState(level);
    const walk = Array.from({ length: 30 }, () => {
      const direction = FRIEND_DIRECTIONS[Math.floor(random() * 4)];
      const move = moveFriends(level, walkState, direction);
      if (!move.lost) walkState = move.state;
      return { direction, move, key: friendsStateKey(move.state), plates: friendsPlateMask(level, move.state) };
    });
    return { n: index + 1, solve: solveFriends(level), half, solveHalf: solveFriends(level, half), solveWalk: solveFriends(level, walkState), tight: solveFriends(level, undefined, 25), trace, walk };
  });
  const directions = (['same', 'mirror-x', 'mirror-y', 'opposite'] as const).map(control => ({ control, value: FRIEND_DIRECTIONS.map(direction => friendDirection(direction, control)) }));
  const worlds = [['#####', '#S.H#', '#####'], ['###', 'S.H', '###'], ['##', 'SH'], ['#####', '#S.S#', '#.H.#'], ['#####', '#S.H#', '#.x.#'], ['########', '#S....H#', '########']]
    .map(rows => { try { return { rows, value: readFriendWorld(rows) }; } catch (error) { return { rows, error: (error as Error).message }; } });
  const results = [[1, 4, 0], [1, 5, 0], [10, 20, 1], [10, 30, 1], [40, 18, 0], [40, 60, 3], [25, 200, 2]].map(([n, moves, hints]) =>
    ({ n, moves, hints, value: friendsResult(friendsLevel(n), { ...createFriendsRound(n), moves, hints }) }));
  // Profile flow
  const level1 = friendsLevel(1), level2 = friendsLevel(2);
  const fresh = { ...createFriendsProfile(), round: { ...createFriendsRound(1), path: level1.solution, moves: level1.par } };
  const won = completeFriendsLevel(fresh, level1);
  const replay = completeFriendsLevel({ ...won, round: { ...createFriendsRound(1), path: level1.solution, moves: level1.par + 9, hints: 2 } }, level1);
  const second = completeFriendsLevel({ ...replay, round: { ...createFriendsRound(2), path: level2.solution, moves: 12, hints: 1, undos: 3 } }, level2);
  const raw = (value: unknown) => JSON.stringify(value);
  const base = createFriendsProfile();
  const storageCases: { name: string; raw: string | null }[] = [
    { name: 'empty', raw: null },
    { name: 'won', raw: raw(second) },
    { name: 'partial', raw: raw({ ...second, round: { ...createFriendsRound(2), path: level2.solution.slice(0, 2), moves: 5, undos: 3 } }) },
    { name: 'bad-path', raw: raw({ ...second, round: { ...createFriendsRound(1), path: ['up'], moves: 1 } }) },
    { name: 'future-level', raw: raw({ ...base, round: createFriendsRound(40) }) },
    { name: 'awarded-unsolved', raw: raw({ ...base, round: { ...createFriendsRound(1), awarded: true } }) },
    { name: 'too-many-hints', raw: raw({ ...second, round: { ...createFriendsRound(1), hints: 4 } }) },
    { name: 'bad-unlocked', raw: raw({ ...base, progress: { ...base.progress, unlocked: 41 } }) },
    { name: 'bad-level-key', raw: raw({ ...base, progress: { ...base.progress, levels: { 41: { stars: 1, score: 5 } } } }) },
    { name: 'rescues-cap', raw: raw({ ...base, progress: { ...base.progress, totalRescues: 81 } }) },
    { name: 'garbage', raw: '{nope' },
    { name: 'too-long', raw: raw({ ...base, pad: 'x'.repeat(24001) }) },
    { name: 'extra-fields', raw: raw({ ...second, extra: [1, 2], round: null }) },
    { name: 'float-moves', raw: raw({ ...second, round: { ...createFriendsRound(1), path: ['down'], moves: 1.5 } }) },
  ];
  const storage = storageCases.map(item => {
    localStorage.clear();
    if (item.raw !== null) localStorage.setItem(FRIENDS_STORAGE_KEY, item.raw);
    const profile = readFriendsProfile();
    writeFriendsProfile(profile);
    return { ...item, profile, rewritten: localStorage.getItem(FRIENDS_STORAGE_KEY) };
  });
  return { levels, directions, worlds, results, flow: { fresh, won, replay, second, same: completeFriendsLevel(won, level1) === won }, storage,
    replays: [['down', 'right'], ['up', 'up', 'up'], []].map(path => { try { return { path, value: replayFriends(level1, path as never) }; } catch (error) { return { path, error: (error as Error).message }; } }) };
}

export type { FriendsProfile };
