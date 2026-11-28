// Ported from: `Date.prototype.toLocaleString / toLocaleDateString / toLocaleTimeString(getLocaleTag(), options)` as
//              used by src/components/illness/*, src/components/recovery/RecoveryScreen.tsx and
//              src/components/pregnancy-loss/LossMemoriesScreen.tsx
//
// ICU patterns through intl for the app language (Latin digits, two-digit hours like `hour: '2-digit'`). Falls back
// to fixed numeric formats when the locale data is not loaded.
import 'package:intl/intl.dart';

import '../../../core/i18n/app_languages.dart' show appLanguage;
import '../../../domain/js_compat.dart' show pad2;

String _intl(String language) => appLanguage(language).intlLocale;

String _format(DateFormat Function(String locale) make, DateTime d, String language, String Function() fallback) {
  try {
    return (make(_intl(language))..useNativeDigits = false).format(d.toLocal());
  } catch (_) {
    return fallback();
  }
}

String _twoDigitHours(String pattern) => pattern.replaceAllMapped(RegExp(r'(?<![hHkK])([hHkK])(?![hHkK])'), (m) => '${m[1]}${m[1]}');

String _clockPattern(String locale) => _twoDigitHours(DateFormat.jm(locale).pattern ?? 'HH:mm');

/// `{ hour: '2-digit', minute: '2-digit' }`.
String fmtTime(DateTime d, String language) =>
    _format((l) => DateFormat(_clockPattern(l), l), d, language, () => '${pad2(d.toLocal().hour)}:${pad2(d.toLocal().minute)}');

/// `{ day: 'numeric', month: 'short' }`.
String fmtDayMonthShort(DateTime d, String language) =>
    _format((l) => DateFormat.MMMd(l), d, language, () => '${d.toLocal().day}.${pad2(d.toLocal().month)}');

/// `{ day: 'numeric', month: 'long' }`.
String fmtDayMonthLong(DateTime d, String language) =>
    _format((l) => DateFormat.MMMMd(l), d, language, () => '${d.toLocal().day}.${pad2(d.toLocal().month)}');

/// `{ day: 'numeric', month: 'long', year: 'numeric' }`.
String fmtDayMonthYearLong(DateTime d, String language) => _format(
    (l) => DateFormat.yMMMMd(l), d, language, () => '${d.toLocal().day}.${pad2(d.toLocal().month)}.${d.toLocal().year}');

/// `{ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }`.
String fmtDayMonthShortTime(DateTime d, String language) => '${fmtDayMonthShort(d, language)}, ${fmtTime(d, language)}';

/// `{ weekday: 'short', hour: '2-digit', minute: '2-digit' }`.
String fmtWeekdayShortTime(DateTime d, String language) =>
    '${_format((l) => DateFormat.E(l), d, language, () => '')} ${fmtTime(d, language)}'.trim();

/// `{ weekday: 'narrow' }`.
String fmtWeekdayNarrow(DateTime d, String language) =>
    _format((l) => DateFormat('EEEEE', l), d, language, () => const ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.toLocal().weekday % 7]);
