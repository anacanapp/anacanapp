import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultAdsConfiguration } from './config';
import { ADMOB_CONTROL_ORIGIN, disableAdmob, fetchAdmobConfiguration, fetchAdmobOverview, fetchSourceAdmobSnapshot,
  reportAdEvent, restoreAdmobConfiguration, saveAdmobConfiguration, setSourceAdmobEmergency, synchronizeSourceAdmob } from './api';
import { SOURCE_ADMOB_ORIGIN, SOURCE_ADMOB_RPC } from './continuity';

const fixture = vi.hoisted(() => ({ azure: false, rpc: vi.fn() }));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ azure: fixture.azure, url: fixture.azure ? 'https://api.anacan.az' : 'https://tntbjulojatnrqmylorp.supabase.co' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: fixture.rpc } }));
const snapshot = (config = defaultAdsConfiguration(), emergencyDisabled = false) => ({ schema: 'anacan-admob-source-v1',
  sourceGeneration: 1, upstreamRevision: config.revision, syncedAt: '2026-09-22T00:00:00Z', emergencyDisabled,
  configuration: emergencyDisabled ? { ...config, settings: { ...config.settings, enabled: false } } : config });
beforeEach(() => {
  fixture.azure = false; fixture.rpc.mockReset();
  vi.stubEnv('VITE_SOURCE_SUPABASE_PUBLISHABLE_KEY', 'public-source-anon-fixture');
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Unexpected network request'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('Source-hosted AdMob continuity', () => {
  it('loads the selected Source snapshot with Azure completely unavailable', async () => {
    const config = defaultAdsConfiguration(); config.settings.mode = 'test';
    fixture.rpc.mockResolvedValue({ data: snapshot(config), error: null });
    expect(await fetchAdmobConfiguration()).toEqual(config);
    expect(fixture.rpc).toHaveBeenCalledWith(SOURCE_ADMOB_RPC, { p_expected_revision: null });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses the selected authenticated RPC only on Azure and rejects Source-side admin mutations', async () => {
    const config = defaultAdsConfiguration();
    await expect(fetchAdmobOverview()).rejects.toThrow('admob_azure_required');
    await expect(saveAdmobConfiguration(config)).rejects.toThrow('admob_azure_required');
    expect(fixture.rpc).not.toHaveBeenCalled();
    fixture.azure = true; fixture.rpc.mockResolvedValue({ data: config, error: null });
    expect(await fetchAdmobConfiguration()).toEqual(config);
    expect(fixture.rpc).toHaveBeenCalledWith('get_admob_configuration', undefined);
  });
  it('loads the Azure admin overview without waiting for Source availability', async () => {
    fixture.azure = true;
    const overview = { configuration: defaultAdsConfiguration(), metrics: [], history: [] };
    fixture.rpc.mockResolvedValue({ data: overview, error: null });
    expect(await fetchAdmobOverview()).toEqual(overview);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses only the public Source key when the selected backend is Azure', async () => {
    fixture.azure = true;
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(snapshot())));
    expect(await fetchSourceAdmobSnapshot(1)).toEqual(snapshot());
    expect(fetch).toHaveBeenCalledWith(`${SOURCE_ADMOB_ORIGIN}/rest/v1/rpc/${SOURCE_ADMOB_RPC}`, expect.objectContaining({
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { apikey: 'public-source-anon-fixture', Authorization: 'Bearer public-source-anon-fixture', 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_expected_revision: 1 }),
    }));
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it('does not fall back to Azure configuration when Source is absent', async () => {
    fixture.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(fetchAdmobConfiguration()).rejects.toThrow('admob_source_not_installed');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('bounds a stalled Source request instead of hanging the configuration query', async () => {
    vi.useFakeTimers(); fixture.rpc.mockReturnValue(new Promise(() => {}));
    const result = expect(fetchAdmobConfiguration()).rejects.toThrow('admob_source_unavailable');
    await vi.advanceTimersByTimeAsync(8000); await result;
  });
  it('waits for the requested revision and never reports an older mirror as confirmed', async () => {
    vi.useFakeTimers();
    const newer = { ...defaultAdsConfiguration(), revision: 2 };
    fixture.rpc.mockResolvedValueOnce({ data: snapshot(), error: null }).mockResolvedValue({ data: snapshot(newer), error: null });
    const operation = synchronizeSourceAdmob(2);
    await vi.advanceTimersByTimeAsync(500);
    expect((await operation).upstreamRevision).toBe(2);
    expect(fixture.rpc).toHaveBeenCalledTimes(2);
    expect(fixture.rpc).toHaveBeenLastCalledWith(SOURCE_ADMOB_RPC, { p_expected_revision: 2 });
  });
  it('reports pending if Source remains on an older revision', async () => {
    vi.useFakeTimers(); fixture.rpc.mockResolvedValue({ data: snapshot(), error: null });
    const result = expect(synchronizeSourceAdmob(2)).rejects.toThrow('admob_source_sync_pending');
    await vi.advanceTimersByTimeAsync(7500); await result;
    expect(fixture.rpc).toHaveBeenCalledTimes(5);
  });
  it.each(['save', 'restore', 'disable'] as const)('keeps a committed Azure %s successful while reporting unconfirmed Source delivery', async operation => {
    fixture.azure = true;
    const config = { ...defaultAdsConfiguration(), revision: 2 };
    fixture.rpc.mockResolvedValue({ data: config, error: null });
    const result = await (operation === 'save' ? saveAdmobConfiguration(config)
      : operation === 'restore' ? restoreAdmobConfiguration(1, 2) : disableAdmob());
    expect(result).toEqual({ configuration: config, continuity: { available: false, ready: false } });
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });
  it('includes the sticky Source emergency stop in a confirmed Azure save result', async () => {
    fixture.azure = true;
    const config = { ...defaultAdsConfiguration(), revision: 2 };
    fixture.rpc.mockResolvedValue({ data: config, error: null });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(snapshot(config, true))));
    const result = await saveAdmobConfiguration(config);
    expect(result.configuration).toEqual(config);
    expect(result.continuity).toMatchObject({ available: true, ready: true, emergencyDisabled: true, upstreamRevision: 2 });
  });
  it('does not request a mirror or repeat a mutation when the primary CAS fails', async () => {
    fixture.azure = true;
    fixture.rpc.mockResolvedValue({ data: null, error: { message: 'admob_configuration_changed_reload' } });
    await expect(saveAdmobConfiguration(defaultAdsConfiguration())).rejects.toThrow('admob_configuration_changed_reload');
    expect(fetch).not.toHaveBeenCalled(); expect(fixture.rpc).toHaveBeenCalledTimes(1);
  });
  it('uses Source admin credentials only for the independent emergency control', async () => {
    fixture.azure = true;
    await expect(setSourceAdmobEmergency(true)).rejects.toThrow('admob_source_admin_required');
    expect(fixture.rpc).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    fixture.azure = false;
    fixture.rpc.mockResolvedValue({ data: snapshot(defaultAdsConfiguration(), true), error: null });
    expect((await setSourceAdmobEmergency(true)).emergencyDisabled).toBe(true);
    expect(fixture.rpc).toHaveBeenCalledWith('admin_set_source_admob_emergency_v1', { p_disabled: true });
  });
  it('surfaces a frozen Source write rather than claiming emergency state changed', async () => {
    fixture.rpc.mockResolvedValue({ data: null, error: { code: 'PT503' } });
    await expect(setSourceAdmobEmergency(false)).rejects.toThrow('admob_source_frozen');
  });
  it('sends only bounded coarse native events from Source; demo and unidentified configuration are excluded', async () => {
    const request = vi.fn(async () => new Response('true')); vi.stubGlobal('fetch', request);
    await reportAdEvent('home_banner', 'impression', 'demo', 'ios', '', 1);
    await reportAdEvent('home_banner', 'impression', 'test', 'web', '', 1);
    await reportAdEvent('home_banner', 'impression', 'test', 'ios');
    expect(request).not.toHaveBeenCalled();
    await reportAdEvent('home_banner', 'impression', 'test', 'ios', '', 7);
    const [url, options] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${ADMOB_CONTROL_ORIGIN}/admob/events`);
    expect(options.credentials).toBe('omit'); expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(options.body))).toEqual({ p_revision: 7, p_placement_id: 'home_banner', p_event: 'impression', p_mode: 'test', p_platform: 'ios', p_reason: '' });
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it('fails closed on unavailable or malformed Source configuration', async () => {
    fixture.rpc.mockResolvedValue({ data: {}, error: null });
    await expect(fetchAdmobConfiguration()).rejects.toThrow('admob_invalid_configuration');
    fixture.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await expect(fetchAdmobConfiguration()).rejects.toThrow('admob_service_unavailable');
  });
  it.each([
    { ...snapshot(), upstreamRevision: 2 },
    { ...snapshot(), emergencyDisabled: true },
    { ...snapshot(), sourceGeneration: 0 },
    { ...snapshot(), sourceGeneration: Number.MAX_SAFE_INTEGER + 1 },
    { ...snapshot(), syncedAt: 'invalid' },
    { ...snapshot(), untrustedField: 'extra' },
  ])('rejects malformed or contradictory mirror envelopes', async value => {
    fixture.rpc.mockResolvedValue({ data: value, error: null });
    await expect(fetchSourceAdmobSnapshot()).rejects.toThrow('admob_invalid_configuration');
  });
});
