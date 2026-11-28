// Ported from: src/components/games/MiniGamesHub.tsx (which views the batch-B games open, `handleNextColorSortLevel`)
import 'package:anacan/features/games/casual/register_games_batch_b.dart';
import 'package:anacan/features/games/color_sort/persistence/storage.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/ui_common/game_registry.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'batch_b_support.dart';

void main() {
  test('registers the three level games and the Bubble Pop screen', () {
    final registry = GameRegistry();
    registerGamesBatchB(registry);
    expect(registry[MiniGameIds.saglamSebet], isA<LevelGameEntry>());
    expect(registry[MiniGameIds.birlesdir], isA<LevelGameEntry>());
    expect(registry[MiniGameIds.colorSort], isA<LevelGameEntry>());
    expect(registry[MiniGameIds.qabarciq], isA<ScreenGameEntry>());
  });

  testWidgets('level counts follow the configs and the Color Sort library; passing the last level adds a pack', (tester) async {
    final registry = GameRegistry();
    registerGamesBatchB(registry);
    final store = MemoryGameStore({colorSortLevelCountKey: '30'});
    late WidgetRef widgetRef;
    await tester.pumpWidget(ProviderScope(
      overrides: gameOverrides(store: store),
      child: Consumer(builder: (context, ref, _) {
        widgetRef = ref;
        return const SizedBox();
      }),
    ));
    final sebet = registry[MiniGameIds.saglamSebet]! as LevelGameEntry;
    final match = registry[MiniGameIds.birlesdir]! as LevelGameEntry;
    final colors = registry[MiniGameIds.colorSort]! as LevelGameEntry;
    expect(sebet.levelCount(widgetRef), 60);
    expect(match.levelCount(widgetRef), 40);
    expect(colors.levelCount(widgetRef), 30);
    expect(colors.nextLevel!(widgetRef, 12), 13);
    expect(store.getItem(colorSortLevelCountKey), '30');
    expect(colors.nextLevel!(widgetRef, 30), 31);
    expect(store.getItem(colorSortLevelCountKey), '40');
    expect(colors.nextLevel!(widgetRef, 300), 300);
  });
}
