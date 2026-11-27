// Ported from: src/hooks/useDailyLogs.ts (logs, todayLog, waterToday, updateWaterIntake, outbox subscription),
//              src/lib/water-intake.ts (addWater: delta per tap with a client op id, persisted in the outbox
//              first, sent one after another per user; displayedWater = stored day total + queued deltas)
//
// Water taps are atomic server deltas (`increment_water_intake_v1`, op ids recorded in `water_intake_ops`,
// docs/STABILITY_PHASE2.md audit 16): a double tap is +2, a lost answer replayed with the same op id is
// applied once, and offline taps stay queued in the outbox and are shown immediately.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/row.dart';
import '../../../core/offline/offline_outbox.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/water/water_target.dart' as water;
import '../home_inputs.dart';
import 'home_repository.dart';

/// `usePartnerNotifications().notifyWaterGoal` (partner feature). Default: no-op.
final homeWaterGoalNotifierProvider = Provider<void Function()>((ref) => () {});

/// Result of one water tap (`SaveOutcome` of water-intake.ts).
class WaterTapOutcome {
  const WaterTapOutcome(this.status, {this.data, this.error});
  final SaveStatus status;
  final Map<String, Object?>? data;
  final Object? error;
}

class DailyLogsState {
  const DailyLogsState({this.logs = const [], this.todayLog, this.loading = true, this.outboxVersion = 0});
  final Rows logs;

  /// Today's row as loaded (may be yesterday's after midnight; see [DailyLogsController.visibleTodayLog]).
  final Row? todayLog;
  final bool loading;

  /// Bumped on every outbox change of this user (re-render, like `setOutboxVersion`).
  final int outboxVersion;

  DailyLogsState copyWith({Rows? logs, Object? todayLog = _keep, bool? loading, int? outboxVersion}) => DailyLogsState(
    logs: logs ?? this.logs,
    todayLog: identical(todayLog, _keep) ? this.todayLog : todayLog as Row?,
    loading: loading ?? this.loading,
    outboxVersion: outboxVersion ?? this.outboxVersion,
  );
}

const Object _keep = Object();

/// Per-user send chains (`chains` of water-intake.ts): sends from this device run one after another.
final Map<String, Future<Object?>> _waterChains = {};

/// `useDailyLogs()` for the signed-in user.
final dailyLogsProvider = NotifierProvider<DailyLogsController, DailyLogsState>(DailyLogsController.new);

class DailyLogsController extends Notifier<DailyLogsState> {
  String? _userId;
  int _waterGeneration = 0;

  OfflineOutbox get _outbox => ref.read(offlineOutboxProvider);

  @override
  DailyLogsState build() {
    final userId = ref.watch(homeUserIdProvider);
    _userId = userId;
    if (userId != null) {
      final outbox = ref.watch(offlineOutboxProvider);
      final unsubscribe = outbox.subscribe((change) {
        if (change.userId != userId || !ref.mounted) return;
        state = state.copyWith(outboxVersion: state.outboxVersion + 1);
        if (change.sentTables.contains(waterOutboxTable) || change.sentTables.contains(dailyLogOutboxTable)) {
          unawaited(fetchLogs());
        }
      });
      final release = outbox.retainUser(userId);
      ref.onDispose(() {
        unsubscribe();
        release();
      });
      Future.microtask(fetchLogs);
    }
    return const DailyLogsState();
  }

  /// `fetchLogs()`.
  Future<void> fetchLogs() async {
    final userId = _userId;
    if (userId == null) return;
    final generation = _waterGeneration;
    try {
      final data = await ref.read(homeRepositoryProvider).dailyLogs(userId);
      if (!ref.mounted || _userId != userId) return;
      final today = todayKey();
      final todayData = data.where((l) => l['log_date'] == today).firstOrNull;
      final previous = state.todayLog;
      Row? next = todayData;
      // A water tap was confirmed while this read was in flight: keep its newer total.
      if (generation != _waterGeneration && previous?['log_date'] == today) {
        next = todayData != null ? {...todayData, 'water_intake': previous!['water_intake']} : previous;
      }
      state = state.copyWith(logs: data, todayLog: next, loading: false);
    } catch (_) {
      if (ref.mounted) state = state.copyWith(loading: false);
    }
  }

  List<Map<String, Object?>> _outboxJson(String? userId) => [for (final e in _outbox.readOutbox(userId)) e.toJson()];

  /// `waterToday`: glasses for the phone's current local day, including taps still queued offline.
  int waterToday([String? day]) {
    final d = day ?? todayKey();
    final log = state.todayLog;
    final stored = water.storedWaterForDay(logDate: log?.str('log_date'), waterIntake: log?.number('water_intake'), day: d);
    return water.displayedWater(stored: stored, pending: water.pendingWaterDelta(_outboxJson(_userId), d));
  }

  /// `todayLog` (null when the loaded row is not today's), with the displayed water.
  Row? visibleTodayLog() {
    final today = todayKey();
    final log = state.todayLog;
    if (log == null || log['log_date'] != today) return null;
    return {...log, 'water_intake': waterToday(today)};
  }

  Row _emptyDay(String userId, String day, num total) => {
    'id': '',
    'user_id': userId,
    'log_date': day,
    'mood': null,
    'symptoms': null,
    'water_intake': total,
    'temperature': null,
    'bleeding': null,
    'notes': null,
    'created_at': DateTime.now().toUtc().toIso8601String(),
  };

  /// `updateWaterIntake(amount)`: adds [amount] glasses to the phone's current local day.
  Future<WaterTapOutcome> updateWaterIntake(num amount) async {
    final userId = _userId;
    if (userId == null) return const WaterTapOutcome(SaveStatus.error, error: 'No user logged in');
    final day = todayKey();
    final outcome = await addWater(
      userId,
      amount,
      day: day,
      onServerTotal: (total, totalDay, applied) {
        if (!ref.mounted) return;
        _waterGeneration++;
        final prev = state.todayLog;
        state = state.copyWith(todayLog: prev?['log_date'] == totalDay ? {...prev!, 'water_intake': total} : _emptyDay(userId, totalDay, total));
        if (water.crossesWaterGoal(applied: applied, total: total, amount: amount)) ref.read(homeWaterGoalNotifierProvider)();
      },
    );
    return outcome;
  }

  /// `addWater(userId, delta, options)` of water-intake.ts.
  Future<WaterTapOutcome> addWater(String userId, num delta, {String? day, void Function(num total, String day, bool applied)? onServerTotal}) {
    final outbox = _outbox;
    final d = day ?? todayKey();
    final id = newClientId();
    final payload = <String, Object?>{'id': id, 'user_id': userId, 'log_date': d, 'delta': delta};
    final persisted = outbox.enqueue(userId, id: id, table: waterOutboxTable, payload: payload);
    if (ref.mounted) state = state.copyWith(outboxVersion: state.outboxVersion + 1);

    Future<WaterTapOutcome> run() async {
      // A background flush already delivered it while this tap waited for the previous one.
      if (persisted && !outbox.readOutbox(userId).any((e) => e.id == id)) {
        return WaterTapOutcome(SaveStatus.saved, data: payload);
      }
      final sent = await outbox.sender(waterOutboxTable, payload);
      if (sent.error == null) {
        final data = sent.data;
        final result = data is Map ? Map<String, Object?>.from(data) : <String, Object?>{};
        final total = result['water_intake'];
        if (total is num) onServerTotal?.call(total, d, result['applied'] != false);
        outbox.remove(userId, id);
        return WaterTapOutcome(SaveStatus.saved, data: {...payload, ...result});
      }
      if (isTransientError(sent.error, status: sent.status) && persisted) {
        return WaterTapOutcome(SaveStatus.queued, data: payload);
      }
      outbox.remove(userId, id);
      return WaterTapOutcome(SaveStatus.error, error: sent.error);
    }

    final previous = _waterChains[userId] ?? Future<Object?>.value();
    final current = previous.then((_) => null, onError: (Object _) => null).then((_) => run());
    _waterChains[userId] = current;
    unawaited(
      current
          .whenComplete(() {
            if (identical(_waterChains[userId], current)) _waterChains.remove(userId);
          })
          .then((_) {}, onError: (Object _) {}),
    );
    return current;
  }
}

/// Test helper (`__resetWaterForTests`).
void resetWaterChainsForTests() => _waterChains.clear();
