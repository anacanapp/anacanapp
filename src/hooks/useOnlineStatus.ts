import { useSyncExternalStore } from 'react';

/** Browser/WebView connectivity: navigator.onLine plus the online/offline events.
 * `true` when unknown (SSR, missing API), so nothing claims "offline" without evidence. */
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const snapshot = () => typeof navigator === 'undefined' || navigator.onLine !== false;

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}
