// Ported from: src/lib/pregnancy-utils.ts
//
// Centralized pregnancy & baby age calculations. Stored dates (LMP, due date, birth date) are calendar days read
// as local midnight; differences are counted in calendar days (never ms / 86400000), so DST cannot shift a day.
// "Today" comes from [DomainClock]. Values accept a DateTime, an ISO string or null (like `Date | string | null`).

import '../dates/local_date.dart';
import '../js_compat.dart';

const int pregnancyDurationDays = 280;

/// Stored value at local midnight, or null for an Invalid Date.
DateTime? _toLocalCalendarDate(Object value) => storedCalendarDate(value);

DateTime _todayLocal() => startOfDay(DomainClock.now());

/// Calendar days from [from] to today (or [to]); null when [from] is invalid (JS: NaN).
int? _calendarDaysSince(Object from, [DateTime? to]) {
  final f = _toLocalCalendarDate(from);
  if (f == null) return null;
  return differenceInCalendarDays(to ?? _todayLocal(), f);
}

bool _truthy(Object? v) => v != null && v != '';

/// Day-of-life/content index. Completed days/months remain zero-based ages.
int getBabyDayNumber(num elapsedDays) =>
    elapsedDays.isFinite && elapsedDays >= 0 ? elapsedDays.floor() + 1 : 0;

class CalendarAge {
  const CalendarAge({
    required this.months,
    required this.days,
    required this.totalDays,
    required this.dayNumber,
    required this.years,
    required this.remainingMonths,
    required this.displayText,
  });
  final int months;
  final int days;
  final int totalDays;
  final int dayNumber;
  final int years;
  final int remainingMonths;
  final String displayText;

  static const empty =
      CalendarAge(months: 0, days: 0, totalDays: 0, dayNumber: 0, years: 0, remainingMonths: 0, displayText: '');

  Map<String, Object?> toJson() => {
        'months': months,
        'days': days,
        'totalDays': totalDays,
        'dayNumber': dayNumber,
        'years': years,
        'remainingMonths': remainingMonths,
        'displayText': displayText,
      };
}

/// Baby age using real calendar months (not 30-day months), anchored to the birthday.
CalendarAge getRealCalendarAge(Object? birthDate, {Tr tr = azTr}) {
  if (!_truthy(birthDate)) return CalendarAge.empty;
  final birth = _toLocalCalendarDate(birthDate!);
  if (birth == null) return CalendarAge.empty;
  final now = startOfDay(DomainClock.now());

  final totalDays = differenceInCalendarDays(now, birth);
  final dayNumber = getBabyDayNumber(totalDays);
  var months = (now.year - birth.year) * 12 + now.month - birth.month;
  if (months < 0) months = 0;
  if (months > 0 && addMonths(birth, months).isAfter(now)) months--;
  final days = differenceInCalendarDays(now, addMonths(birth, months));

  final years = months ~/ 12;
  final remainingMonths = months % 12;

  var displayText = '';
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

// ─── Premature babies ────────────────────────────────────────────────────────────────────────
// WHO: gestation < 37 weeks (259 days) = premature. Correction only for premature babies and only until
// 24 months corrected age; vaccines always follow the chronological age.
const int prematureGestationLimitDays = 259;
const int correctionMaxMonths = 24;
const int _minPlausibleGestationDays = 140;
const int _maxPlausibleGestationDays = 310;

class PrematurityInfo {
  const PrematurityInfo({
    required this.isKnown,
    required this.isPremature,
    required this.gestationalDaysAtBirth,
    required this.gestationalWeeksAtBirth,
    required this.gestationalExtraDays,
    required this.correctionDays,
    required this.correctionApplies,
    required this.corrected,
  });
  final bool isKnown;
  final bool isPremature;
  final int? gestationalDaysAtBirth;
  final int? gestationalWeeksAtBirth;
  final int? gestationalExtraDays;
  final int correctionDays;
  final bool correctionApplies;
  final CalendarAge? corrected;

  static const none = PrematurityInfo(
    isKnown: false,
    isPremature: false,
    gestationalDaysAtBirth: null,
    gestationalWeeksAtBirth: null,
    gestationalExtraDays: null,
    correctionDays: 0,
    correctionApplies: false,
    corrected: null,
  );

  Map<String, Object?> toJson() => {
        'isKnown': isKnown,
        'isPremature': isPremature,
        'gestationalDaysAtBirth': gestationalDaysAtBirth,
        'gestationalWeeksAtBirth': gestationalWeeksAtBirth,
        'gestationalExtraDays': gestationalExtraDays,
        'correctionDays': correctionDays,
        'correctionApplies': correctionApplies,
        'corrected': corrected?.toJson(),
      };
}

PrematurityInfo getPrematurityInfo(Object? birthDate, Object? dueDate, {Tr tr = azTr}) {
  if (!_truthy(birthDate) || !_truthy(dueDate)) return PrematurityInfo.none;
  final birth = _toLocalCalendarDate(birthDate!);
  final due = _toLocalCalendarDate(dueDate!);
  if (birth == null || due == null) return PrematurityInfo.none;

  final daysBeforeDue = differenceInCalendarDays(due, birth);
  final gestationalDaysAtBirth = pregnancyDurationDays - daysBeforeDue;
  if (gestationalDaysAtBirth < _minPlausibleGestationDays || gestationalDaysAtBirth > _maxPlausibleGestationDays) {
    return PrematurityInfo.none;
  }
  final isPremature = gestationalDaysAtBirth < prematureGestationLimitDays;
  final weeks = gestationalDaysAtBirth ~/ 7;
  final extra = gestationalDaysAtBirth % 7;
  if (!isPremature) {
    return PrematurityInfo(
      isKnown: true,
      isPremature: false,
      gestationalDaysAtBirth: gestationalDaysAtBirth,
      gestationalWeeksAtBirth: weeks,
      gestationalExtraDays: extra,
      correctionDays: 0,
      correctionApplies: false,
      corrected: null,
    );
  }
  var corrected = getRealCalendarAge(due, tr: tr);
  if (corrected.totalDays < 0) {
    corrected = CalendarAge(
      months: 0,
      days: 0,
      totalDays: 0,
      dayNumber: 1,
      years: 0,
      remainingMonths: 0,
      displayText: '0 ${tr('pregnancy_utils_day', 'gün')}',
    );
  }
  return PrematurityInfo(
    isKnown: true,
    isPremature: true,
    gestationalDaysAtBirth: gestationalDaysAtBirth,
    gestationalWeeksAtBirth: weeks,
    gestationalExtraDays: extra,
    correctionDays: daysBeforeDue,
    correctionApplies: corrected.months < correctionMaxMonths,
    corrected: corrected,
  );
}

/// Effective due date: LMP + 280 when LMP exists, else the explicit due date. Null when missing or invalid
/// (the TypeScript returns an Invalid Date for an invalid stored value).
DateTime? getEffectiveDueDate(Object? lastPeriodDate, [Object? explicitDueDate]) {
  if (_truthy(lastPeriodDate)) return calculateDueDate(lastPeriodDate);
  if (_truthy(explicitDueDate)) return _toLocalCalendarDate(explicitDueDate!);
  return null;
}

/// Pregnancy day (1-280); day 1 is the first day of LMP. An invalid date gives NaN, as in JS
/// (`Math.max(1, Math.min(280, NaN))` is NaN).
num getPregnancyDay(Object? lastPeriodDate) {
  if (!_truthy(lastPeriodDate)) return 0;
  final d = _calendarDaysSince(lastPeriodDate!);
  if (d == null) return double.nan;
  final v = d + 1;
  return v > pregnancyDurationDays ? pregnancyDurationDays : (v < 1 ? 1 : v);
}

/// Pregnancy week (0-40).
num getPregnancyWeek(Object? lastPeriodDate) {
  if (!_truthy(lastPeriodDate)) return 0;
  final d = _calendarDaysSince(lastPeriodDate!);
  if (d == null) return double.nan;
  final w = (d / 7).floor();
  return w > 40 ? 40 : (w < 0 ? 0 : w);
}

/// Pregnancy week at any date (0-42), e.g. for an ultrasound scan date.
num getPregnancyWeekAtDate(Object? lastPeriodDate, Object atDate) {
  if (!_truthy(lastPeriodDate)) return 0;
  final at = _toLocalCalendarDate(atDate);
  if (at == null) return double.nan;
  final d = _calendarDaysSince(lastPeriodDate!, at);
  if (d == null) return double.nan;
  final w = (d / 7).floor();
  return w > 42 ? 42 : (w < 0 ? 0 : w);
}

/// Day within the current week (JS `%`: negative before the LMP).
num getDayInWeek(Object? lastPeriodDate) {
  if (!_truthy(lastPeriodDate)) return 0;
  final d = _calendarDaysSince(lastPeriodDate!);
  if (d == null) return double.nan;
  return jsRem(d, 7);
}

/// Days remaining until the due date (never negative). As in JS, an invalid stored date gives NaN (the
/// TypeScript gets an Invalid Date, which is truthy, and `Math.max(0, NaN)` is NaN); only a missing one gives 0.
num getDaysUntilDue(Object? lastPeriodDate, [Object? dueDate]) {
  if (!_truthy(lastPeriodDate) && !_truthy(dueDate)) return 0;
  final due = getEffectiveDueDate(lastPeriodDate, dueDate);
  if (due == null) return double.nan;
  final left = differenceInCalendarDays(due, _todayLocal());
  return left < 0 ? 0 : left;
}

/// LMP + 280 days at local midnight.
DateTime? calculateDueDate(Object? lastPeriodDate) {
  if (!_truthy(lastPeriodDate)) return null;
  final d = _toLocalCalendarDate(lastPeriodDate!);
  return d == null ? null : addDays(d, pregnancyDurationDays);
}

/// Due date − 280 days.
DateTime? calculateLMPFromDueDate(Object? dueDate) {
  if (!_truthy(dueDate)) return null;
  final d = _toLocalCalendarDate(dueDate!);
  return d == null ? null : addDays(d, -pregnancyDurationDays);
}

int getTrimester(num weekNumber) {
  if (weekNumber < 13) return 1;
  if (weekNumber < 27) return 2;
  return 3;
}

/// Days elapsed in pregnancy (0-280).
num getDaysElapsed(Object? lastPeriodDate) {
  if (!_truthy(lastPeriodDate)) return 0;
  final d = _calendarDaysSince(lastPeriodDate!);
  if (d == null) return double.nan;
  return d > pregnancyDurationDays ? pregnancyDurationDays : (d < 0 ? 0 : d);
}

/// Progress percentage (0-100).
num getPregnancyProgress(Object? lastPeriodDate) {
  final e = getDaysElapsed(lastPeriodDate);
  final p = e / pregnancyDurationDays * 100;
  return p.isNaN ? p : (p > 100 ? 100 : p);
}

/// "3 həftə 5 gün".
String getWeekDayString(Object? lastPeriodDate, {Tr tr = azTr}) {
  final week = getPregnancyWeek(lastPeriodDate);
  final day = getDayInWeek(lastPeriodDate);
  return '${jsNumberToString(week)} ${tr('pregnancy_utils_week', 'həftə')} ${jsNumberToString(day)} '
      '${tr('pregnancy_utils_day', 'gün')}';
}

class FullPregnancyData {
  const FullPregnancyData({
    required this.pregnancyDay,
    required this.pregnancyWeek,
    required this.dayInWeek,
    required this.daysUntilDue,
    required this.daysElapsed,
    required this.progressPercent,
    required this.trimester,
    required this.dueDate,
  });
  final num pregnancyDay;
  final num pregnancyWeek;
  final num dayInWeek;
  final num daysUntilDue;
  final num daysElapsed;
  final num progressPercent;
  final int trimester;
  final DateTime? dueDate;
  int get totalDays => pregnancyDurationDays;
}

FullPregnancyData getFullPregnancyData(Object? lastPeriodDate, [Object? explicitDueDate]) {
  final week = getPregnancyWeek(lastPeriodDate);
  return FullPregnancyData(
    pregnancyDay: getPregnancyDay(lastPeriodDate),
    pregnancyWeek: week,
    dayInWeek: getDayInWeek(lastPeriodDate),
    daysUntilDue: getDaysUntilDue(lastPeriodDate, explicitDueDate),
    daysElapsed: getDaysElapsed(lastPeriodDate),
    progressPercent: getPregnancyProgress(lastPeriodDate),
    trimester: getTrimester(week),
    dueDate: getEffectiveDueDate(lastPeriodDate, explicitDueDate),
  );
}
