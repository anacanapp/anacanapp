// Ported from: src/components/games/word-garden/messages.ts
library;

import '../../common/data/game_messages.dart';
import '../../common/engine/js.dart';

/// Word Garden copy belongs to its language pack: only languages with a lexicon have copy, and an
/// unknown language throws `WORD_GARDEN_MESSAGES_NOT_AVAILABLE` (no fallback), like `gardenText`.
class GardenMessages {
  GardenMessages(this.catalog);
  final GameMessageCatalog catalog;
  static GardenMessages parse(String assetText) => GardenMessages(GameMessageCatalog.parse(assetText));

  String text(String language, String key, [Map<String, Object?> parameters = const {}]) {
    final messages = catalog.languages[language];
    if (messages == null) throw const GameError('WORD_GARDEN_MESSAGES_NOT_AVAILABLE');
    final value = messages[key];
    if (value == null) throw ArgumentError.value(key, 'key');
    return fillPlaceholders(value, parameters);
  }
}
