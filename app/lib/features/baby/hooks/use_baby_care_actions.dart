// Ported from: src/hooks/useBabyCareActions.ts, src/hooks/useBabyLogsRange.ts, src/lib/babycare-i18n.ts (bc)
//
// Feeding / sleep actions shared by the Baby tracker tool and the baby home widgets (same baby_logs rows, same
// running timers), and the range query used by the tools.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/tr.dart';
import '../../../domain/baby/baby_logs_range.dart';
import '../../../domain/js_compat.dart';
import '../../../state/timer_store.dart';
import '../data/baby_repository.dart';
import 'baby_services.dart';
import 'use_baby_logs.dart';
import 'use_baby_records.dart' show BabyToast;
import 'use_children.dart';

/// `bc(key, vars)`: babycare copy (ui-copy section `babycare`).
String bc(String key, [Map<String, Object?>? vars]) => copyText('babycare', key, vars: vars);

const int feedingProAfter = 9;
const List<int> formulaPresetsMl = [30, 60, 90, 120, 150, 180];

// ─── useBabyLogsRange(days) ──────────────────────────────────────────────────────────────────

const String _rangeKey = 'baby-logs-range';

/// baby_logs of the selected child for the last [days] days (`['baby-logs-range', userId, childId, days]`,
/// staleTime 60 s), invalidated by realtime changes.
final babyLogsRangeQuery = queryProviderFamily<List<BabyLogRow>, int>((ref, days) {
  final userId = ref.watch(authUserProvider)?.id;
  final childId = ref.watch(selectedChildIdProvider);
  final repo = ref.watch(babyRepositoryProvider);
  if (userId != null) {
    final client = ref.read(queryClientProvider);
    repo.watchBabyLogs(ref, 'baby_logs_range_$userId', userId, () => client.invalidateQueries(queryKey: const [_rangeKey]));
  }
  return QueryOptions<List<BabyLogRow>>(
    queryKey: [_rangeKey, userId, childId, days],
    enabled: userId != null,
    staleTime: const Duration(seconds: 60),
    meta: const {'persist': false},
    codec: QueryCodecs.models((r) => Map<String, dynamic>.from(r.toJson()), (j) => BabyLogRow.fromJson(j)),
    queryFn: (_) async {
      final from = jsToIsoString(startOfDayOffset(DomainClock.now(), -(days - 1)));
      final rows = await repo.loadBabyLogsSince(userId!, childId, from);
      return [for (final r in rows) BabyLogRow.fromJson(r)];
    },
  );
}, name: 'babyLogsRangeQuery');

Future<void> refreshBabyLogsRange(QueryClient client) => client.invalidateQueries(queryKey: const [_rangeKey]);

// ─── useBabyCareActions ──────────────────────────────────────────────────────────────────────

/// Timers of the selected child (`timerFor`).
class BabyCareTimers {
  const BabyCareTimers({this.left, this.right, this.sleep});
  final ActiveTimer? left;
  final ActiveTimer? right;
  final ActiveTimer? sleep;
}

BabyCareTimers babyCareTimersFor(List<ActiveTimer> timers, String? childId) {
  ActiveTimer? find(bool Function(ActiveTimer) pred) {
    for (final t in timers) {
      if (t.childId == childId && pred(t)) return t;
    }
    return null;
  }

  return BabyCareTimers(
    left: find((t) => t.type == 'feeding' && t.feedType == 'left'),
    right: find((t) => t.type == 'feeding' && t.feedType == 'right'),
    sleep: find((t) => t.type == 'sleep'),
  );
}

/// `useBabyCareActions({ onSaved, feedingsToday })`. Create one per widget; [busy] guards double taps.
class BabyCareActions {
  BabyCareActions(this._ref, {this.onSaved, this.feedingsToday = 0, required this.toast});

  final Ref _ref;
  final void Function()? onSaved;
  final int feedingsToday;
  final BabyToast toast;
  bool busy = false;

  BabyCareServices get _services => _ref.read(babyCareServicesProvider);
  TimerStore get _timers => _ref.read(timerStoreProvider.notifier);

  String? get childId => selectedChildNow(_ref)?.id;
  String? get childName {
    final userId = _ref.read(authUserProvider)?.id;
    final count = _ref.read(queryClientProvider).getQueryData<List<Child>>(['user-children', userId])?.length ?? 0;
    return count > 1 ? selectedChildNow(_ref)?.name : null;
  }

  BabyCareTimers get timers => babyCareTimersFor(_ref.read(timerStoreProvider).activeTimers, childId);

  void saveError() => toast(title: bc('babytracker_save_error'), destructive: true);

  Future<void> run(Future<void> Function() fn) async {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } finally {
      busy = false;
    }
  }

  Future<void> toggleBreast(String side) => run(() async {
        _services.hapticMedium();
        final timer = side == 'left' ? timers.left : timers.right;
        if (timer == null) {
          _timers.startTimer('feeding', feedType: side, childId: childId, childName: childName);
          return;
        }
        final duration = _timers.stopTimer(timer.id);
        if (duration == null) return;
        final end = DomainClock.now();
        final res = await _ref.read(babyLogsActionsProvider).addLog(
              logType: 'feeding',
              feedType: side == 'left' ? 'breast_left' : 'breast_right',
              startTime: jsToIsoString(end.subtract(Duration(seconds: duration))),
              endTime: jsToIsoString(end),
            );
        if (res.error != null) return saveError();
        onSaved?.call();
        toast(
          title: side == 'left' ? bc('babytracker_left_done') : bc('babytracker_right_done'),
          description: '${bc('babytracker_duration')}: ${formatClockSeconds(duration)}',
        );
        if (feedingsToday >= feedingProAfter) _services.unlockAchievement('feeding_pro', 'mommy');
      });

  /// False when the amount is invalid (nothing saved).
  Future<bool> saveFormula(num amountMl) async {
    final amount = jsRound(amountMl);
    if (!amount.isFinite || amount <= 0 || amount > 1000) {
      toast(title: bc('babytracker_ml_invalid'), destructive: true);
      return false;
    }
    var ok = false;
    await run(() async {
      _services.hapticLight();
      final ml = amount.toInt();
      final res = await _ref.read(babyLogsActionsProvider).addLog(logType: 'feeding', feedType: 'formula', notes: '$ml ml');
      if (res.error != null) return saveError();
      ok = true;
      onSaved?.call();
      toast(title: '${bc('babytracker_formula')} $ml ml ${bc('babytracker_saved')}');
    });
    return ok;
  }

  Future<bool> saveSolid(String food) async {
    final trimmed = food.trim();
    final name = trimmed.length > 80 ? trimmed.substring(0, 80) : trimmed;
    if (name.isEmpty) return false;
    var ok = false;
    await run(() async {
      _services.hapticLight();
      final res = await _ref.read(babyLogsActionsProvider).addLog(logType: 'feeding', feedType: 'solid', notes: name);
      if (res.error != null) return saveError();
      ok = true;
      onSaved?.call();
      toast(title: '$name ${bc('babytracker_saved')}');
    });
    return ok;
  }

  Future<void> toggleSleep() => run(() async {
        _services.hapticMedium();
        final sleep = timers.sleep;
        if (sleep == null) {
          _timers.startTimer('sleep', childId: childId, childName: childName);
          toast(title: bc('babytracker_sleep_started'), description: bc('babytracker_tap_to_stop'));
          return;
        }
        final duration = _timers.stopTimer(sleep.id);
        if (duration == null) return;
        final end = DomainClock.now();
        final res = await _ref.read(babyLogsActionsProvider).addLog(
              logType: 'sleep',
              startTime: jsToIsoString(end.subtract(Duration(seconds: duration))),
              endTime: jsToIsoString(end),
            );
        if (res.error != null) return saveError();
        onSaved?.call();
        toast(title: bc('babytracker_sleep_ended'), description: '${bc('babytracker_slept')}: ${formatClockSeconds(duration)}');
      });
}

/// Builds a [BabyCareActions] bound to the container (`ref.read(babyCareActionsFactoryProvider)(toast: …)`).
final babyCareActionsFactoryProvider = Provider<BabyCareActions Function({required BabyToast toast, void Function()? onSaved, int feedingsToday})>(
  (ref) => ({required BabyToast toast, void Function()? onSaved, int feedingsToday = 0}) =>
      BabyCareActions(ref, toast: toast, onSaved: onSaved, feedingsToday: feedingsToday),
);
