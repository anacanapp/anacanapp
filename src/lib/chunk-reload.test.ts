import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const reload = vi.fn();
let online = true;
beforeEach(() => {
  vi.resetModules(); reload.mockReset(); online = true; sessionStorage.clear();
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  vi.stubGlobal('location', { ...window.location, reload });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const load = () => import('./chunk-reload');

it('reloads once per window while online', async () => {
  const { reloadOnceForChunkError } = await load();
  expect(reloadOnceForChunkError()).toBe(true);
  expect(reloadOnceForChunkError()).toBe(false);
  expect(reload).toHaveBeenCalledOnce();
});

it('never reloads into the browser offline page; reloads once when the connection returns', async () => {
  online = false;
  const { reloadOnceForChunkError, retryAfterChunkError } = await load();
  expect(reloadOnceForChunkError()).toBe(false);
  expect(reloadOnceForChunkError()).toBe(false);
  expect(retryAfterChunkError()).toBe(false);
  expect(reload).not.toHaveBeenCalled();
  online = true;
  window.dispatchEvent(new Event('online'));
  window.dispatchEvent(new Event('online'));
  expect(reload).toHaveBeenCalledOnce();
});

it('treats Vite preload failures (Unable to preload CSS) with the same guarded reload', async () => {
  const { installPreloadErrorReload, isChunkLoadError } = await load();
  expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true);
  const target = new EventTarget();
  installPreloadErrorReload(target as unknown as Window);
  const first = new Event('vite:preloadError', { cancelable: true });
  target.dispatchEvent(first);
  expect(first.defaultPrevented).toBe(true);
  expect(reload).toHaveBeenCalledOnce();
  // Within the guard window: no second reload, and the error is not swallowed.
  const second = new Event('vite:preloadError', { cancelable: true });
  target.dispatchEvent(second);
  expect(second.defaultPrevented).toBe(false);
  expect(reload).toHaveBeenCalledOnce();
});

it('lets an offline preload error reach the error boundary instead of reloading', async () => {
  online = false;
  const { installPreloadErrorReload } = await load();
  const target = new EventTarget();
  installPreloadErrorReload(target as unknown as Window);
  const event = new Event('vite:preloadError', { cancelable: true });
  target.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});
