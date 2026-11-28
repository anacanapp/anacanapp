// Ported from: src/components/games/leaf-flight/LeafFlight.test.tsx
import 'dart:convert';

import 'package:anacan/features/games/casual/persistence/storage.dart';
import 'package:anacan/features/games/leaf_flight/engine/engine.dart';
import 'package:anacan/features/games/leaf_flight/ui/leaf_flight_screen.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../ui_support.dart';

void main() {
  late GameTestEnv env;
  setUp(() => env = GameTestEnv());

  final key = casualStorageKey(leafFlightId, leafFlightRevision);
  Map<String, dynamic> round() => (jsonDecode(env.item(key)!) as Map<String, dynamic>)['round'] as Map<String, dynamic>;
  LeafFlightState screen(WidgetTester tester) => tester.state<LeafFlightState>(find.byType(LeafFlight));
  Future<void> render(WidgetTester tester) => pumpGame(tester, env, LeafFlight(onBack: () {}));

  /// `frames(count)`: 60 Hz animation frames.
  Future<void> frames(WidgetTester tester, int count) async {
    for (var n = 0; n < count; n++) {
      await tester.pump(const Duration(microseconds: 16667));
    }
  }

  Future<void> start(WidgetTester tester) async {
    await tapKey(tester, 'cg-play');
    await tapKey(tester, 'flight-play');
  }

  group('Tumurcuq flight input and saving', () {
    gameTest('starts only on Play, releases a cancelled touch and saves the live position on pause', (tester) async {
      await render(tester);
      await tapKey(tester, 'cg-play');
      await frames(tester, 30);
      expect(round()['distance'], 0);
      await tapKey(tester, 'flight-play');
      final hold = await tester.startGesture(tester.getCenter(find.byKey(const ValueKey('flight-lift'))));
      await tester.pump();
      expect(screen(tester).pressed, isTrue);
      await frames(tester, 35);
      await hold.cancel();
      await tester.pump();
      expect(screen(tester).pressed, isFalse);
      await tapKey(tester, 'flight-pause');
      final paused = round();
      expect(paused['y'] as num, lessThan(360));
      expect(paused['distance'] as num, greaterThan(0));
      await frames(tester, 120);
      expect(round(), paused);
    });

    gameTest('background-pauses a keyboard hold and restores a half-played flight after remount', (tester) async {
      await render(tester);
      await start(tester);
      await tester.sendKeyDownEvent(LogicalKeyboardKey.arrowUp);
      await frames(tester, 25);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
      expect(screen(tester).phase, 'paused');
      final saved = round();
      expect(saved['distance'] as num, greaterThan(0));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.arrowUp);
      await tester.pumpWidget(const SizedBox());
      await render(tester);
      await tapKey(tester, 'cg-play');
      expect(round(), saved);
      expect(screen(tester).phase, 'ready');
      expect(tester.widget<Listener>(find.byKey(const ValueKey('flight-lift'))).onPointerDown, isNull);
    });
  });
}
