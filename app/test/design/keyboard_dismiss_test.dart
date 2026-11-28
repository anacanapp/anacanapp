// Ported from: (no React test) WebView keyboard behaviour — tap outside blurs the field, dragging the page closes
//              the keyboard; src/components/chat/ConversationScreen.tsx keeps focus in the composer
import 'package:anacan/design/design.dart';
import 'package:flutter/gestures.dart' show PointerDeviceKind;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

class _Form extends StatelessWidget {
  const _Form({required this.a, required this.b, required this.multi});
  final FocusNode a;
  final FocusNode b;
  final FocusNode multi;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      builder: (context, child) => KeyboardDismissScope(child: child!),
      home: Scaffold(
        body: Column(children: [
          SizedBox(height: 60, child: TextField(key: const ValueKey('a'), focusNode: a)),
          SizedBox(height: 60, child: TextField(key: const ValueKey('b'), focusNode: b)),
          SizedBox(
            height: 80,
            child: TextField(key: const ValueKey('multi'), focusNode: multi, maxLines: null, keyboardType: TextInputType.multiline),
          ),
          TextFieldTapRegion(
            child: GestureDetector(
              key: const ValueKey('send'),
              onTap: () {},
              child: const SizedBox(width: 60, height: 40, child: Text('SEND')),
            ),
          ),
          GestureDetector(
            key: const ValueKey('button'),
            onTap: () {},
            child: const SizedBox(width: 60, height: 40, child: Text('OTHER')),
          ),
          Expanded(
            child: ListView(
              key: const ValueKey('list'),
              children: [for (var i = 0; i < 60; i++) SizedBox(height: 40, child: Text('row $i'))],
            ),
          ),
        ]),
      ),
    );
  }
}

void main() {
  late FocusNode a, b, multi;
  setUp(() {
    a = FocusNode();
    b = FocusNode();
    multi = FocusNode();
  });
  tearDown(() {
    a.dispose();
    b.dispose();
    multi.dispose();
  });

  Future<void> pump(WidgetTester tester) => tester.pumpWidget(_Form(a: a, b: b, multi: multi));

  testWidgets('a tap outside the focused field unfocuses it (closes the keyboard)', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('a')));
    await tester.pump();
    expect(a.hasFocus, isTrue);
    expect(tester.testTextInput.isVisible, isTrue);
    await tester.tap(find.byKey(const ValueKey('button')));
    await tester.pump();
    expect(a.hasFocus, isFalse);
    expect(tester.testTextInput.isVisible, isFalse);
  });

  testWidgets('a tap on empty space (no widget) unfocuses too', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('a')));
    await tester.pump();
    await tester.tapAt(const Offset(700, 270));
    await tester.pump();
    expect(a.hasFocus, isFalse);
  });

  testWidgets('tapping another field moves focus; taps inside a TextFieldTapRegion keep it', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('a')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('b')));
    await tester.pump();
    expect(b.hasFocus, isTrue);
    await tester.tap(find.byKey(const ValueKey('send')));
    await tester.pump();
    expect(b.hasFocus, isTrue, reason: 'composer send buttons keep the keyboard open');
    expect(tester.testTextInput.isVisible, isTrue);
  });

  testWidgets('a multi-line field (Return = newline) is closed by a tap outside', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('multi')));
    await tester.pump();
    expect(multi.hasFocus, isTrue);
    await tester.tap(find.byKey(const ValueKey('button')));
    await tester.pump();
    expect(multi.hasFocus, isFalse);
  });

  testWidgets('a drag that is not a tap does not unfocus by itself; dragging a scroll view does', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('a')));
    await tester.pump();
    // Horizontal drag over a non-scrolling area: not a tap.
    await tester.dragFrom(const Offset(700, 270), const Offset(-80, 0));
    await tester.pump();
    expect(a.hasFocus, isTrue);
    // Vertical drag of the list (ScrollViewKeyboardDismissBehavior.onDrag semantics).
    await tester.drag(find.byKey(const ValueKey('list')), const Offset(0, -200));
    await tester.pump();
    expect(a.hasFocus, isFalse);
  });

  testWidgets('scrolling the text inside a multi-line field keeps the keyboard', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('multi')));
    await tester.pump();
    tester.testTextInput.enterText(List.generate(30, (i) => 'line $i').join('\n'));
    await tester.pump();
    await tester.drag(find.byKey(const ValueKey('multi')), const Offset(0, -60));
    await tester.pump();
    expect(multi.hasFocus, isTrue);
  });

  testWidgets('mouse keeps the framework default (unfocus on pointer down)', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('a')));
    await tester.pump();
    final gesture = await tester.startGesture(tester.getCenter(find.byKey(const ValueKey('button'))), kind: PointerDeviceKind.mouse);
    await tester.pump();
    expect(a.hasFocus, isFalse);
    await gesture.up();
  });
}
