// Ported from: src/components/ToolsHub.tsx (`renderToolById('mini-games')` → `<MiniGamesHub onBack />`),
//              src/components/games/MiniGamesHub.tsx (lazy game imports)
//
// The hub is the `mini-games` tool. The standalone `/mini-games` route of App.tsx is a dev-only web page and is
// not registered natively (docs/flutter/SHELL.md §10). Games plug into the hub through the game registry
// (ui_common/game_registry.dart): this file registers Söz bağı, İki dost, Tumurcuğun uçuşu and Yolunu aç; the
// other game folders pass their own registration functions in [games].
library;

import '../../shell/shell.dart';
import 'hub/ui/mini_games_hub.dart';
import 'iki_dost/ui/two_friends_screen.dart';
import 'leaf_flight/ui/leaf_flight_screen.dart';
import 'parking/ui/clear_the_way_screen.dart';
import 'ui_common/game_registry.dart';
import 'word_garden/ui/word_garden_screen.dart';

/// The four own-screen games of this folder.
void registerHubScreenGames(GameRegistry games) {
  games
    ..register(ScreenGameEntry(id: MiniGameIds.wordGarden, builder: (context, a) => WordGarden(onBack: a.onBack)))
    ..register(ScreenGameEntry(id: MiniGameIds.twoFriends, builder: (context, a) => TwoFriends(onBack: a.onBack)))
    ..register(ScreenGameEntry(id: MiniGameIds.leafFlight, builder: (context, a) => LeafFlight(onBack: a.onBack)))
    ..register(ScreenGameEntry(id: MiniGameIds.clearTheWay, builder: (context, a) => ClearTheWay(onBack: a.onBack)));
}

/// Registers the Mini Games hub tool. [games]: registration functions of the other game folders (Sağlam Səbət,
/// Birləşdir, Rəng çeşidləmə, Qabarcıq), e.g. `registerGamesFeature(r, games: [registerColorSortGame, …])`.
void registerGamesFeature(FeatureRegistry r, {List<void Function(GameRegistry games)> games = const []}) {
  registerHubScreenGames(sharedGameRegistry);
  for (final register in games) {
    register(sharedGameRegistry);
  }
  r.registerTool(ToolId.miniGames, (context, a) => MiniGamesHub(onBack: a.onBack));
}
