// Ported from: src/lib/mommy-period.ts (mommyPeriodStatus, recentDays — the part the home banner uses),
//              src/hooks/usePeriodDayLogs.ts (usePeriodDayLogs(), recordPeriodDays, the keys completePeriodWrite
//              invalidates)
//
// NOTE: features/home_flow ports the same module for the period screen (logic/mommy_period.dart) and the same
// hooks (data/flow_hooks.dart). The banner keeps its own copy so the two features do not depend on each other;
// the app root may point [mommyPeriodSourceProvider] at the flow port instead (same query key and RPC).
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/net/backend_providers.dart';
import '../../../domain/cycle/period_flow.dart';
import '../../../domain/js_compat.dart';

const int _samePeriodGap = 2;

/// `MommyPeriodStatus` (`state`: none | today | askToday | idle).
class MommyPeriodStatus {
  const MommyPeriodStatus(this.state, this.start, this.lastDay, this.dayNumber);
  final String state;
  final String? start;
  final String? lastDay;
  final int dayNumber;

  @override
  bool operator ==(Object other) =>
      other is MommyPeriodStatus && other.state == state && other.start == start && other.lastDay == lastDay && other.dayNumber == dayNumber;
  @override
  int get hashCode => Object.hash(state, start, lastDay, dayNumber);
  @override
  String toString() => 'MommyPeriodStatus($state, $start, $lastDay, $dayNumber)';
}

DateTime _p(String s) => parseIsoDateFns(s)!;
int _diff(String a, String b) => differenceInCalendarDays(_p(a), _p(b));

/// Status of the postpartum period card from recorded flow days; [endedOn] = last day the user marked as the end.
MommyPeriodStatus mommyPeriodStatus(List<String> flowDays, String today, String? endedOn) {
  final days = ({...flowDays}.where((d) => d.compareTo(today) <= 0).toList())..sort();
  if (days.isEmpty) return const MommyPeriodStatus('none', null, null, 0);
  final lastDay = days.last;
  var start = lastDay;
  for (var i = days.length - 2; i >= 0; i--) {
    if (_diff(start, days[i]) > _samePeriodGap) break;
    start = days[i];
  }
  final dayNumber = _diff(today, start) + 1;
  final yesterday = formatYmd(subDays(_p(today), 1));
  if (endedOn != null && endedOn.isNotEmpty && endedOn.compareTo(lastDay) >= 0) return MommyPeriodStatus('idle', start, lastDay, 0);
  if (lastDay == today) return MommyPeriodStatus('today', start, lastDay, dayNumber);
  if (lastDay == yesterday) return MommyPeriodStatus('askToday', start, lastDay, dayNumber);
  return MommyPeriodStatus('idle', start, lastDay, 0);
}

/// The last [count] calendar days ending [today], oldest first (yyyy-MM-dd).
List<String> recentDays(String today, [int count = 14]) {
  final end = _p(today);
  return [for (var i = 0; i < count; i++) formatYmd(subDays(end, count - 1 - i))];
}

/// `eachDayOfInterval({ start, end })` as yyyy-MM-dd.
List<String> eachDay(String start, String end) {
  final s = _p(start), e = _p(end);
  final n = differenceInCalendarDays(e, s);
  return [for (var i = 0; i <= n; i++) formatYmd(addDays(s, i))];
}

/// `PeriodWrite` as the banner sends it.
class MommyPeriodWrite {
  const MommyPeriodWrite({required this.dates, required this.flow, this.complete, this.preserveExisting});
  final List<String> dates;

  /// 'unspecified' | 'clear'.
  final String flow;
  final bool? complete;
  final bool? preserveExisting;

  @override
  bool operator ==(Object other) =>
      other is MommyPeriodWrite &&
      '${other.dates}' == '$dates' &&
      other.flow == flow &&
      other.complete == complete &&
      other.preserveExisting == preserveExisting;
  @override
  int get hashCode => Object.hash('$dates', flow, complete, preserveExisting);
  @override
  String toString() => 'MommyPeriodWrite($dates, $flow, complete: $complete, preserveExisting: $preserveExisting)';
}

/// Data the banner needs: `usePeriodDayLogs()` rows + `useRecordPeriodDays()`.
abstract interface class MommyPeriodSource {
  Future<List<Map<String, dynamic>>> loadPeriodDayLogs(String userId);

  /// `recordPeriodDays(userId, input)`; throws on failure.
  Future<void> record(String userId, MommyPeriodWrite input);
}

/// IANA zone sent as `p_timezone` (Dart has no IANA lookup; the app root overrides it). Default 'UTC' like the
/// React fallback.
final mommyTimeZoneProvider = Provider<String>((ref) => 'UTC');

class SupabaseMommyPeriodSource implements MommyPeriodSource {
  SupabaseMommyPeriodSource(this._ref);
  final Ref _ref;

  @override
  Future<List<Map<String, dynamic>>> loadPeriodDayLogs(String userId) async {
    final rows = await _ref.read(supabaseClientProvider).from('period_day_logs').select().eq('user_id', userId).order('log_date');
    return [for (final r in rows) Map<String, dynamic>.from(r)];
  }

  @override
  Future<void> record(String userId, MommyPeriodWrite input) async {
    if (userId.isEmpty) throw StateError('NOT_AUTHENTICATED');
    final dates = validatePeriodDates(input.dates);
    final data = await _ref.read(supabaseClientProvider).rpc<Object?>('record_period_days', params: {
      'p_expected_user_id': userId,
      'p_dates': dates,
      'p_flow': input.flow,
      'p_complete': input.complete ?? false,
      'p_preserve_existing': input.preserveExisting ?? false,
      'p_daily_log': null,
      'p_timezone': _ref.read(mommyTimeZoneProvider),
    });
    if (data is! Map || data['ok'] != true || data['userId'] != userId) throw StateError('PERIOD_WRITE_FAILED');
  }
}

final mommyPeriodSourceProvider = Provider<MommyPeriodSource>(SupabaseMommyPeriodSource.new);

/// `usePeriodDayLogs()` (no month): key `['period-day-logs', user, null, null]`, staleTime 0.
final mommyPeriodDayLogsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  final source = ref.watch(mommyPeriodSourceProvider);
  return QueryOptions(
    queryKey: ['period-day-logs', uid, null, null],
    enabled: uid != null,
    staleTime: Duration.zero,
    codec: QueryCodecs.rows,
    queryFn: (_) async => uid == null ? const <Map<String, dynamic>>[] : source.loadPeriodDayLogs(uid),
  );
}, name: 'mommyPeriodDayLogsQuery');

/// `useRecordPeriodDays().mutate` + `completePeriodWrite` invalidations (the flow-stage user store update does
/// not apply to a mommy user; Health sync is the flow feature's).
Future<void> recordMommyPeriod(Ref ref, MommyPeriodWrite input) async {
  final uid = ref.read(authUserProvider)?.id ?? '';
  await ref.read(mommyPeriodSourceProvider).record(uid, input);
  final qc = ref.read(queryClientProvider);
  await Future.wait([
    for (final key in ['period-day-logs', 'cycle-history', 'flow-daily-log', 'flow-daily-logs', 'flow-month-logs', 'flow-mood-chart'])
      qc.invalidateQueries(queryKey: [key, uid]),
  ]);
}

/// `hasPeriodFlow(row.flow_intensity)`.
bool rowHasFlow(Map<String, dynamic> row) => hasPeriodFlow(row['flow_intensity']);

final mommyPeriodActionsProvider = Provider<Future<void> Function(MommyPeriodWrite input)>((ref) => (input) => recordMommyPeriod(ref, input));
