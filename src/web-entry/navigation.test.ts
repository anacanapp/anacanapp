import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { guardSystemEntryNavigation } from './navigation';

let stop: (() => void) | undefined;
beforeEach(() => vi.stubGlobal('location', new URL('https://api.anacan.az/payment/success')));
afterEach(() => { stop?.(); stop = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('requires full entry handling when a system-page router leaves its exception', () => {
  const push = vi.spyOn(history, 'pushState'), replace = vi.spyOn(history, 'replaceState');
  const navigate = vi.fn(); stop = guardSystemEntryNavigation(navigate);
  for (const path of ['/', '/?web=admin', '/admin', '/brands', '/legal/terms_of_service', '/blog/en/article/']) {
    history.pushState({}, '', path);
    expect(navigate).toHaveBeenLastCalledWith(new URL(path, location.origin).href);
  }
  history.replaceState({}, '', '/');
  expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled();
});

it('preserves history operations within required recovery/provider/payment routes', () => {
  const push = vi.spyOn(history, 'pushState'), replace = vi.spyOn(history, 'replaceState');
  const navigate = vi.fn(); stop = guardSystemEntryNavigation(navigate);
  history.pushState({}, '', '/payment/error');
  history.replaceState({}, '', '/reset-password');
  expect(push).toHaveBeenCalledOnce(); expect(replace).toHaveBeenCalledOnce();
  expect(navigate).not.toHaveBeenCalled();
});
