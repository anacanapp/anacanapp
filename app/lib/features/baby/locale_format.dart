// Ported from: `Date.prototype.toLocaleTimeString(getLocaleTag(), { hour: '2-digit', minute: '2-digit' })` and
//              `toLocaleDateString(getLocaleTag())` as used in src/components/Dashboard.tsx and
//              src/components/mommy/GrowthTrackerWidget.tsx
//
// ICU's locale patterns through intl (`DateFormat.jm` / `yMd` for the app language's intl locale), with the hour
// forced to two digits like `hour: '2-digit'`. Requires `ensureDateLocales()` (core/i18n/date_utils.dart) at
// startup; before that it falls back to `HH:mm` / `dd.MM.yyyy`.
import 'package:intl/intl.dart';

import '../../core/i18n/app_languages.dart';
import '../../core/i18n/tr.dart';

String _two(int v) => v.toString().padLeft(2, '0');

/// `toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })`.
String localeTimeHm(DateTime date, {String? language}) {
  final local = date.toLocal();
  try {
    final locale = appLanguage(language ?? currentLanguage()).intlLocale;
    final base = DateFormat.jm(locale).pattern ?? 'HH:mm';
    // 2-digit hour: h → hh, H → HH (only single letters).
    final pattern = base.replaceAllMapped(RegExp(r'(?<![hH])([hH])(?![hH])'), (m) => '${m[1]}${m[1]}');
    return DateFormat(pattern, locale).format(local);
  } catch (_) {
    return '${_two(local.hour)}:${_two(local.minute)}';
  }
}

/// `toLocaleDateString(locale)`.
String localeDate(DateTime date, {String? language}) {
  final local = date.toLocal();
  try {
    return DateFormat.yMd(appLanguage(language ?? currentLanguage()).intlLocale).format(local);
  } catch (_) {
    return '${_two(local.day)}.${_two(local.month)}.${local.year}';
  }
}
