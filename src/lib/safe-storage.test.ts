import { describe, expect, it } from 'vitest';
import { createMemoryStorage, installStorageFallbacks, safeStorage } from './safe-storage';

const blockedHost = () => {
  const host = {} as Record<string, unknown>;
  for (const kind of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(host, kind, { configurable: true, get() { throw new DOMException("Failed to read the 'sessionStorage' property from 'Window': Access is denied", 'SecurityError'); } });
  }
  return host;
};

describe('safe storage', () => {
  it('memory storage implements the Storage API', () => {
    const s = createMemoryStorage();
    s.setItem('a', '1'); s.setItem('b', '2');
    expect(s.getItem('a')).toBe('1');
    expect(s.length).toBe(2);
    expect(s.key(1)).toBe('b');
    s.removeItem('a');
    expect(s.getItem('a')).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
  });

  it('safeStorage returns null instead of throwing for blocked storage', () => {
    expect(safeStorage('sessionStorage', blockedHost())).toBeNull();
  });

  it('replaces a throwing storage getter with in-memory storage (private mode)', () => {
    const host = blockedHost();
    expect(installStorageFallbacks(host)).toEqual(['localStorage', 'sessionStorage']);
    const session = host.sessionStorage as Storage;
    session.setItem('k', 'v');
    expect(session.getItem('k')).toBe('v');
    expect(safeStorage('localStorage', host)).not.toBeNull();
  });

  it('leaves working storage alone', () => {
    const host = { localStorage: createMemoryStorage(), sessionStorage: createMemoryStorage() };
    expect(installStorageFallbacks(host)).toEqual([]);
  });
});
