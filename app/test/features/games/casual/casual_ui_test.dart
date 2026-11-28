// Ported from: (no vitest for casual/GameLobby.tsx / GameDialog.tsx — widget checks of the shared casual chrome:
//              10-level pages, locks, stars, resume label, dialog closing on back / Escape)
import 'package:anacan/features/games/casual/persistence/storage.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/ui_common/casual_ui.dart';
import 'package:anacan/features/games/ui_common/game_data.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:anacan/shell/nav/shell_controller.dart' show backDispatcherProvider;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../batch_b_support.dart';

late GameData data;

CasualProfile _profile(int unlocked, Map<String, Object?> levels) => CasualProfile({
      'schema': 'anacan-casual-profile-v1', 'game': 'leaf-flight', 'revision': 'flight-202610-v1', 'unlocked': unlocked, 'levels': levels, 'round': null,
    });

void main() {
  setUpAll(() async => data = await loadTestGameData());

  testWidgets('pages ten levels at a time, locks future ones and resumes a saved level', (tester) async {
    final played = <int>[];
    final t = CasualText(data.casual, 'az');
    await pumpGame(
      tester,
      CasualScreen(
        palette: const CasualPalette(),
        dir: t.dir,
        child: GameLobby(
          palette: const CasualPalette(),
          title: t('flightTitle'),
          description: t('flightCard'),
          image: 'assets/images/onboarding/pregnancy-mode.webp',
          count: 30,
          profile: _profile(12, {'1': {'stars': 3, 'score': 900}, '11': {'stars': 1, 'score': 100}}),
          savedLevel: 12,
          t: t,
          onPlay: played.add,
        ),
      ),
      overrides: gameOverrides(store: MemoryGameStore(), data: data),
    );
    await tester.pump();
    expect(find.text('11 – 20'), findsOneWidget);
    expect(find.text(t('resume')), findsOneWidget);
    expect(tester.widget<GameButton>(find.byKey(const ValueKey('casual-level-13'))).enabled, isFalse);
    await tester.tap(find.byKey(const ValueKey('casual-level-11')));
    expect(played, [11]);
    await tester.tap(find.byKey(const ValueKey('cg-play')));
    expect(played, [11, 12]);
  });

  testWidgets('a casual dialog closes on native back and Escape', (tester) async {
    var closes = 0;
    late WidgetRef widgetRef;
    await pumpGame(
      tester,
      Consumer(builder: (context, ref, _) {
        widgetRef = ref;
        return Stack(children: [GameDialog(title: 'T', closeLabel: 'Bağla', onClose: () => closes++, children: const [Text('body')])]);
      }),
      overrides: gameOverrides(store: MemoryGameStore(), data: data),
    );
    expect(find.text('body'), findsOneWidget);
    expect(widgetRef.read(backDispatcherProvider).dispatch(), isTrue);
    expect(closes, 1);
    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    expect(closes, 2);
  });
}
