// Ported from: src/hooks/useContractions.ts
//
// Device storage per user (same keys and JSON as the WebView localStorage): the offline queue
// `anacan_contraction_queue_v1:<uid>` and the timer state `anacan_contraction_timer_v1:<uid|anon>`. A contraction is
// queued on the device first, then inserted; when the insert fails or the device is offline it stays queued, shows in
// the list (`pending`) and syncs on the next load / `online` event. The client id makes a retry idempotent (23505).
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, SupabaseClient;

import '../../../core/auth/auth_providers.dart';
import '../../../core/data/realtime.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/net/backend_providers.dart';
import '../../../core/offline/offline.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/labor/labor_utils.dart';
import '../../../state/local_store.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../pregnancy_common/pregnancy_ports.dart';

const String _queuePrefix = 'anacan_contraction_queue_v1';
const String _timerPrefix = 'anacan_contraction_timer_v1';

List<QueuedContraction> readContractionQueue(LocalStore store, String uid) {
  try {
    return parseQueue(store.getItem('$_queuePrefix:$uid'));
  } catch (_) {
    return [];
  }
}

void writeContractionQueue(LocalStore store, String uid, List<QueuedContraction> queue) {
  try {
    if (queue.isNotEmpty) {
      store.setItem('$_queuePrefix:$uid', jsonEncode([for (final q in queue) q.toJson()]));
    } else {
      store.removeItem('$_queuePrefix:$uid');
    }
  } catch (_) {
    // storage blocked
  }
}

@immutable
class ContractionTimerState {
  const ContractionTimerState({this.activeStart, this.lastStart, this.lastEnd});

  /// Epoch ms of the running contraction's start, or null when idle.
  final int? activeStart;

  /// Epoch ms of the previous contraction's start and end.
  final int? lastStart;
  final int? lastEnd;

  static const ContractionTimerState empty = ContractionTimerState();

  Map<String, Object?> toJson() => {'activeStart': activeStart, 'lastStart': lastStart, 'lastEnd': lastEnd};

  @override
  bool operator ==(Object other) =>
      other is ContractionTimerState && other.activeStart == activeStart && other.lastStart == lastStart && other.lastEnd == lastEnd;
  @override
  int get hashCode => Object.hash(activeStart, lastStart, lastEnd);
}

int? _finiteOrNull(Object? v) => v is num && v.isFinite ? v.toInt() : null;

String _timerKey(String? uid) => '$_timerPrefix:${uid == null || uid.isEmpty ? 'anon' : uid}';

ContractionTimerState loadContractionTimerState(LocalStore store, String? uid) {
  try {
    final raw = store.getItem(_timerKey(uid));
    if (raw == null || raw.isEmpty) return ContractionTimerState.empty;
    final v = jsonDecode(raw);
    final m = v is Map ? v : const {};
    var active = _finiteOrNull(m['activeStart']);
    // A contraction "running" for over 30 minutes is a forgotten timer.
    if (active != null && DomainClock.nowMs() - active > 30 * 60 * 1000) active = null;
    return ContractionTimerState(activeStart: active, lastStart: _finiteOrNull(m['lastStart']), lastEnd: _finiteOrNull(m['lastEnd']));
  } catch (_) {
    return ContractionTimerState.empty;
  }
}

void saveContractionTimerState(LocalStore store, String? uid, ContractionTimerState state) {
  try {
    store.setItem(_timerKey(uid), jsonEncode(state.toJson()));
  } catch (_) {
    // storage blocked
  }
}

@immutable
class Contraction {
  const Contraction({
    required this.id,
    required this.userId,
    required this.startTime,
    required this.durationSeconds,
    required this.intervalSeconds,
    required this.createdAt,
    this.pending = false,
  });

  final String id;
  final String userId;
  final String startTime;
  final num durationSeconds;

  /// Start-to-start seconds for new rows (older rows stored end-to-start rest).
  final num? intervalSeconds;
  final String createdAt;

  /// Saved on this device only, waiting to sync.
  final bool pending;

  factory Contraction.fromRow(Map<String, dynamic> r) => Contraction(
        id: '${r['id'] ?? ''}',
        userId: '${r['user_id'] ?? ''}',
        startTime: '${r['start_time'] ?? ''}',
        durationSeconds: (r['duration_seconds'] as num?) ?? 0,
        intervalSeconds: r['interval_seconds'] as num?,
        createdAt: '${r['created_at'] ?? ''}',
      );
}

abstract interface class ContractionsRepository {
  /// `select('*').eq('user_id').order('start_time', desc).limit(100)`.
  Future<List<Map<String, dynamic>>> load(String userId);

  /// `insert({...entry, user_id})` (+ `.select().single()` when [returnRow]). Returns the error (null = ok) and the row.
  Future<({Object? error, Map<String, dynamic>? row})> insert(Map<String, Object?> row, {bool returnRow = false});

  /// `delete().eq('user_id')`; throws on error.
  Future<void> deleteAll(String userId);

  void watch(Ref ref, String userId, void Function() onChange);
}

class SupabaseContractionsRepository implements ContractionsRepository {
  SupabaseContractionsRepository(this._client);
  final SupabaseClient Function() _client;

  @override
  Future<List<Map<String, dynamic>>> load(String userId) async {
    final data = await _client().from('contractions').select().eq('user_id', userId).order('start_time', ascending: false).limit(100);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<({Object? error, Map<String, dynamic>? row})> insert(Map<String, Object?> row, {bool returnRow = false}) async {
    try {
      if (returnRow) {
        final data = await _client().from('contractions').insert(row).select().single();
        return (error: null, row: Map<String, dynamic>.from(data));
      }
      await _client().from('contractions').insert(row);
      return (error: null, row: null);
    } catch (e) {
      return (error: e, row: null);
    }
  }

  @override
  Future<void> deleteAll(String userId) => _client().from('contractions').delete().eq('user_id', userId);

  @override
  void watch(Ref ref, String userId, void Function() onChange) {
    subscribePostgresChanges(ref, _client(),
        channelPrefix: 'contractions_changes', table: 'contractions', filter: 'user_id=eq.$userId', onChange: (_) => onChange());
  }
}

final contractionsRepositoryProvider =
    Provider<ContractionsRepository>((ref) => SupabaseContractionsRepository(() => ref.read(supabaseClientProvider)));

bool _isDuplicateKey(Object? error) {
  if (error is PostgrestException) return error.code == '23505';
  if (error is Map) return error['code'] == '23505';
  return false;
}

@immutable
class ContractionsState {
  const ContractionsState({this.serverRows = const [], this.queue = const [], this.loading = true});
  final List<Contraction> serverRows;
  final List<QueuedContraction> queue;
  final bool loading;

  ContractionsState copyWith({List<Contraction>? serverRows, List<QueuedContraction>? queue, bool? loading}) =>
      ContractionsState(serverRows: serverRows ?? this.serverRows, queue: queue ?? this.queue, loading: loading ?? this.loading);
}

/// Toast sink of the hook (`useToast().toast`).
typedef ContractionToast = void Function({required String title, String? description, bool destructive});

class ContractionsController extends Notifier<ContractionsState> {
  bool _has511Notified = false;
  bool _syncing = false;

  String? get _uid => ref.read(authUserProvider)?.id;
  LocalStore get _store => ref.read(localStoreProvider);
  ContractionsRepository get _repo => ref.read(contractionsRepositoryProvider);

  @override
  ContractionsState build() {
    final uid = ref.watch(authUserProvider)?.id;
    if (uid == null) return const ContractionsState();
    final connectivity = ref.watch(connectivitySourceProvider);
    final sub = connectivity.onlineChanges.listen((online) {
      if (online) unawaited(syncQueue());
    });
    ref.onDispose(sub.cancel);
    ref.read(contractionsRepositoryProvider).watch(ref, uid, () => unawaited(fetch()));
    Future.microtask(() async {
      if (!ref.mounted) return;
      await fetch();
      await syncQueue();
    });
    return ContractionsState(queue: readContractionQueue(ref.read(localStoreProvider), uid));
  }

  List<QueuedContraction> _updateQueue(String uid, List<QueuedContraction> Function(List<QueuedContraction> q) update) {
    final next = update(readContractionQueue(_store, uid));
    writeContractionQueue(_store, uid, next);
    if (ref.mounted) state = state.copyWith(queue: next);
    return next;
  }

  Future<void> fetch() async {
    final uid = _uid;
    if (uid == null) return;
    try {
      final rows = [for (final r in await _repo.load(uid)) Contraction.fromRow(r)];
      if (!ref.mounted) return;
      state = state.copyWith(serverRows: rows);
      // Anything already on the server leaves the local queue.
      _updateQueue(uid, (q) => pruneQueue(q, [for (final r in rows) (id: r.id, startTime: r.startTime)]));
    } catch (e) {
      debugPrint('Error fetching contractions: $e');
    } finally {
      if (ref.mounted) state = state.copyWith(loading: false);
    }
  }

  bool get _online => ref.read(connectivitySourceProvider).isOnline;

  /// Sends queued entries; the client id makes a retry idempotent.
  Future<void> syncQueue() async {
    final uid = _uid;
    if (uid == null || _syncing || !_online) return;
    final pending = readContractionQueue(_store, uid);
    if (pending.isEmpty) return;
    _syncing = true;
    try {
      for (final entry in pending) {
        final res = await _repo.insert({...entry.toJson(), 'user_id': uid});
        if (res.error != null && !_isDuplicateKey(res.error)) break; // still offline / failing
        _updateQueue(uid, (q) => q.where((x) => x.id != entry.id).toList());
      }
    } finally {
      _syncing = false;
    }
    await fetch();
  }

  /// Saves one contraction (queued on the device first, then inserted).
  Future<Object?> addContraction(int durationSeconds, num? intervalSeconds, {int? startedAt, required ContractionToast toast}) async {
    final uid = _uid;
    if (uid == null) return null;
    final start = startedAt ?? DomainClock.nowMs() - durationSeconds * 1000;
    final entry = QueuedContraction(
      id: newClientId(),
      startTime: jsToIsoString(DateTime.fromMillisecondsSinceEpoch(start)),
      durationSeconds: durationSeconds < 0 ? 0 : durationSeconds,
      intervalSeconds: intervalSeconds,
    );
    _updateQueue(uid, (q) => [...q, entry]);

    void keptOnDevice() => toast(
          title: tr('contraction_saved_offline_title', 'Bu cihazda saxlanıldı'),
          description: tr('contraction_saved_offline_desc', 'İnternet bərpa olunanda avtomatik sinxronlaşacaq.'),
        );

    if (!_online) {
      keptOnDevice();
      return entry;
    }
    final res = await _repo.insert({...entry.toJson(), 'user_id': uid}, returnRow: true);
    if (res.error != null && !_isDuplicateKey(res.error)) {
      debugPrint('Error adding contraction (kept in local queue): ${res.error}');
      keptOnDevice();
      return entry;
    }
    _updateQueue(uid, (q) => q.where((x) => x.id != entry.id).toList());
    unawaited(ref.read(pregnancyPartnerNotificationsProvider).notifyContractionStarted(entry.durationSeconds.toInt(), entry.intervalSeconds));
    await fetch();
    return res.row ?? entry;
  }

  /// Server rows plus still-pending local rows, newest first.
  List<Contraction> get contractions {
    final uid = _uid ?? '';
    final merged = mergeWithQueue(
      [for (final r in state.serverRows) MergedContraction(id: r.id, startTime: r.startTime, durationSeconds: r.durationSeconds, row: r)],
      state.queue,
    );
    return [
      for (final m in merged)
        if (m.pending)
          Contraction(
            id: m.id,
            userId: uid,
            startTime: m.startTime,
            durationSeconds: m.durationSeconds,
            intervalSeconds: (m.row as QueuedContraction).intervalSeconds,
            createdAt: m.startTime,
            pending: true,
          )
        else
          m.row! as Contraction,
    ];
  }

  ContractionStats stats([List<Contraction>? list]) => computeContractionStats([
        for (final c in list ?? contractions) TimedContraction(startTime: c.startTime, durationSeconds: c.durationSeconds, id: c.id),
      ]);

  /// Notify the partner once when the 5-1-1 rule is met.
  void maybeNotify511(bool is511) {
    if (is511 && !_has511Notified) {
      _has511Notified = true;
      unawaited(ref.read(pregnancyPartnerNotificationsProvider).notifyContraction511());
    }
  }

  Future<void> clearAll({required ContractionToast toast}) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.deleteAll(uid);
      state = state.copyWith(serverRows: const []);
      _updateQueue(uid, (_) => []);
      final current = loadContractionTimerState(_store, uid);
      saveContractionTimerState(_store, uid, ContractionTimerState(activeStart: current.activeStart));
      _has511Notified = false;
      toast(
        title: tr('usecontractions_sancilar_silindi_535de3', 'Sancılar silindi'),
        description: tr('usecontractions_butun_qeydler_silindi_1f1172', 'Bütün qeydlər silindi.'),
      );
    } catch (e) {
      debugPrint('Error clearing contractions: $e');
      // `error instanceof Error ? error.message : undefined`: PostgREST errors are plain objects in supabase-js.
      final message = e is PostgrestException ? null : e.toString();
      toast(title: tr('usecontractions_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), description: message, destructive: true);
    }
  }
}

final contractionsProvider = NotifierProvider.autoDispose<ContractionsController, ContractionsState>(ContractionsController.new);
