// Ported from: src/components/games/MiniGamesHub.tsx (game imports of Sağlam Səbət, Birləşdir, Rəng çeşidləmə,
//              Qabarcıq)
//
// Registers the batch-B games on the mini-games registry: `registerGamesFeature(r, games: [registerGamesBatchB])`.
// The casual lobby / dialog used by Leaf Flight and Clear the Way live in ui_common/casual_ui.dart.
library;

import '../birlesdir/register_birlesdir.dart';
import '../color_sort/register_color_sort.dart';
import '../qabarciq/register_qabarciq.dart';
import '../saglam_sebet/register_saglam_sebet.dart';
import '../ui_common/game_registry.dart';

void registerGamesBatchB(GameRegistry games) {
  registerSaglamSebet(games);
  registerBirlesdir(games);
  registerColorSort(games);
  registerQabarciq(games);
}
