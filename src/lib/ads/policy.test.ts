import { describe, expect, it } from 'vitest';
import { adsConfigurationSchema, defaultAdsConfiguration, TEST_APP_IDS, TEST_UNIT_IDS } from './config';
import { emptyAdLedger, evaluateAd, normalizeAdLedger, recordAdShown, type AdEvaluationContext } from './policy';

const now = Date.parse('2026-09-20T12:00:00Z');
const context = (patch: Partial<AdEvaluationContext> = {}): AdEvaluationContext => ({ now, sessionStartedAt: now - 120000,
  screenStartedAt: now - 60000, platform: 'ios', signedIn: true, entitlementReady: true, premium: false,
  foreground: true, online: true, blocked: false, native: false, sdkAvailable: false, nativeVersion: '31.0',
  compiledAppId: TEST_APP_IDS.ios, consent: true, demo: true, ...patch });
describe('AdMob delivery policy', () => {
  it('hides ads for Premium/unknown entitlement, sensitive overlays, background, offline and anonymous users', () => {
    const config = defaultAdsConfiguration();
    for (const [patch, reason] of [
      [{ premium: true }, 'premium'], [{ entitlementReady: false }, 'entitlement_loading'], [{ blocked: true }, 'blocked_screen'],
      [{ foreground: false }, 'background'], [{ online: false }, 'offline'], [{ signedIn: false }, 'signed_out'],
    ] as const) expect(evaluateAd(config, 'home_banner', context(patch), emptyAdLedger(now)).reason).toBe(reason);
    expect(evaluateAd(null, 'home_banner', context(), emptyAdLedger(now)).allowed).toBe(false);
  });
  it('applies master, per-platform, per-placement and scheduled switches', () => {
    const config = defaultAdsConfiguration(), ledger = emptyAdLedger(now);
    config.settings.enabled = false; expect(evaluateAd(config, 'home_banner', context(), ledger).reason).toBe('disabled');
    config.settings.enabled = true; config.placements[0].enabled = false;
    expect(evaluateAd(config, 'home_banner', context(), ledger).reason).toBe('placement_disabled');
    config.placements[0].enabled = true; config.placements[0].platforms = ['android'];
    expect(evaluateAd(config, 'home_banner', context(), ledger).reason).toBe('platform');
    config.placements[0].platforms = ['ios']; config.placements[0].start_at = '2027-01-01T00:00:00Z';
    expect(evaluateAd(config, 'home_banner', context(), ledger).reason).toBe('schedule');
  });
  it('uses independent demo/test/live counters and protects global fullscreen cooldowns across placements', () => {
    const config = defaultAdsConfiguration(); let ledger = emptyAdLedger(now);
    expect(evaluateAd(config, 'article_exit_interstitial', context(), ledger).allowed).toBe(true);
    ledger = recordAdShown(ledger, 'article_exit_interstitial', now);
    expect(evaluateAd(config, 'recipe_exit_interstitial', context(), ledger).reason).toBe('global_cooldown');
    expect(evaluateAd(config, 'recipe_exit_interstitial', context({ now: now + 601000 }), ledger).allowed).toBe(true);
    ledger.fullscreen.day = config.settings.fullscreen_daily_cap;
    expect(evaluateAd(config, 'recipe_exit_interstitial', context({ now: now + 601000 }), ledger).reason).toBe('daily_cap');
  });
  it('keeps an already visible banner while applying kill/premium checks immediately', () => {
    const config = defaultAdsConfiguration(); const ledger = recordAdShown(emptyAdLedger(now), 'home_banner', now);
    expect(evaluateAd(config, 'home_banner', context(), ledger).allowed).toBe(false);
    expect(evaluateAd(config, 'home_banner', context({ alreadyShowingBanner: true }), ledger).allowed).toBe(true);
    config.settings.enabled = false;
    expect(evaluateAd(config, 'home_banner', context({ alreadyShowingBanner: true }), ledger).reason).toBe('disabled');
  });
  it('requires a supported native build, matching App ID and consent for real SDK requests', () => {
    const config = defaultAdsConfiguration(); config.settings.mode = 'test'; const ledger = emptyAdLedger(now);
    const native = context({ demo: false, native: true, sdkAvailable: true });
    expect(evaluateAd(config, 'home_banner', native, ledger).adUnitId).toBe(TEST_UNIT_IDS.ios.banner);
    expect(evaluateAd(config, 'home_banner', { ...native, nativeVersion: '30.0' }, ledger).reason).toBe('update_required');
    expect(evaluateAd(config, 'home_banner', { ...native, consent: false }, ledger).reason).toBe('consent');
    expect(evaluateAd(config, 'home_banner', { ...native, compiledAppId: 'unknown' }, ledger).reason).toBe('app_id_mismatch');
    expect(evaluateAd(config, 'home_banner', { ...native, sdkAvailable: false }, ledger).reason).toBe('unsupported');
    config.settings.mode = 'demo';
    expect(evaluateAd(config, 'home_banner', { ...native, demo: false }, ledger).reason).toBe('demo_only');
  });
  it('keeps daily limits across restarts, resets them on UTC day changes, and preserves reward pauses', () => {
    const ledger = recordAdShown(emptyAdLedger(now, 'one'), 'home_banner', now); ledger.pause_until = now + 1800000;
    const resumed = normalizeAdLedger(ledger, now + 1000, 'two');
    expect(resumed.placements.home_banner?.session).toBe(0); expect(resumed.placements.home_banner?.day).toBe(1);
    expect(resumed.pause_until).toBe(ledger.pause_until);
    expect(evaluateAd(defaultAdsConfiguration(), 'home_banner', context(), resumed).reason).toBe('paused');
    const tomorrow = normalizeAdLedger(resumed, now + 86400000, 'three'); expect(tomorrow.placements.home_banner?.day).toBe(0);
  });
  it('allows explicit rewarded actions before passive-ad grace and rejects incomplete live configuration', () => {
    const config = defaultAdsConfiguration(), ledger = emptyAdLedger(now), fresh = context({ sessionStartedAt: now });
    expect(evaluateAd(config, 'home_banner', fresh, ledger).reason).toBe('startup_delay');
    expect(evaluateAd(config, 'ads_pause_rewarded', fresh, ledger).allowed).toBe(true);
    config.settings.mode = 'live'; expect(adsConfigurationSchema.safeParse(config).success).toBe(false);
    config.settings.enabled = false; expect(adsConfigurationSchema.safeParse(config).success).toBe(true);
  });
});
