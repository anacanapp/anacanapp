// Ported from: src/lib/app-languages.ts (normalizeAppLanguage) and the `{name}` placeholder
// replacement shared by src/components/games/{word-garden,iki-dost,casual,color-sort,qabarciq}/messages.ts
library;

import 'dart:convert';

import '../engine/js_json.dart';

/// The 25 bundled app languages (src/lib/app-languages.ts `APP_LANGUAGES`, same order).
const List<String> gameAppLanguageCodes = [
  'az', 'en', 'tr', 'ru', 'de', 'ar', 'ka', 'kk', 'uz', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky',
  'et', 'tk', 'uk',
];

/// `normalizeAppLanguage`: trim, lower-case, `_`→`-`, primary subtag; unknown → `az`.
String normalizeGameLanguage(Object? value) {
  final code = value is String ? value.trim().toLowerCase().replaceAll('_', '-').split('-').first : '';
  return gameAppLanguageCodes.contains(code) ? code : 'az';
}

final RegExp _placeholder = RegExp(r'\{(\w+)\}');

/// `text.replace(/\{(\w+)\}/g, (match, name) => values[name] === undefined ? match : String(values[name]))`.
String fillPlaceholders(String text, Map<String, Object?> values) => text.replaceAllMapped(_placeholder, (match) {
      final name = match.group(1)!;
      return values.containsKey(name) ? jsString(values[name]) : match.group(0)!;
    });

/// A parsed `anacan-game-messages-v1` asset (`app/assets/games/<game>/messages.json`).
class GameMessageCatalog {
  GameMessageCatalog(this.game, this.languages);
  final String game;
  final Map<String, Map<String, String>> languages;

  static GameMessageCatalog parse(String text) {
    final json = (jsonDecode(text) as Map).cast<String, Object?>();
    if (json['schema'] != 'anacan-game-messages-v1') throw const FormatException('GAME_MESSAGES_SCHEMA');
    final languages = <String, Map<String, String>>{
      for (final entry in (json['languages'] as Map).entries)
        entry.key as String: (entry.value as Map).cast<String, String>(),
    };
    return GameMessageCatalog(json['game'] as String, languages);
  }
}
