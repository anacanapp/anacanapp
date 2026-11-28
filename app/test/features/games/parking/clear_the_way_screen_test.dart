// Ported from: src/components/games/parking/ClearTheWay.test.tsx
import 'dart:convert';

import 'package:anacan/features/games/casual/persistence/storage.dart';
import 'package:anacan/features/games/parking/engine/engine.dart';
import 'package:anacan/features/games/parking/ui/clear_the_way_screen.dart';
import 'package:anacan/features/games/parking/ui/parking_board.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../ui_support.dart';

void main() {
  final catalog = parkingCatalogFromAssets();
  late GameTestEnv env;
  setUp(() => env = GameTestEnv());

  final key = casualStorageKey(parkingId, parkingRevision);
  Map<String, dynamic> saved() => jsonDecode(env.item(key)!) as Map<String, dynamic>;
  Future<void> render(WidgetTester tester) => pumpGame(tester, env, ClearTheWay(onBack: () {}));
  Future<void> start(WidgetTester tester) => tapKey(tester, 'cg-play');

  int position(int car) {
    final level = catalog.level(1);
    final path = [for (final move in saved()['round']['path'] as List) ParkingMove.fromJson(move)];
    return replayParking(level, path).positions[car];
  }

  Future<void> shift(WidgetTester tester, int car, num to) async {
    await tester.tap(find.byKey(ValueKey('parking-car-$car')));
    await tester.pump();
    final axis = catalog.level(1).cars[car].axis;
    while (to != 6 && position(car) != to) {
      final from = position(car);
      final code = axis == 'h'
          ? to > from
              ? LogicalKeyboardKey.arrowRight
              : LogicalKeyboardKey.arrowLeft
          : to > from
              ? LogicalKeyboardKey.arrowDown
              : LogicalKeyboardKey.arrowUp;
      await tester.sendKeyEvent(code);
      await tester.pump();
    }
    if (to == 6) await tapKey(tester, 'parking-exit');
    await settle(tester);
  }

  group('Qucaq parking player', () {
    gameTest('solves the actual first layout, records one result and opens the next level', (tester) async {
      await render(tester);
      await start(tester);
      expect(tester.widget<GameButton>(find.byKey(const ValueKey('parking-exit'))).enabled, isFalse);
      for (final move in catalog.level(1).solution) {
        await shift(tester, move.car, move.to);
      }
      expect(find.text('Qucaq yola çıxdı!'), findsOneWidget);
      final value = saved();
      expect(value['unlocked'], 2);
      expect(value['round'], isNull);
      expect((value['levels'] as Map).keys.toList(), ['1']);
      await tapKey(tester, 'parking-next');
      await settle(tester);
      expect(find.text('Səviyyə 2'), findsOneWidget);
    });

    gameTest('gets a real solver hint, preserves a moved car on reopen and undo does not reset hint statistics', (tester) async {
      await render(tester);
      await start(tester);
      await tapKey(tester, 'parking-hint');
      await settle(tester);
      expect(tester.state<ClearTheWayState>(find.byType(ClearTheWay)).hint, isNotNull);
      final first = catalog.level(1).solution[0];
      await shift(tester, first.car, first.to);
      final round = saved()['round'];
      await tester.pumpWidget(const SizedBox());
      await render(tester);
      await start(tester);
      expect(saved()['round'], round);
      await tapKey(tester, 'parking-undo');
      final undone = saved()['round'];
      expect((undone['path'] as List).length, (round['path'] as List).length - 1);
      expect(undone['hints'], 1);
      await tapKey(tester, 'parking-pause');
      expect(tester.widget<ParkingBoard>(find.byType(ParkingBoard)).disabled, isTrue);
    });
  });
}
