// Ported from: (widget coverage of src/components/CalendarScreen.tsx — no React test exists)
import 'package:anacan/core/i18n/i18n.dart' show ensureDateLocales;
import 'package:anacan/features/calendar/calendar_screen.dart';
import 'package:anacan/features/home/appointments/upcoming_appointments.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../home/home_fixtures.dart';
import '../home/home_test_support.dart';

void main() {
  setUpAll(ensureDateLocales);
  setUp(() async => installRealI18n());

  Future<(HomeTestEnv, List<String>)> pump(WidgetTester tester, {String stage = 'bump'}) async {
    final opened = <String>[];
    final env = HomeTestEnv(
      now: fixtureNow,
      stage: stage,
      lastPeriod: stage == 'bump' ? fixtureLmp : DateTime(2026, 11, 10),
      extra: [
        appointmentSheetOpenerProvider.overrideWithValue((context, {appointment, defaultDate}) async {
          opened.add(appointment?.title ?? 'new:${defaultDate?.day}');
        }),
      ],
    );
    addTearDown(env.dispose);
    seedBumpFixtures(env.repo);
    phoneSurface(tester, height: 1400);
    var backs = 0;
    await tester.pumpWidget(env.wrap(CalendarScreen(onBack: () => backs++), scroll: false));
    await settle(tester);
    return (env, opened);
  }

  testWidgets('shows the month, marks appointment days and lists the selected day', (tester) async {
    final (_, opened) = await pump(tester);
    expect(find.text('Noyabr 2026'), findsOneWidget);
    expect(find.text('Bu gün üçün hadisə yoxdur'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('calendar-day-23')));
    await tester.pump();
    // As in React: once as a day event, once as the editable appointment row.
    expect(find.text('Həkim müayinəsi'), findsNWidgets(2));
    expect(find.text('23 Noyabr, Bazar ertəsi'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('calendar-appt-a1')));
    await tester.tap(find.byKey(const ValueKey('calendar-add-soft')));
    expect(opened, ['Həkim müayinəsi', 'new:23']);
  });

  testWidgets('an empty day shows the empty state; months navigate', (tester) async {
    await pump(tester);
    await tester.tap(find.byKey(const ValueKey('calendar-day-5')));
    await tester.pump();
    expect(find.text('Bu gün üçün hadisə yoxdur'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('calendar-next')));
    await tester.pump();
    expect(find.text('Dekabr 2026'), findsOneWidget);
  });

  testWidgets('flow shows the cycle stats and the cycle day', (tester) async {
    await pump(tester, stage: 'flow');
    expect(find.text('gün period'), findsOneWidget);
    expect(find.textContaining('/ 28'), findsOneWidget);
  });
}
