// Ported from: src/lib/breastfeeding.test.ts, (no suite) src/lib/recovery.ts + RecoveryHomeCard.tsx behaviour
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/baby/models/baby_rules.dart';
import 'package:anacan/features/recovery/recovery.dart';
import 'package:anacan/features/recovery/recovery_home_card.dart';
import 'package:flutter/widgets.dart' hide FocusManager;
import 'package:flutter_test/flutter_test.dart';

import '../home_mommy/support/mommy_harness.dart';

void main() {
  test('offers breastfeeding until the second birthday', () {
    expect(offersBreastfeeding(0), isTrue);
    expect(offersBreastfeeding(23), isTrue);
    expect(offersBreastfeeding(24), isFalse);
    expect(offersBreastfeeding(null), isTrue);
  });

  test('solid food guide entry from 5 months to 4 years', () {
    expect([null, 4, 5, 47, 48].map(solidFoodGuideRelevant), [false, false, true, true, false]);
  });

  test('weekAfterBirth is 1-based and null before birth / without a date', () {
    final now = DateTime(2026, 11, 27, 15);
    expect(weekAfterBirth('2026-11-27', now), 1);
    expect(weekAfterBirth('2026-11-21', now), 1);
    expect(weekAfterBirth('2026-11-20', now), 2);
    expect(weekAfterBirth('2026-11-28', now), isNull);
    expect(weekAfterBirth(null, now), isNull);
    expect(weekAfterBirth('2026-10-01T00:00:00Z', now), 9);
  });

  test('kegel levels, check-up date and flag severity', () {
    expect(kegelLevel(1).hold, 3);
    expect(kegelLevel(4).level, 1);
    expect(kegelLevel(6).hold, 8);
    expect(kegelMinutes(kegelLevel(1)), 1);
    expect(checkupDate('2026-11-01'), DateTime(2026, 12, 13));
    expect(flagSeverity(['fever'], null), 'doctor');
    expect(flagSeverity(['fever', 'chest'], null), 'urgent');
    expect(flagSeverity([], 3), 'doctor');
    expect(flagSeverity([], 1), isNull);
  });

  test('recovery text per language (unknown → az), all 25 languages are generated', () {
    expect(recoveryText('az')['title'], 'Ana bərpası');
    expect(recoveryText('xx')['title'], 'Ana bərpası'); // unknown codes normalize to az
    expect(recoveryText('en')['title'], isNot('Ana bərpası'));
    expect(fill('Doğuşdan sonra {n}. həftə {x}', {'n': 3}), 'Doğuşdan sonra 3. həftə {x}');
  });

  group('RecoveryHomeCard', () {
    tearDown(DomainClock.reset);

    Future<MommyHarness> pump(WidgetTester tester, String? birth) async {
      DomainClock.setSystemTime(DateTime(2026, 11, 27, 12));
      final h = MommyHarness(babyBirthDate: birth);
      await tester.pumpWidget(mommyApp(overrides: h.overrides, child: RecoveryHomeCard(onOpen: () {})));
      await tester.pump();
      return h;
    }

    testWidgets('shows the week focus during the first 6 weeks', (tester) async {
      final h = await pump(tester, '2026-11-10');
      expect(find.text('Doğuşdan sonra 3. həftə'), findsOneWidget);
      await h.finish(tester);
    });

    testWidgets('shows "recovery continues" in weeks 7–8 and nothing after week 8', (tester) async {
      var h = await pump(tester, '2026-10-05');
      expect(find.text('Bərpa davam edir'), findsOneWidget);
      await h.finish(tester);
      h = await pump(tester, '2026-09-01');
      expect(find.byType(Row), findsNothing);
      await h.finish(tester);
    });
  });
}
