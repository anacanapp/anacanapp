import { describe, expect, it } from 'vitest';
import { friendDirection, friendsAtHome, friendsPlateMask, initialFriendsState, moveFriends, readFriendWorld, replayFriends, solveFriends } from './engine';
import { friendsLevel } from './levels';
import { FRIEND_DIRECTIONS, TWO_FRIENDS_REVISION, type FriendsLevel } from './model';

function fixture(left: string[], right: string[], plateCounts: [number, number] = [0, 0]): FriendsLevel {
  return { schema: 'anacan-two-friends-level-v1', revision: TWO_FRIENDS_REVISION, level: 1, chapter: 1,
    worlds: [readFriendWorld(left), readFriendWorld(right)], control: 'same', plateCounts, par: 1, solution: [] };
}
describe('two linked friends', () => {
  it('moves both with one command while an obstacle can stop only one', () => {
    const level = fixture(['#####', '#S.H#', '#...#', '#####'], ['#####', '#S#H#', '#...#', '#####']);
    const move = moveFriends(level, initialFriendsState(level), 'right');
    expect(move.moved).toEqual([true, false]); expect(move.state.positions).toEqual([7, 6]);
    expect(moveFriends(level, initialFriendsState(level), 'up').changed).toBe(false);
  });
  it('maps each mirrored axis and all four opposite directions precisely', () => {
    expect(FRIEND_DIRECTIONS.map(direction => friendDirection(direction, 'opposite'))).toEqual(['down', 'left', 'up', 'right']);
    expect(FRIEND_DIRECTIONS.map(direction => friendDirection(direction, 'mirror-x'))).toEqual(['up', 'left', 'down', 'right']);
    expect(FRIEND_DIRECTIONS.map(direction => friendDirection(direction, 'mirror-y'))).toEqual(['down', 'right', 'up', 'left']);
  });
  it('uses a shared key only after it is collected, including across the other world', () => {
    const level = fixture(['######', '#Sk.H#', '#....#', '######'], ['######', '#SK.H#', '#....#', '######']);
    let move = moveFriends(level, initialFriendsState(level), 'right');
    expect(move.moved).toEqual([true, false]); expect(move.collectedKeys).toBe(1);
    move = moveFriends(level, move.state, 'right'); expect(move.moved).toEqual([true, true]);
    expect(move.state.keys).toBe(1);
  });
  it('opens a pressure gate using the pre-move held switch and closes it after departure', () => {
    const level = fixture(['######', '#Sa.H#', '#....#', '######'], ['######', '#SA.H#', '#....#', '######'], [1, 0]);
    const onSwitch = moveFriends(level, initialFriendsState(level), 'right');
    expect(onSwitch.moved).toEqual([true, false]); expect(friendsPlateMask(level, onSwitch.state)).toBe(1);
    const crossed = moveFriends(level, onSwitch.state, 'right'); expect(crossed.moved).toEqual([true, true]);
    expect(friendsPlateMask(level, crossed.state)).toBe(0);
    // A friend standing in a closing door can leave it; the closed door cannot be entered.
    const leftDoor = moveFriends(level, crossed.state, 'down'); expect(leftDoor.moved[1]).toBe(true);
    expect(moveFriends(level, leftDoor.state, 'up').moved[1]).toBe(false);
  });
  it('requires both held switches for a two-friend coordinated gate', () => {
    const level = fixture(['######', '#SaAH#', '#....#', '######'], ['######', '#SaAH#', '#....#', '######'], [2, 0]);
    const start = initialFriendsState(level);
    expect(friendsPlateMask(level, { ...start, positions: [8, 7] })).toBe(0);
    const together = moveFriends(level, start, 'right'); expect(friendsPlateMask(level, together.state)).toBe(1);
    expect(moveFriends(level, together.state, 'right').moved).toEqual([true, true]);
  });
  it('does not freeze a friend at home and fails safely if either falls in water', () => {
    const level = fixture(['#####', '#SH.#', '#...#', '#####'], ['#####', '#S!H#', '#...#', '#####']);
    const move = moveFriends(level, initialFriendsState(level), 'right');
    expect(move.lost).toBe(true); expect(move.won).toBe(false);
    expect(friendsAtHome(level, move.state)).toEqual([true, false]);
    expect(moveFriends(level, move.state, 'down').moved[0]).toBe(true);
  });
  it('solves every shipped level and reproduces its stored optimal solution', () => {
    for (let n = 1; n <= 40; n++) {
      const level = friendsLevel(n), solved = solveFriends(level);
      expect(solved.path?.length, `level ${n}`).toBe(level.par);
      expect(solved.exhausted).toBe(false);
      const last = replayFriends(level, level.solution);
      expect(last.lost).toBe(false); expect(friendsAtHome(level, last.state)).toEqual([true, true]);
    }
  });
});
