// Ported from: src/components/tools/DangerSignsScreen.tsx (behaviour checks; the catalogue is covered by
//              test/domain/health/health_test.dart, src/lib/redFlags.test.ts)
import 'package:anacan/domain/health/red_flags.dart';
import 'package:anacan/features/tools/danger_signs/danger_signs_screen.dart';
import 'package:anacan/features/tools/pregnancy_common/pregnancy_ports.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../pregnancy_common/pregnancy_harness.dart';

void main() {
  testWidgets('pregnancy signs, the country emergency number and the partner SOS', (tester) async {
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'bump', 'countryCode': 'TR'}), profile: testProfile({'country_code': 'DE'}));
    final sent = <List<Object?>>[];
    await pumpTool(tester, DangerSignsScreen(onBack: () {}), overrides: [
      ...env.overrides,
      sosAlertPortProvider.overrideWithValue(SosAlertPort(
        hasPartner: true,
        sendSOS: (message, location, type) async {
          sent.add([message, location, type]);
          return null;
        },
      )),
    ]);
    expect(find.text('HAMİLƏLİK DÖVRÜ'), findsOneWidget);
    // Germany (profile country) → 112, not the stored TR or the language.
    await tester.tap(find.byKey(const ValueKey('danger-emergency')));
    expect(env.calls.single.toString(), 'tel:112');

    final first = getDangerSignsForStage('bump').first;
    await tester.tap(find.text(first.title));
    await tester.pump();
    expect(find.text(first.desc), findsOneWidget);
    await tester.tap(find.byKey(ValueKey('danger-partner-${first.id}')));
    await tester.pump();
    await tester.pump();
    expect(sent.single, ['${first.emoji} ${first.title} — dərhal əlaqə saxla!', true, 'emergency']);
    expect(find.text('Xəbərdar edildi ✓'), findsOneWidget);
    await unmount(tester);
  });

  testWidgets('postpartum eyebrow and no partner button by default', (tester) async {
    final env = PregnancyEnv(store: userStore(user: {'lifeStage': 'mommy'}));
    await pumpTool(tester, DangerSignsScreen(onBack: () {}), overrides: env.overrides);
    expect(find.text('DOĞUŞDAN SONRA'), findsOneWidget);
    final first = getDangerSignsForStage('mommy').first;
    await tester.tap(find.text(first.title));
    await tester.pump();
    expect(find.text('Partnyora bildir'), findsNothing);
    await unmount(tester);
  });
}
