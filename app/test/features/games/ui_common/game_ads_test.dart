// Ported from: src/hooks/useGameAds.test.tsx
import 'dart:async';

import 'package:anacan/domain/ads/ads_config.dart';
import 'package:anacan/domain/ads/ads_policy.dart';
import 'package:anacan/features/games/ui_common/game_ads.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeAdsPlatform implements GameAdsPlatform {
  @override
  AdsConfiguration? configuration = defaultAdsConfiguration();
  @override
  bool premium = false;
  @override
  bool get busy => false;
  final List<String> registered = [];
  final List<(String, String)> opportunities = [];
  final List<String> shown = [];
  bool nextOpportunity = false;
  final List<Future<bool> Function()> rewards = [];

  @override
  VoidCallback registerSurface(String placement) {
    registered.add(placement);
    return () {};
  }

  @override
  bool opportunity(String placement, String key) {
    opportunities.add((placement, key));
    final value = nextOpportunity;
    nextOpportunity = false;
    return value;
  }

  @override
  Future<bool> showInterstitial(String placement) async {
    shown.add(placement);
    return true;
  }

  @override
  Future<bool> showRewarded(String placement) => rewards.removeAt(0)();

  @override
  AdDecision decisionFor(String placement) => const AdDecision(allowed: true, reason: 'ready', waitSeconds: 0, mode: 'demo', adUnitId: null);
}

void main() {
  group('game rewarded revival', () {
    test('does not restore on close/failure; restores once on reward and enforces per-round limit', () async {
      final ads = FakeAdsPlatform();
      final restored = <GameReviveBenefits>[];
      final hook = GameAdsController(gameId: 'saglam-sebet', platform: ads, phase: 'lost', restore: restored.add);
      ads.rewards.add(() async => false);
      await hook.revive();
      expect(restored, isEmpty);
      ads.rewards.add(() async => true);
      await hook.revive();
      expect(restored, [const GameReviveBenefits(lives: 3, moves: 5, seconds: 15)]);
      hook.update(phase: 'lost', restore: restored.add);
      await hook.revive();
      expect(restored, hasLength(1));
      hook.dispose();
    });

    test('ignores a delayed reward after leaving the round and only counts terminal round transitions', () async {
      final ads = FakeAdsPlatform();
      final restored = <GameReviveBenefits>[];
      final finish = Completer<bool>();
      ads.rewards.add(() => finish.future);
      final hook = GameAdsController(gameId: 'birlesdir', platform: ads, phase: 'lost', restore: restored.add);
      final pending = hook.revive();
      hook.dispose();
      finish.complete(true);
      await pending;
      expect(restored, isEmpty);

      final next = GameAdsController(gameId: 'birlesdir', platform: ads, phase: 'playing', restore: restored.add);
      var actions = 0;
      await next.transition(() => actions++);
      expect(ads.opportunities, isEmpty);
      next.update(phase: 'won', restore: restored.add);
      ads.nextOpportunity = true;
      await next.transition(() => actions++);
      expect(ads.shown, ['games_break_interstitial']);
      expect(actions, 2);
      next.dispose();
    });
  });

  test('no ads configuration: nothing is offered and transitions run at once', () async {
    final hook = GameAdsController(gameId: 'word-garden', platform: const NoGameAdsPlatform(), phase: 'lost', restore: (_) {});
    expect(hook.canOffer, isFalse);
    expect(hook.benefits, const GameReviveBenefits(lives: 3, moves: 5, seconds: 15));
    var ran = false;
    await hook.transition(() => ran = true);
    expect(ran, isTrue);
    hook.dispose();
  });
}
