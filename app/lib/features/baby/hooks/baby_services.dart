// Ported from: src/lib/native.ts (hapticFeedback.light / medium), src/hooks/useAchievements.ts (unlockAchievement),
//              src/hooks/useSubscription.ts (peekRemainingDaily)
//
// Side effects the baby care code calls into but that belong to other features. Defaults: haptics through
// Flutter's HapticFeedback (Capacitor Haptics impact light/medium), no-op achievements, and an unlimited daily
// allowance (the baby-insight Edge Function still enforces the real limit server-side and answers 429).
// The app root overrides [babyCareServicesProvider] once useAchievements / useSubscription are ported.
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

abstract interface class BabyCareServices {
  Future<void> hapticLight();
  Future<void> hapticMedium();

  /// `unlockAchievement(key, stage)`.
  Future<void> unlockAchievement(String key, String stage);

  /// `peekRemainingDaily(feature)` → `{ remaining, limit }` (remaining may be infinite).
  Future<({num remaining, num limit})> peekRemainingDaily(String feature);
}

class DefaultBabyCareServices implements BabyCareServices {
  const DefaultBabyCareServices();
  @override
  Future<void> hapticLight() => HapticFeedback.lightImpact();
  @override
  Future<void> hapticMedium() => HapticFeedback.mediumImpact();
  @override
  Future<void> unlockAchievement(String key, String stage) async {}
  @override
  Future<({num remaining, num limit})> peekRemainingDaily(String feature) async => (remaining: double.infinity, limit: 0);
}

final babyCareServicesProvider = Provider<BabyCareServices>((ref) => const DefaultBabyCareServices());
