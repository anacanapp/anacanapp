// Ported from: src/hooks/useLocalGameProgress.ts, src/components/games/tierLabels.ts (no vitest suites; unit checks)
import 'package:anacan/features/games/ui_common/game_env.dart';
import 'package:anacan/features/games/ui_common/local_game_progress.dart';
import 'package:anacan/features/games/ui_common/tier_labels.dart';
import 'package:anacan/state/local_store.dart';
import 'package:anacan/state/persisted_store.dart' show localStoreProvider;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../support/i18n_fakes.dart';

void main() {
  test('local game progress reads the Capacitor save and writes the same JSON shape', () {
    final store = LocalStore.memory({
      'anacan_minigame_progress_color-sort': '{"unlockedLevel":3,"levels":{"2":{"stars":1,"bestScore":200}},"bestScoreOverall":200}',
    });
    final container = ProviderContainer(overrides: [localStoreProvider.overrideWithValue(store)]);
    addTearDown(container.dispose);
    final sub = container.listen(localGameProgressProvider('color-sort'), (_, _) {});
    expect(sub.read().unlockedLevel, 3);
    expect(container.read(localGameProgressProvider('color-sort').notifier).isLevelUnlocked(3), isTrue);
    expect(container.read(localGameProgressProvider('color-sort').notifier).isLevelUnlocked(4), isFalse);
    container.read(localGameProgressProvider('color-sort').notifier).recordLevelResult(3, 450, 2, true);
    expect(store.getItem('anacan_minigame_progress_color-sort'),
        '{"unlockedLevel":4,"levels":{"2":{"stars":1,"bestScore":200},"3":{"stars":2,"bestScore":450}},"bestScoreOverall":450}');
    container.read(localGameProgressProvider('color-sort').notifier).recordLevelResult(3, 100, 1, false);
    expect(sub.read().levels['3'], {'stars': 2, 'bestScore': 450});
    sub.close();
  });

  test('tier names translate known tiers and keep unknown labels', () {
    installTestI18n();
    expect(trTierName('Çətin'), 'Çətin');
    expect(trTierName('Bölmə 9'), 'Bölmə 9');
  });

  test('game numbers use the language grouping like Intl.NumberFormat', () {
    expect(gameNumber('az', 12500), '12.500');
    expect(gameNumber('en', 12500), '12,500');
    expect(gameNumber('az', 75), '75');
  });
}
