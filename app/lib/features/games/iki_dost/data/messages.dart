// Ported from: src/components/games/iki-dost/messages.ts
library;

import '../../common/data/game_messages.dart';

/// `friendsText`: the language is normalised with `normalizeAppLanguage` (unknown → az).
class FriendsMessages {
  FriendsMessages(this.catalog);
  final GameMessageCatalog catalog;
  static FriendsMessages parse(String assetText) => FriendsMessages(GameMessageCatalog.parse(assetText));

  String text(String language, String key, [Map<String, Object?> parameters = const {}]) {
    final value = catalog.languages[normalizeGameLanguage(language)]?[key];
    if (value == null) throw ArgumentError.value(key, 'key');
    return fillPlaceholders(value, parameters);
  }
}
