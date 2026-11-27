// Ported from: src/lib/stored-date-key.ts, src/lib/local-date.ts, src/lib/pregnancy-utils.ts (the subset
// the user store's derived selectors use: getPregnancyWeek, getDayInWeek, getTrimester,
// calculateDueDate, getRealCalendarAge) and the JS Date ⇄ JSON conventions of zustand persist.

import '../core/i18n/tr.dart';

const int pregnancyDurationDays = 280;

String _pad(int n) => n.toString().padLeft(2, '0');

/// `localDateKey(d)`: YYYY-MM-DD in local time.
String localDateKey([DateTime? d]) {
  final v = (d ?? DateTime.now()).toLocal();
  return '${v.year}-${_pad(v.month)}-${_pad(v.day)}';
}

final RegExp _dateOnly = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// `new Date(string)` semantics: a bare `YYYY-MM-DD` is UTC midnight, ISO with zone is that instant,
/// ISO without zone is local time. Null when unparseable.
DateTime? parseJsDate(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  if (value is num) return DateTime.fromMillisecondsSinceEpoch(value.toInt());
  if (value is! String || value.isEmpty) return null;
  if (_dateOnly.hasMatch(value)) {
    final p = value.split('-').map(int.parse).toList();
    return DateTime.utc(p[0], p[1], p[2]);
  }
  return DateTime.tryParse(value);
}

/// `JSON.stringify(date)`: `toISOString()` (UTC, millisecond precision).
String jsDateJson(DateTime value) =>
    DateTime.fromMillisecondsSinceEpoch(value.millisecondsSinceEpoch, isUtc: true).toIso8601String();

/// `storedDateKey(value)`.
String? storedDateKey(Object? value) {
  if (value == null || value == '') return null;
  if (value is String && _dateOnly.hasMatch(value)) return value;
  final date = parseJsDate(value);
  if (date == null) return null;
  final utc = date.toUtc();
  final utcMidnight = utc.hour == 0 && utc.minute == 0 && utc.second == 0 && utc.millisecond == 0;
  return utcMidnight ? '${utc.year.toString().padLeft(4, '0')}-${_pad(utc.month)}-${_pad(utc.day)}' : localDateKey(date);
}

/// `storedCalendarDate(value)`: local midnight of the stored calendar day.
DateTime? storedCalendarDate(Object? value) {
  final key = storedDateKey(value);
  if (key == null) return null;
  final p = key.split('-').map(int.parse).toList();
  return DateTime(p[0], p[1], p[2]);
}

DateTime startOfDay(DateTime d) {
  final v = d.toLocal();
  return DateTime(v.year, v.month, v.day);
}

/// date-fns `differenceInCalendarDays(a, b)` (local calendar days, DST-safe).
int differenceInCalendarDays(DateTime a, DateTime b) {
  final x = a.toLocal(), y = b.toLocal();
  return DateTime.utc(x.year, x.month, x.day).difference(DateTime.utc(y.year, y.month, y.day)).inDays;
}

/// date-fns `addDays` (calendar days, keeps the local time of day).
DateTime addDays(DateTime d, int days) {
  final v = d.toLocal();
  return DateTime(v.year, v.month, v.day + days, v.hour, v.minute, v.second, v.millisecond);
}

/// date-fns `addMonths` (clamps the day to the target month's last day).
DateTime addMonths(DateTime d, int months) {
  final v = d.toLocal();
  final firstOfTarget = DateTime(v.year, v.month + months, 1);
  final lastDay = DateTime(firstOfTarget.year, firstOfTarget.month + 1, 0).day;
  return DateTime(firstOfTarget.year, firstOfTarget.month, v.day > lastDay ? lastDay : v.day, v.hour, v.minute,
      v.second, v.millisecond);
}

/// Calendar days from the stored date [from] to today; null for an invalid date (JS: NaN).
int? _calendarDaysSince(Object from, [DateTime? to]) {
  final date = storedCalendarDate(from);
  return date == null ? null : differenceInCalendarDays(to ?? startOfDay(DateTime.now()), date);
}

/// `getPregnancyWeek(lmp)` (0–40).
int getPregnancyWeek(Object? lastPeriodDate) {
  if (lastPeriodDate == null) return 0;
  final days = _calendarDaysSince(lastPeriodDate);
  return days == null ? 0 : (days / 7).floor().clamp(0, 40);
}

/// `getDayInWeek(lmp)` (JS `%`: keeps the sign of the dividend).
int getDayInWeek(Object? lastPeriodDate) {
  if (lastPeriodDate == null) return 0;
  return _calendarDaysSince(lastPeriodDate)?.remainder(7) ?? 0;
}

/// `getTrimester(week)`.
int getTrimester(int week) => week < 13 ? 1 : (week < 27 ? 2 : 3);

/// `calculateDueDate(lmp)` = LMP + 280 days.
DateTime? calculateDueDate(Object? lastPeriodDate) {
  if (lastPeriodDate == null) return null;
  final lmp = storedCalendarDate(lastPeriodDate);
  return lmp == null ? null : addDays(lmp, pregnancyDurationDays);
}

/// `getRealCalendarAge(birthDate)`.
class CalendarAge {
  const CalendarAge({
    this.months = 0,
    this.days = 0,
    this.totalDays = 0,
    this.dayNumber = 0,
    this.years = 0,
    this.remainingMonths = 0,
    this.displayText = '',
  });
  final int months;
  final int days;
  final int totalDays;
  final int dayNumber;
  final int years;
  final int remainingMonths;
  final String displayText;
}

int getBabyDayNumber(int elapsedDays) => elapsedDays >= 0 ? elapsedDays + 1 : 0;

CalendarAge getRealCalendarAge(Object? birthDate, {DateTime? today}) {
  if (birthDate == null) return const CalendarAge();
  final birth = storedCalendarDate(birthDate);
  if (birth == null) return const CalendarAge();
  final now = startOfDay(today ?? DateTime.now());
  final totalDays = differenceInCalendarDays(now, birth);
  final dayNumber = getBabyDayNumber(totalDays);
  var months = (now.year - birth.year) * 12 + now.month - birth.month;
  if (months < 0) months = 0;
  if (months > 0 && addMonths(birth, months).isAfter(now)) months--;
  final days = differenceInCalendarDays(now, addMonths(birth, months));
  final years = months ~/ 12;
  final remainingMonths = months % 12;
  String displayText;
  if (totalDays < 0) {
    displayText = '';
  } else if (totalDays == 0) {
    displayText = tr('pregnancy_utils_first_day', '1-ci gün');
  } else if (years > 0) {
    displayText = '$years ${tr('pregnancy_utils_year', 'yaş')}'
        '${remainingMonths > 0 ? ' $remainingMonths ${tr('pregnancy_utils_month', 'ay')}' : ''}';
  } else if (months > 0) {
    displayText = '$months ${tr('pregnancy_utils_month', 'ay')} $days ${tr('pregnancy_utils_day', 'gün')}';
  } else {
    displayText = '$totalDays ${tr('pregnancy_utils_day', 'gün')}';
  }
  return CalendarAge(
    months: months,
    days: days,
    totalDays: totalDays,
    dayNumber: dayNumber,
    years: years,
    remainingMonths: remainingMonths,
    displayText: displayText,
  );
}
