// Ported from: src/components/tools/anacan/SafetyStrip.test.tsx (+ ToolHeader / ToolSectionsBar / ToolEmpty /
//              ToolLoading of src/components/tools/anacan/ToolKit.tsx)
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/settings/ui/settings_ui.dart' show cssUpper;
import 'package:anacan/features/tools/kit/kit.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show MaterialApp;

import '../../../support/i18n_fakes.dart';
import '../../settings/support/harness.dart' show seededStore;

Future<void> pumpKit(WidgetTester tester, Widget child, {List<Override> overrides = const [], bool rtl = false}) async {
  installTestI18n();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      localStoreProvider.overrideWithValue(seededStore(user: {'countryCode': 'AZ'})),
      authProfileProvider.overrideWithValue(null),
      ...overrides,
    ],
    child: MaterialApp(
      theme: buildAnacanTheme(Brightness.light, locale: const Locale('az'), lite: false),
      builder: (context, nav) => MediaQuery(
        data: const MediaQueryData(size: Size(390, 844), disableAnimations: true),
        child: Directionality(textDirection: rtl ? TextDirection.rtl : TextDirection.ltr, child: nav!),
      ),
      home: SingleChildScrollView(child: child),
    ),
  ));
  await tester.pump();
}

void main() {
  group('SafetyStrip', () {
    testWidgets('renders the sign line and a tel: link with the country emergency number', (tester) async {
      final launched = <Uri>[];
      await pumpKit(
        tester,
        const SafetyStrip(signs: 'Zəng edin: qanaxma, baş ağrısı'),
        overrides: [safetyCallLauncherProvider.overrideWithValue((uri) async => launched.add(uri))],
      );
      expect(find.text('Zəng edin: qanaxma, baş ağrısı'), findsOneWidget);
      final call = find.byKey(const ValueKey('safety-strip-call'));
      expect(find.descendant(of: call, matching: find.text('Zəng et 103')), findsOneWidget);
      await tester.tap(call);
      expect(launched.single.toString(), 'tel:103');
    });

    testWidgets('renders a collapsed doctor-check line', (tester) async {
      await pumpKit(tester, const SafetyMore(summary: 'Əvvəlcə həkimlə danışın', text: 'plasenta previa'));
      // <details> starts closed; Flutter does not build the hidden paragraph.
      expect(find.text('plasenta previa'), findsNothing);
      await tester.tap(find.textContaining('Əvvəlcə həkimlə danışın'));
      await tester.pump();
      expect(find.text('plasenta previa'), findsOneWidget);
    });
  });

  group('ToolHeader / ToolSectionsBar', () {
    testWidgets('title, eyebrow, back and actions; no sections outside the hub', (tester) async {
      var backs = 0;
      await pumpKit(
        tester,
        ToolHeader(title: 'Təpik sayğacı', eyebrow: 'Hamiləlik', onBack: () => backs++, actions: const [Text('act')]),
      );
      expect(find.text('Təpik sayğacı'), findsOneWidget);
      expect(find.text(cssUpper('Hamiləlik')), findsOneWidget);
      expect(find.text('act'), findsOneWidget);
      expect(find.byKey(const ValueKey('tool-tab-a')), findsNothing);
      await tester.tap(find.bySemanticsLabel('Geri'));
      expect(backs, 1);
    });

    testWidgets('section tabs (lock on Premium sections), selection and the companion intro/link', (tester) async {
      final selected = <String>[];
      var opened = 0;
      await pumpKit(
        tester,
        ToolSections(
          value: ToolSectionsValue(
            sections: const [ToolSection(id: 'a', label: 'Ağ səs'), ToolSection(id: 'b', label: 'Səs ölçən', locked: true)],
            active: 'a',
            onSelect: selected.add,
            intro: 'Sakit yuxu üçün',
            link: (label: 'Yuxu təlimi', onOpen: () => opened++),
          ),
          child: const ToolHeader(title: 'Ağ səs'),
        ),
      );
      expect(find.byKey(const ValueKey('tool-tab-a')), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('tool-tab-b')), matching: find.byType(AIcon)), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('tool-tab-a')), matching: find.byType(AIcon)), findsNothing);
      // `flex: 1 0 auto`: two short tabs share the row (each wider than its label).
      final aw = tester.getSize(find.byKey(const ValueKey('tool-tab-a'))).width;
      expect(aw, greaterThan(100));
      await tester.tap(find.byKey(const ValueKey('tool-tab-b')));
      expect(selected, ['b']);
      expect(find.text('Sakit yuxu üçün'), findsOneWidget);
      await tester.tap(find.text('Yuxu təlimi'));
      expect(opened, 1);
    });

    testWidgets('a single section and no intro renders no bar', (tester) async {
      await pumpKit(
        tester,
        const ToolSections(
          value: ToolSectionsValue(sections: [ToolSection(id: 'a', label: 'A')], active: 'a'),
          child: ToolSectionsBar(),
        ),
      );
      expect(find.byKey(const ValueKey('tool-tab-a')), findsNothing);
    });
  });

  group('ToolEmpty / ToolLoading / ToolPage', () {
    testWidgets('empty state with text and action', (tester) async {
      await pumpKit(tester, const ToolEmpty(icon: Text('🍼'), title: 'Hələ qeyd yoxdur', text: 'İlk qeydi əlavə edin', action: Text('Əlavə et')));
      expect(find.text('🍼'), findsOneWidget);
      expect(find.text('Hələ qeyd yoxdur'), findsOneWidget);
      expect(find.text('İlk qeydi əlavə edin'), findsOneWidget);
      expect(find.text('Əlavə et'), findsOneWidget);
    });

    testWidgets('loading fills the screen height; page adds the shell padding', (tester) async {
      await pumpKit(tester, const ToolLoading());
      expect(tester.getSize(find.byType(ToolLoading)).height, greaterThanOrEqualTo(844));
      await pumpKit(tester, const ToolPage(child: SizedBox(key: ValueKey('body'), height: 10)));
      expect(tester.getTopLeft(find.byKey(const ValueKey('body'))).dx, 20);
      await pumpKit(tester, const ToolPage(noShell: true, child: SizedBox(key: ValueKey('body2'), height: 10)));
      expect(tester.getTopLeft(find.byKey(const ValueKey('body2'))).dx, 0);
      // ToolPage's scroll-to-top retries (frame + 60 ms).
      await tester.pump(const Duration(seconds: 1));
    });
  });
}
