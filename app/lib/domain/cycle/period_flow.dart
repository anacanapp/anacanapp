// Ported from: src/lib/period-flow.ts

import '../js_compat.dart';

/// 'unspecified' | 'light' | 'medium' | 'heavy' | 'none' | 'spotting'
typedef PeriodFlow = String;

/// PeriodFlow or 'clear'.
typedef PeriodFlowAction = String;

const List<PeriodFlow> periodFlows = ['unspecified', 'light', 'medium', 'heavy', 'none', 'spotting'];

/// Sentinel for "no record" (JS `undefined`); a present null record means bleeding without an amount.
const Object periodFlowUndefined = _Undefined();

class _Undefined {
  const _Undefined();
}

/// A present legacy/null record means bleeding was logged without an amount. Pass [periodFlowUndefined] for
/// a missing record (JS `undefined`).
bool hasPeriodFlow(Object? flow) => !identical(flow, periodFlowUndefined) && flow != 'none' && flow != 'spotting';

class PeriodDateError implements Exception {
  const PeriodDateError(this.code);
  final String code;
  @override
  String toString() => code;
}

/// Local YYYY-MM-DD of a picked day (a DateTime or an ISO string parsed with date-fns `parseISO`).
String localPeriodDate(Object value) {
  final date = value is String ? parseIsoDateFns(value) : value as DateTime?;
  if (date == null) throw const PeriodDateError('INVALID_PERIOD_DATE');
  return formatYmd(date);
}

/// Unique sorted keys; throws for an empty list, more than 90 days, or a day after [today].
List<String> validatePeriodDates(List<Object> dates, [DateTime? today]) {
  final t = startOfDay(today ?? DomainClock.now());
  final keys = <String>{for (final d in dates) localPeriodDate(d)}.toList()..sort();
  if (keys.isEmpty || keys.length > 90 || keys.any((k) => startOfDay(parseIsoDateFns(k)!).isAfter(t))) {
    throw const PeriodDateError('INVALID_PERIOD_DATES');
  }
  return keys;
}

String periodFlowLabel(Object? flow) => periodFlows.contains(flow) ? flow as String : 'unspecified';
