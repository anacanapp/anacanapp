import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LEGACY_AUTH_STORAGE_KEY as OLD, SOURCE_AUTH_REALM } from './auth-storage-key';

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), brokeredPreviewStorage: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));
vi.mock('./authStorage', () => ({ brokeredPreviewStorage: mocks.brokeredPreviewStorage }));

const AZURE = 'https://anacan-gateway.example.azurecontainerapps.io';
const CURRENT = 'sb-anacan-gateway-auth-token';

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  localStorage.clear();
  mocks.brokeredPreviewStorage.mockReturnValue(localStorage);
  vi.stubEnv('VITE_SUPABASE_URL', AZURE);
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key');
  vi.stubEnv('VITE_AUTH_CUTOVER', undefined);
  vi.stubGlobal('window', { location: { hostname: 'app.anacan.az' }, localStorage });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('leaves the current source backend, key and SDK auth options unchanged', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', SOURCE_AUTH_REALM);
  const { authStorage } = await import('./client');
  expect(authStorage.storageKey).toBe(OLD);
  expect(mocks.createClient).toHaveBeenCalledExactlyOnceWith(SOURCE_AUTH_REALM, 'synthetic-publishable-key', {
    auth: { storage: localStorage, storageKey: OLD, persistSession: true, autoRefreshToken: true },
  });
});

it.each([undefined, 'false', 'TRUE', '1'])('does not activate cutover for flag %s', async (flag) => {
  vi.stubEnv('VITE_AUTH_CUTOVER', flag);
  localStorage.setItem(OLD, 'source-session');
  const { authStorage } = await import('./client');
  expect(authStorage).toMatchObject({ storageKey: CURRENT, realm: AZURE, allowLegacyFallback: false });
  expect(mocks.createClient.mock.calls[0][0]).toBe(AZURE);
});

it('selects the legacy key before construction only for explicit first-party opt-in, without switching URLs', async () => {
  vi.stubEnv('VITE_AUTH_CUTOVER', 'true');
  const { authStorage } = await import('./client');
  expect(authStorage).toMatchObject({ storageKey: OLD, realm: SOURCE_AUTH_REALM, allowLegacyFallback: true });
  expect(mocks.createClient.mock.calls[0]).toEqual([
    AZURE, 'synthetic-publishable-key',
    { auth: { storage: localStorage, storageKey: OLD, persistSession: true, autoRefreshToken: true } },
  ]);
});

it('preserves the Lovable broker and destination namespace even if the flag is set', async () => {
  vi.stubEnv('VITE_AUTH_CUTOVER', 'true');
  vi.stubGlobal('window', { location: { hostname: 'preview.lovableproject.com' }, localStorage });
  const broker = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
  mocks.brokeredPreviewStorage.mockReturnValue(broker);
  const { authStorage } = await import('./client');
  expect(authStorage.storage).toBe(broker);
  expect(authStorage.storageKey).toBe(CURRENT);
  expect(authStorage.allowLegacyFallback).toBe(false);
  expect(broker.getItem).not.toHaveBeenCalled();
});

it('uses the default key and SDK memory fallback when browser storage access throws', async () => {
  vi.stubEnv('VITE_AUTH_CUTOVER', 'true');
  vi.stubGlobal('window', {
    location: { hostname: 'app.anacan.az' },
    get localStorage() { throw new Error('blocked'); },
  });
  mocks.brokeredPreviewStorage.mockImplementation(() => { throw new Error('blocked'); });
  const { authStorage } = await import('./client');
  expect(authStorage).toEqual({ storageKey: CURRENT, realm: AZURE, allowLegacyFallback: false, storage: undefined });
});
