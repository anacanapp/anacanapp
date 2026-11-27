// Ported from: src/hooks/usePremiumEntitlement.ts (usePremiumEntitlement, PremiumEntitlementMonitor)
//
// Only the bounded, current server grant (`get_premium_access_v1`) authorizes paid access. One shared
// answer is reused for 60 s; fresh reads come from resume / reconnect (the monitor), realtime changes of
// `subscriptions` / `profiles`, explicit invalidation after purchase/restore/promo and a 10 min foreground
// poll. Between reads the confirmed grant (premium_grant_cache.dart) carries Premium, so the 31 s lease is
// not polled. A timeout or network error never revokes; an explicit inactive answer or the grant reaching
// its end does.

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/cache/cache.dart';
import '../../core/data/data.dart';
import '../../core/net/backend_providers.dart';
import '../../core/offline/connectivity.dart' show connectivitySourceProvider;
import '../../core/offline/offline_providers.dart' show appResumeEventsProvider;
import '../../state/persisted_store.dart';
import '../../state/white_noise_store.dart';
import 'premium_grant_cache.dart';
import 'purchase_errors.dart' show LabeledTimeoutException;

const String premiumAccessProtocol = 'anacan-premium-access-v1';

/// Queries refreshed by a realtime change (entitlement + content that renders Premium state).
const Set<String> entitlementRoots = {'premium-access-v1', 'subscription', 'household-premium'};
const Set<String> premiumRefreshRoots = {...entitlementRoots, 'community-feed', 'community-profile-card', 'stories', 'chat-authors-v2', 'banners'};
final Set<String> premiumContentRoots = premiumRefreshRoots.difference(entitlementRoots);

const Duration resumeCoalesce = Duration(milliseconds: 2000);
const Duration premiumAccessPoll = Duration(minutes: 10);

/// A hung request becomes an error instead of an endless spinner.
const Duration premiumAccessTimeout = Duration(milliseconds: 15000);

/// Wall clock and a monotonic clock (ms). In a session the grant ages monotonically, so moving the device
/// clock neither extends nor cuts it.
class PremiumClock {
  PremiumClock({int Function()? wall, double Function()? mono})
      : wall = wall ?? (() => DateTime.now().millisecondsSinceEpoch),
        mono = mono ?? _defaultMono;
  final int Function() wall;
  final double Function() mono;

  static final Stopwatch _watch = Stopwatch()..start();
  static double _defaultMono() => _watch.elapsedMicroseconds / 1000;
}

class PremiumGrantView {
  const PremiumGrantView({required this.active, this.expiresAt, this.source});
  final bool active;
  final String? expiresAt;
  final String? source;
}

/// A validated `get_premium_access_v1` answer, its record, and the monotonic time it was received.
class PremiumAccessResult {
  const PremiumAccessResult({required this.userId, required this.own, required this.household, required this.checkedAt, required this.validUntil, required this.record, required this.monoAt});
  final String userId;
  final PremiumGrantView own;
  final PremiumGrantView household;
  final String checkedAt;
  final String validUntil;
  final PremiumGrantRecord record;
  final double monoAt;
}

double _parse(Object? v) => v is String ? (DateTime.tryParse(v)?.millisecondsSinceEpoch.toDouble() ?? double.nan) : double.nan;

/// Validates the protocol, account and lease; throws `PREMIUM_ACCESS_INVALID` / `PREMIUM_LEASE_INVALID`.
({PremiumGrantView own, PremiumGrantView household, String checkedAt, String validUntil}) validatePremiumAccess(Object? data, String actor) {
  final own = data is Map ? data['own'] : null, household = data is Map ? data['household'] : null;
  if (data is! Map ||
      data['protocol'] != premiumAccessProtocol ||
      data['userId'] != actor ||
      own is! Map ||
      own['active'] is! bool ||
      household is! Map ||
      household['active'] is! bool) {
    throw const LabeledTimeoutException('PREMIUM_ACCESS_INVALID');
  }
  final checked = _parse(data['checkedAt']), lease = _parse(data['validUntil']);
  if (!checked.isFinite || !lease.isFinite || lease <= checked || lease - checked > 31000) {
    throw const LabeledTimeoutException('PREMIUM_LEASE_INVALID');
  }
  PremiumGrantView view(Map g) => PremiumGrantView(active: g['active'] as bool, expiresAt: g['expiresAt'] as String?, source: g['source'] as String?);
  return (own: view(own), household: view(household), checkedAt: data['checkedAt'] as String, validUntil: data['validUntil'] as String);
}

/// The query function: rpc (15 s bound) → validation → record written (an explicit inactive answer removes
/// any earlier offline grant at once).
Future<PremiumAccessResult> fetchPremiumAccess({
  required Future<Object?> Function(String actor) rpc,
  required String backend,
  required String actor,
  required String? partner,
  required GrantStorage storage,
  required PremiumClock clock,
}) async {
  final data = await rpc(actor).timeout(premiumAccessTimeout, onTimeout: () => throw const LabeledTimeoutException('PREMIUM_ACCESS_TIMEOUT'));
  final access = validatePremiumAccess(data, actor);
  ServerGrant grant(PremiumGrantView g) => ServerGrant(active: g.active, expiresAt: g.expiresAt, source: g.source);
  final record = recordFromServer(
    backend: backend,
    userId: actor,
    partner: partner,
    checkedAt: access.checkedAt,
    own: grant(access.own),
    household: grant(access.household),
    now: clock.wall(),
  );
  writeGrantRecord(storage, record);
  return PremiumAccessResult(
    userId: actor,
    own: access.own,
    household: access.household,
    checkedAt: access.checkedAt,
    validUntil: access.validUntil,
    record: record,
    monoAt: clock.mono(),
  );
}

class PremiumEntitlement {
  const PremiumEntitlement({
    this.ownPremium = false,
    this.householdPremium = false,
    this.ready = false,
    this.loading = false,
    this.error = false,
    this.revoked = false,
    this.ownSource,
    this.nextChangeInMs,
  });

  final bool ownPremium;
  final bool householdPremium;
  bool get isPremium => ownPremium || householdPremium;

  /// Entitlement known (an answer arrived, or a confirmed grant covers it).
  final bool ready;
  final bool loading;

  /// The latest request failed (offline/timeout); Premium then rests on the confirmed grant.
  final bool error;

  /// Explicit server revocation or the confirmed grant reaching its end.
  final bool revoked;
  final String? ownSource;

  /// Milliseconds until the grant changes on its own (expiry / 72 h cap), for a re-evaluation timer.
  final double? nextChangeInMs;
}

/// The hook body after the query: memory answer (monotonic) or stored record (wall clock).
PremiumEntitlement evaluatePremiumEntitlement({
  required String? actor,
  required String backend,
  required String? partner,
  required PremiumAccessResult? data,
  required bool isSuccess,
  required bool isError,
  required bool isLoading,
  required GrantStorage storage,
  required PremiumClock clock,
}) {
  final stored = actor != null ? readGrantRecord(storage, backend, actor) : null;
  final memory = data != null && data.userId == actor ? data : null;
  final record = memory != null ? memory.record : stored;
  final now = memory != null ? memory.record.confirmedAt + (clock.mono() - memory.monoAt) : clock.wall().toDouble();
  final grant = evaluateGrant(record, backend: backend, userId: actor, partner: partner, now: now);
  final has = actor != null;
  final own = has && grant.own, household = has && grant.household;
  final premium = own || household;
  return PremiumEntitlement(
    ownPremium: own,
    householdPremium: household,
    ready: has && (isSuccess || premium),
    loading: has && isLoading && !premium,
    error: has && isError,
    revoked: has && !premium && (isSuccess || grant.hadGrant),
    ownSource: own ? record?.ownSource : null,
    nextChangeInMs: grant.nextChange == null ? null : grant.nextChange! - now,
  );
}

// ── Riverpod wiring ──

/// `supabase.rpc('get_premium_access_v1', { p_user_id })` → data (throws on `{error}`).
final premiumAccessRpcProvider = Provider<Future<Object?> Function(String actor)>((ref) {
  return (actor) => ref.read(dbProvider).rpc<Object?>('get_premium_access_v1', params: {'p_user_id': actor});
});

final premiumGrantStorageProvider = Provider<GrantStorage>((ref) => LocalStoreGrantStorage(ref.watch(localStoreProvider)));

final premiumClockProvider = Provider<PremiumClock>((ref) => PremiumClock());

QueryOptions<PremiumAccessResult> _accessOptions(Ref ref, {required bool monitor}) {
  final inputs = ref.watch(premiumEntitlementInputsProvider);
  final actor = inputs.actor;
  return QueryOptions<PremiumAccessResult>(
    queryKey: inputs.queryKey,
    enabled: actor != null,
    staleTime: const Duration(seconds: 60),
    gcTime: const Duration(minutes: 5),
    retry: noRetry,
    refetchOnMount: RefetchOn.ifStale,
    refetchOnWindowFocus: RefetchOn.ifStale,
    refetchOnReconnect: RefetchOn.ifStale,
    refetchInterval: monitor ? premiumAccessPoll : null,
    meta: const {'persist': false},
    queryFn: (_) => fetchPremiumAccess(
      rpc: ref.read(premiumAccessRpcProvider),
      backend: inputs.backend,
      actor: actor!,
      partner: inputs.partner,
      storage: ref.read(premiumGrantStorageProvider),
      clock: ref.read(premiumClockProvider),
    ),
  );
}

/// `usePremiumEntitlement()`'s shared query.
final premiumAccessQuery = queryProvider<PremiumAccessResult>((ref) => _accessOptions(ref, monitor: false), name: 'premiumAccessQuery');

/// The monitor's observer of the same query (10 min foreground poll).
final premiumAccessMonitorQuery = queryProvider<PremiumAccessResult>((ref) => _accessOptions(ref, monitor: true), name: 'premiumAccessMonitorQuery');

/// `usePremiumEntitlement()`: re-evaluated when the grant changes on its own (exact expiry, 72 h cap).
final premiumEntitlementProvider = Provider<PremiumEntitlement>((ref) {
  final inputs = ref.watch(premiumEntitlementInputsProvider);
  final q = ref.watch(premiumAccessQuery);
  final view = evaluatePremiumEntitlement(
    actor: inputs.actor,
    backend: inputs.backend,
    partner: inputs.partner,
    data: q.data,
    isSuccess: q.isSuccess,
    isError: q.isError,
    isLoading: q.isLoading,
    storage: ref.watch(premiumGrantStorageProvider),
    clock: ref.watch(premiumClockProvider),
  );
  final next = view.nextChangeInMs;
  if (next != null) {
    final ms = (next + 1).clamp(1, 2147483647).toInt();
    final timer = Timer(Duration(milliseconds: ms), ref.invalidateSelf);
    ref.onDispose(timer.cancel);
  }
  return view;
}, name: 'premiumEntitlementProvider');

/// `refresh()` of the hook.
Future<void> refreshPremiumAccess(WidgetRef ref) => ref.read(premiumAccessQuery.notifier).refetch(cancelRefetch: false);

/// `PremiumEntitlementMonitor` (App.tsx): polls, re-reads on resume / reconnect (coalesced 2 s), subscribes to
/// realtime `subscriptions` / `profiles` changes, refreshes Premium-rendering content when the resolved status
/// changes, and stops global white-noise playback on expiry or explicit revocation.
class PremiumEntitlementMonitor extends ConsumerStatefulWidget {
  const PremiumEntitlementMonitor({super.key, this.child = const SizedBox.shrink()});
  final Widget child;
  @override
  ConsumerState<PremiumEntitlementMonitor> createState() => _PremiumEntitlementMonitorState();
}

/// Realtime channel of the monitor (removed when the actor changes / the monitor goes away).
final premiumRealtimeProvider = Provider.autoDispose<void>((ref) {
  final actor = ref.watch(premiumEntitlementInputsProvider.select((i) => i.actor));
  if (actor == null) return;
  final client = ref.watch(supabaseClientProvider);
  final queries = ref.read(queryClientProvider);
  void refresh(Object? _) =>
      unawaited(queries.invalidateQueries(predicate: (q) => q.queryKey.isNotEmpty && premiumRefreshRoots.contains('${q.queryKey.first}')));
  subscribePostgresChanges(ref, client, channelPrefix: 'premium-access:$actor', table: 'subscriptions', filter: 'user_id=eq.$actor', onChange: refresh);
  subscribePostgresChanges(ref, client, channelPrefix: 'premium-access:$actor:profiles', table: 'profiles', filter: 'user_id=eq.$actor', onChange: refresh);
});

class _PremiumEntitlementMonitorState extends ConsumerState<PremiumEntitlementMonitor> {
  StreamSubscription<void>? _resume;
  StreamSubscription<bool>? _online;
  double _lastResume = double.negativeInfinity;
  ({String key, bool premium})? _last;

  void _resumed() {
    final now = PremiumClock._defaultMono();
    if (now - _lastResume < resumeCoalesce.inMilliseconds) return;
    _lastResume = now;
    unawaited(ref
        .read(queryClientProvider)
        .invalidateQueries(predicate: (q) => q.queryKey.isNotEmpty && entitlementRoots.contains('${q.queryKey.first}')));
  }

  @override
  void initState() {
    super.initState();
    _resume = ref.read(appResumeEventsProvider).listen((_) => _resumed());
    try {
      _online = ref.read(connectivitySourceProvider).onlineChanges.listen((online) {
        if (online) _resumed();
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    unawaited(_resume?.cancel());
    unawaited(_online?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(premiumAccessMonitorQuery);
    try {
      ref.watch(premiumRealtimeProvider);
    } catch (_) {
      // backend not open yet (tests / startup)
    }
    final inputs = ref.watch(premiumEntitlementInputsProvider);
    final view = ref.watch(premiumEntitlementProvider);
    final q = ref.watch(premiumAccessQuery);
    final resolved = inputs.actor != null && q.isSuccess;
    if (resolved) {
      final key = '${inputs.backend}:${inputs.actor}', previous = _last;
      _last = (key: key, premium: view.isPremium);
      if (previous != null && previous.key == key && previous.premium != view.isPremium) {
        final queries = ref.read(queryClientProvider);
        scheduleMicrotask(() => unawaited(
            queries.invalidateQueries(predicate: (q) => q.queryKey.isNotEmpty && premiumContentRoots.contains('${q.queryKey.first}'))));
      }
    }
    final playing = ref.watch(whiteNoiseStoreProvider.select((s) => s.isPlaying));
    if (view.revoked && playing) {
      scheduleMicrotask(() {
        if (mounted) ref.read(whiteNoiseStoreProvider.notifier).stop();
      });
    }
    return widget.child;
  }
}
