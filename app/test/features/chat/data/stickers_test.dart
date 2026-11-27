// Ported from: src/lib/stickers.test.ts (+ Dart-only recent-sticker cases)
import 'package:anacan/features/chat/data/stickers.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('stickers', () {
    test('has 60 numbered stickers', () {
      expect(kStickers, hasLength(60));
      expect(kStickers[59].id, '60');
    });

    test('round-trips a message token and rejects lookalikes', () {
      expect(stickerFromMessage(stickerMessage('07')), '07');
      expect(stickerFromMessage('🧸 Stiker 61'), isNull);
      expect(stickerFromMessage('hello 🧸 Stiker 3'), isNull);
    });

    test('recognises only first-party sticker comment images', () {
      expect(stickerFromImageUrl('https://api.anacan.az/storage/v1/object/public/community-media/stickers/v1/12.webp'), '12');
      expect(stickerFromImageUrl('https://api.anacan.az/storage/v1/object/public/community-media/u1/12.webp'), isNull);
    });

    test('remembers the 12 most recent stickers, newest first (Dart)', () {
      final store = LocalStore.memory({'anacan_recent_stickers_v1': '["99","03","x"]'});
      expect(recentStickers(store), ['03']);
      for (var i = 1; i <= 13; i++) {
        rememberSticker(store, i.toString().padLeft(2, '0'));
      }
      rememberSticker(store, '05');
      final recent = recentStickers(store);
      expect(recent.first, '05');
      expect(recent, hasLength(12));
      expect(recent.where((id) => id == '05'), hasLength(1));
      expect(recentStickers(LocalStore.memory({'anacan_recent_stickers_v1': '{bad'})), isEmpty);
    });
  });
}
