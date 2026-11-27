// Ported from: src/lib/ads/policy.test.ts, src/lib/ads/cadence.test.ts
// (the zod schema assertions of the last policy case are admin-side validation and are not ported)

import 'package:anacan/domain/ads/ads_cadence.dart';
import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/domain/ads/ads_policy.dart';
import 'package:flutter_test/flutter_test.dart';

final int now = DateTime.parse('2026-09-20T12:00:00Z').millisecondsSinceEpoch;
AdEvaluationContext context() => AdEvaluationContext(
      now: now, sessionStartedAt: now - 120000, screenStartedAt: now - 60000, platform: 'ios', signedIn: true, entitlementReady: true,
      premium: false, foreground: true, online: true, blocked: false, native: false, sdkAvailable: false, nativeVersion: '31.0',
      compiledAppId: testAppIds['ios']!, consent: true, demo: true,
    );

void main() {
  group('AdMob delivery policy', () {
    test('hides ads for Premium/unknown entitlement, sensitive overlays, background, offline and anonymous users', () {
      final config = defaultAdsConfiguration();
      final c = context();
      for (final (patched, reason) in [
        (c.copyWith(premium: true), 'premium'), (c.copyWith(entitlementReady: false), 'entitlement_loading'), (c.copyWith(blocked: true), 'blocked_screen'),
        (c.copyWith(foreground: false), 'background'), (c.copyWith(online: false), 'offline'), (c.copyWith(signedIn: false), 'signed_out'),
      ]) {
        expect(evaluateAd(config, 'home_banner', patched, emptyAdLedger(now)).reason, reason);
      }
      expect(evaluateAd(null, 'home_banner', context(), emptyAdLedger(now)).allowed, false);
    });
    test('applies master, per-platform, per-placement and scheduled switches', () {
      final config = defaultAdsConfiguration(), ledger = emptyAdLedger(now);
      config.settings.enabled = false;
      expect(evaluateAd(config, 'home_banner', context(), ledger).reason, 'disabled');
      config.settings.enabled = true;
      config.placements[0].enabled = false;
      expect(evaluateAd(config, 'home_banner', context(), ledger).reason, 'placement_disabled');
      config.placements[0].enabled = true;
      config.placements[0].platforms = ['android'];
      expect(evaluateAd(config, 'home_banner', context(), ledger).reason, 'platform');
      config.placements[0].platforms = ['ios'];
      config.placements[0].startAt = '2027-01-01T00:00:00Z';
      expect(evaluateAd(config, 'home_banner', context(), ledger).reason, 'schedule');
    });
    test('uses independent demo/test/live counters and protects global fullscreen cooldowns across placements', () {
      final config = defaultAdsConfiguration();
      var ledger = emptyAdLedger(now);
      expect(evaluateAd(config, 'article_exit_interstitial', context(), ledger).allowed, true);
      ledger = recordAdShown(ledger, 'article_exit_interstitial', now);
      expect(evaluateAd(config, 'recipe_exit_interstitial', context(), ledger).reason, 'global_cooldown');
      expect(evaluateAd(config, 'recipe_exit_interstitial', context().copyWith(now: now + 601000), ledger).allowed, true);
      ledger.fullscreen.day = config.settings.fullscreenDailyCap;
      expect(evaluateAd(config, 'recipe_exit_interstitial', context().copyWith(now: now + 601000), ledger).reason, 'daily_cap');
    });
    test('keeps an already visible banner while applying kill/premium checks immediately', () {
      final config = defaultAdsConfiguration();
      final ledger = recordAdShown(emptyAdLedger(now), 'home_banner', now);
      expect(evaluateAd(config, 'home_banner', context(), ledger).allowed, false);
      expect(evaluateAd(config, 'home_banner', context().copyWith(alreadyShowingBanner: true), ledger).allowed, true);
      config.settings.enabled = false;
      expect(evaluateAd(config, 'home_banner', context().copyWith(alreadyShowingBanner: true), ledger).reason, 'disabled');
    });
    test('requires a supported native build, matching App ID and consent for real SDK requests', () {
      final config = defaultAdsConfiguration();
      config.settings.mode = 'test';
      final ledger = emptyAdLedger(now);
      final native = context().copyWith(demo: false, native: true, sdkAvailable: true);
      expect(evaluateAd(config, 'home_banner', native, ledger).adUnitId, testUnitIds['ios']!['banner']);
      expect(evaluateAd(config, 'home_banner', native.copyWith(nativeVersion: '30.0'), ledger).reason, 'update_required');
      expect(evaluateAd(config, 'home_banner', native.copyWith(consent: false), ledger).reason, 'consent');
      expect(evaluateAd(config, 'home_banner', native.copyWith(compiledAppId: 'unknown'), ledger).reason, 'app_id_mismatch');
      expect(evaluateAd(config, 'home_banner', native.copyWith(sdkAvailable: false), ledger).reason, 'unsupported');
      config.settings.mode = 'demo';
      expect(evaluateAd(config, 'home_banner', native.copyWith(demo: false), ledger).reason, 'demo_only');
    });
    test('keeps daily limits across restarts, resets them on UTC day changes, and preserves reward pauses', () {
      final ledger = recordAdShown(emptyAdLedger(now, 'one'), 'home_banner', now);
      ledger.pauseUntil = now + 1800000;
      final resumed = normalizeAdLedger(ledger, now + 1000, 'two');
      expect(resumed.placements['home_banner']?.session, 0);
      expect(resumed.placements['home_banner']?.day, 1);
      expect(resumed.pauseUntil, ledger.pauseUntil);
      expect(evaluateAd(defaultAdsConfiguration(), 'home_banner', context(), resumed).reason, 'paused');
      final tomorrow = normalizeAdLedger(resumed, now + 86400000, 'three');
      expect(tomorrow.placements['home_banner']?.day, 0);
    });
    test('allows explicit rewarded actions before passive-ad grace and rejects incomplete live configuration', () {
      final config = defaultAdsConfiguration(), ledger = emptyAdLedger(now), fresh = context().copyWith(sessionStartedAt: now);
      expect(evaluateAd(config, 'home_banner', fresh, ledger).reason, 'startup_delay');
      expect(evaluateAd(config, 'ads_pause_rewarded', fresh, ledger).allowed, true);
      config.settings.mode = 'live';
      expect(evaluateAd(config, 'home_banner', context().copyWith(demo: false, native: true, sdkAvailable: true), ledger).reason, 'app_id_mismatch');
    });
    test('ledger JSON round trip and app-ads.txt', () {
      final ledger = recordAdShown(emptyAdLedger(now, 's'), 'article_exit_interstitial', now);
      expect(AdLedger.fromJson(ledger.toJson()).toJson(), ledger.toJson());
      expect(ledger.toJson()['date'], '2026-09-20');
      expect(appAdsTxt(defaultAdsConfiguration()), '# Anacan: AdMob publisher is not configured.\n');
      expect(compareNativeVersions('31.0', '31'), 0);
      expect(compareNativeVersions('30.9', '31.0'), -1);
      expect(compareNativeVersions('x', '1'), isNull);
    });
  });

  group('story/game advertisement cadence', () {
    test('requires two different finished rounds and ignores duplicate completion callbacks', () {
      final first = advanceAdCadence(const AdCadence(count: 0, seen: []), 'round-one', 2);
      expect(first.due, false);
      expect(advanceAdCadence(first.state, 'round-one', 2).counted, false);
      final second = advanceAdCadence(first.state, 'round-two', 2);
      expect(second.due, true);
      final afterAd = consumeAdCadence(second.state);
      expect(afterAd.count, 0);
      expect(advanceAdCadence(afterAd, 'round-two', 2).due, false);
    });
    test('keeps a missed opportunity due without accumulating a queue of ads', () {
      var state = const AdCadence(count: 0, seen: []);
      for (var i = 0; i < 20; i++) {
        state = advanceAdCadence(state, 'story-$i', 5).state;
      }
      expect(state.count, 5);
      expect(consumeAdCadence(state).count, 0);
    });
  });
}
