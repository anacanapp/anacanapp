/** Lazy chunk failures (stale deploy hashes, flaky WebView loads). React.lazy caches
 * the rejected import, so only a full reload recovers. The reload is guarded so a
 * chunk that is missing every time cannot cause an endless blank reload loop.
 * While the device is offline no reload happens (a web user would land on the
 * browser's offline page); the reload is deferred until the 'online' event. */
const RELOAD_KEY = 'anacan-chunk-reload-at';
const RELOAD_WINDOW_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (?:CSS )?chunk [\w-]+ failed|Unable to preload CSS/i.test(message);
}

/** navigator.onLine === false only; an unknown state counts as online. */
export function isDeviceOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

let waitingForOnline = false;

/** Reload once the connection returns (single listener however many errors arrive). */
export function reloadWhenOnline(): void {
  if (waitingForOnline || typeof window === 'undefined') return;
  waitingForOnline = true;
  const onOnline = () => {
    window.removeEventListener('online', onOnline);
    waitingForOnline = false;
    reloadOnceForChunkError();
  };
  window.addEventListener('online', onOnline);
}

/** Reloads once per 30s window; returns false when a reload already just happened
 * or the device is offline (then it reloads when the 'online' event fires). */
export function reloadOnceForChunkError(): boolean {
  if (isDeviceOffline()) {
    reloadWhenOnline();
    return false;
  }
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage blocked: still try a single reload */ }
  window.location.reload();
  return true;
}

/** Manual "try again" for a chunk error: never reloads into the browser's offline page. */
export function retryAfterChunkError(): boolean {
  if (isDeviceOffline()) {
    reloadWhenOnline();
    return false;
  }
  window.location.reload();
  return true;
}

/** Vite fires `vite:preloadError` when a preloaded JS/CSS dependency ("Unable to preload
 * CSS") fails. Use the same guarded single reload; only when a reload actually starts is
 * the error suppressed, otherwise it propagates to the error boundary (offline UI). */
export function installPreloadErrorReload(target: Pick<Window, 'addEventListener'> = window): void {
  target.addEventListener('vite:preloadError', (event: Event) => {
    if (reloadOnceForChunkError()) event.preventDefault();
  });
}
