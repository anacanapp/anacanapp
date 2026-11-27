// Ported from: src/lib/freemium.test.ts (+ usage-limit helpers from src/hooks/useSubscription.ts, whose hook tests
// render React and mock Supabase; the pure decisions are covered here)

import 'package:anacan/domain/billing/freemium.dart';
import 'package:anacan/domain/billing/usage_limits.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('freemium tool access', () {
    test('baby tracker stays fully Premium', () {
      expect(isToolFree('baby-tracker'), false);
      expect(toolAccess(toolId: 'baby-tracker'), 'premium');
      expect(canOpenToolFree('baby-tracker'), false);
    });
    test('opens tools with an in-tool free limit for free users', () {
      for (final id in ['recipes', 'horoscope']) {
        expect(toolAccess(toolId: id, isPremiumFlag: true, premiumType: 'premium_only'), 'limited');
        expect(canOpenToolFree(id), true);
      }
    });
    test('honours the admin premium_type limited values', () {
      expect(isLimitedPremiumType('limited_total'), true);
      expect(isLimitedPremiumType('limited_monthly'), true);
      expect(isLimitedPremiumType('premium_only'), false);
      expect(toolAccess(toolId: 'photoshoot', isPremiumFlag: true, premiumType: 'limited_total'), 'preview');
      expect(toolAccess(toolId: 'whitenoise'), 'preview');
      expect(toolAccess(toolId: 'photoshoot', stageLocked: true), 'premium');
      expect(toolAccess(toolId: 'cry-translator', isPremiumFlag: true, premiumType: 'limited_total'), 'premium');
      expect(toolAccess(toolId: 'fairy-tale', isPremiumFlag: true, premiumType: 'limited_monthly'), 'premium');
      expect(toolAccess(toolId: 'cry-translator', isPremiumFlag: true, premiumType: 'none'), 'premium');
      expect(canOpenToolFree('photoshoot', 'limited_monthly'), true);
      expect(canOpenToolFree('cry-translator', 'limited_monthly'), false);
      expect(canOpenToolFree('cry-translator'), false);
    });
    test('keeps the DB premium flag on free-listed tools and stage locks on everything', () {
      expect(toolAccess(toolId: 'first-aid'), 'free');
      expect(toolAccess(toolId: 'first-aid', isPremiumFlag: true), 'premium');
      expect(toolAccess(toolId: 'recipes', stageLocked: true), 'premium');
    });
  });

  group('Premium-only tools (2026-11-09)', () {
    test('Tərbiyə and Əlavə qida bələdçisi need Premium', () {
      expect(toolAccess(toolId: 'parenting'), 'premium');
      expect(toolAccess(toolId: 'solid-food-guide'), 'premium');
    });
  });

  group('cakes market', () {
    test('only AZ (or unset) with az/ru/kk/uz/ka', () {
      expect(isCakesAvailable(), true);
      expect(isCakesAvailable('AZ', 'ru'), true);
      expect(isCakesAvailable('TR', 'az'), false);
      expect(isCakesAvailable(null, 'en'), false);
    });
  });

  group('usage limits (useSubscription pure parts)', () {
    test('DB free limits override the fallbacks', () {
      final limits = mergeFreeLimits({'white_noise_seconds_per_day': 100});
      expect(limits['white_noise_seconds_per_day'], 100);
      expect(dailyLimitFor(limits, 'ai_chat'), 10);
      expect(dailyLimitFor(mergeFreeLimits('bad'), 'horoscope'), 2);
    });
    test('premium is unlimited, signed-out is refused, server answers are trusted', () {
      expect(usageShortCut(isPremium: true, userId: 'u', limit: 3)!.remaining, double.infinity);
      expect(usageShortCut(isPremium: false, userId: null, limit: 3)!.allowed, false);
      expect(usageShortCut(isPremium: false, userId: 'u', limit: 3), isNull);
      final rpc = usageFromRpc({'allowed': true, 'used': 2, 'limit': 5}, 3)!;
      expect([rpc.allowed, rpc.remaining, rpc.limit], [true, 3, 5]);
      expect(usageFromRpc({'allowed': 'yes'}, 3), isNull);
      final noUsed = usageFromRpc({'allowed': false, 'limit': 'x'}, 3)!;
      expect([noUsed.remaining, noUsed.limit], [3, 3]);
      expect(usageFromLegacyCount(3, 3).allowed, false);
      expect(usageFromLegacyCount(1, 3).remaining, 1);
      expect(usageOnError(3).allowed, true);
    });
    test('white noise and photoshoot allowances (the hook test: 100 s limit, 40 s used → 60 s left)', () {
      final limits = mergeFreeLimits({'white_noise_seconds_per_day': 100});
      expect(canUseWhiteNoise(isPremium: false, freeLimits: limits, usedSeconds: 40), (allowed: true, remainingSeconds: 60.0));
      expect(canUseWhiteNoise(isPremium: false, freeLimits: mergeFreeLimits(null)).remainingSeconds, 1200);
      expect(canUseBabyPhotoshoot(isPremium: false, userId: 'u', freeLimits: limits, totalPhotos: 3).allowed, false);
    });
  });
}
