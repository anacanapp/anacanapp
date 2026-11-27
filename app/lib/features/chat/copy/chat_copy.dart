// Ported from: src/lib/chat-i18n.ts (tr), src/lib/group-i18n.ts (tr), src/lib/feature37-i18n.ts (feature37Text, chat_*
//              keys), src/lib/followup-i18n.ts (followupText, media_* keys), src/lib/stickers.ts (stickerText),
//              src/lib/date-utils.ts (getCurrentDateLocale) + date-fns formatDistanceToNow (addSuffix: false)
import '../../../core/i18n/i18n.dart';
import 'chat_copy.g.dart';

/// chat-i18n `tr(key, fallback)`: the DB / dictionary value of [key], else the bundled chat table of the active
/// language, else its English entry, else [fallback] (default: the key).
String chatTr(String key, [String? fallback]) {
  final language = currentLanguage();
  return tr(key, kChatTranslations[language]?[key] ?? kChatTranslations['en']![key] ?? fallback ?? key);
}

/// group-i18n `tr(key, fallback)`: a `GROUP_LABELS` entry (by `GROUP_LANGUAGES` index, az for other languages)
/// becomes the fallback of [chatTr].
String groupTr(String key, [String? fallback]) {
  final labels = kGroupLabels[key];
  final index = kGroupLanguages.indexOf(currentLanguage());
  return chatTr(key, labels != null ? labels[index < 0 ? 0 : index] : fallback ?? key);
}

String _table(Map<String, Map<String, String>> table, String key, String? language) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  final own = table[lang]?[key];
  if (own != null && own.isNotEmpty) return own;
  return table['en']?[key] ?? key;
}

/// `feature37Text(key)` for the chat_* keys.
String chatFeature37Text(String key, [String? language]) => _table(kChatFeature37Copy, key, language);

/// `followupText('media_failed' | 'media_retry')`.
String chatFollowupText(String key, [String? language]) => _table(kChatFollowupCopy, key, language);

/// `stickerText(key, language)`: own language, else English.
String stickerText(String key, [String? language]) => _table(kStickerCopy, key, language);

const int _minutesInDay = 1440;
const int _minutesInAlmostTwoDays = 2520;
const int _minutesInMonth = 43200;

String _distance(String language, String token, int count) {
  final table = kDistanceStrings[normalizeAppLanguage(language)] ?? kDistanceStrings['az']!;
  final list = table[token]!;
  if (count >= 1 && count <= list.length) return list[count - 1];
  // Counts past the generated range only occur for decades; reuse the last form with the number swapped.
  final last = list.last;
  return last.replaceFirst('${list.length}', '$count');
}

/// date-fns `differenceInMonths(later, earlier)` (calendar months, minus one when the day has not been reached).
int _differenceInMonths(DateTime later, DateTime earlier) {
  var months = (later.year - earlier.year) * 12 + later.month - earlier.month;
  final anchor = DateTime(earlier.year, earlier.month + months, earlier.day, earlier.hour, earlier.minute, earlier.second,
      earlier.millisecond);
  if (anchor.isAfter(later)) months -= 1;
  return months < 0 ? 0 : months;
}

/// `formatDistanceToNow(date, { addSuffix: false, locale: getCurrentDateLocale() })`.
String formatDistanceToNow(DateTime date, {DateTime? now, String? language}) {
  final lang = language ?? currentLanguage();
  final base = (now ?? DateTime.now()).toLocal();
  final value = date.toLocal();
  final left = value.isAfter(base) ? base : value;
  final right = value.isAfter(base) ? value : base;
  final seconds = right.difference(left).inSeconds;
  final offset = (right.timeZoneOffset - left.timeZoneOffset).inSeconds;
  final minutes = ((seconds - offset) / 60).round();
  if (minutes < 2) return minutes == 0 ? _distance(lang, 'lessThanXMinutes', 1) : _distance(lang, 'xMinutes', minutes);
  if (minutes < 45) return _distance(lang, 'xMinutes', minutes);
  if (minutes < 90) return _distance(lang, 'aboutXHours', 1);
  if (minutes < _minutesInDay) return _distance(lang, 'aboutXHours', (minutes / 60).round());
  if (minutes < _minutesInAlmostTwoDays) return _distance(lang, 'xDays', 1);
  if (minutes < _minutesInMonth) return _distance(lang, 'xDays', (minutes / _minutesInDay).round());
  if (minutes < _minutesInMonth * 2) return _distance(lang, 'aboutXMonths', (minutes / _minutesInMonth).round());
  final months = _differenceInMonths(right, left);
  if (months < 12) return _distance(lang, 'xMonths', (minutes / _minutesInMonth).round());
  final sinceYear = months % 12;
  final years = months ~/ 12;
  if (sinceYear < 3) return _distance(lang, 'aboutXYears', years);
  if (sinceYear < 9) return _distance(lang, 'overXYears', years);
  return _distance(lang, 'almostXYears', years + 1);
}
