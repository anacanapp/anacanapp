// Ported from: src/lib/backButton.test.tsx (handler stack + exit policy; the Radix Dialog cases map to Flutter
//              routes, which the framework pops before the stack — covered in the AndroidBackScope widget test)
import 'package:anacan/shell/nav/back_button.dart';
import 'package:anacan/shell/widgets/android_back_scope.dart';
import 'package:anacan/shell/nav/shell_controller.dart';
import 'package:anacan/shell/shell_inputs.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'shell_test_support.dart';

void main() {
  late BackDispatcher d;
  setUp(() => d = BackDispatcher());

  group('back handler stack', () {
    test('asks overlays before screens and screens before root, regardless of registration order', () {
      final calls = <String>[];
      d.push(() {
        calls.add('root');
        return true;
      }, BackLayer.root);
      final releaseOverlay = d.push(() {
        calls.add('overlay');
        return true;
      }, BackLayer.overlay);
      d.push(() {
        calls.add('screen');
        return true;
      });
      expect(d.dispatch(), isTrue);
      releaseOverlay();
      expect(d.dispatch(), isTrue);
      expect(calls, ['overlay', 'screen']);
    });

    test('closes the top-most overlay first (last opened wins)', () {
      final closed = <String>[];
      final releaseA = d.push(() {
        closed.add('a');
        return true;
      }, BackLayer.overlay);
      final releaseB = d.push(() {
        closed.add('b');
        return true;
      }, BackLayer.overlay);
      d.dispatch();
      releaseB();
      d.dispatch();
      releaseA();
      expect(closed, ['b', 'a']);
    });

    test('falls through handlers that decline and tolerates throwing handlers', () {
      var screen = 0;
      d.push(() {
        screen++;
        return true;
      });
      d.push(() => throw StateError('boom'), BackLayer.overlay);
      d.push(() => false, BackLayer.overlay);
      expect(d.dispatch(), isTrue);
      expect(screen, 1);
    });

    test('only exits the app on a second back within 2s when nothing consumes it', () {
      var now = DateTime(2026);
      final policy = BackExitPolicy(clock: () => now);
      expect(policy.press(), BackExitDecision.showToast);
      now = now.add(const Duration(milliseconds: 1999));
      expect(policy.press(), BackExitDecision.exit);
      now = now.add(const Duration(seconds: 5));
      expect(policy.press(), BackExitDecision.showToast);
      now = now.add(const Duration(milliseconds: 2000));
      expect(policy.press(), BackExitDecision.showToast);
    });
  });

  group('AndroidBackScope + OverlayBackHandler', () {
    testWidgets('back closes the overlay only and keeps typed text; next back reaches the screen; then exit', (tester) async {
      final platform = FakePlatform();
      final container = ProviderContainer(overrides: [shellPlatformProvider.overrideWithValue(platform)]);
      addTearDown(container.dispose);
      var overlayOpen = true;
      var screenBacks = 0;
      final text = TextEditingController(text: 'typed');
      container.read(backDispatcherProvider).push(() {
        screenBacks++;
        return screenBacks < 2;
      });
      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: WidgetsApp(
            color: const Color(0xFFFFFFFF),
            pageRouteBuilder: <T>(RouteSettings settings, WidgetBuilder builder) =>
                PageRouteBuilder<T>(settings: settings, pageBuilder: (context, _, _) => builder(context)),
            home: AndroidBackScope(
              enabled: true,
              child: StatefulBuilder(
                builder: (context, setState) => OverlayBackHandler(
                  open: overlayOpen,
                  onClose: () => setState(() => overlayOpen = false),
                  child: Column(children: [
                    EditableText(
                      controller: text,
                      focusNode: FocusNode(),
                      style: const TextStyle(),
                      cursorColor: const Color(0xFF000000),
                      backgroundCursorColor: const Color(0xFF000000),
                    ),
                    if (overlayOpen) const Text('overlay'),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ));
      expect(find.text('overlay'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pump();
      expect(find.text('overlay'), findsNothing);
      expect(text.text, 'typed');
      expect(screenBacks, 0);
      await tester.binding.handlePopRoute();
      expect(screenBacks, 1);
      await tester.binding.handlePopRoute(); // screen declines → toast
      await tester.binding.handlePopRoute(); // second press within 2 s → exit
      expect(platform.exits, 1);
    });
  });
}
