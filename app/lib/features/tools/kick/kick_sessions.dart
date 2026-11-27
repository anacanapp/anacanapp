// Ported from: src/hooks/useKickSessions.ts
//
// Server rows live in the query cache under `['kick-sessions', userId]` (never persisted: health data); the realtime
// channel `kick_sessions_changes:<uuid>` refetches; the offline outbox (STABILITY_PHASE2) keeps every new session
// until the server confirms it (`saveWithOutbox`), queued rows show as `pending`, and a background flush that
// delivered `kick_sessions` refetches.
//
// `const { sessions, todaySessions, loading, getTodayStats } = useKickSessions()` → `ref.watch(kickSessionsProvider)`;
// `addSession` → `ref.read(kickSessionsActionsProvider).addSession(...)`.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show SupabaseClient;

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/realtime.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/net/backend_providers.dart';
import '../../../core/offline/offline.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../pregnancy_common/pregnancy_ports.dart';
import 'kick_session.dart';

@immutable
class KickSession {
  const KickSession({
    required this.id,
    required this.userId,
    required this.kickCount,
    required this.durationSeconds,
    required this.sessionDate,
    required this.createdAt,
    this.position,
    this.pending = false,
  });

  final String id;
  final String userId;
  final int kickCount;
  final int durationSeconds;
  final String sessionDate;
  final String createdAt;

  /// Optional side label for multiples ('left' / 'right'); a position, not an identity.
  final String? position;

  /// True while the session only exists in the offline outbox.
  final bool pending;

  factory KickSession.fromRow(Map<String, dynamic> r, {bool pending = false}) => KickSession(
        id: '${r['id'] ?? ''}',
        userId: '${r['user_id'] ?? ''}',
        kickCount: (r['kick_count'] as num?)?.toInt() ?? 0,
        durationSeconds: (r['duration_seconds'] as num?)?.toInt() ?? 0,
        sessionDate: '${r['session_date'] ?? ''}',
        createdAt: '${r['created_at'] ?? ''}',
        position: r['position'] is String ? r['position'] as String : null,
        pending: pending,
      );

  Map<String, dynamic> toRow() => {
        'id': id,
        'user_id': userId,
        'kick_count': kickCount,
        'duration_seconds': durationSeconds,
        'session_date': sessionDate,
        'created_at': createdAt,
        'position': position,
      };

  String get dayKey => kickSessionDayKey(createdAt: createdAt, sessionDate: sessionDate);
}

/// Server sessions plus queued ones (marked pending), newest first; server rows win on the same id.
List<KickSession> mergePendingKickSessions(List<KickSession> server, List<Map<String, Object?>> pendingRows, String userId) {
  final known = {for (final s in server) s.id};
  final pending = [
    for (final row in pendingRows)
      if (row['id'] is String && !known.contains(row['id']) && row['user_id'] == userId)
        KickSession.fromRow({...row, 'created_at': row['created_at'] ?? jsToIsoString(DomainClock.now())}, pending: true),
  ];
  if (pending.isEmpty) return server;
  return jsSorted([...pending, ...server], (KickSession a, KickSession b) => b.createdAt.compareTo(a.createdAt));
}

/// `{ status: 'saved' | 'queued' | 'error' }` of `addSession`.
@immutable
class AddKickSessionResult {
  const AddKickSessionResult(this.status, {this.data, this.error});
  final SaveStatus status;
  final KickSession? data;
  final Object? error;
}

/// The reads of useKickSessions (tests override [kickRepositoryProvider]).
abstract interface class KickRepository {
  /// `select('*').eq('user_id').order('created_at', desc).limit(50)`.
  Future<List<Map<String, dynamic>>> loadSessions(String userId);

  /// `postgres_changes` on kick_sessions filtered to the user; removed when [ref] is disposed.
  void watch(Ref ref, String userId, void Function() onChange);
}

class SupabaseKickRepository implements KickRepository {
  SupabaseKickRepository(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<List<Map<String, dynamic>>> loadSessions(String userId) async {
    final data = await _client().from('kick_sessions').select().eq('user_id', userId).order('created_at', ascending: false).limit(50);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  void watch(Ref ref, String userId, void Function() onChange) {
    subscribePostgresChanges(ref, _client(),
        channelPrefix: 'kick_sessions_changes', table: 'kick_sessions', filter: 'user_id=eq.$userId', onChange: (_) => onChange());
  }
}

final kickRepositoryProvider = Provider<KickRepository>((ref) => SupabaseKickRepository(() => ref.read(supabaseClientProvider)));

List<Object?> kickSessionsKey(String? userId) => ['kick-sessions', userId];

final kickSessionsServerQuery = queryProvider<List<KickSession>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final repo = ref.watch(kickRepositoryProvider);
  return QueryOptions<List<KickSession>>(
    queryKey: kickSessionsKey(userId),
    enabled: userId != null,
    staleTime: Duration.zero,
    refetchOnWindowFocus: RefetchOn.never,
    retry: noRetry,
    meta: const {'persist': false},
    codec: QueryCodecs.models<KickSession>((s) => s.toRow(), KickSession.fromRow),
    queryFn: (_) async {
      try {
        return [for (final r in await repo.loadSessions(userId!)) KickSession.fromRow(r)];
      } catch (e) {
        debugPrint('Error fetching kick sessions: $e');
        rethrow;
      }
    },
  );
}, name: 'kickSessionsServerQuery');

final _kickRealtime = Provider.autoDispose.family<void, String>((ref, userId) {
  final client = ref.read(queryClientProvider);
  ref.read(kickRepositoryProvider).watch(ref, userId, () => client.invalidateQueries(queryKey: kickSessionsKey(userId)));
}, name: '_kickRealtime');

final _kickOutbox = NotifierProvider.autoDispose.family<_KickOutboxBridge, int, String>(_KickOutboxBridge.new);

class _KickOutboxBridge extends Notifier<int> {
  _KickOutboxBridge(this.userId);
  final String userId;

  @override
  int build() {
    final outbox = ref.watch(offlineOutboxProvider);
    final client = ref.read(queryClientProvider);
    final unsubscribe = outbox.subscribe((change) {
      if (change.userId != userId) return;
      if (ref.mounted) state = state + 1;
      if (change.sentTables.contains('kick_sessions')) unawaited(client.invalidateQueries(queryKey: kickSessionsKey(userId)));
    });
    final release = outbox.retainUser(userId);
    ref.onDispose(() {
      unsubscribe();
      release();
    });
    return 0;
  }
}

@immutable
class KickTodayStats {
  const KickTodayStats({required this.totalKicks, required this.totalDuration, required this.sessionCount});
  final int totalKicks;
  final int totalDuration;
  final int sessionCount;
}

class KickSessionsView {
  KickSessionsView({required this.sessions, required this.loading});
  final List<KickSession> sessions;
  final bool loading;

  /// Today's sessions by the phone's local calendar day.
  late final List<KickSession> todaySessions = () {
    final today = todayKey();
    return sessions.where((s) => s.dayKey == today).toList();
  }();

  /// `getTodayStats()`.
  KickTodayStats get todayStats => KickTodayStats(
        totalKicks: todaySessions.fold(0, (sum, s) => sum + s.kickCount),
        totalDuration: todaySessions.fold(0, (sum, s) => sum + s.durationSeconds),
        sessionCount: todaySessions.length,
      );
}

final kickSessionsProvider = Provider.autoDispose<KickSessionsView>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final server = ref.watch(kickSessionsServerQuery);
  final serverRows = server.data ?? const <KickSession>[];
  if (userId == null) return KickSessionsView(sessions: serverRows, loading: server.isLoading);
  ref.watch(_kickRealtime(userId));
  ref.watch(_kickOutbox(userId));
  final pending = ref.read(offlineOutboxProvider).pendingRows(userId, 'kick_sessions');
  return KickSessionsView(sessions: mergePendingKickSessions(serverRows, pending, userId), loading: server.isLoading && server.data == null);
}, name: 'kickSessionsProvider');

/// Toast sink of the hook (`useToast().toast`).
typedef KickToast = void Function({required String title, String? description, bool destructive});

/// The partner "10 kicks" alert goes out once per local day; remembered across screen visits.
const String kickTenNotifiedKey = 'anacan_kick_ten_notified_day';

class KickSessionsActions {
  KickSessionsActions(this._ref);
  final Ref _ref;

  /// `notifiedForTenKicks` ref + its midnight reset (kept per local day).
  String? _notifiedDay;

  LocalStore get _store => _ref.read(localStoreProvider);

  /// Saves ONE finished session ('saved' confirmed, 'queued' in the outbox, 'error' real rejection: the caller keeps
  /// its state). [quiet] suppresses only the success toast.
  Future<AddKickSessionResult?> addSession(
    int kickCount,
    int durationSeconds, {
    String? position,
    int? startedAt,
    bool quiet = false,
    required KickToast toast,
  }) async {
    final userId = _ref.read(authUserProvider)?.id;
    if (userId == null) return null;
    final sessionDay = localDateKey(startedAt != null ? DateTime.fromMillisecondsSinceEpoch(startedAt) : DomainClock.now());
    final outcome = await _ref.read(offlineOutboxProvider).saveWithOutbox(userId, 'kick_sessions', {
      'user_id': userId,
      'kick_count': kickCount,
      'duration_seconds': durationSeconds,
      'session_date': sessionDay,
      // The day grouping reads created_at, so a late (queued) upload keeps the real time.
      'created_at': jsToIsoString(DomainClock.now()),
      'position': ?position,
    });

    switch (outcome.status) {
      case SaveStatus.error:
        debugPrint('Error adding kick session: ${outcome.error}');
        final failed = saveFailedToast();
        final message = _errorMessage(outcome.error);
        toast(title: failed.title, description: message ?? failed.description, destructive: true);
        return AddKickSessionResult(SaveStatus.error, error: outcome.error);
      case SaveStatus.queued:
        toast(title: queuedToast().title);
        return AddKickSessionResult(SaveStatus.queued, data: KickSession.fromRow(Map<String, dynamic>.from(outcome.data!), pending: true));
      case SaveStatus.saved:
        break;
    }

    final data = KickSession.fromRow(Map<String, dynamic>.from(outcome.data!));
    final client = _ref.read(queryClientProvider);
    final before = mergePendingKickSessions(client.getQueryData<List<KickSession>>(kickSessionsKey(userId)) ?? const [],
        _ref.read(offlineOutboxProvider).pendingRows(userId, 'kick_sessions'), userId);
    client.setQueryData<List<KickSession>>(kickSessionsKey(userId), (prev) => [data, ...?prev?.where((s) => s.id != data.id)]);
    if (!quiet) {
      toast(
        title: tr('usekicksessions_sessiya_yadda_saxlandi_241831', 'Sessiya yadda saxlandı! 👶'),
        description: '$kickCount ${tr('usekicksessions_tepik', 'təpik')}, ${durationSeconds ~/ 60} ${tr('usekicksessions_deqiqe', 'dəqiqə')}',
      );
    }

    try {
      // Total kicks today (local day) including the new session; the new row's id is excluded in case realtime
      // already merged it.
      final today = todayKey();
      final todayTotal = before.where((s) => s.id != data.id && s.dayKey == today).fold<int>(0, (sum, s) => sum + s.kickCount) +
          (sessionDay == today ? kickCount : 0);
      String? stored;
      try {
        stored = _store.getItem(kickTenNotifiedKey);
      } catch (_) {}
      if (todayTotal >= 10 && _notifiedDay != today && stored != today) {
        _notifiedDay = today;
        try {
          _store.setItem(kickTenNotifiedKey, today);
        } catch (_) {}
        await _ref.read(pregnancyPartnerNotificationsProvider).notifyKickSession(todayTotal, durationSeconds);
      }
    } catch (e) {
      debugPrint('Kick partner notification failed: $e');
    }

    await client.refetchQueries(QueryFilters(queryKey: kickSessionsKey(userId)));
    return AddKickSessionResult(SaveStatus.saved, data: data);
  }

  static String? _errorMessage(Object? error) {
    if (error is Map && error['message'] is String && (error['message'] as String).isNotEmpty) return error['message'] as String;
    try {
      final dynamic d = error;
      final m = d.message;
      if (m is String && m.isNotEmpty) return m;
    } catch (_) {}
    return null;
  }
}

final kickSessionsActionsProvider = Provider<KickSessionsActions>(KickSessionsActions.new);
