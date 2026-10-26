/** Lazy chunk failures (stale deploy hashes, flaky WebView loads). React.lazy caches
 * the rejected import, so only a full reload recovers. The reload is guarded so a
 * chunk that is missing every time cannot cause an endless blank reload loop. */
const RELOAD_KEY = 'anacan-chunk-reload-at';
const RELOAD_WINDOW_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (?:CSS )?chunk [\w-]+ failed|Unable to preload CSS/i.test(message);
}

/** Reloads once per 30s window; returns false when a reload already just happened. */
export function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage blocked: still try a single reload */ }
  window.location.reload();
  return true;
}
