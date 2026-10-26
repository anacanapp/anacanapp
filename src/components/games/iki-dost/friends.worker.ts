/// <reference lib="webworker" />
import { solveFriends } from './engine';
import type { FriendsLevel, FriendsState } from './model';

addEventListener('message', (event: MessageEvent<{ level: FriendsLevel; state: FriendsState }>) => {
  const result = solveFriends(event.data.level, event.data.state);
  postMessage(result.path?.[0] || null);
});
