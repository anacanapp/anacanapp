import { describe, expect, it, vi } from 'vitest';

// Keep the native-bridge import inert so the module loads under jsdom.
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web', isPluginAvailable: () => false } }));

import { RC_NATIVE_TIMEOUT_MS, withNativeTimeout } from './revenuecat';

describe('withNativeTimeout', () => {
  it('resolves with the value when the bridge call finishes in time', async () => {
    await expect(withNativeTimeout(Promise.resolve('offerings'), 1000)).resolves.toBe('offerings');
  });

  it('rejects with the given label when the bridge call hangs', async () => {
    const hang = new Promise<never>(() => {}); // never settles (a hung native bridge)
    await expect(withNativeTimeout(hang, 10, 'RC_OFFERINGS_TIMEOUT')).rejects.toThrow('RC_OFFERINGS_TIMEOUT');
  });

  it('exposes a ~15s default budget', () => {
    expect(RC_NATIVE_TIMEOUT_MS).toBe(15_000);
  });
});
