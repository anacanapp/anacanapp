import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), refreshProfile: vi.fn(), user: { id: 'fixture-user' } }));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'ios', isNativePlatform: () => true, isPluginAvailable: () => true } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user, refreshProfile: mocks.refreshProfile }) }));
vi.mock('@/lib/tr', () => ({ tr: (_key: string, fallback: string) => fallback }));
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); vi.stubEnv('MODE', 'azure'); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('keeps Azure native UI unsupported and never invokes the closed sync route, including explicit refresh/restore', async () => {
  const { useInAppPurchase } = await import('./useInAppPurchase');
  const { result } = renderHook(useInAppPurchase);
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.isSupported).toBe(false);
  expect(result.current.packages).toEqual([]);
  await act(async () => {
    await result.current.refreshEntitlements();
    await expect(result.current.restorePurchases()).resolves.toBe(false);
    await expect(result.current.showPaywallSafe()).resolves.toEqual({ available: false, didPurchase: false });
    await result.current.showCustomerCenter();
  });
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(mocks.refreshProfile).not.toHaveBeenCalled();
});
