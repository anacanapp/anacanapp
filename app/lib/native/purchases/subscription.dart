// Ported from: src/hooks/useSubscription.ts, src/hooks/useSubscriptionCancellation.ts
//
// `isPremium` = the bounded server grant (premium_entitlement.dart), own or household. The `subscriptions`
// row is display data only (plan, status, dates); a cached row never grants anything. Free daily limits are
// consumed atomically on the server (`usage_consume_v1` / `usage_add_seconds_v1`, phone time zone); an old
// backend without those functions falls back to the table path with the local calendar day.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/cache/cache.dart';
import '../../core/data/data.dart';
import '../../core/offline/offline_providers.dart' show offlineCacheProvider;
import '../../core/offline/outbox_senders.dart' show isMissingRpc;
import '../../domain/billing/usage_limits.dart';
import '../../domain/dates/local_date.dart' show todayKey;
import 'app_setting.dart';
import 'premium_entitlement.dart';

const String subscriptionCacheKey = 'subscription';
const String householdPremiumCacheKey = 'household_premium';

/// 'white_noise' | 'baby_photoshoot' | DailyFeature
typedef UsageFeatureType = String;

/// The phone's IANA zone. Flutter has no IANA name without a plugin (flutter_timezone is not a dependency):
/// the app root may override [deviceTimeZoneProvider]; the server validates it and falls back to Asia/Baku.
String Function() deviceTimeZone = () => 'Asia/Baku';

/// Data access of the hook (supabase calls), replaceable in tests.
abstract interface class SubscriptionBackend {
  /// `subscriptions` row of [userId] (`maybeSingle`); throws on a query error.
  Future<Map<String, dynamic>?> fetchSubscription(String userId);

  /// `usage_tracking` rows of [userId] on [day]; throws on a query error.
  Future<List<Map<String, dynamic>>> fetchUsage(String userId, String day);

  /// rpc `get_linked_partner_premium`; throws on error.
  Future<bool> fetchHouseholdPremium();

  /// `supabase.rpc(name, args)` as `{data, error, status}`.
  Future<DbResult<Object?>> rpc(String name, Map<String, dynamic> args);

  /// `usage_tracking` row (`id, usage_count`) of a feature/day, or null.
  Future<Map<String, dynamic>?> usageRow(String userId, String feature, String day);
  Future<void> updateUsage(String id, Map<String, dynamic> values);
  Future<void> upsertUsage(Map<String, dynamic> row);
  Future<void> insertUsage(Map<String, dynamic> row);

  /// `baby_photos` count of [userId].
  Future<int> countPhotos(String userId);

  /// `subscription_cancellations` insert (useSubmitCancellationReason).
  Future<void> insertCancellation(Map<String, dynamic> row);
}

class SupabaseSubscriptionBackend implements SubscriptionBackend {
  SupabaseSubscriptionBackend(this.db);
  final Db db;

  @override
  Future<Map<String, dynamic>?> fetchSubscription(String userId) =>
      db.from('subscriptions').select().eq('user_id', userId).maybeSingle();

  @override
  Future<List<Map<String, dynamic>>> fetchUsage(String userId, String day) async =>
      List<Map<String, dynamic>>.from(await db.from('usage_tracking').select().eq('user_id', userId).eq('usage_date', day));

  @override
  Future<bool> fetchHouseholdPremium() async => await db.rpc<Object?>('get_linked_partner_premium') == true;

  @override
  Future<DbResult<Object?>> rpc(String name, Map<String, dynamic> args) => db.rpcResult(name, params: args);

  @override
  Future<Map<String, dynamic>?> usageRow(String userId, String feature, String day) => db
      .from('usage_tracking')
      .select('id, usage_count')
      .eq('user_id', userId)
      .eq('feature_type', feature)
      .eq('usage_date', day)
      .maybeSingle();

  @override
  Future<void> updateUsage(String id, Map<String, dynamic> values) async => db.from('usage_tracking').update(values).eq('id', id);

  @override
  Future<void> upsertUsage(Map<String, dynamic> row) async =>
      db.from('usage_tracking').upsert(row, onConflict: 'user_id,feature_type,usage_date');

  @override
  Future<void> insertUsage(Map<String, dynamic> row) async => db.from('usage_tracking').insert(row);

  @override
  Future<int> countPhotos(String userId) async => (await db.from('baby_photos').select('id').eq('user_id', userId).count()).count;

  @override
  Future<void> insertCancellation(Map<String, dynamic> row) async => db.from('subscription_cancellations').insert(row);
}

/// Old backend answered "no such function": this session goes straight to the legacy table path.
class LegacyUsageFlags {
  bool consume = false;
  bool seconds = false;
  void reset() {
    consume = false;
    seconds = false;
  }
}

/// Session-wide flags (`legacyUsage` module state).
final LegacyUsageFlags legacyUsage = LegacyUsageFlags();

/// Test helper (`__resetUsageRpcForTests`).
void resetUsageRpcForTests() => legacyUsage.reset();

/// The usage functions of the hook, bound to the current user / premium state / limits.
class SubscriptionUsage {
  SubscriptionUsage({
    required this.backend,
    required this.userId,
    required this.isPremium,
    required this.freeLimits,
    this.usage = const [],
    this.refetchUsage,
    LegacyUsageFlags? flags,
  }) : flags = flags ?? legacyUsage;

  final SubscriptionBackend backend;
  final String? userId;
  final bool isPremium;
  final Map<String, Object?> freeLimits;
  final List<Map<String, dynamic>> usage;
  final Future<void> Function()? refetchUsage;
  final LegacyUsageFlags flags;

  Map<String, dynamic>? usageFor(UsageFeatureType type) {
    for (final u in usage) {
      if (u['feature_type'] == type) return u;
    }
    return null;
  }

  /// Daily count limit: check AND consume (Premium → unlimited). A refused use is not counted.
  Future<UsageDecision> checkAndConsume(DailyFeature feature) async {
    final limit = dailyLimitFor(freeLimits, feature);
    final short = usageShortCut(isPremium: isPremium, userId: userId, limit: limit);
    if (short != null) return short;
    if (!flags.consume) {
      try {
        final res = await backend.rpc('usage_consume_v1', {'p_feature': feature, 'p_time_zone': deviceTimeZone()});
        final decided = res.error == null ? usageFromRpc(res.data, limit) : null;
        if (decided != null) {
          unawaited(refetchUsage?.call());
          return decided;
        }
        if (!isMissingRpc(res.error, res.status)) return usageOnError(limit);
        flags.consume = true;
      } catch (_) {
        return usageOnError(limit);
      }
    }
    final today = todayKey();
    try {
      final row = await backend.usageRow(userId!, feature, today);
      final used = (row?['usage_count'] as num?) ?? 0;
      final decision = usageFromLegacyCount(used, limit);
      if (!decision.allowed) return decision;
      if (row != null) {
        await backend.updateUsage('${row['id']}', {'usage_count': used + 1});
      } else {
        await backend.upsertUsage({'user_id': userId, 'feature_type': feature, 'usage_date': today, 'usage_count': 1});
      }
      return decision;
    } catch (_) {
      return usageOnError(limit);
    }
  }

  /// Remaining daily uses, read only (UI counters).
  Future<({double remaining, double limit})> peekRemainingDaily(DailyFeature feature) async {
    final limit = dailyLimitFor(freeLimits, feature);
    if (isPremium) return (remaining: double.infinity, limit: limit);
    if (userId == null) return (remaining: 0.0, limit: limit);
    try {
      final row = await backend.usageRow(userId!, feature, todayKey());
      final used = ((row?['usage_count'] as num?) ?? 0).toDouble();
      return (remaining: (limit - used) < 0 ? 0.0 : limit - used, limit: limit);
    } catch (_) {
      return (remaining: limit, limit: limit);
    }
  }

  ({bool allowed, double remainingSeconds}) canUseWhiteNoiseNow() =>
      canUseWhiteNoise(isPremium: isPremium, freeLimits: freeLimits, usedSeconds: (usageFor('white_noise')?['usage_seconds'] as num?) ?? 0);

  Future<({bool allowed, double remainingCount})> canUseBabyPhotoshootNow() async {
    if (isPremium) return (allowed: true, remainingCount: double.infinity);
    if (userId == null) return (allowed: false, remainingCount: 0.0);
    final total = await backend.countPhotos(userId!);
    return canUseBabyPhotoshoot(isPremium: false, userId: userId, freeLimits: freeLimits, totalPhotos: total);
  }

  Future<void> trackWhiteNoiseUsage(num seconds) async {
    if (userId == null || isPremium) return;
    if (!flags.seconds) {
      try {
        final res = await backend.rpc('usage_add_seconds_v1', {'p_seconds': seconds.round(), 'p_time_zone': deviceTimeZone()});
        if (res.error == null) {
          await refetchUsage?.call();
          return;
        }
        if (!isMissingRpc(res.error, res.status)) return;
        flags.seconds = true;
      } catch (_) {
        return;
      }
    }
    final existing = usageFor('white_noise');
    if (existing != null) {
      await backend.updateUsage('${existing['id']}', {'usage_seconds': ((existing['usage_seconds'] as num?) ?? 0) + seconds});
    } else {
      await backend.insertUsage({'user_id': userId, 'feature_type': 'white_noise', 'usage_date': todayKey(), 'usage_seconds': seconds});
    }
    await refetchUsage?.call();
  }
}

/// `useSubscription()` state.
class SubscriptionState {
  const SubscriptionState({
    this.subscription,
    this.isPremium = false,
    this.ownPremium = false,
    this.householdPremium = false,
    this.entitlementReady = false,
    this.entitlementError = false,
    this.loading = false,
    this.freeLimits = const {},
  });

  /// `subscriptions` row (display only).
  final Map<String, dynamic>? subscription;
  final bool isPremium;
  final bool ownPremium;
  final bool householdPremium;
  final bool entitlementReady;

  /// The latest entitlement check failed (offline/timeout) and no confirmed grant covers it.
  final bool entitlementError;
  final bool loading;
  final Map<String, Object?> freeLimits;

  bool get isCancelled => subscription?['status'] == 'cancelled';
  bool get cancelledButActive => isCancelled && ownPremium;

  /// `upgradeToPremium()` (legacy constant; real prices come from the store).
  ({bool showUpgradeModal, double monthlyPrice, double yearlyPrice}) upgradeToPremium() =>
      (showUpgradeModal: true, monthlyPrice: 3.99, yearlyPrice: 29.99);
}

final subscriptionBackendProvider = Provider<SubscriptionBackend>((ref) => SupabaseSubscriptionBackend(ref.watch(dbProvider)));

/// `freeLimits`: `{ ...DEFAULT_FREE_LIMITS, ...app_settings.free_limits }`.
final freeLimitsProvider = Provider<Map<String, Object?>>((ref) => mergeFreeLimits(ref.watch(appSettingProvider('free_limits'))));

final subscriptionRowQuery = queryProvider<Map<String, dynamic>?>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions<Map<String, dynamic>?>(
    queryKey: ['subscription', userId],
    enabled: userId != null,
    staleTime: const Duration(seconds: 30),
    retry: noRetry,
    queryFn: (_) async {
      final row = await ref.read(subscriptionBackendProvider).fetchSubscription(userId!);
      // A confirmed missing row also clears the previous offline display row.
      ref.read(offlineCacheProvider).writeCache(subscriptionCacheKey, userId, row);
      return row;
    },
  );
}, name: 'subscriptionRowQuery');

final subscriptionUsageQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final today = todayKey();
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['subscription-usage', userId, today],
    enabled: userId != null,
    staleTime: const Duration(seconds: 30),
    retry: noRetry,
    queryFn: (_) => ref.read(subscriptionBackendProvider).fetchUsage(userId!, today),
  );
}, name: 'subscriptionUsageQuery');

final householdPremiumQuery = queryProvider<bool>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final profile = ref.watch(authProfileProvider);
  final partner = profile != null && profile.userId == userId ? profile.linkedPartnerId : null;
  return QueryOptions<bool>(
    queryKey: ['household-premium', userId, partner],
    enabled: userId != null && partner != null,
    staleTime: const Duration(seconds: 30),
    retry: noRetry,
    queryFn: (_) async {
      final value = await ref.read(subscriptionBackendProvider).fetchHouseholdPremium();
      ref.read(offlineCacheProvider).writeCache('$householdPremiumCacheKey:$partner', userId!, value);
      return value;
    },
  );
}, name: 'householdPremiumQuery');

/// `useSubscription()`.
final subscriptionProvider = Provider<SubscriptionState>((ref) {
  final access = ref.watch(premiumEntitlementProvider);
  final userId = ref.watch(authUserProvider)?.id;
  final sub = ref.watch(subscriptionRowQuery);
  final usage = ref.watch(subscriptionUsageQuery);
  final household = ref.watch(householdPremiumQuery);
  // Query errors stay visible; reading offline data does not renew its cache lifetime.
  final row = sub.isError && userId != null ? ref.read(offlineCacheProvider).readCache<Map<String, dynamic>>(subscriptionCacheKey, userId) : sub.data;
  final loading = userId != null && (sub.isLoading || usage.isLoading || household.isLoading);
  return SubscriptionState(
    subscription: row,
    ownPremium: access.ownPremium,
    householdPremium: access.householdPremium,
    isPremium: access.isPremium,
    entitlementReady: access.ready,
    entitlementError: access.error,
    loading: loading || access.loading,
    freeLimits: ref.watch(freeLimitsProvider),
  );
}, name: 'subscriptionProvider');

/// The usage actions of `useSubscription()` for the current state.
final subscriptionUsageProvider = Provider<SubscriptionUsage>((ref) {
  final state = ref.watch(subscriptionProvider);
  return SubscriptionUsage(
    backend: ref.watch(subscriptionBackendProvider),
    userId: ref.watch(authUserProvider)?.id,
    isPremium: state.isPremium,
    freeLimits: state.freeLimits,
    usage: ref.watch(subscriptionUsageQuery).data ?? const [],
    refetchUsage: () async {
      await ref.read(subscriptionUsageQuery.notifier).refetch(cancelRefetch: false);
    },
  );
});

/// `refetch()`: subscription row, usage, entitlement and (when linked) household.
Future<void> refetchSubscription(WidgetRef ref) async {
  if (ref.read(authUserProvider) == null) return;
  await Future.wait<Object?>([
    ref.read(subscriptionRowQuery.notifier).refetch(cancelRefetch: false),
    ref.read(subscriptionUsageQuery.notifier).refetch(cancelRefetch: false),
    ref.read(premiumAccessQuery.notifier).refetch(cancelRefetch: false),
    ref.read(householdPremiumQuery.notifier).refetch(cancelRefetch: false),
  ]);
}

// ── useSubscriptionCancellation ──

/// 'too_expensive' | 'not_using_enough' | 'missing_features' | 'technical_issues' | 'found_alternative'
/// | 'temporary_break' | 'other'
typedef CancellationReasonCode = String;

/// `useSubmitCancellationReason().mutateAsync`: records the in-app reason (`cancel_flow: 'in_app'`, kept apart
/// from the store-reported reason the webhook writes).
Future<void> submitCancellationReason(
  SubscriptionBackend backend, {
  required String? userId,
  required CancellationReasonCode reasonCode,
  String? reasonText,
  String? planType,
  bool wasTrial = false,
}) async {
  if (userId == null) throw StateError('Not authenticated');
  final text = reasonText?.trim();
  await backend.insertCancellation({
    'user_id': userId,
    'reason_code': reasonCode,
    'reason_text': text == null || text.isEmpty ? null : text,
    'plan_type': planType == null || planType.isEmpty ? null : planType,
    'was_trial': wasTrial,
    'cancel_flow': 'in_app',
  });
}
