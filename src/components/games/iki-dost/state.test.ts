import { beforeEach, describe, expect, it } from 'vitest';
import { completeFriendsLevel, createFriendsProfile, createFriendsRound, FRIENDS_STORAGE_KEY, readFriendsProfile, writeFriendsProfile } from './state';
import { friendsLevel } from './levels';

beforeEach(() => localStorage.clear());
describe('Two Friends saved journey', () => {
  it('unlocks once and does not count the same rescue again on replay', () => {
    const level = friendsLevel(1), fresh = { ...createFriendsProfile(), round: { ...createFriendsRound(1), path: level.solution, moves: level.par } };
    const won = completeFriendsLevel(fresh, level);
    expect(won.progress.unlocked).toBe(2); expect(won.progress.totalRescues).toBe(2);
    expect(won.progress.levels['1'].stars).toBe(3);
    expect(completeFriendsLevel(won, level)).toBe(won);
    expect(completeFriendsLevel({ ...won, round: { ...fresh.round } }, level).progress.totalRescues).toBe(2);
  });
  it('restores a partially played path and preserves progression when only the round is malformed', () => {
    const level = friendsLevel(1), profile = { ...createFriendsProfile(), round: { ...createFriendsRound(1), path: level.solution.slice(0, 2), moves: 2 } };
    expect(writeFriendsProfile(profile)).toBe(true); expect(readFriendsProfile()).toEqual(profile);
    localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify({ ...profile, round: { ...profile.round, path: ['up'] } }));
    expect(readFriendsProfile().round).toBeNull(); expect(readFriendsProfile().progress).toEqual(profile.progress);
  });
  it('does not accept future levels or an awarded unsolved round', () => {
    const profile = createFriendsProfile();
    localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify({ ...profile, round: createFriendsRound(40) }));
    expect(readFriendsProfile().round).toBeNull();
    localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify({ ...profile, round: { ...createFriendsRound(1), awarded: true } }));
    expect(readFriendsProfile().round).toBeNull();
  });
});
