import { useEffect, useSyncExternalStore } from 'react';

const screens = new Set<symbol>();
const listeners = new Set<() => void>();
const snapshot = () => screens.size > 0;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const changed = () => {
  if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-chat-fullscreen', snapshot());
  listeners.forEach(listener => listener());
};

export function useChatChromeHidden() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/** Leases keep nested profile/group details from prematurely restoring the footer. */
export function useFullScreenChat() {
  useEffect(() => {
    const screen = Symbol('chat'); screens.add(screen); changed();
    return () => { screens.delete(screen); changed(); };
  }, []);
}
