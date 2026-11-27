// Ported from: src/data/baby-chat/index.ts (loadBabyChatText, useBabyChatText), src/lib/baby-chat.ts (BabyChatText)
//
// Texts of "Körpəmdən mesajlar" for the app language (English if a file is missing, then Azerbaijani). The JSON
// packs are compiled in (data/baby_chat_text.g.dart), so the text is available at once (React loaded it lazily
// and rendered nothing until then).
import 'data/baby_chat_text.g.dart';

/// One language pack (`src/data/baby-chat/<lang>.json`).
class BabyChatText {
  BabyChatText(this.language, Map<String, Object> data)
      : ui = Map<String, String>.from(data['ui']! as Map),
        openers = List<String>.from(data['openers']! as List),
        notifications = List<String>.from(data['notifications']! as List),
        replies = {for (final e in (data['replies']! as Map).entries) e.key as String: List<String>.from(e.value as List)},
        keywords = {for (final e in (data['keywords']! as Map).entries) e.key as String: List<String>.from(e.value as List)},
        weekly = Map<String, String>.from(data['weekly']! as Map),
        daily = List<String>.from(data['daily']! as List);

  /// The pack's language (the file actually used).
  final String language;
  final Map<String, String> ui;
  final List<String> openers;
  final List<String> notifications;
  final Map<String, List<String>> replies;
  final Map<String, List<String>> keywords;
  final Map<String, String> weekly;
  final List<String> daily;

  /// `text.ui.<key>` (the key itself when missing).
  String u(String key) => ui[key] ?? key;

  /// `text.replies.<group>` (empty when missing).
  List<String> reply(String group) => replies[group] ?? const [];
}

final Map<String, BabyChatText> _cache = {};

/// `loadBabyChatText(language)`: own file, else en, else az.
BabyChatText loadBabyChatText(String language) {
  final lang = kBabyChatText.containsKey(language) ? language : (kBabyChatText.containsKey('en') ? 'en' : 'az');
  return _cache[lang] ??= BabyChatText(lang, kBabyChatText[lang]!);
}

/// Every language that has its own pack.
Iterable<String> get babyChatLanguages => kBabyChatText.keys;
