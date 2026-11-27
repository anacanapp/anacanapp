// Ported from: src/lib/rtl.ts (rtlX), src/styles/anacan-design.css (.a3-enter), framer-motion spring configs
import 'package:anacan/design/design.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('rtlX', () {
    test('LTR keeps the value', () {
      expect(rtlX(20, false), 20);
      expect(rtlXValue('20%', false), '20%');
    });
    test('RTL negates numbers', () => expect(rtlX(20, true), -20));
    test('RTL negates "N%" and "Npx" strings', () {
      expect(rtlXValue('20%', true), '-20%');
      expect(rtlXValue('-12px', true), '12px');
      expect(rtlXValue('0.5px', true), '-0.5px');
    });
    test('RTL leaves other values untouched', () => expect(rtlXValue('auto', true), 'auto'));
  });

  group('a3-enter', () {
    test('nth-child delays: 0, 50 … 250ms, capped from the 6th child', () {
      expect(<int>[for (var i = 0; i < 8; i++) AEnter.delayFor(i).inMilliseconds], <int>[0, 50, 100, 150, 200, 250, 250, 250]);
    });
    test('backwards fill: 16px before the delay, 0 at the end', () {
      expect(AEnter.offsetAt(3, Duration.zero), 16);
      expect(AEnter.offsetAt(3, const Duration(milliseconds: 149)), 16);
      expect(AEnter.offsetAt(3, const Duration(milliseconds: 150 + 560)), 0);
    });

    testWidgets('children rise into place and reduced motion skips it', (tester) async {
      await tester.pumpWidget(const Directionality(
        textDirection: TextDirection.ltr,
        child: AEnter(children: <Widget>[SizedBox(key: Key('a'), height: 10), SizedBox(key: Key('b'), height: 10)]),
      ));
      await tester.pump(const Duration(milliseconds: 20));
      expect(tester.getTopLeft(find.byKey(const Key('b'))).dy, greaterThan(10));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(find.byKey(const Key('b'))).dy, 10);

      await tester.pumpWidget(const MediaQuery(
        data: MediaQueryData(disableAnimations: true),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: AEnter(key: Key('reduced'), children: <Widget>[SizedBox(key: Key('c'), height: 10), SizedBox(key: Key('d'), height: 10)]),
        ),
      ));
      expect(tester.getTopLeft(find.byKey(const Key('d'))).dy, 10);
    });
  });

  group('springs', () {
    test('the common framer config is stiffness 300 / damping 25 / mass 1', () {
      expect(ASprings.standard.stiffness, 300);
      expect(ASprings.standard.damping, 25);
      expect(ASprings.standard.mass, 1);
    });
    test('framer defaults and whileTap scale spring', () {
      expect(ASprings.framerDefault.stiffness, 100);
      expect(ASprings.framerDefault.damping, 10);
      expect(ASprings.tapScale.stiffness, 550);
      expect(ASprings.tapScale.damping, 30);
    });
    test('CSS curves come from the generated tokens', () {
      expect(<double>[ACurves.spring.a, ACurves.spring.b, ACurves.spring.c, ACurves.spring.d], <double>[0.32, 0.72, 0, 1]);
      expect(ACurves.bounce.transform(0.5), greaterThan(1)); // overshoot
    });
  });

  testWidgets('PressScale scales down on press and back on release', (tester) async {
    await tester.pumpWidget(const Directionality(
      textDirection: TextDirection.ltr,
      child: Center(child: PressScale(scale: 0.9, child: SizedBox(key: Key('t'), width: 100, height: 100, child: ColoredBox(color: Color(0xFF000000))))),
    ));
    final g = await tester.startGesture(tester.getCenter(find.byKey(const Key('t'))));
    await tester.pumpAndSettle();
    expect(tester.getSize(find.byKey(const Key('t'))).width, 100); // layout size unchanged
    expect(tester.getRect(find.byKey(const Key('t'))).width, closeTo(90, 0.5));
    await g.up();
    await tester.pumpAndSettle();
    expect(tester.getRect(find.byKey(const Key('t'))).width, closeTo(100, 0.5));
  });
}
