import { solveFriends } from './engine';
import type { FriendDirection, FriendsLevel, FriendsState } from './model';

export function requestFriendsHint(level: FriendsLevel, state: FriendsState, signal: AbortSignal): Promise<FriendDirection | null> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  let worker: Worker;
  try {
    if (typeof Worker === 'undefined') return Promise.resolve(solveFriends(level, state).path?.[0] || null);
    worker = new Worker(new URL('./friends.worker.ts', import.meta.url), { type: 'module' });
  } catch { return Promise.resolve(solveFriends(level, state).path?.[0] || null); }
  return new Promise((resolve, reject) => {
    const finish = (value: FriendDirection | null, error?: Error) => {
      clearTimeout(timer); signal.removeEventListener('abort', cancel); worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    const cancel = () => finish(null, new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(() => finish(null, new Error('TWO_FRIENDS_HINT_TIMEOUT')), 5000);
    signal.addEventListener('abort', cancel, { once: true });
    worker.onmessage = event => finish(event.data);
    worker.onerror = () => finish(null, new Error('TWO_FRIENDS_HINT_FAILED'));
    try { worker.postMessage({ level, state }); }
    catch { finish(null, new Error('TWO_FRIENDS_HINT_FAILED')); }
  });
}
