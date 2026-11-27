import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ value: true }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value, getPlatform: () => 'ios' } }));

import { markLockOfferSeen, shouldOfferLock } from './lock-offer';

describe('lock offer', () => {
  beforeEach(() => {localStorage.clear();native.value = true;});
  it('offers once on native when the lock is off', () => {
    expect(shouldOfferLock()).toBe(true);
    markLockOfferSeen();
    expect(shouldOfferLock()).toBe(false);
  });
  it('never offers on the web or when the lock is already on', () => {
    native.value = false;
    expect(shouldOfferLock()).toBe(false);
    native.value = true;
    localStorage.setItem('anacan_lock_enabled', '1');
    localStorage.setItem('anacan_lock_hash', 'x');
    expect(shouldOfferLock()).toBe(false);
  });
});
