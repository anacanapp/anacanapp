import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocked = vi.hoisted(() => ({
  handlers: new Map<string, Set<(value?: unknown) => void>>(),
  sdk: {
    initialize: vi.fn(async () => {}), setApplicationMuted: vi.fn(async () => {}),
    requestConsentInfo: vi.fn(async () => ({ status: 'NOT_REQUIRED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' })),
    showConsentForm: vi.fn(), showPrivacyOptionsForm: vi.fn(async () => {}),
    addListener: vi.fn(), showBanner: vi.fn(async () => {}), removeBanner: vi.fn(async () => {}),
    prepareInterstitial: vi.fn(async () => ({})), prepareRewardVideoAd: vi.fn(async () => ({})),
    showInterstitial: vi.fn(async () => {}), showRewardVideoAd: vi.fn(async () => ({ amount: 1, type: 'reward' })),
  },
}));
vi.mock('@capacitor-community/admob', () => ({ AdMob: mocked.sdk,
  MaxAdContentRating: { General: 'General' }, BannerAdPosition: { BOTTOM_CENTER: 'BOTTOM_CENTER' }, BannerAdSize: { ADAPTIVE_BANNER: 'ADAPTIVE_BANNER' },
  BannerAdPluginEvents: { Loaded: 'banner-loaded', SizeChanged: 'banner-size', AdImpression: 'banner-impression', FailedToLoad: 'banner-failed' },
  InterstitialAdPluginEvents: { Showed: 'interstitial-showed', AdImpression: 'interstitial-impression', Dismissed: 'interstitial-dismissed', FailedToShow: 'interstitial-failed' },
  RewardAdPluginEvents: { Showed: 'reward-showed', AdImpression: 'reward-impression', Dismissed: 'reward-dismissed', FailedToShow: 'reward-failed', Rewarded: 'reward-earned' },
}));
import { NativeAdmobAdapter } from './native';
const emit = (name: string, value: unknown = {}) => mocked.handlers.get(name)?.forEach(callback => callback(value));
beforeEach(() => {
  vi.clearAllMocks(); mocked.handlers.clear();
  mocked.sdk.addListener.mockImplementation(async (name: string, callback: (value?: unknown) => void) => {
    const callbacks = mocked.handlers.get(name) ?? new Set(); callbacks.add(callback); mocked.handlers.set(name, callbacks);
    return { remove: vi.fn(async () => { callbacks.delete(callback); }) };
  });
});
describe('native AdMob lifecycle', () => {
  it('ignores late banner callbacks after removal and never initializes before UMP permits ads', async () => {
    const adapter = new NativeAdmobAdapter();
    await adapter.consent(); expect(mocked.sdk.initialize).toHaveBeenCalledTimes(1);
    const callbacks = { loaded: vi.fn(), size: vi.fn(), impression: vi.fn(), failed: vi.fn() };
    await adapter.showBanner('test-unit', 100, 'test', true, callbacks);
    const late = [...mocked.handlers.get('banner-loaded')!][0];
    await adapter.stopBanner(); late({});
    expect(callbacks.loaded).not.toHaveBeenCalled();
    expect([...mocked.handlers.values()].every(items => items.size === 0)).toBe(true);
  });
  it('a close event or resolved SDK promise does not grant a rewarded benefit', async () => {
    const adapter = new NativeAdmobAdapter(); await adapter.consent();
    await adapter.prepare('reward-unit', 'test', true, true);
    const callbacks = { shown: vi.fn(), impression: vi.fn(), rewarded: vi.fn() };
    const result = adapter.showFullscreen('reward-unit', 'test', true, true, () => true, callbacks);
    await vi.waitFor(() => expect(mocked.sdk.showRewardVideoAd).toHaveBeenCalledTimes(1));
    emit('reward-showed'); emit('reward-dismissed');
    expect(await result).toEqual({ shown: true, rewarded: false });
    expect(callbacks.rewarded).not.toHaveBeenCalled(); adapter.reset();
  });
  it('only one earned-reward callback grants the benefit and repeated dismissals settle once', async () => {
    const adapter = new NativeAdmobAdapter(); await adapter.consent(); await adapter.prepare('reward-unit', 'test', true, true);
    const callbacks = { shown: vi.fn(), impression: vi.fn(), rewarded: vi.fn() };
    const result = adapter.showFullscreen('reward-unit', 'test', true, true, () => true, callbacks);
    await vi.waitFor(() => expect(mocked.sdk.showRewardVideoAd).toHaveBeenCalledTimes(1));
    emit('reward-showed'); emit('reward-earned'); emit('reward-earned'); emit('reward-dismissed'); emit('reward-dismissed');
    expect(await result).toEqual({ shown: true, rewarded: true }); expect(callbacks.rewarded).toHaveBeenCalledTimes(1); adapter.reset();
  });
  it('stale preloads after reset are not usable and a last-moment policy change prevents showing', async () => {
    let finish!: () => void;
    mocked.sdk.prepareInterstitial.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({}); }));
    const adapter = new NativeAdmobAdapter(); await adapter.consent();
    const loading = adapter.prepare('interstitial-unit', 'test', true);
    await vi.waitFor(() => expect(finish).toBeDefined()); adapter.reset(); finish();
    expect(await loading).toBe(false); expect(adapter.isPrepared('interstitial-unit', 'test', true)).toBe(false);
    await adapter.prepare('interstitial-unit', 'test', true);
    const result = await adapter.showFullscreen('interstitial-unit', 'test', true, false, () => false, { shown: vi.fn(), impression: vi.fn(), rewarded: vi.fn() });
    expect(result.shown).toBe(false); expect(mocked.sdk.showInterstitial).not.toHaveBeenCalled(); adapter.reset();
  });
});
