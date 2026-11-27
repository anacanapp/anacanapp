// Ported from: src/lib/local-date.ts, src/lib/stored-date-key.ts, src/lib/local-day-range.ts

import '../js_compat.dart';

/// YYYY-MM-DD of [d] in local time.
String localDateKey([DateTime? d]) {
  final x = d ?? DomainClock.now();
  return '${x.year}-${pad2(x.month)}-${pad2(x.day)}';
}

/// Today's local YYYY-MM-DD.
String todayKey() => localDateKey(DomainClock.now());

/// Local YYYY-MM-DD [days] days before (negative: after) [from].
String daysAgoKey(int days, [DateTime? from]) {
  final f = from ?? DomainClock.now();
  return localDateKey(DateTime(f.year, f.month, f.day - days));
}

final _ymd = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// YYYY-MM-DD of a calendar date kept in the user store (due date, last period, birth date).
///
/// A plain YYYY-MM-DD string is returned as is, a value at exactly UTC midnight keeps its UTC day, anything else
/// uses the local day. [value] is a DateTime, epoch ms, a string or null.
String? storedDateKey(Object? value) {
  if (value == null || value == '') return null;
  if (value is String && _ymd.hasMatch(value)) return value;
  final date = jsDate(value);
  if (date == null) return null;
  final u = date.toUtc();
  final utcMidnight = u.hour == 0 && u.minute == 0 && u.second == 0 && u.millisecond == 0;
  return utcMidnight ? jsToIsoString(date).substring(0, 10) : localDateKey(date);
}

/// Local-midnight DateTime for a stored calendar date, or null for empty/invalid values.
DateTime? storedCalendarDate(Object? value) {
  final key = storedDateKey(value);
  if (key == null) return null;
  final parts = key.split('-').map(int.parse).toList();
  return DateTime(parts[0], parts[1], parts[2]);
}

/// Timestamptz bound for the start of a local calendar day (`new Date(y, m - 1, d).toISOString()`).
String localDayStartIso(String key) {
  final parts = key.split('-').map((p) => int.tryParse(p) ?? 0).toList();
  return jsToIsoString(DateTime(parts[0], parts[1], parts[2]));
}
