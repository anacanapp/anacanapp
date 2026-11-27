// Ported from: src/hooks/useSubscription.ts (pure parts of the free-tier usage limits)
//
// Daily count limits for free users (usage_tracking.feature_type), with app_settings.free_limits overriding the
// fallback values. The server RPC usage_consume_v1 checks and increments atomically; these helpers interpret its
// answer and the legacy table path exactly like the hook.

import 'dart:math' as math;

import '../js_compat.dart';

/// 'ai_chat' | 'cry_translator' | 'poop_scanner' | 'fairy_tale' | 'horoscope' | 'baby_insight'
typedef DailyFeature = String;

/// Fallback free tier limits (used if the DB setting is not available).
const Map<String, num> defaultFreeLimits = {
  'white_noise_seconds_per_day': 20 * 60,
  'baby_photoshoot_count': 3,
  'fairy_tale_count_per_day': 3,
  'ai_chat_count_per_day': 10,
  'cry_translator_count_per_day': 3,
  'poop_scanner_count_per_day': 3,
  'horoscope_count_per_day': 2,
  'baby_insight_count_per_day': 2,
};

const Map<DailyFeature, String> dailyLimitKeys = {
  'ai_chat': 'ai_chat_count_per_day',
  'cry_translator': 'cry_translator_count_per_day',
  'poop_scanner': 'poop_scanner_count_per_day',
  'fairy_tale': 'fairy_tale_count_per_day',
  'horoscope': 'horoscope_count_per_day',
  'baby_insight': 'baby_insight_count_per_day',
};

/// `{ ...DEFAULT_FREE_LIMITS, ...dbFreeLimits }` when the setting is an object.
Map<String, Object?> mergeFreeLimits(Object? dbFreeLimits) {
  if (dbFreeLimits is Map) return {...defaultFreeLimits, ...dbFreeLimits.cast<String, Object?>()};
  return {...defaultFreeLimits};
}

/// `Number(freeLimits[DAILY_LIMIT_KEYS[feature]] ?? 0)`.
double dailyLimitFor(Map<String, Object?> freeLimits, DailyFeature feature) => jsNumber(freeLimits[dailyLimitKeys[feature]] ?? 0);

class UsageDecision {
  const UsageDecision({required this.allowed, required this.remaining, required this.limit});
  final bool allowed;

  /// `Infinity` for Premium.
  final double remaining;
  final double limit;
}

/// Premium / signed-out short cuts of checkAndConsume, before any network call (null: ask the server).
UsageDecision? usageShortCut({required bool isPremium, required String? userId, required double limit}) {
  if (isPremium) return UsageDecision(allowed: true, remaining: double.infinity, limit: limit);
  if (userId == null || userId.isEmpty) return UsageDecision(allowed: false, remaining: 0, limit: limit);
  return null;
}

/// usage_consume_v1 answer `{ allowed, used, limit }`; null when the answer is not usable (falls back to allow).
UsageDecision? usageFromRpc(Object? data, double limit) {
  if (data is! Map || data['allowed'] is! bool) return null;
  final serverLimit = jsNumber(data['limit']).isFinite ? jsNumber(data['limit']) : limit;
  final rawUsed = data.containsKey('used') ? jsNumber(data['used']) : double.nan;
  final used = rawUsed.isNaN ? 0.0 : rawUsed; // `Number(data.used) || 0`
  return UsageDecision(allowed: data['allowed'] as bool, remaining: math.max(0, serverLimit - used), limit: serverLimit);
}

/// Legacy table path: refused at the limit, otherwise the count after this use.
UsageDecision usageFromLegacyCount(num used, double limit) {
  if (used >= limit) return UsageDecision(allowed: false, remaining: 0, limit: limit);
  return UsageDecision(allowed: true, remaining: math.max(0, limit - used - 1).toDouble(), limit: limit);
}

/// Network failure: never block the user (the limit is best effort; server AI functions check too).
UsageDecision usageOnError(double limit) => UsageDecision(allowed: true, remaining: 0, limit: limit);

/// White noise: remaining seconds of the daily allowance.
({bool allowed, double remainingSeconds}) canUseWhiteNoise({required bool isPremium, required Map<String, Object?> freeLimits, num usedSeconds = 0}) {
  if (isPremium) return (allowed: true, remainingSeconds: double.infinity);
  final remaining = jsNumber(freeLimits['white_noise_seconds_per_day']) - usedSeconds;
  return (allowed: remaining > 0, remainingSeconds: math.max(0, remaining).toDouble());
}

/// Baby photoshoot: total photos against the lifetime free count.
({bool allowed, double remainingCount}) canUseBabyPhotoshoot({required bool isPremium, required String? userId, required Map<String, Object?> freeLimits, num totalPhotos = 0}) {
  if (isPremium) return (allowed: true, remainingCount: double.infinity);
  if (userId == null || userId.isEmpty) return (allowed: false, remainingCount: 0);
  final remaining = jsNumber(freeLimits['baby_photoshoot_count']) - totalPhotos;
  return (allowed: remaining > 0, remainingCount: math.max(0, remaining).toDouble());
}
