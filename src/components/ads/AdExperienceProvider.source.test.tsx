import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { defaultAdsConfiguration, TEST_UNIT_IDS, type AdPlacementId, type AdsConfiguration } from '@/lib/ads/config';
import { SOURCE_ADMOB_RPC } from '@/lib/ads/continuity';

const fixture = vi.hoisted(() => ({
  premium: false, ready: true, platform: 'ios', userId: '00000000-0000-4000-8000-000000000128',
  consent: vi.fn(), privacy: vi.fn(), banner: vi.fn(), stopBanner: vi.fn(), reset: vi.fn(), rpc: vi.fn(),
  prepare: vi.fn(), prepareStory: vi.fn(), fullscreen: vi.fn(), story: vi.fn(), prepared: new Set<string>(),
}));
vi.mock('@/integrations/supabase/backend-config', () => ({ getBackendConfig: () => ({ azure: false, url: 'https://tntbjulojatnrqmylorp.supabase.co' }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: fixture.rpc } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: fixture.userId ? { id: fixture.userId } : null, isAdmin: false }) }));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPremium: fixture.premium, entitlementReady: fixture.ready }) }));
vi.mock('@/store/timerStore', () => ({ useTimerStore: () => false }));
vi.mock('@/store/whiteNoiseStore', () => ({ useWhiteNoiseStore: () => false }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => fixture.platform, isNativePlatform: () => fixture.platform !== 'web' } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: '31.0' }) } }));
vi.mock('@/lib/ads/native', () => ({
  hasNativeAdmob: () => fixture.platform !== 'web', removeNativeAdmobBanner: async () => {},
  NativeAdmobAdapter: class {
    consent = fixture.consent; privacyOptions = fixture.privacy; showBanner = fixture.banner;
    stopBanner = fixture.stopBanner; reset = fixture.reset;
    positionBanner = async () => {};
    prepare = fixture.prepare; prepareStory = fixture.prepareStory;
    isPrepared = (id: string) => fixture.prepared.has(id); isPreparing = () => false;
    isStoryPrepared = (id: string) => fixture.prepared.has(id); isStoryPreparing = () => false;
    showFullscreen = fixture.fullscreen; showStory = fixture.story;
  },
}));
import { AdExperienceProvider, AdSurface, useAdExperience } from './AdExperienceProvider';

let client: QueryClient;
let config: AdsConfiguration, emergencyDisabled: boolean;
function Controls() {
  const ads = useAdExperience();
  const [extra, setExtra] = useState<AdPlacementId | null>(null), [result, setResult] = useState<boolean | null>(null);
  return <><AdSurface id="home_banner" />
    {extra && <AdSurface id={extra} />}
    <output data-testid="ad-reason">{ads.decisionFor('home_banner').reason}</output>
    <output data-testid="ad-result">{result === null ? 'waiting' : String(result)}</output>
    <button onClick={() => void ads.openPrivacy()}>Privacy</button>
    {(['article_exit_interstitial', 'community_story_break', 'ads_pause_rewarded'] as const).map(id => <button key={id} onClick={() => setExtra(id)}>Enter {id}</button>)}
    <button onClick={async () => setResult(extra === 'ads_pause_rewarded' ? await ads.showRewarded()
      : extra === 'community_story_break' ? await ads.showStory() : await ads.showInterstitial('article_exit_interstitial'))}>Show</button>
  </>;
}
function mount() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><AdExperienceProvider><Controls /></AdExperienceProvider></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); fixture.rpc.mockReset(); fixture.prepared.clear(); localStorage.clear(); sessionStorage.clear();
  fixture.premium = false; fixture.ready = true; fixture.platform = 'ios'; fixture.userId = '00000000-0000-4000-8000-000000000128';
  fixture.consent.mockResolvedValue({ canRequestAds: true, privacyOptionsRequired: true });
  fixture.privacy.mockResolvedValue({ canRequestAds: false, privacyOptionsRequired: true });
  fixture.stopBanner.mockResolvedValue(undefined);
  fixture.banner.mockImplementation(async (_unit, _margin, _mode, _npa, callbacks) => { callbacks.loaded(); });
  fixture.prepare.mockImplementation(async id => { fixture.prepared.add(id); return true; });
  fixture.prepareStory.mockImplementation(async id => { fixture.prepared.add(id); return true; });
  fixture.fullscreen.mockImplementation(async (_id, _mode, _npa, rewarded, allowed, callbacks) => {
    if (!allowed()) return { shown: false, rewarded: false };
    callbacks.shown(); callbacks.impression(); if (rewarded) callbacks.rewarded();
    return { shown: true, rewarded };
  });
  fixture.story.mockImplementation(async (_id, _video, allowed, callbacks) => {
    if (!allowed()) return { shown: false, rewarded: false };
    callbacks.shown(); callbacks.impression(); return { shown: true, rewarded: false };
  });
  config = defaultAdsConfiguration(); config.settings.mode = 'test'; config.settings.startup_delay_seconds = 0;
  config.placements.forEach(item => { item.min_screen_seconds = 0; });
  emergencyDisabled = false;
  fixture.rpc.mockImplementation(async name => {
    if (name !== SOURCE_ADMOB_RPC) throw new Error('Unexpected Source RPC');
    const configuration = structuredClone(config); if (emergencyDisabled) configuration.settings.enabled = false;
    return { error: null, data: { schema: 'anacan-admob-source-v1', sourceGeneration: 1,
      upstreamRevision: configuration.revision, emergencyDisabled, syncedAt: '2026-01-01T00:00:00Z', configuration } };
  });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Azure unavailable'); }));
});
afterEach(() => { cleanup(); client?.clear(); vi.unstubAllGlobals(); });

describe('Source native advertising survives Azure outages with real UMP eligibility', () => {
  it('obtains Source consent, starts an official test banner, and honors privacy withdrawal', async () => {
    mount();
    await waitFor(() => expect(fixture.banner).toHaveBeenCalled());
    expect(fixture.consent).toHaveBeenCalledTimes(1);
    expect(fixture.banner.mock.calls[0].slice(0, 4)).toEqual([TEST_UNIT_IDS.ios.banner, expect.any(Number), 'test', true]);
    expect(fixture.rpc).toHaveBeenCalledWith(SOURCE_ADMOB_RPC, { p_expected_revision: null });
    for (const [url, options] of vi.mocked(fetch).mock.calls) {
      expect(String(url)).toBe('https://api.anacan.az/admob/events');
      expect(options).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
      expect(new Headers(options?.headers).has('authorization')).toBe(false);
    }
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Privacy' })); });
    await waitFor(() => expect(screen.getByTestId('ad-reason')).toHaveTextContent('consent'));
    expect(fixture.privacy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('ad-banner-dock')).not.toBeInTheDocument());
  });

  it.each([['ios', 403], ['ios', 503], ['android', 403], ['android', 503]] as const)('keeps %s test ads working when Azure returns %i', async (platform, status) => {
    fixture.platform = platform;
    vi.mocked(fetch).mockImplementation(async () => new Response('{}', { status }));
    mount();
    await waitFor(() => expect(fixture.banner).toHaveBeenCalled());
    expect(fixture.banner.mock.calls[0][0]).toBe(TEST_UNIT_IDS[platform].banner);
    expect(fixture.consent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ad-banner-dock')).toBeInTheDocument();
  });

  it.each(['article_exit_interstitial', 'community_story_break', 'ads_pause_rewarded'] as const)('requests and shows %s with Azure networking blocked', async id => {
    mount(); await waitFor(() => expect(fixture.banner).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: `Enter ${id}` }));
    if (id === 'article_exit_interstitial') await waitFor(() => expect(fixture.prepare).toHaveBeenCalled());
    if (id === 'community_story_break') await waitFor(() => expect(fixture.prepareStory).toHaveBeenCalled());
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Show' })); });
    await waitFor(() => expect(screen.getByTestId('ad-result')).toHaveTextContent('true'));
    const call = id === 'community_story_break' ? fixture.story.mock.calls[0] : fixture.fullscreen.mock.calls[0];
    expect(call[0]).toBe(TEST_UNIT_IDS.ios[id === 'community_story_break' ? 'native_story' : id === 'ads_pause_rewarded' ? 'rewarded' : 'interstitial']);
    expect(fixture.rpc.mock.calls.every(([name]) => name === SOURCE_ADMOB_RPC)).toBe(true);
  });

  it.each(['primary kill switch', 'Source emergency'] as const)('removes the running banner when a new Source read contains %s', async stop => {
    mount(); await waitFor(() => expect(screen.getByTestId('ad-banner-dock')).toBeInTheDocument());
    if (stop === 'Source emergency') emergencyDisabled = true;
    else { config.settings.enabled = false; config.revision++; }
    await act(async () => { await client.invalidateQueries({ queryKey: ['admob-configuration'] }); });
    await waitFor(() => expect(screen.queryByTestId('ad-banner-dock')).not.toBeInTheDocument());
    expect(screen.getByTestId('ad-reason')).toHaveTextContent('disabled');
  });

  it('still fails closed if Source itself becomes unavailable', async () => {
    mount(); await waitFor(() => expect(screen.getByTestId('ad-banner-dock')).toBeInTheDocument());
    fixture.rpc.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    await act(async () => { await client.invalidateQueries({ queryKey: ['admob-configuration'] }); });
    await waitFor(() => expect(screen.queryByTestId('ad-banner-dock')).not.toBeInTheDocument());
    expect(screen.getByTestId('ad-reason')).toHaveTextContent('configuration');
  });

  it('does not load a banner when UMP refuses consent, and can reopen privacy on Source', async () => {
    fixture.consent.mockResolvedValue({ canRequestAds: false, privacyOptionsRequired: true });
    fixture.privacy.mockResolvedValue({ canRequestAds: true, privacyOptionsRequired: true });
    mount();
    await waitFor(() => expect(fixture.consent).toHaveBeenCalledTimes(1));
    expect(fixture.banner).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Privacy' })); });
    await waitFor(() => expect(fixture.banner).toHaveBeenCalled());
  });

  it.each(['premium', 'unknown entitlement', 'web'] as const)('keeps SDK loading suppressed for %s', async mode => {
    fixture.premium = mode === 'premium'; fixture.ready = mode !== 'unknown entitlement';
    if (mode === 'web') fixture.platform = 'web';
    mount();
    await waitFor(() => expect(screen.getByTestId('ad-reason')).toHaveTextContent(mode === 'premium' ? 'premium' : mode === 'web' ? 'unsupported' : 'entitlement_loading'));
    expect(fixture.consent).not.toHaveBeenCalled(); expect(fixture.banner).not.toHaveBeenCalled();
  });
});
