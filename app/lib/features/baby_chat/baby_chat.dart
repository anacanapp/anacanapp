// Ported from: src/lib/baby-chat.ts
//
// "Körpəmdən mesajlar" — the unborn baby texts the mother once a day and answers her replies.
// Everything is curated text (src/data/baby-chat/<lang>.json) filled with the week's facts:
// no AI, nothing medical, nothing frightening. The thread lives on the device only.
import 'dart:convert';

import '../../domain/dates/local_date.dart';
import '../../state/local_store.dart';
import 'baby_chat_text.dart';

export 'baby_chat_text.dart';

/// `BabyChatMessage` (`from`: 'baby' | 'mom'; [at] epoch ms).
class BabyChatMessage {
  const BabyChatMessage({required this.id, required this.from, required this.text, required this.at});
  final String id;
  final String from;
  final String text;
  final int at;

  BabyChatMessage copyWith({int? at}) => BabyChatMessage(id: id, from: from, text: text, at: at ?? this.at);

  Map<String, Object?> toJson() => {'id': id, 'from': from, 'text': text, 'at': at};

  static BabyChatMessage? fromJson(Object? v) {
    if (v is! Map) return null;
    final id = v['id'], from = v['from'], text = v['text'], at = v['at'];
    if (id is! String || from is! String || text is! String) return null;
    return BabyChatMessage(id: id, from: from, text: text, at: at is num ? at.toInt() : 0);
  }

  @override
  bool operator ==(Object other) => other is BabyChatMessage && other.id == id && other.from == from && other.text == text && other.at == at;
  @override
  int get hashCode => Object.hash(id, from, text, at);
}

/// `BabyWeekFacts`.
class BabyWeekFacts {
  const BabyWeekFacts({required this.week, this.fruit, this.cm, this.weeksLeft});
  final int week;
  final String? fruit;
  final num? cm;
  final int? weeksLeft;
}

/// Order matters: the first matching intent wins.
const List<String> kIntentOrder = ['thanks', 'love', 'name', 'dad', 'kick', 'hear', 'size', 'food', 'sleep', 'meet', 'how', 'hello'];
// Scripts without spaces between words are matched as substrings.
const Set<String> _substringLanguages = {'zh', 'ja', 'ko'};

final RegExp _nonWord = RegExp(r'[^\p{L}\p{N}]+', unicode: true);
final RegExp _wordChar = RegExp(r'[\p{L}\p{N}]', unicode: true);

/// FNV-1a over UTF-16 code units (`Math.imul`, `>>> 0`).
int babyChatHash(String value) {
  var h = 2166136261;
  for (var i = 0; i < value.length; i++) {
    h = (h ^ value.codeUnitAt(i)) & 0xFFFFFFFF;
    h = (h * 16777619) & 0xFFFFFFFF;
  }
  return h;
}

T _pick<T>(List<T> items, String seed) => items[babyChatHash(seed) % items.length];

/// `String.prototype.toLocaleLowerCase(language)`: Turkish/Azerbaijani dotted and dotless I.
String localeLower(String text, String language) {
  if (language == 'tr' || language == 'az') {
    return text.replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase();
  }
  return text.toLowerCase();
}

String dayKey(DateTime date) => localDateKey(date);

/// Today's message arrives at a different time each day: 09:00–20:30, stable per user and date.
DateTime dailyArrival(DateTime date, String userId) {
  final slot = babyChatHash('$userId:${dayKey(date)}') % (23 * 30); // 23 half-hours × 30 one-minute steps
  return DateTime(date.year, date.month, date.day, 9, (slot ~/ 30) * 30 + (slot % 30));
}

/// The intent of the mother's message, or null.
String? detectIntent(String message, Map<String, List<String>> keywords, String language) {
  final text = localeLower(message, language);
  final words = text.split(_nonWord).where((w) => w.isNotEmpty).toList();
  final phrase = ' ${words.join(' ')} ';
  for (final intent in kIntentOrder) {
    for (final raw in keywords[intent] ?? const <String>[]) {
      final key = localeLower(raw, language);
      if (!_wordChar.hasMatch(key) || _substringLanguages.contains(language)) {
        if (text.contains(key)) return intent;
      } else if (key.contains(' ') ? phrase.contains(' $key') : words.any((w) => w.startsWith(key))) {
        return intent;
      }
    }
  }
  return null;
}

/// JS `String(Math.round(n * 10) / 10)`.
String _oneDecimal(num n) {
  final v = (n * 10).round() / 10;
  return v == v.roundToDouble() ? v.toInt().toString() : v.toString();
}

String _fill(String template, BabyWeekFacts facts) => template
    .replaceAll('{fruit}', facts.fruit ?? '')
    .replaceAll('{cm}', facts.cm != null && facts.cm != 0 ? _oneDecimal(facts.cm!) : '')
    .replaceAll('{week}', '${facts.week}')
    .replaceAll('{weeks_left}', facts.weeksLeft == null ? '' : '${facts.weeksLeft}');

/// Templates whose placeholders cannot be filled for this week are skipped.
List<String> _usable(List<String> templates, BabyWeekFacts facts) => templates
    .where((t) =>
        (!t.contains('{fruit}') || (facts.fruit != null && facts.fruit!.isNotEmpty)) &&
        (!t.contains('{cm}') || (facts.cm ?? 0) >= 1) &&
        (!t.contains('{weeks_left}') || (facts.weeksLeft ?? 0) > 1))
    .toList();

/// The baby's answer to the mother's message, matched to its topic and the current week.
String babyReply(String message, BabyChatText text, BabyWeekFacts facts, String language, String seed) {
  final intent = detectIntent(message, text.keywords, language);
  var pool = text.reply('generic');
  if (intent == 'kick') {
    pool = facts.week < 18 ? text.reply('kick_early') : text.reply('kick');
  } else if (intent == 'hear') {
    pool = facts.week < 18 ? text.reply('hear_early') : text.reply('hear');
  } else if (intent == 'meet') {
    pool = (facts.weeksLeft ?? 99) <= 2 ? text.reply('meet_soon') : text.reply('meet');
  } else if (intent != null) {
    pool = text.reply(intent);
  }
  final options = _usable(pool, facts);
  return _fill(_pick(options.isNotEmpty ? options : _usable(text.reply('generic'), facts), '$seed:$message'), facts);
}

/// The day's short message: the week's line on two days of each pregnancy week (so it is
/// seen even if one day is missed), a sweet line from the daily pool on the others.
String babyDailyLine(BabyChatText text, BabyWeekFacts facts, int pregnancyDay, String userId) {
  final week = facts.week.clamp(4, 41);
  final dayInWeek = ((pregnancyDay % 7) + 7) % 7;
  final weekly = text.weekly['$week'];
  if ((dayInWeek == 0 || dayInWeek == 3) && weekly != null && weekly.isNotEmpty) return weekly;
  final pool = _usable(text.daily, facts);
  return _fill(_pick(pool.isNotEmpty ? pool : text.daily.where((t) => !t.contains('{')).toList(), '$userId:$pregnancyDay:daily'), facts);
}

/// The day's thread from the baby: an opener and the day's content message.
List<BabyChatMessage> dailyBabyMessages(BabyChatText text, String dailyMessage, DateTime date, String userId) {
  final at = dailyArrival(date, userId).millisecondsSinceEpoch;
  final day = dayKey(date);
  return [
    BabyChatMessage(id: '$day-open', from: 'baby', text: _pick(text.openers, '$userId:$day:open'), at: at),
    BabyChatMessage(id: '$day-daily', from: 'baby', text: dailyMessage, at: at + 1000),
  ];
}

// ── Device storage: the last 14 days of threads, per user ──────────────────────
typedef BabyChatThreads = Map<String, List<BabyChatMessage>>;

String babyChatStoreKey(String userId) => 'anacan_baby_chat_v1:$userId';

BabyChatThreads loadThreads(LocalStore store, String userId) {
  try {
    final parsed = jsonDecode(store.getItem(babyChatStoreKey(userId)) ?? '{}');
    if (parsed is! Map) return {};
    return {
      for (final e in parsed.entries)
        if (e.key is String && e.value is List) e.key as String: [for (final m in e.value as List) ?BabyChatMessage.fromJson(m)],
    };
  } catch (_) {
    return {};
  }
}

/// Deletes every stored thread of this user on this device.
void deleteThreads(LocalStore store, String userId) => store.removeItem(babyChatStoreKey(userId));

void saveThread(LocalStore store, String userId, String day, List<BabyChatMessage> messages) {
  try {
    final all = {...loadThreads(store, userId), day: messages.length > 60 ? messages.sublist(messages.length - 60) : messages};
    final keys = all.keys.toList()..sort();
    final kept = keys.length > 14 ? keys.sublist(keys.length - 14) : keys;
    store.setItem(babyChatStoreKey(userId), jsonEncode({for (final k in kept) k: [for (final m in all[k]!) m.toJson()]}));
  } catch (_) {
    // storage blocked: the thread stays in memory
  }
}
