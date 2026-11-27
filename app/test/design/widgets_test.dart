// Ported from: src/components/anacan/Sheet.tsx (vaul behaviour), src/components/ui/sonner.tsx + toaster.tsx,
//              src/styles/anacan-design.css (.a-scope fonts)
import 'package:anacan/design/design.dart';
import 'package:anacan/design/gallery.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget home, {bool rtl = false}) => MaterialApp(
      theme: buildAnacanTheme(Brightness.light, locale: rtl ? const Locale('ar') : const Locale('az'), lite: false),
      home: AToastHost(child: home),
    );

void main() {
  group('theme', () {
    testWidgets('body defaults: Nunito 16px, line-height 1.5, foreground colour', (tester) async {
      late TextStyle style;
      await tester.pumpWidget(_app(Builder(builder: (c) {
        style = DefaultTextStyle.of(c).style.merge(Theme.of(c).textTheme.bodyMedium);
        return const SizedBox();
      })));
      expect(style.fontFamily, 'Nunito');
      expect(style.fontSize, 16);
      expect(style.height, 1.5);
      expect(style.color, ShadcnTokens.light.foreground);
    });

    testWidgets('AScope switches to Inter, and to Noto Sans Arabic for ar', (tester) async {
      late TextStyle s;
      await tester.pumpWidget(_app(AScope(child: Builder(builder: (c) {
        s = DefaultTextStyle.of(c).style;
        return const SizedBox();
      }))));
      expect(s.fontFamily, 'Inter');
      expect(s.color, ATokens.light.ink);
      await tester.pumpWidget(_app(AScope(child: Builder(builder: (c) {
        s = DefaultTextStyle.of(c).style;
        return const SizedBox();
      })), rtl: true));
      await tester.pumpAndSettle();
      expect(s.fontFamily, 'Noto Sans Arabic');
      expect(s.fontFamilyFallback, <String>['Inter', 'Nunito']);
    });

    test('lite disables blur; noBlur swaps capsule glass', () {
      final lite = AnacanTokens.resolve(Brightness.light, lite: true);
      expect(lite.blurEnabled, isFalse);
      expect(lite.navCapsule.glass, NavCapsuleTokens.light.glass);
      final nb = AnacanTokens.resolve(Brightness.dark, noBlur: true);
      expect(nb.navCapsule.glass, NavCapsuleTokens.darkNoBlur.glass);
    });
  });

  group('ASheet', () {
    testWidgets('opens, closes with the X button', (tester) async {
      await tester.pumpWidget(_app(Builder(builder: (c) => Center(
            child: GestureDetector(
              onTap: () => showASheet<void>(c, title: const Text('T'), builder: (_) => <Widget>[const Text('Body')]),
              child: const Text('open'),
            ),
          ))));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Body'), findsOneWidget);
      await tester.tap(find.byType(AIconButton));
      await tester.pumpAndSettle();
      expect(find.text('Body'), findsNothing);
    });

    testWidgets('drag down past 25% dismisses; small drag snaps back', (tester) async {
      await tester.pumpWidget(_app(Builder(builder: (c) => Center(
            child: GestureDetector(
              onTap: () => showASheet<void>(c, title: const Text('Title'), full: false, builder: (_) => <Widget>[const SizedBox(height: 300, child: Text('Body'))]),
              child: const Text('open'),
            ),
          ))));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      // Slow small drag on the header: snaps back.
      await tester.timedDrag(find.text('Title'), const Offset(0, 30), const Duration(milliseconds: 600));
      await tester.pumpAndSettle();
      expect(find.text('Body'), findsOneWidget);
      // Slow long drag: > 25% of the sheet height closes.
      await tester.timedDrag(find.text('Title'), const Offset(0, 250), const Duration(milliseconds: 1500));
      await tester.pumpAndSettle();
      expect(find.text('Body'), findsNothing);
    });

    testWidgets('a fast short flick (> 0.4 px/ms by the pointer timestamps) dismisses', (tester) async {
      await tester.pumpWidget(_app(Builder(builder: (c) => Center(
            child: GestureDetector(
              onTap: () => showASheet<void>(c, title: const Text('Title'), full: false, builder: (_) => <Widget>[const SizedBox(height: 300, child: Text('Body'))]),
              child: const Text('open'),
            ),
          ))));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.timedDrag(find.text('Title'), const Offset(0, 60), const Duration(milliseconds: 50));
      await tester.pumpAndSettle();
      expect(find.text('Body'), findsNothing);
    });

    testWidgets('Android back closes, or steps back when onBack is set', (tester) async {
      var backs = 0;
      await tester.pumpWidget(_app(Builder(builder: (c) => Center(
            child: Column(children: <Widget>[
              GestureDetector(onTap: () => showASheet<void>(c, title: const Text('A'), builder: (_) => <Widget>[const Text('BodyA')]), child: const Text('openA')),
              GestureDetector(onTap: () => showASheet<void>(c, title: const Text('B'), onBack: () => backs++, builder: (_) => <Widget>[const Text('BodyB')]), child: const Text('openB')),
            ]),
          ))));
      await tester.tap(find.text('openA'));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('BodyA'), findsNothing);

      await tester.tap(find.text('openB'));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(backs, 1);
      expect(find.text('BodyB'), findsOneWidget);
    });
  });

  group('AToast', () {
    testWidgets('sonner toast shows and auto-dismisses after 4s', (tester) async {
      await tester.pumpWidget(_app(Builder(builder: (c) => GestureDetector(onTap: () => AToastHost.of(c).success('Saved'), child: const Text('go')))));
      await tester.tap(find.text('go'));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('Saved'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 3600));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();
      expect(find.text('Saved'), findsNothing);
    });

    testWidgets('radix toast keeps only one (TOAST_LIMIT 1) and lasts 5s', (tester) async {
      await tester.pumpWidget(_app(Builder(builder: (c) => GestureDetector(
            onTap: () {
              AToastHost.of(c).show(title: 'First');
              AToastHost.of(c).show(title: 'Second', destructive: true);
            },
            child: const Text('go'),
          ))));
      await tester.tap(find.text('go'));
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.text('First'), findsNothing);
      expect(find.text('Second'), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 4900));
      await tester.pumpAndSettle();
      expect(find.text('Second'), findsNothing);
    });
  });

  testWidgets('DesignGallery builds', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: DesignGallery()));
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Dark'), findsOneWidget);
  });
}
