import { useCallback, useEffect, useRef, useState } from 'react';

/** Returns `value` after it stopped changing for `delay` ms (search boxes). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const query = (q: string) => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null);

/** `true` when the media query matches; SSR/test safe. */
export function useMediaQuery(media: string): boolean {
  const [matches, setMatches] = useState(() => !!query(media)?.matches);
  useEffect(() => {
    const list = query(media);
    if (!list) return;
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [media]);
  return matches;
}

/** Admin shell breakpoint: below 1024px the mobile shell (top bar + bottom tabs) is used. */
export const useIsMobileAdmin = () => !useMediaQuery('(min-width: 1024px)');

/** Small localStorage-backed state for per-browser conveniences (favourites, recents, collapsed). */
export function useStoredState<T>(key: string, initial: T): [T, (next: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  const ref = useRef(value);
  ref.current = value;
  const set = useCallback((next: T | ((previous: T) => T)) => {
    const resolved = typeof next === 'function' ? (next as (p: T) => T)(ref.current) : next;
    setValue(resolved);
    try { localStorage.setItem(key, JSON.stringify(resolved)); } catch { /* private mode */ }
  }, [key]);
  return [value, set];
}
