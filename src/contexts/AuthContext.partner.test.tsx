import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuthContext } from './AuthContext';

const mocks = vi.hoisted(() => {
  const store: Record<string, any> = { language: 'en', hasSelectedLanguage: true };
  for (const key of ['setAuth', 'setRole', 'setLifeStage', 'setOnboarded', 'setLastPeriodDate', 'setCycleLength',
    'setPeriodLength', 'setDueDate', 'setBabyData', 'setMultiplesData', 'setDeliveryType', 'setPartnerCode', 'setLinkedPartnerId',
    'logout', 'setLanguage', 'setHasSelectedLanguage']) store[key] = vi.fn();
  return { store, rpc: vi.fn(), from: vi.fn(), update: vi.fn(), writeCache: vi.fn(),
    listener: null as ((event: string, session: unknown) => void) | null,
    profiles: [] as Record<string, any>[], profileError: null as unknown };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mocks.rpc, from: mocks.from,
  auth: { onAuthStateChange: (listener: typeof mocks.listener) => {
    mocks.listener = listener;
    return { data: { subscription: { unsubscribe: () => {} } } };
  } },
} }));
vi.mock('@/store/userStore', () => ({ useUserStore: Object.assign(
  (selector: (state: object) => unknown) => selector(mocks.store), { getState: () => mocks.store },
) }));
vi.mock('@/lib/offlineCache', () => ({ readCache: () => null, writeCache: mocks.writeCache, clearAllCaches: () => {} }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
vi.mock('@/lib/analytics', () => ({ analytics: { setUserId: () => {}, setUserProperties: () => {} } }));
vi.mock('@/lib/mixpanel', () => ({ identifyUser: () => {}, setSuperProperties: () => {} }));
vi.mock('@/lib/revenuecat', () => ({ identifyUser: () => {} }));

function query(table: string) {
  let filter: [string, unknown] | null = null;
  let updates: object | null = null;
  const execute = (single: boolean) => {
    if (table === 'profiles' && mocks.profileError) return { data: null, error: mocks.profileError };
    const rows = table === 'profiles' ? mocks.profiles.filter((row) => !filter || row[filter[0]] === filter[1])
      : table === 'user_roles' ? [{ role: 'user' }] : [{ language: 'en' }];
    if (updates) rows.forEach((row) => Object.assign(row, updates));
    return { data: single ? rows[0] ?? null : rows, error: null };
  };
  return {
    select() { return this; },
    eq(key: string, value: unknown) { filter = [key, value]; return this; },
    update(values: object) { updates = values; mocks.update(values); return this; },
    maybeSingle: () => Promise.resolve(execute(true)), single: () => Promise.resolve(execute(true)),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(execute(false)).then(resolve),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_AZURE_PARTNER_PAIRING', 'true');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.profileError = null;
  mocks.profiles = [
    { id: 'my-profile', user_id: 'user-a', name: 'Fixture A', life_stage: 'bump', linked_partner_id: null, partner_code: 'ANACAN-ABCD2345' },
    { id: 'other-profile', user_id: 'user-b', name: 'Fixture B', life_stage: 'bump', linked_partner_id: null, partner_code: 'ANACAN-A01F' },
  ];
  mocks.from.mockImplementation(query);
  mocks.rpc.mockImplementation(async () => {
    mocks.profiles[0] = { ...mocks.profiles[0], linked_partner_id: 'other-profile', life_stage: 'partner' };
    return { data: { ok: true }, error: null };
  });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function signedIn() {
  const hook = renderHook(useAuthContext, { wrapper: AuthProvider });
  await act(async () => {
    mocks.listener?.('SIGNED_IN', { user: {
      id: 'user-a', email: 'pairing@example.invalid', user_metadata: {},
      created_at: '2025-01-01T00:00:00Z', last_sign_in_at: '2026-01-01T00:00:00Z',
    } });
  });
  await waitFor(() => expect(hook.result.current.profileLoaded).toBe(true));
  mocks.from.mockClear();
  mocks.writeCache.mockClear();
  return hook;
}

describe('existing-account linkPartner', () => {
  it.each(['bump', 'mommy'])('hydrates %s multiple-child data after a fresh login', async stage => {
    mocks.profiles[0] = { ...mocks.profiles[0], life_stage: stage, baby_count: 3, multiples_type: 'triplets',
      ...(stage === 'mommy' ? { baby_name: 'Fixture Child', baby_birth_date: '2026-08-01', baby_gender: 'girl' } : {}) };
    await signedIn();
    expect(mocks.store.setMultiplesData).toHaveBeenLastCalledWith(3, 'triplets');
    if (stage === 'mommy') expect(mocks.store.setBabyData).toHaveBeenLastCalledWith(new Date('2026-08-01'), 'Fixture Child', 'girl', 3, 'triplets');
  });
  it('uses the code-only RPC then synchronizes the confirmed profile in Azure', async () => {
    const { result } = await signedIn();
    await act(async () => { await expect(result.current.linkPartner(' anacan-abcd23 ')).resolves.toEqual({ error: null }); });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('link_partner_by_code', { p_partner_code: 'ANACAN-ABCD23' });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.current.profile?.linked_partner_id).toBe('other-profile');
    expect(mocks.store.setLinkedPartnerId).toHaveBeenLastCalledWith('other-profile');
    expect(mocks.writeCache).toHaveBeenCalledWith('profile', 'user-a', expect.objectContaining({ linked_partner_id: 'other-profile' }));
  });

  it('keeps both legacy direct updates without new RPCs when the flag is absent', async () => {
    vi.stubEnv('VITE_AZURE_PARTNER_PAIRING', undefined);
    const { result } = await signedIn();
    await act(async () => { await expect(result.current.linkPartner('ANACAN-A01F')).resolves.toEqual({ error: null }); });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls).toEqual([
      [{ linked_partner_id: 'other-profile', life_stage: 'partner' }], [{ linked_partner_id: 'my-profile' }],
    ]);
  });

  it.each(['42501', 'PGRST202'])('returns %s without falling back to direct writes', async (code) => {
    const error = { code, message: 'RPC unavailable' };
    mocks.rpc.mockResolvedValue({ data: null, error });
    const { result } = await signedIn();
    await act(async () => { await expect(result.current.linkPartner('ANACAN-ABCD23')).resolves.toEqual({ error }); });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });

  it('returns an occupied-link rejection rather than reporting success', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'PAIRING_CONFLICT' }, error: null });
    const { result } = await signedIn();
    await act(async () => {
      await expect(result.current.linkPartner('ANACAN-ABCD23')).resolves.toMatchObject({ error: { code: 'PAIRING_CONFLICT' } });
    });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(result.current.profile?.linked_partner_id).toBeNull();
  });

  it('does not disguise a failed post-pair refresh as a successful cached profile', async () => {
    const { result } = await signedIn();
    const error = { message: 'offline' };
    mocks.profileError = error;
    await act(async () => { await expect(result.current.linkPartner('ANACAN-ABCD23')).resolves.toEqual({ error }); });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeCache).not.toHaveBeenCalled();
  });
});
