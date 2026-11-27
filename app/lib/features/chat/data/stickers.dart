// Ported from: src/lib/stickers.ts
//
// The 60 Anacan stickers (bundled as app/assets/stickers/NN.webp, copied from public/stickers by
// `node app/lib/features/chat/copy/gen_chat_copy.mjs --assets`; mirrored in public storage for older builds).
import 'dart:convert';

import '../../../state/local_store.dart' show LocalStore;

enum StickerGroup { ritm, tumurcuq, qucaq, trio }

class Sticker {
  const Sticker(this.id, this.group);
  final String id;
  final StickerGroup group;
}

const List<StickerGroup> _names = [
  StickerGroup.qucaq, StickerGroup.qucaq, StickerGroup.qucaq, StickerGroup.ritm, StickerGroup.ritm, StickerGroup.ritm, //
  StickerGroup.ritm, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.ritm, StickerGroup.ritm, //
  StickerGroup.ritm, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.qucaq, StickerGroup.qucaq, //
  StickerGroup.qucaq, StickerGroup.qucaq, //
  StickerGroup.ritm, StickerGroup.ritm, StickerGroup.ritm, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.tumurcuq, //
  StickerGroup.qucaq, StickerGroup.qucaq, StickerGroup.qucaq, StickerGroup.trio, StickerGroup.ritm, StickerGroup.ritm, //
  StickerGroup.ritm, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.qucaq, StickerGroup.qucaq, //
  StickerGroup.qucaq, StickerGroup.qucaq, //
  StickerGroup.ritm, StickerGroup.ritm, StickerGroup.ritm, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.tumurcuq, //
  StickerGroup.qucaq, StickerGroup.qucaq, StickerGroup.qucaq, StickerGroup.trio, StickerGroup.ritm, StickerGroup.ritm, //
  StickerGroup.ritm, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.tumurcuq, StickerGroup.qucaq, StickerGroup.qucaq, //
  StickerGroup.qucaq, StickerGroup.trio,
];

/// `STICKERS`.
final List<Sticker> kStickers = [
  for (var i = 0; i < _names.length; i++) Sticker('${i + 1}'.padLeft(2, '0'), _names[i]),
];

/// `STICKER_GROUPS`.
const List<StickerGroup> kStickerGroups = [StickerGroup.ritm, StickerGroup.tumurcuq, StickerGroup.qucaq, StickerGroup.trio];

final Set<String> _ids = {for (final s in kStickers) s.id};

/// `stickerAsset(id)` → the bundled asset (`/stickers/NN.webp` on the web).
String stickerAsset(String id) => 'assets/stickers/$id.webp';

/// `STICKER_STORAGE_PATH(id)`: storage path used as a comment image, so builds without stickers still show it.
String stickerStoragePath(String id) => 'stickers/v1/$id.webp';

/// Messages carry the sticker as readable text (older builds show "🧸 Stiker 12").
String stickerMessage(String id) => '🧸 Stiker ${int.parse(id)}';

final RegExp _messageToken = RegExp(r'^🧸 Stiker (\d{1,2})$', unicode: true);

/// `stickerFromMessage(content)`.
String? stickerFromMessage(String? content) {
  final match = _messageToken.firstMatch((content ?? '').trim());
  if (match == null) return null;
  final id = match[1]!.padLeft(2, '0');
  return _ids.contains(id) ? id : null;
}

final RegExp _imageUrl = RegExp(r'/community-media/stickers/v1/(\d{2})\.webp(?:\?.*)?$');

/// `stickerFromImageUrl(url)`.
String? stickerFromImageUrl(String? url) {
  final match = _imageUrl.firstMatch(url ?? '');
  return match != null && _ids.contains(match[1]) ? match[1] : null;
}

const String _recentKey = 'anacan_recent_stickers_v1';

/// `recentStickers()` (localStorage `anacan_recent_stickers_v1`).
List<String> recentStickers(LocalStore store) {
  try {
    final value = jsonDecode(store.getItem(_recentKey) ?? '[]');
    return value is List ? value.whereType<String>().where(_ids.contains).take(12).toList() : const [];
  } catch (_) {
    return const [];
  }
}

/// `rememberSticker(id)`.
void rememberSticker(LocalStore store, String id) {
  try {
    store.setItem(_recentKey, jsonEncode([id, ...recentStickers(store).where((item) => item != id)].take(12).toList()));
  } catch (_) {
    // storage unavailable
  }
}
