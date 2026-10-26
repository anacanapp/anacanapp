import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEGACY_AUTH_STORAGE_KEY as OLD, resolveAuthStorage, SOURCE_AUTH_REALM } from './auth-storage-key';

const AZURE = 'https://anacan-gateway.example.azurecontainerapps.io';
const CURRENT = 'sb-anacan-gateway-auth-token';
const marker = `anacan.auth-key.v1:${encodeURIComponent(AZURE)}`;
const defaults = { storageKey: CURRENT, realm: AZURE, allowLegacyFallback: false };
const browser = (hostname = 'app.anacan.az', storage = localStorage) => ({
  location: { hostname } as Location, localStorage: storage,
});

beforeEach(() => localStorage.clear());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps the exact source/native 25 namespace and source fallback without reading storage', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem');
  expect(resolveAuthStorage(SOURCE_AUTH_REALM, false, browser())).toEqual({
    storageKey: OLD, realm: SOURCE_AUTH_REALM, allowLegacyFallback: true,
  });
  expect(resolveAuthStorage(`${SOURCE_AUTH_REALM}/`, true, browser()).storageKey).toBe(OLD);
  expect(get).not.toHaveBeenCalled();
});

it('leaves Azure preview unchanged unless explicitly enabled', () => {
  localStorage.setItem(OLD, 'source-session');
  const get = vi.spyOn(Storage.prototype, 'getItem');
  expect(resolveAuthStorage(AZURE, false, browser())).toEqual(defaults);
  expect(resolveAuthStorage(AZURE, 'true' as unknown as boolean, browser())).toEqual(defaults);
  expect(get).not.toHaveBeenCalled();
});

it('preserves an existing destination session even if it is expired or malformed', () => {
  localStorage.setItem(OLD, 'source-session');
  localStorage.setItem(CURRENT, 'not-json');
  expect(resolveAuthStorage(AZURE, true, browser())).toEqual(defaults);
  expect(localStorage.getItem(marker)).toBe(CURRENT);
  expect(localStorage.getItem(CURRENT)).toBe('not-json');
  expect(localStorage.getItem(OLD)).toBe('source-session');
});

it('pins the legacy namespace without reading, copying or scanning source credentials', () => {
  const get = vi.spyOn(Storage.prototype, 'getItem');
  const keys = vi.spyOn(Storage.prototype, 'key');
  expect(resolveAuthStorage(AZURE, true, browser())).toEqual({
    storageKey: OLD, realm: SOURCE_AUTH_REALM, allowLegacyFallback: true,
  });
  expect(get.mock.calls).toEqual([[marker], [CURRENT]]);
  expect(keys).not.toHaveBeenCalled();
  expect(localStorage.getItem(marker)).toBe(OLD);
});

it('does not resurrect an alternate entry after destination logout', () => {
  localStorage.setItem(CURRENT, 'azure-session');
  resolveAuthStorage(AZURE, true, browser());
  localStorage.removeItem(CURRENT);
  localStorage.setItem(OLD, 'old-source-session');
  expect(resolveAuthStorage(AZURE, true, browser())).toEqual(defaults);
  expect(localStorage.getItem(marker)).toBe(CURRENT);
});

it('retains a legacy pin through logout rather than selecting a later alternate entry', () => {
  resolveAuthStorage(AZURE, true, browser());
  localStorage.setItem(CURRENT, 'alternate-session');
  expect(resolveAuthStorage(AZURE, true, browser()).storageKey).toBe(OLD);
});

it('fails closed on an invalid pin without changing it', () => {
  localStorage.setItem(marker, 'sb-unrelated-auth-token');
  expect(resolveAuthStorage(AZURE, true, browser())).toEqual(defaults);
  expect(localStorage.getItem(marker)).toBe('sb-unrelated-auth-token');
});

describe.each(['getItem', 'setItem'] as const)('blocked %s', (operation) => {
  it('uses the default realm with no source backup eligibility', () => {
    vi.spyOn(Storage.prototype, operation).mockImplementation(() => { throw new Error('blocked'); });
    expect(resolveAuthStorage(AZURE, true, browser())).toEqual(defaults);
  });
});

it('handles a throwing localStorage getter and an absent browser', () => {
  const blocked = browser();
  Object.defineProperty(blocked, 'localStorage', { get() { throw new Error('blocked'); } });
  expect(resolveAuthStorage(AZURE, true, blocked)).toEqual(defaults);
  vi.stubGlobal('window', undefined);
  expect(resolveAuthStorage(AZURE, true)).toEqual(defaults);
});

it.each([
  'id-preview--00000000-0000-4000-8000-000000000000.lovableproject.com',
  'project--00000000-0000-4000-8000-000000000000.lovableproject-dev.com',
  'preview.lovable.app', 'preview.gpt-eng.com', 'preview.gptengineer.run',
  'anacan-gateway.example.azurecontainerapps.io', 'localhost',
  'anacan.az.attacker.example', 'notanacan.az',
])('does not enable migration on %s, even with the flag', (hostname) => {
  const get = vi.spyOn(Storage.prototype, 'getItem');
  expect(resolveAuthStorage(AZURE, true, browser(hostname))).toEqual(defaults);
  expect(get).not.toHaveBeenCalled();
});

it('binds backup realms and pins to the full backend URL, not just its first label', () => {
  const other = 'https://anacan-gateway.other.example';
  localStorage.setItem(marker, CURRENT);
  expect(resolveAuthStorage(other, false, browser())).toEqual({ ...defaults, realm: other });
  expect(resolveAuthStorage(other, true, browser()).storageKey).toBe(OLD);
});
