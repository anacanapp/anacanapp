import catalog from './catalog.json';
import { TWO_FRIENDS_LEVELS, TWO_FRIENDS_REVISION, type FriendsLevel } from './model';

export function friendsLevel(level: number): FriendsLevel {
  if (!Number.isSafeInteger(level) || level < 1 || level > TWO_FRIENDS_LEVELS
    || catalog.revision !== TWO_FRIENDS_REVISION) throw new Error('TWO_FRIENDS_LEVEL_INVALID');
  return catalog.levels[level - 1] as FriendsLevel;
}
