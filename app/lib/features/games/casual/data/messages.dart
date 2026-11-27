// Ported from: src/components/games/casual/messages.ts
library;

import '../../common/data/game_messages.dart';
import '../../iki_dost/data/messages.dart';

/// `casualText`: Leaf Flight / Clear the Way keys first, otherwise the shared Two Friends copy
/// (common controls such as `play`, `undo`, `hint`).
class CasualMessages {
  CasualMessages(this.catalog, this.friends);
  final GameMessageCatalog catalog;
  final FriendsMessages friends;
  static CasualMessages parse(String casualAsset, String friendsAsset) =>
      CasualMessages(GameMessageCatalog.parse(casualAsset), FriendsMessages.parse(friendsAsset));

  String text(String language, String key, [Map<String, Object?> values = const {}]) {
    final messages = catalog.languages[normalizeGameLanguage(language)]!;
    final own = messages[key];
    return own != null ? fillPlaceholders(own, values) : friends.text(language, key, values);
  }
}
