// Ported from: src/hooks/useBabyLogs.ts
//
// React kept server rows in component state and shared one realtime channel per user through a module-level
// ref-counted map. The Dart port puts the server rows in the query cache under
// `['baby-logs', userId, childId]` (never persisted: health data), so all widgets share one request, and keeps:
//   * the shared realtime channel `baby_logs_changes:<user>:<uuid>` → [_babyLogsRealtime] (an auto-dispose family:
//     reference counted exactly like `babyLogsSharedChannels`);
//   * the offline outbox (STABILITY_PHASE2): rows are written with `saveWithOutbox` (client uuid, persisted first);
//     queued rows are merged into the list as `pending` ([mergePendingBabyLogs]); a background flush that delivered
//     `baby_logs` refetches; `retainOutboxUser` while mounted → [_babyLogsOutbox].
//
// `const { logs, todayLogs, loading, getTodayStats, getFeedingHistory, getTodayFeedingBreakdown } = useBabyLogs()`
//   → `ref.watch(babyLogsProvider)` ([BabyLogsView]);
// `addLog / updateLog / deleteLog / refetch` → `ref.read(babyLogsActionsProvider)`.
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/offline/offline.dart';
import '../../../domain/js_compat.dart';
import '../data/baby_repository.dart';
import '../models/baby_log.dart';
import 'use_children.dart';

export '../models/baby_log.dart';

List<Object?> babyLogsKey(String? userId, String? childId) => ['baby-logs', userId, childId];

final _babyLogCodec = QueryCodecs.models<BabyLog>((l) => l.toRow(), BabyLog.fromRow);

/// Server rows of the last 7 days (selected child when there is one), newest first.
final babyLogsServerQuery = queryProvider<List<BabyLog>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final childId = ref.watch(selectedChildIdProvider);
  final repo = ref.watch(babyRepositoryProvider);
  return QueryOptions<List<BabyLog>>(
    queryKey: babyLogsKey(userId, childId),
    enabled: userId != null,
    // React refetched on every mount (useEffect) and on every realtime event.
    staleTime: Duration.zero,
    refetchOnWindowFocus: RefetchOn.never,
    retry: noRetry,
    meta: const {'persist': false},
    codec: _babyLogCodec,
    queryFn: (_) async {
      final now = DomainClock.now();
      final since = DateTime(now.year, now.month, now.day - 7, now.hour, now.minute, now.second, now.millisecond);
      final rows = await repo.loadRecentBabyLogs(userId!, childId, jsToIsoString(since));
      return [for (final r in rows) BabyLog.fromRow(r)];
    },
  );
}, name: 'babyLogsServerQuery');

/// Shared realtime channel per user (ref-counted by Riverpod): any change refetches every baby-logs query.
final _babyLogsRealtime = Provider.autoDispose.family<void, String>((ref, userId) {
  final client = ref.read(queryClientProvider);
  ref.read(babyRepositoryProvider).watchBabyLogs(ref, 'baby_logs_changes:$userId', userId, () {
    client.invalidateQueries(queryKey: ['baby-logs', userId]);
  });
}, name: '_babyLogsRealtime');

/// Outbox bridge per user: version bump on every queue change, refetch after a flush delivered `baby_logs`,
/// keeps the user's outbox flushing while mounted (`retainOutboxUser`).
final _babyLogsOutbox = NotifierProvider.autoDispose.family<_OutboxBridge, int, String>(_OutboxBridge.new);

class _OutboxBridge extends Notifier<int> {
  _OutboxBridge(this.userId);
  final String userId;

  @override
  int build() {
    final outbox = ref.watch(offlineOutboxProvider);
    final client = ref.read(queryClientProvider);
    final unsubscribe = outbox.subscribe((change) {
      if (change.userId != userId) return;
      if (ref.mounted) state = state + 1;
      if (change.sentTables.contains('baby_logs')) client.invalidateQueries(queryKey: ['baby-logs', userId]);
    });
    final release = outbox.retainUser(userId);
    ref.onDispose(() {
      unsubscribe();
      release();
    });
    return 0;
  }
}

/// `useBabyLogs()` state.
class BabyLogsView {
  BabyLogsView({required this.logs, required this.loading, DateTime? now}) : _now = now; // ignore: prefer_initializing_formals

  /// Server rows + queued rows (pending), newest first.
  final List<BabyLog> logs;
  final bool loading;
  final DateTime? _now;

  late final List<BabyLog> todayLogs = todayLogsOf(logs, _now);

  /// `getTodayStats()`.
  late final TodayStats todayStats = todayStatsOf(todayLogs);

  /// `getTodayFeedingBreakdown`.
  late final FeedingBreakdown todayFeedingBreakdown = feedingBreakdownOf(todayLogs);

  /// `getFeedingHistory(days)`.
  Map<String, List<FeedingHistoryItem>> feedingHistory([int days = 3]) => feedingHistoryOf(logs, days);
}

final babyLogsProvider = Provider.autoDispose<BabyLogsView>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final childId = ref.watch(selectedChildIdProvider);
  final server = ref.watch(babyLogsServerQuery);
  final serverLogs = server.data ?? const <BabyLog>[];
  if (userId == null) return BabyLogsView(logs: serverLogs, loading: false);
  ref.watch(_babyLogsRealtime(userId));
  ref.watch(_babyLogsOutbox(userId));
  final pendingRows = ref.read(offlineOutboxProvider).pendingRows(userId, 'baby_logs');
  return BabyLogsView(
    logs: mergePendingBabyLogs(serverLogs, pendingRows, userId, childId),
    loading: server.isLoading,
  );
}, name: 'babyLogsProvider');

/// `{ data, error, queued }` of `addLog`.
class AddLogResult {
  const AddLogResult({this.data, this.error, this.queued = false});
  final BabyLog? data;
  final Object? error;
  final bool queued;
}

const Object _unset = Object();

/// `addLog` / `updateLog` / `deleteLog` / `refetch`.
class BabyLogsActions {
  BabyLogsActions(this._ref);
  final Ref _ref;

  String? get _userId => _ref.read(authUserProvider)?.id;
  String? get _selectedChildId => selectedChildNow(_ref)?.id;
  QueryClient get _client => _ref.read(queryClientProvider);

  Future<void> refetch() => _client.refetchQueries(QueryFilters(queryKey: ['baby-logs', _userId]));

  /// [childId]: explicit `child_id` (widget stop, twins); omitted → the selected child.
  Future<AddLogResult> addLog({
    required String logType,
    String? startTime,
    String? endTime,
    String? feedType,
    String? diaperType,
    String? notes,
    Object? childId = _unset,
  }) async {
    final userId = _userId;
    if (userId == null) return const AddLogResult(error: 'No user logged in');
    final row = <String, Object?>{
      'log_type': logType,
      'end_time': ?endTime,
      'feed_type': ?feedType,
      'diaper_type': ?diaperType,
      'notes': ?notes,
      'user_id': userId,
      'child_id': identical(childId, _unset) ? _selectedChildId : childId as String?,
      'start_time': startTime ?? jsToIsoString(DomainClock.now()),
    };
    final outcome = await _ref.read(offlineOutboxProvider).saveWithOutbox(userId, 'baby_logs', row);
    switch (outcome.status) {
      case SaveStatus.error:
        debugPrint('Error adding baby log: ${outcome.error}');
        return AddLogResult(error: outcome.error ?? 'error');
      case SaveStatus.queued:
        return AddLogResult(data: BabyLog.fromRow(Map<String, dynamic>.from(outcome.data!), pending: true), queued: true);
      case SaveStatus.saved:
        final saved = BabyLog.fromRow(Map<String, dynamic>.from(outcome.data!));
        final key = babyLogsKey(userId, _selectedChildId);
        _client.setQueryData<List<BabyLog>>(key, (prev) => [saved, ...?prev?.where((l) => l.id != saved.id)]);
        await refetch();
        return AddLogResult(data: saved);
    }
  }

  Future<Object?> updateLog(String id, Map<String, Object?> updates) async {
    final userId = _userId;
    if (userId == null) return 'No user logged in';
    try {
      await _ref.read(babyRepositoryProvider).updateBabyLog(id, userId, updates);
      await refetch();
      return null;
    } catch (e) {
      debugPrint('Error updating baby log: $e');
      return e;
    }
  }

  Future<Object?> deleteLog(String id) async {
    final userId = _userId;
    if (userId == null) return 'No user logged in';
    try {
      await _ref.read(babyRepositoryProvider).deleteBabyLog(id, userId);
      await refetch();
      return null;
    } catch (e) {
      debugPrint('Error deleting baby log: $e');
      return e;
    }
  }
}

final babyLogsActionsProvider = Provider<BabyLogsActions>(BabyLogsActions.new);
