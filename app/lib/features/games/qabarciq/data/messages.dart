// Ported from: src/components/games/qabarciq/messages.ts
library;

import '../../common/data/game_messages.dart';

/// `bubbleText`: normalised app language, then `az`.
class BubbleMessages {
  BubbleMessages(this.catalog);
  final GameMessageCatalog catalog;
  static BubbleMessages parse(String assetText) => BubbleMessages(GameMessageCatalog.parse(assetText));

  String text(String language, String key, [Map<String, Object?> values = const {}]) {
    final messages = catalog.languages[normalizeGameLanguage(language)] ?? catalog.languages['az']!;
    final value = messages[key];
    if (value == null) throw ArgumentError.value(key, 'key');
    return fillPlaceholders(value, values);
  }
}
