// Ported from: src/lib/community-moderation-i18n.ts (moderationText), src/lib/feature37-i18n.ts (feature37Text, blog_*
//              keys), src/lib/date-utils.ts (getCurrentDateLocale) + date-fns formatDistanceToNow({ addSuffix: true }) and
//              formatDistanceToNowStrict
import '../../../core/i18n/i18n.dart';
import 'community_copy.g.dart';

String _table(Map<String, Map<String, String>> table, String key, String? language) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = table[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  return table['en']?[key] ?? key;
}

/// `moderationText(key, language)`: the language's own string, else English.
String moderationText(String key, [String? language]) => _table(kCommunityModerationCopy, key, language);

/// `feature37Text(key, language)` for the blog_* keys.
String communityFeature37Text(String key, [String? language]) => _table(kCommunityFeature37Copy, key, language);

const int _minutesInDay = 1440;
const int _minutesInAlmostTwoDays = 2520;
const int _minutesInMonth = 43200;
const int _minutesInYear = 525600;

String _suffix(String language, String token, int count, bool future) {
  final table = kSuffixDistance[normalizeAppLanguage(language)] ?? kSuffixDistance['az']!;
  final list = table[token]![future ? 1 : 0];
  if (count >= 1 && count <= list.length) return list[count - 1];
  return list.last.replaceFirst('${list.length}', '$count');
}

String _strict(String language, String token, int count) {
  final table = kStrictDistance[normalizeAppLanguage(language)] ?? kStrictDistance['az']!;
  final list = table[token]!;
  if (count >= 0 && count < list.length) return list[count];
  return list.last.replaceFirst('${list.length - 1}', '$count');
}

int _differenceInMonths(DateTime later, DateTime earlier) {
  var months = (later.year - earlier.year) * 12 + later.month - earlier.month;
  final anchor = DateTime(earlier.year, earlier.month + months, earlier.day, earlier.hour, earlier.minute, earlier.second,
      earlier.millisecond);
  if (anchor.isAfter(later)) months -= 1;
  return months < 0 ? 0 : months;
}

/// `Math.round` (half up, also for negatives like JS).
int _round(num value) => (value + 0.5).floor();

/// `formatDistanceToNow(date, { addSuffix: true, locale: getCurrentDateLocale() })`.
String formatDistanceToNowSuffix(DateTime date, {DateTime? now, String? language}) {
  final lang = language ?? currentLanguage();
  final base = (now ?? DateTime.now()).toLocal();
  final value = date.toLocal();
  final future = value.isAfter(base);
  final left = future ? base : value;
  final right = future ? value : base;
  final seconds = right.difference(left).inSeconds;
  final offset = (right.timeZoneOffset - left.timeZoneOffset).inSeconds;
  final minutes = _round((seconds - offset) / 60);
  String d(String token, int count) => _suffix(lang, token, count, future);
  if (minutes < 2) return minutes == 0 ? d('lessThanXMinutes', 1) : d('xMinutes', minutes);
  if (minutes < 45) return d('xMinutes', minutes);
  if (minutes < 90) return d('aboutXHours', 1);
  if (minutes < _minutesInDay) return d('aboutXHours', _round(minutes / 60));
  if (minutes < _minutesInAlmostTwoDays) return d('xDays', 1);
  if (minutes < _minutesInMonth) return d('xDays', _round(minutes / _minutesInDay));
  if (minutes < _minutesInMonth * 2) return d('aboutXMonths', _round(minutes / _minutesInMonth));
  final months = _differenceInMonths(right, left);
  if (months < 12) return d('xMonths', _round(minutes / _minutesInMonth));
  final sinceYear = months % 12;
  final years = months ~/ 12;
  if (sinceYear < 3) return d('aboutXYears', years);
  if (sinceYear < 9) return d('overXYears', years);
  return d('almostXYears', years + 1);
}

/// `formatDistanceToNowStrict(date, { locale: getCurrentDateLocale() })` (no suffix, `Math.round`).
String formatDistanceToNowStrict(DateTime date, {DateTime? now, String? language}) {
  final lang = language ?? currentLanguage();
  final base = (now ?? DateTime.now()).toLocal();
  final value = date.toLocal();
  final left = value.isAfter(base) ? base : value;
  final right = value.isAfter(base) ? value : base;
  final milliseconds = right.difference(left).inMilliseconds;
  final minutes = milliseconds / 60000;
  final offset = (right.timeZoneOffset - left.timeZoneOffset).inMilliseconds;
  final dstMinutes = (milliseconds - offset) / 60000;
  if (minutes < 1) return _strict(lang, 'xSeconds', _round(milliseconds / 1000));
  if (minutes < 60) return _strict(lang, 'xMinutes', _round(minutes));
  if (minutes < _minutesInDay) return _strict(lang, 'xHours', _round(minutes / 60));
  if (dstMinutes < _minutesInMonth) return _strict(lang, 'xDays', _round(dstMinutes / _minutesInDay));
  if (dstMinutes < _minutesInYear) {
    final months = _round(dstMinutes / _minutesInMonth);
    return months == 12 ? _strict(lang, 'xYears', 1) : _strict(lang, 'xMonths', months);
  }
  return _strict(lang, 'xYears', _round(dstMinutes / _minutesInYear));
}
