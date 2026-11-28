// Ported from: src/components/games/{word-garden,iki-dost,casual,qabarciq,color-sort}/messages.ts (bundled copy
//              packs), src/components/games/iki-dost/levels.ts, src/components/games/parking/levels.ts (catalogs)
//
// The bundled message packs and level catalogs the hub and the games read synchronously in React (static
// imports). Here they are loaded once from `assets/games/**` and kept for the whole process.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../casual/data/messages.dart';
import '../color_sort/data/messages.dart';
import '../iki_dost/data/messages.dart';
import '../iki_dost/engine/engine.dart';
import '../parking/engine/engine.dart';
import '../qabarciq/data/messages.dart';
import '../word_garden/data/messages.dart';
import 'game_env.dart';

class GameData {
  const GameData({
    required this.garden,
    required this.friends,
    required this.casual,
    required this.bubble,
    required this.colorSort,
    required this.friendsCatalog,
    required this.parkingCatalog,
  });
  final GardenMessages garden;
  final FriendsMessages friends;
  final CasualMessages casual;
  final BubbleMessages bubble;
  final ColorSortMessages colorSort;
  final FriendsCatalog friendsCatalog;
  final ParkingCatalog parkingCatalog;

  static Future<GameData> load(Future<String> Function(String path) read) async {
    final texts = await Future.wait([
      read('assets/games/word_garden/messages.json'),
      read('assets/games/iki_dost/messages.json'),
      read('assets/games/casual/messages.json'),
      read('assets/games/qabarciq/messages.json'),
      read('assets/games/color_sort/messages.json'),
      read('assets/games/iki_dost/catalog.json'),
      read('assets/games/parking/catalog.json'),
    ]);
    final friends = FriendsMessages.parse(texts[1]);
    return GameData(
      garden: GardenMessages.parse(texts[0]),
      friends: friends,
      casual: CasualMessages(CasualMessages.parse(texts[2], texts[1]).catalog, friends),
      bubble: BubbleMessages.parse(texts[3]),
      colorSort: ColorSortMessages.parse(texts[4]),
      friendsCatalog: FriendsCatalog.parse(texts[5]),
      parkingCatalog: ParkingCatalog.parse(texts[6]),
    );
  }
}

/// Loaded once (kept alive) — React bundles these files into the JS chunk of the hub.
final gameDataProvider = FutureProvider<GameData>((ref) => GameData.load(ref.watch(gameAssetTextLoaderProvider)));
