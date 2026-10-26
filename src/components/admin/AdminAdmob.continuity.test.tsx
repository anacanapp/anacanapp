import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAdsConfiguration, type AdsConfiguration } from '@/lib/ads/config';
import { SOURCE_ADMOB_ORIGIN, SOURCE_ADMOB_RPC } from '@/lib/ads/continuity';

const fixture = vi.hoisted(() => ({ azure: false, rpc: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(), frozen: false }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ azure: fixture.azure,
  url: fixture.azure ? 'https://api.anacan.az' : 'https://tntbjulojatnrqmylorp.supabase.co' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: fixture.rpc } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'source-admin-fixture' }, isAdmin: true }) }));
vi.mock('@/components/ads/AdExperienceProvider', () => ({ useAdExperience: () => ({ startPreview: vi.fn() }) }));
vi.mock('@/components/ads/AdmobSimulator', () => ({ AdmobSimulator: () => null }));
vi.mock('sonner', () => ({ toast: { success: fixture.success, warning: fixture.warning, error: fixture.error, info: vi.fn() } }));
import AdminAdmob from './AdminAdmob';

let client: QueryClient, config: AdsConfiguration, emergencyDisabled: boolean;
const snapshot = () => ({ schema: 'anacan-admob-source-v1', sourceGeneration: 1, upstreamRevision: config.revision,
  syncedAt: '2026-09-22T00:00:00Z', emergencyDisabled,
  configuration: { ...config, settings: { ...config.settings, enabled: emergencyDisabled ? false : config.settings.enabled } } });
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<QueryClientProvider client={client}><AdminAdmob /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); fixture.azure = false; fixture.frozen = false; emergencyDisabled = false; config = defaultAdsConfiguration();
  vi.stubEnv('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY', 'public-source-anon-fixture');
  vi.stubGlobal('fetch', vi.fn(async url => {
    if (!String(url).startsWith(SOURCE_ADMOB_ORIGIN)) throw new TypeError('Azure is offline');
    return new Response(JSON.stringify(snapshot()));
  }));
  fixture.rpc.mockImplementation(async (name, args) => {
    if (name === SOURCE_ADMOB_RPC) return { data: snapshot(), error: null };
    if (name === 'admin_set_source_admob_emergency_v1') {
      if (fixture.frozen) return { data: null, error: { code: 'PT503' } };
      emergencyDisabled = args.p_disabled;
      return { data: snapshot(), error: null };
    }
    if (name === 'admin_get_admob_overview') return { data: { configuration: structuredClone(config), metrics: [], history: [] }, error: null };
    if (name === 'admin_disable_admob') {
      config = { ...config, revision: config.revision + 1, settings: { ...config.settings, enabled: false } };
      return { data: structuredClone(config), error: null };
    }
    throw new Error('Unexpected RPC');
  });
});
afterEach(() => { cleanup(); client?.clear(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('AdMob continuity administration', () => {
  it('lets the Source administrator stop and clear the local override while Azure is offline', async () => {
    mount(); await screen.findByTestId('source-admob-status');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Source reklamlarını dayandır' })); });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Source fövqəladə dayandırması aktivdir.'));
    expect(fixture.rpc).toHaveBeenCalledWith('admin_set_source_admob_emergency_v1', { p_disabled: true });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fövqəladə dayandırmanı ləğv et' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Fövqəladə dayandırmanı ləğv et' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Source fövqəladə dayandırması aktiv deyil.'));
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps the emergency state visible and reports a frozen Source write accurately', async () => {
    fixture.frozen = true; emergencyDisabled = true;
    mount(); await screen.findByTestId('source-admob-status');
    fireEvent.click(screen.getByRole('button', { name: 'Fövqəladə dayandırmanı ləğv et' }));
    await waitFor(() => expect(fixture.error).toHaveBeenCalledWith(expect.stringContaining('dondurulub')));
    expect(screen.getByRole('status')).toHaveTextContent('Source fövqəladə dayandırması aktivdir.');
    expect(fixture.success).not.toHaveBeenCalled();
  });
  it('warns about pending Source delivery after a committed Azure stop instead of claiming a global stop', async () => {
    fixture.azure = true; vi.mocked(fetch).mockRejectedValue(new TypeError('Source is unavailable'));
    mount(); await screen.findByTestId('admin-admob');
    fireEvent.click(screen.getByRole('button', { name: 'Hamısını dərhal dayandır' }));
    await waitFor(() => expect(fixture.warning).toHaveBeenCalledWith(expect.stringContaining('Source nüsxəsi hələ təsdiqlənməyib')));
    expect(fixture.success).not.toHaveBeenCalled();
    expect(fixture.rpc.mock.calls.filter(([name]) => name === 'admin_disable_admob')).toHaveLength(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hamısını dərhal dayandır' })).toBeDisabled());
  });
  it('retries only mirror synchronization and shows the independent sticky emergency state', async () => {
    fixture.azure = true; emergencyDisabled = true;
    mount(); await screen.findByTestId('admin-admob');
    await waitFor(() => expect(screen.getByTestId('admob-mirror-status')).toHaveTextContent('Source fövqəladə dayandırması aktivdir'));
    fireEvent.click(screen.getByRole('button', { name: 'Source sinxronunu yoxla' }));
    await waitFor(() => expect(fixture.warning).toHaveBeenCalledWith('Nüsxə təsdiqləndi. Source fövqəladə dayandırması aktiv qalır.'));
    expect(fixture.rpc.mock.calls.every(([name]) => name === 'admin_get_admob_overview')).toBe(true);
    expect(fixture.success).not.toHaveBeenCalled();
  });
});
