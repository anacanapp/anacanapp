// Ported from: `toLocaleDateString(getLocaleTag(), { day: 'numeric', month: 'long', weekday: 'long' })`
//              (PartnerAppointmentsScreen), `new Intl.DateTimeFormat(language, { weekday: 'short' })` (NightShiftScreen),
//              `new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' })` (BirthPlanScreen)
//
// ICU patterns through intl for the app language (Latin digits); fixed numeric fallbacks when the locale data is
// not loaded. Times use `localeTimeHm` (baby feature).
import 'package:intl/intl.dart';

import '../../../core/i18n/app_languages.dart' show appLanguage;
import '../../../core/i18n/tr.dart' show currentLanguage;

String _two(int v) => v.toString().padLeft(2, '0');

String _fmt(DateFormat Function(String locale) make, DateTime d, String? language, String Function() fallback) {
  try {
    return (make(appLanguage(language ?? currentLanguage()).intlLocale)..useNativeDigits = false).format(d);
  } catch (_) {
    return fallback();
  }
}

/// `{ day: 'numeric', month: 'long', weekday: 'long' }`.
String fmtWeekdayDayMonth(DateTime d, {String? language}) => _fmt((l) => DateFormat.MMMMEEEEd(l), d, language, () => '${d.day}.${_two(d.month)}');

/// `{ weekday: 'short' }`.
String fmtWeekdayShort(DateTime d, {String? language}) =>
    _fmt((l) => DateFormat.E(l), d, language, () => const ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.weekday % 7]);

/// `{ dateStyle: 'medium', timeStyle: 'short' }`.
String fmtDateMediumTimeShort(DateTime d, {String? language}) => _fmt(
      (l) => DateFormat.yMMMd(l).add_jm(),
      d,
      language,
      () => '${_two(d.day)}.${_two(d.month)}.${d.year}, ${_two(d.hour)}:${_two(d.minute)}',
    );
