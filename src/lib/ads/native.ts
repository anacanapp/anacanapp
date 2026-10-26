import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { AdMobPlugin } from '@capacitor-community/admob';
import type { AdMode } from './config';
type ExtendedAdMob = AdMobPlugin & {
  setBannerFrame(options: { top: number; hidden: boolean }): Promise<void>;
  prepareNativeStoryAd(options: { adId: string; isTesting: boolean; npa: boolean; videoOnly: boolean }): Promise<{ adUnitId: string }>;
  showNativeStoryAd(options: { adId: string }): Promise<void>;
  removeNativeStoryAd(): Promise<void>;
};

type AdmobModule = typeof import('@capacitor-community/admob');
export interface NativeConsent { canRequestAds: boolean; privacyOptionsRequired: boolean }
export interface BannerCallbacks { loaded: () => void; size: (height: number) => void; impression: () => void; failed: () => void }
export interface FullscreenCallbacks { shown: () => void; impression: () => void; rewarded: () => void }
export interface FullscreenResult { shown: boolean; rewarded: boolean }
export function hasNativeAdmob(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('AdMob');
}
export async function removeNativeAdmobBanner(): Promise<void> {
  if (!hasNativeAdmob()) return;
  try { await (await import('@capacitor-community/admob')).AdMob.removeBanner(); } catch { /* Optional SDK cleanup. */ }
}
const bounded = async <T>(promise: Promise<T>, milliseconds = 15000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('admob_timeout')), milliseconds); })]); }
  finally { clearTimeout(timer!); }
};
const listener = (sdk: AdMobPlugin, event: string, callback: (value: Record<string, unknown>) => void) =>
  (sdk.addListener as unknown as (event: string, callback: (value: Record<string, unknown>) => void) => Promise<PluginListenerHandle>)(event, callback);

export class NativeAdmobAdapter {
  private module?: Promise<AdmobModule>;
  private initialized = false;
  private bannerGeneration = 0;
  private bannerHandles: PluginListenerHandle[] = [];
  private bannerQueue: Promise<unknown> = Promise.resolve();
  private bannerTimeout?: ReturnType<typeof setTimeout>;
  private prepared = new Map<string, number>();
  private preparing = new Map<string, Promise<boolean>>();
  private loadGeneration = 0;
  private activePresentation: (() => void) | null = null;
  private getModule() { return this.module ??= import('@capacitor-community/admob'); }

  async consent(showForm = true): Promise<NativeConsent> {
    const { AdMob, MaxAdContentRating } = await this.getModule();
    let info = await bounded(AdMob.requestConsentInfo());
    if (showForm && info.status === 'REQUIRED' && info.isConsentFormAvailable) info = await AdMob.showConsentForm();
    if (info.canRequestAds && !this.initialized) {
      await bounded(AdMob.initialize({ maxAdContentRating: MaxAdContentRating.General }));
      await AdMob.setApplicationMuted({ muted: true });
      this.initialized = true;
    }
    return { canRequestAds: info.canRequestAds === true, privacyOptionsRequired: info.privacyOptionsRequirementStatus === 'REQUIRED' };
  }
  async privacyOptions(): Promise<NativeConsent> {
    await this.stopBanner();
    await (await this.getModule()).AdMob.showPrivacyOptionsForm();
    return this.consent(false);
  }
  private async clearBanner() {
    clearTimeout(this.bannerTimeout);
    const handles = this.bannerHandles.splice(0);
    await Promise.allSettled(handles.map(handle => handle.remove()));
    if (this.module) await (await this.module).AdMob.removeBanner().catch(() => {});
  }
  stopBanner(): Promise<void> {
    this.bannerGeneration++;
    const stop = this.bannerQueue.catch(() => {}).then(() => this.clearBanner());
    this.bannerQueue = stop;
    return stop;
  }
  showBanner(unit: string, margin: number, mode: AdMode, npa: boolean, callbacks: BannerCallbacks,
    options: { top?: boolean; inline?: boolean } = {}): Promise<void> {
    const generation = ++this.bannerGeneration;
    const show = this.bannerQueue.catch(() => {}).then(async () => {
      await this.clearBanner();
      if (generation !== this.bannerGeneration) return;
      const { AdMob, BannerAdPluginEvents: events, BannerAdPosition, BannerAdSize } = await this.getModule();
      if (generation !== this.bannerGeneration || !this.initialized) return;
      let loaded = false;
      const current = () => generation === this.bannerGeneration;
      this.bannerHandles = await Promise.all([
        listener(AdMob, events.Loaded, () => { if (current()) { loaded = true; clearTimeout(this.bannerTimeout); callbacks.loaded(); } }),
        listener(AdMob, events.SizeChanged, value => { if (current() && typeof value.height === 'number') callbacks.size(Math.max(0, Math.min(150, value.height))); }),
        listener(AdMob, events.AdImpression, () => { if (current()) callbacks.impression(); }),
        listener(AdMob, events.FailedToLoad, () => { if (current()) { clearTimeout(this.bannerTimeout); callbacks.failed(); } }),
      ]);
      if (!current()) { await this.clearBanner(); return; }
      this.bannerTimeout = setTimeout(() => {
        if (current() && !loaded) { callbacks.failed(); void this.stopBanner(); }
      }, 15000);
      try { await AdMob.showBanner({ adId: unit, adSize: options.inline ? BannerAdSize.BANNER : BannerAdSize.ADAPTIVE_BANNER,
        position: options.top ? BannerAdPosition.TOP_CENTER : BannerAdPosition.BOTTOM_CENTER, margin: Math.round(Math.max(0, margin)), isTesting: mode === 'test', npa }); }
      catch { if (current()) { callbacks.failed(); await this.clearBanner(); } }
    });
    this.bannerQueue = show;
    return show;
  }
  async positionBanner(top: number, hidden: boolean): Promise<void> {
    if (!this.module) return;
    await ((await this.module).AdMob as ExtendedAdMob).setBannerFrame({ top: Math.round(Math.max(0, top)), hidden });
  }
  private adKey(unit: string, mode: AdMode, npa: boolean, rewarded: boolean) { return `${rewarded ? 'reward' : 'interstitial'}:${mode}:${npa}:${unit}`; }
  isPrepared(unit: string, mode: AdMode, npa: boolean, rewarded = false): boolean {
    const time = this.prepared.get(this.adKey(unit, mode, npa, rewarded));
    return Boolean(time && Date.now() - time < 50 * 60_000);
  }
  isPreparing(unit: string, mode: AdMode, npa: boolean, rewarded = false): boolean {
    return this.preparing.has(this.adKey(unit, mode, npa, rewarded));
  }
  prepare(unit: string, mode: AdMode, npa: boolean, rewarded = false): Promise<boolean> {
    const key = this.adKey(unit, mode, npa, rewarded);
    if (this.isPrepared(unit, mode, npa, rewarded)) return Promise.resolve(true);
    const pending = this.preparing.get(key); if (pending) return pending;
    const generation = this.loadGeneration;
    const promise = (async () => {
      if (!this.initialized) return false;
      const { AdMob } = await this.getModule();
      const options = { adId: unit, isTesting: mode === 'test', npa };
      try {
        await bounded(rewarded ? AdMob.prepareRewardVideoAd(options) : AdMob.prepareInterstitial(options));
        if (generation !== this.loadGeneration) return false;
        this.prepared.set(key, Date.now()); return true;
      } catch { return false; }
    })().finally(() => this.preparing.delete(key));
    this.preparing.set(key, promise); return promise;
  }
  async showFullscreen(unit: string, mode: AdMode, npa: boolean, rewarded: boolean,
    allowed: () => boolean, callbacks: FullscreenCallbacks): Promise<FullscreenResult> {
    if (this.activePresentation || !this.isPrepared(unit, mode, npa, rewarded)) return { shown: false, rewarded: false };
    const { AdMob, InterstitialAdPluginEvents: interstitial, RewardAdPluginEvents: reward } = await this.getModule();
    if (this.activePresentation || !allowed()) return { shown: false, rewarded: false };
    return new Promise(resolve => {
      let shown = false, earned = false, settled = false;
      const handles: PluginListenerHandle[] = [];
      let timer: ReturnType<typeof setTimeout>;
      const finish = () => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.activePresentation = null;
        void Promise.allSettled(handles.map(handle => handle.remove()));
        resolve({ shown, rewarded: earned });
      };
      this.activePresentation = finish;
      const events = rewarded ? reward : interstitial;
      const subscribe = async (event: string, callback: (value: Record<string, unknown>) => void) => {
        const handle = await listener(AdMob, event, callback);
        if (settled) await handle.remove(); else handles.push(handle);
      };
      void (async () => {
        try {
          await subscribe(events.Showed, () => {
            if (!settled) { shown = true; clearTimeout(timer); callbacks.shown(); }
          });
          await subscribe(events.AdImpression, () => { if (!settled) callbacks.impression(); });
          await subscribe(events.Dismissed, finish);
          await subscribe(events.FailedToShow, finish);
          if (rewarded) await subscribe(reward.Rewarded, () => {
            if (!settled && !earned) { earned = true; callbacks.rewarded(); }
          });
          if (!allowed() || settled) { finish(); return; }
          this.prepared.delete(this.adKey(unit, mode, npa, rewarded));
          timer = setTimeout(finish, 15000); // Once shown, dismissal owns completion.
          const show = rewarded ? AdMob.showRewardVideoAd({ adId: unit }) : AdMob.showInterstitial({ adId: unit });
          void show.catch(finish);
        } catch { finish(); }
      })();
    });
  }
  reset(): void {
    this.loadGeneration++;
    this.prepared.clear();
    this.storyReady.clear();
    this.activePresentation?.();
    void this.stopBanner();
    if (this.module) void this.module.then(module => (module.AdMob as ExtendedAdMob).removeNativeStoryAd()).catch(() => {});
  }
  private storyReady = new Map<string, number>();
  private storyLoading = new Map<string, Promise<boolean>>();
  isStoryPrepared(unit: string, videoOnly: boolean) { const time = this.storyReady.get(`${unit}:${videoOnly}`); return !!time && Date.now() - time < 50 * 60000; }
  isStoryPreparing(unit: string, videoOnly: boolean) { return this.storyLoading.has(`${unit}:${videoOnly}`); }
  prepareStory(unit: string, mode: AdMode, npa: boolean, videoOnly: boolean): Promise<boolean> {
    const key = `${unit}:${videoOnly}`;
    if (this.isStoryPrepared(unit, videoOnly)) return Promise.resolve(true);
    if (this.storyLoading.has(key)) return this.storyLoading.get(key)!;
    const generation = this.loadGeneration;
    const promise = (async () => {
      if (!this.initialized) return false;
      try { const sdk = (await this.getModule()).AdMob as ExtendedAdMob;
        await bounded(sdk.prepareNativeStoryAd({ adId: unit, isTesting: mode === 'test', npa, videoOnly }));
        if (generation !== this.loadGeneration) return false;
        this.storyReady.set(key, Date.now()); return true;
      } catch { return false; }
    })().finally(() => this.storyLoading.delete(key));
    this.storyLoading.set(key, promise); return promise;
  }
  async showStory(unit: string, videoOnly: boolean, allowed: () => boolean, callbacks: FullscreenCallbacks): Promise<FullscreenResult> {
    if (!this.isStoryPrepared(unit, videoOnly) || this.activePresentation || !allowed()) return { shown: false, rewarded: false };
    const sdk = (await this.getModule()).AdMob as ExtendedAdMob;
    if (!allowed() || this.activePresentation) return { shown: false, rewarded: false };
    return new Promise(resolve => {
      let shown = false, done = false; const handles: PluginListenerHandle[] = [];
      let timeout: ReturnType<typeof setTimeout>;
      const finish = () => { if (done) return; done = true; clearTimeout(timeout); this.activePresentation = null;
        void Promise.allSettled(handles.map(handle => handle.remove())); resolve({ shown, rewarded: false }); };
      this.activePresentation = finish;
      void (async () => {
        try {
          for (const [event, callback] of [
            ['nativeStoryAdShowed', () => { if (!done) { shown = true; clearTimeout(timeout); callbacks.shown(); } }],
            ['nativeStoryAdImpression', () => { if (!done) callbacks.impression(); }],
            ['nativeStoryAdDismissed', finish], ['nativeStoryAdFailedToShow', finish],
          ] as const) { const handle = await listener(sdk, event, callback); if (done) await handle.remove(); else handles.push(handle); }
          if (!allowed() || done) { finish(); return; }
          this.storyReady.delete(`${unit}:${videoOnly}`); timeout = setTimeout(finish, 15000);
          void sdk.showNativeStoryAd({ adId: unit }).catch(finish);
        } catch { finish(); }
      })();
    });
  }
}
