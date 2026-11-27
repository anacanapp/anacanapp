// Ported from: src/hooks/useCycleHistory.ts, src/hooks/usePeriodDayLogs.ts, src/hooks/useFlowDailyLogs.ts,
//              src/hooks/useFlowReminders.ts, src/hooks/usePhaseTips.ts (usePhaseTips), src/hooks/useFlowData.ts
//              (useFlowInsights), src/components/flow/FlowDashboard.tsx (flow-upcoming-labels)
//
// React Query hooks on the Dart query cache: same query keys, stale times, invalidations, outbox flush and
// the `period-recording:<user>` mutation scope (serialised writes).
import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../core/i18n/i18n.dart';
import '../../../core/offline/offline.dart';
import '../../../domain/cycle/cycle_predictions.dart' as cp;
import '../../../domain/cycle/health_cycle.dart' show PeriodDay;
import '../../../domain/cycle/period_flow.dart';
import '../../../domain/js_compat.dart' show DomainClock, jsRoundInt, parseIsoDateFns;
import '../../../state/user_store.dart';
import '../flow_platform.dart';
import 'flow_repository.dart';

String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime flowNow() => DomainClock.now();

final _languageProvider = Provider<String>((ref) => ref.watch(userStoreProvider.select((s) => s.language)));

// ───────────────────────── cycle history ─────────────────────────

/// The outbox the cycle history flushes (override in tests; null = no outbox).
final flowOutboxProvider = Provider<OfflineOutbox?>((ref) => ref.watch(offlineOutboxProvider));

/// useCycleHistory's effect: flush queued cycle entries for the user and refresh once a flush delivered them.
final _cycleOutboxBinding = Provider.autoDispose.family<void, String>((ref, uid) {
  final outbox = ref.watch(flowOutboxProvider);
  if (outbox == null) return;
  final client = ref.read(queryClientProvider);
  final unsubscribe = outbox.subscribe((event) {
    if (event.userId == uid && event.sentTables.contains('cycle_history')) {
      unawaited(client.invalidateQueries(queryKey: const ['cycle-history']));
    }
  });
  final release = outbox.retainUser(uid);
  ref.onDispose(() {
    unsubscribe();
    release();
  });
});

final cycleHistoryQuery = queryProvider<Rows>((ref) {
  final uid = ref.watch(flowUserIdProvider);
  if (uid != null) ref.watch(_cycleOutboxBinding(uid));
  return QueryOptions(
    queryKey: ['cycle-history', uid],
    enabled: uid != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => uid == null ? <Row>[] : ref.read(flowRepositoryProvider).cycleHistory(uid),
  );
});

List<cp.CycleHistory> toCycleHistory(Rows rows) => [for (final r in rows) cp.CycleHistory.fromJson(r)];

/// `useEffectiveCycleLength()`.
final effectiveCycleLengthProvider = Provider.autoDispose<int>((ref) {
  final cycles = ref.watch(cycleHistoryQuery).data ?? const <Row>[];
  final stored = ref.watch(userStoreProvider.select((s) => s.cycleLength));
  return cp.effectiveCycleLength(toCycleHistory(cycles), stored).round();
});

class CycleStatsData {
  const CycleStatsData({
    required this.averageCycleLength,
    this.averagePeriodLength = 5,
    this.shortestCycle = 28,
    this.longestCycle = 28,
    this.totalCycles = 0,
    this.cycleVariation = 0,
    this.anomalousCycles = 0,
  });
  final int averageCycleLength;
  final int averagePeriodLength;
  final int shortestCycle;
  final int longestCycle;
  final int totalCycles;
  final int cycleVariation;
  final int anomalousCycles;
}

/// `useCycleStats()` body.
CycleStatsData cycleStatsOf(Rows cycles, int fallbackCycleLength) {
  if (cycles.isEmpty) return CycleStatsData(averageCycleLength: fallbackCycleLength);
  final lengths = [
    for (final c in cycles)
      if ((c.integer('cycle_length') ?? 0) >= 15 && (c.integer('cycle_length') ?? 0) <= 60) c.integer('cycle_length')!
  ];
  final periods = [
    for (final c in cycles)
      if (c['end_date'] != null && (c.integer('period_length') ?? 0) >= 1 && (c.integer('period_length') ?? 0) <= 15)
        c.integer('period_length')!
  ];
  var avg = fallbackCycleLength, anomalous = 0, shortest = 28, longest = 28, variation = 0, avgPeriod = 5;
  if (lengths.isNotEmpty) {
    final normal = lengths.where((l) => !cp.isAnomalousCycleLength(l)).toList();
    if (normal.isNotEmpty) avg = jsRoundInt(normal.reduce((a, b) => a + b) / normal.length);
    anomalous = lengths.length - normal.length;
    shortest = lengths.reduce((a, b) => a < b ? a : b);
    longest = lengths.reduce((a, b) => a > b ? a : b);
    variation = longest - shortest;
  }
  if (periods.isNotEmpty) avgPeriod = jsRoundInt(periods.reduce((a, b) => a + b) / periods.length);
  return CycleStatsData(
    averageCycleLength: avg,
    averagePeriodLength: avgPeriod,
    shortestCycle: shortest,
    longestCycle: longest,
    totalCycles: cycles.length,
    cycleVariation: variation,
    anomalousCycles: anomalous,
  );
}

final cycleStatsProvider = Provider.autoDispose<CycleStatsData>((ref) =>
    cycleStatsOf(ref.watch(cycleHistoryQuery).data ?? const <Row>[], ref.watch(effectiveCycleLengthProvider)));

/// `useAddCycle()`: queued in the offline outbox first; optimistic insert on success (also when queued).
final addCycleMutation = mutationProvider<Row, Map<String, Object?>, void>((ref) {
  final qc = ref.read(queryClientProvider);
  final uid = ref.watch(flowUserIdProvider);
  return MutationOptions(
    mutationFn: (cycle) async {
      if (uid == null) throw StateError('Not authenticated');
      final outbox = ref.read(flowOutboxProvider);
      if (outbox == null) throw StateError('No outbox');
      final outcome = await outbox.saveWithOutbox(uid, 'cycle_history', {...cycle, 'user_id': uid});
      if (outcome.status == SaveStatus.error) throw outcome.error ?? StateError('save failed');
      return Map<String, dynamic>.from(outcome.data!);
    },
    onSuccess: (row, _, _) {
      qc.setQueryData<Rows>(['cycle-history', uid], (old) {
        final list = old ?? const <Row>[];
        return list.any((c) => c['id'] == row['id']) ? list : [row, ...list];
      });
      unawaited(qc.invalidateQueries(queryKey: const ['cycle-history']));
    },
  );
});

final updateCycleMutation = mutationProvider<Row, Map<String, Object?>, void>((ref) {
  final qc = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (v) {
      final updates = Map<String, Object?>.from(v)..remove('id');
      return ref.read(flowRepositoryProvider).updateCycle(v['id']! as String, updates);
    },
    onSuccess: (_, _, _) => unawaited(qc.invalidateQueries(queryKey: const ['cycle-history'])),
  );
});

final deleteCycleMutation = mutationProvider<void, String, void>((ref) {
  final qc = ref.read(queryClientProvider);
  return MutationOptions(
    mutationFn: (id) => ref.read(flowRepositoryProvider).deleteCycle(id),
    onSuccess: (_, _, _) => unawaited(qc.invalidateQueries(queryKey: const ['cycle-history'])),
  );
});

// ───────────────────────── period day logs ─────────────────────────

/// `usePeriodDayLogs(month?)`: key `['period-day-logs', user, year?, monthIndex?]`, staleTime 0.
final periodDayLogsQuery = queryProviderFamily<Rows, DateTime?>((ref, month) {
  final uid = ref.watch(flowUserIdProvider);
  return QueryOptions(
    queryKey: ['period-day-logs', uid, month?.year, month == null ? null : month.month - 1],
    enabled: uid != null,
    staleTime: Duration.zero,
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      if (uid == null) return <Row>[];
      if (month == null) return ref.read(flowRepositoryProvider).periodDayLogs(uid);
      return ref.read(flowRepositoryProvider).periodDayLogs(uid,
          from: ymd(DateTime(month.year, month.month - 1, 1)), to: ymd(DateTime(month.year, month.month + 2, 0)));
    },
  );
});

/// `PeriodWrite`.
class PeriodWrite {
  const PeriodWrite({required this.dates, required this.flow, this.complete, this.preserveExisting, this.dailyLog});

  /// DateTime or 'yyyy-MM-dd' strings.
  final List<Object> dates;
  final PeriodFlowAction? flow;
  final bool? complete;
  final bool? preserveExisting;
  final Map<String, Object?>? dailyLog;

  @override
  String toString() => 'PeriodWrite(dates: $dates, flow: $flow, complete: $complete, preserveExisting: $preserveExisting)';
}

class PeriodWriteResult {
  const PeriodWriteResult(this.raw);
  final Row raw;
  String get userId => raw.str('userId') ?? '';
  Row get profile => raw.row('profile') ?? const {};
  List<PeriodDay> get healthDays => [
        for (final d in raw.rows('healthDays'))
          PeriodDay(date: d.str('date') ?? '', flow: d.str('flow') ?? 'unspecified', cycleStart: d.boolean('cycleStart') ?? false)
      ];
}

final Map<String, ({Future<void> tail, bool Function() done})> _scopes = {};

/// TanStack `scope: { id }`: mutations of one scope run one after another.
Future<T> runInScope<T>(String scope, Future<T> Function() run) {
  final previous = _scopes[scope];
  final Future<T> next = previous == null || previous.done() ? run() : previous.tail.then((_) => run());
  var finished = false;
  final tail = next.then((_) {}, onError: (Object _) {}).whenComplete(() => finished = true);
  _scopes[scope] = (tail: tail, done: () => finished);
  return next;
}

/// `recordPeriodDays(userId, input)`.
Future<PeriodWriteResult> recordPeriodDays(Ref ref, String userId, PeriodWrite input) async {
  if (userId.isEmpty) throw StateError('NOT_AUTHENTICATED');
  final dates = validatePeriodDates(input.dates);
  final data = await ref.read(flowRepositoryProvider).recordPeriodDays({
    'p_expected_user_id': userId,
    'p_dates': dates,
    'p_flow': input.flow,
    'p_complete': input.complete ?? false,
    'p_preserve_existing': input.preserveExisting ?? false,
    'p_daily_log': input.dailyLog,
    'p_timezone': ref.read(flowTimeZoneProvider),
  });
  final row = asRow(data);
  if (row == null || row['ok'] != true || row['userId'] != userId) throw StateError('PERIOD_WRITE_FAILED');
  return PeriodWriteResult(row);
}

/// `completePeriodWrite(result, userId, queryClient)`.
Future<void> completePeriodWrite(Ref ref, PeriodWriteResult result, String userId) async {
  final store = ref.read(userStoreProvider);
  final notifier = ref.read(userStoreProvider.notifier);
  if (store.userId == userId && store.lifeStage == LifeStages.flow) {
    final p = result.profile;
    final lpd = p.str('last_period_date');
    notifier.setLastPeriodDate(lpd == null ? null : parseIsoDateFns(lpd));
    notifier.setPeriodLength(p.integer('period_length') ?? store.periodLength);
    notifier.setCycleLength(p.integer('cycle_length') ?? store.cycleLength);
  }
  final qc = ref.read(queryClientProvider);
  await Future.wait([
    for (final key in ['period-day-logs', 'cycle-history', 'flow-daily-log', 'flow-daily-logs', 'flow-month-logs', 'flow-mood-chart'])
      qc.invalidateQueries(queryKey: [key, userId]),
  ]);
  final days = result.healthDays;
  if (ref.read(userStoreProvider).userId == userId && days.isNotEmpty) {
    try {
      await ref.read(cycleHealthWriterProvider).syncPeriodDays(days);
    } catch (_) {
      // Optional device sync must not misreport a committed app record.
    }
  }
}

/// `useRecordPeriodDays()`.
final recordPeriodDaysMutation = mutationProvider<PeriodWriteResult, PeriodWrite, void>((ref) {
  final uid = ref.watch(flowUserIdProvider);
  return MutationOptions(
    mutationFn: (input) => runInScope('period-recording:$uid', () => recordPeriodDays(ref, uid ?? '', input)),
    onSuccess: (result, _, _) => completePeriodWrite(ref, result, uid!),
  );
});

// ───────────────────────── flow daily logs ─────────────────────────

final flowSymptomsQuery = queryProvider<Rows>((ref) {
  final language = ref.watch(_languageProvider);
  return QueryOptions(
    queryKey: ['flow-symptoms', language],
    staleTime: const Duration(minutes: 30),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await ref.read(flowRepositoryProvider).flowSymptoms(), language, const ['label']),
  );
});

/// `useFlowDailyLog(date)`.
final flowDailyLogQuery = queryProviderFamily<Row?, String>((ref, date) {
  final uid = ref.watch(flowUserIdProvider);
  return QueryOptions(
    queryKey: ['flow-daily-log', uid, date],
    enabled: uid != null,
    codec: QueryCodecs.maybeRow,
    queryFn: (_) async => uid == null ? null : ref.read(flowRepositoryProvider).flowDailyLog(uid, date),
  );
});

/// `useFlowDailyLogs(start?, end?)`; pass `(null, null)` for the last 30 days.
final flowDailyLogsQuery = queryProviderFamily<Rows, (String?, String?)>((ref, range) {
  final uid = ref.watch(flowUserIdProvider);
  final now = flowNow();
  final start = range.$1 ?? ymd(DateTime(now.year, now.month, now.day - 30));
  final end = range.$2 ?? ymd(now);
  return QueryOptions(
    queryKey: ['flow-daily-logs', uid, start, end],
    enabled: uid != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => uid == null ? <Row>[] : ref.read(flowRepositoryProvider).flowDailyLogs(uid, start, end),
  );
});

/// `useFlowMonthLogs(month)`.
final flowMonthLogsQuery = queryProviderFamily<Rows, DateTime>((ref, month) {
  final uid = ref.watch(flowUserIdProvider);
  final start = ymd(DateTime(month.year, month.month, 1));
  final end = ymd(DateTime(month.year, month.month + 1, 0));
  return QueryOptions(
    queryKey: ['flow-month-logs', uid, start, end],
    enabled: uid != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => uid == null ? <Row>[] : ref.read(flowRepositoryProvider).flowDailyLogs(uid, start, end, ascending: true),
  );
});

/// `useSaveFlowDailyLog()`: [log] holds `log_date`, optional `flow_intensity` (absent = untouched) and the daily fields.
final saveFlowDailyLogMutation = mutationProvider<PeriodWriteResult, Map<String, Object?>, void>((ref) {
  final uid = ref.watch(flowUserIdProvider);
  return MutationOptions(
    mutationFn: (log) => runInScope('period-recording:$uid', () {
      if (uid == null) throw StateError('Not authenticated');
      final daily = Map<String, Object?>.from(log)
        ..remove('log_date')
        ..remove('flow_intensity');
      final hasFlow = log.containsKey('flow_intensity');
      return recordPeriodDays(
          ref, uid, PeriodWrite(dates: [log['log_date']! as String], flow: hasFlow ? log['flow_intensity'] as String? : null, dailyLog: daily));
    }),
    onSuccess: (result, _, _) => completePeriodWrite(ref, result, uid!),
  );
});

/// `useFlowMoodChart()`.
final flowMoodChartQuery = queryProvider<Rows>((ref) {
  final uid = ref.watch(flowUserIdProvider);
  final now = flowNow();
  final start = ymd(DateTime(now.year, now.month, now.day - 30));
  final end = ymd(now);
  return QueryOptions(
    queryKey: ['flow-mood-chart', uid, start, end],
    enabled: uid != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => uid == null ? <Row>[] : ref.read(flowRepositoryProvider).flowMoodChart(uid, start, end),
  );
});

// ───────────────────────── tips, insights, labels ─────────────────────────

/// `usePhaseTips(phase)` (mapFollowupContent → mapRowsTranslation; see README gaps).
final phaseTipsQuery = queryProviderFamily<Rows, String>((ref, phase) {
  final language = ref.watch(_languageProvider);
  return QueryOptions(
    queryKey: ['phase-tips', phase, language],
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await ref.read(flowRepositoryProvider).phaseTips(phase), language, const ['title', 'content']),
  );
});

/// `useFlowInsights(phase)` (useFlowData.ts).
final flowInsightsQuery = queryProviderFamily<Rows, String?>((ref, phase) => QueryOptions(
      queryKey: ['flow-insights', phase],
      staleTime: const Duration(minutes: 30),
      codec: QueryCodecs.rows,
      queryFn: (_) => ref.read(flowRepositoryProvider).flowInsights(phase),
    ));

/// FlowDashboard `['flow-upcoming-labels']`.
final flowUpcomingLabelsQuery = queryProvider<Map<String, String>>((ref) => QueryOptions(
      queryKey: const ['flow-upcoming-labels'],
      staleTime: const Duration(minutes: 5),
      queryFn: (_) async {
        final labels = <String, String>{};
        for (final item in await ref.read(flowRepositoryProvider).upcomingLabels()) {
          final v = item['value'];
          final val = v is String ? v : jsonEncode(v);
          labels[item['key'] as String] = val.replaceAll(RegExp(r'^"|"$'), '');
        }
        return labels;
      },
    ));

// ───────────────────────── reminders ─────────────────────────

final flowRemindersQuery = queryProvider<Rows>((ref) {
  final uid = ref.watch(flowUserIdProvider);
  return QueryOptions(
    queryKey: const ['flow-reminders'],
    enabled: uid != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => uid == null ? <Row>[] : ref.read(flowRepositoryProvider).flowReminders(uid),
  );
});

void _invalidateReminders(Ref ref) =>
    unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: const ['flow-reminders']));

/// `useSaveFlowReminder()`.
final saveFlowReminderMutation = mutationProvider<Row, Map<String, Object?>, void>((ref) {
  final uid = ref.watch(flowUserIdProvider);
  return MutationOptions(
    mutationFn: (reminder) {
      if (uid == null) throw StateError('Not authenticated');
      return ref.read(flowRepositoryProvider).upsertReminder(
          {...reminder, 'user_id': uid, 'updated_at': DateTime.now().toUtc().toIso8601String()});
    },
    onSuccess: (_, _, _) => _invalidateReminders(ref),
  );
});

/// `useToggleReminder()`.
final toggleReminderMutation = mutationProvider<Row, ({String id, bool isEnabled}), void>((ref) => MutationOptions(
      mutationFn: (v) => ref
          .read(flowRepositoryProvider)
          .updateReminder(v.id, {'is_enabled': v.isEnabled, 'updated_at': DateTime.now().toUtc().toIso8601String()}),
      onSuccess: (_, _, _) => _invalidateReminders(ref),
    ));

/// `useDeleteFlowReminder()`.
final deleteFlowReminderMutation = mutationProvider<void, String, void>((ref) => MutationOptions(
      mutationFn: (id) => ref.read(flowRepositoryProvider).deleteReminder(id),
      onSuccess: (_, _, _) => _invalidateReminders(ref),
    ));

/// `useInitializeFlowReminders()`.
final initializeFlowRemindersMutation = mutationProvider<void, void, void>((ref) {
  final uid = ref.watch(flowUserIdProvider);
  return MutationOptions(
    mutationFn: (_) {
      if (uid == null) throw StateError('Not authenticated');
      Map<String, Object?> r(String type, int daysBefore, String title, String message) => {
            'user_id': uid,
            'reminder_type': type,
            'days_before': daysBefore,
            'time_of_day': '09:00',
            'is_enabled': true,
            'title': title,
            'message': message,
          };
      return ref.read(flowRepositoryProvider).upsertReminders([
        r('period_start', 2, tr('useflowreminders_period_yaxinlasir_06bbcf', 'Period yaxınlaşır'),
            tr('useflowreminders_perioda_2_gun_qaldi_hazir_ol_0c170f', 'Perioda 2 gün qaldı, hazır ol!')),
        r('ovulation', 1, tr('useflowreminders_ovulyasiya_gunu_751dc6', 'Ovulyasiya günü'),
            tr('useflowreminders_sabah_ovulyasiya_gunudur_c8c5d7', 'Sabah ovulyasiya günüdür!')),
        r('fertile_start', 1, tr('useflowreminders_mehsuldar_gunler_b8c031', 'Məhsuldar günlər'),
            tr('useflowreminders_sabahdan_mehsuldar_gunler_baslayir_fba6cc', 'Sabahdan məhsuldar günlər başlayır!')),
        r('pms', 0, tr('useflowreminders_pms_dovru_16f417', 'PMS Dövrü'),
            tr('useflowreminders_pms_yaxinlasir_ozune_bax', 'PMS dövrü yaxınlaşır — özünə qayğı göstər! ⚡')),
      ]);
    },
    onSuccess: (_, _, _) => _invalidateReminders(ref),
  );
});
