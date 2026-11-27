// Ported from: src/lib/mommy-period.test.ts (mommyPeriodStatus, recentDays), src/components/mommy/MommyPeriodTracker.test.tsx
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/home_mommy/period/mommy_period.dart';
import 'package:anacan/features/home_mommy/period/mommy_period_banner.dart';
import 'package:flutter/widgets.dart' hide FocusManager;
import 'package:flutter_test/flutter_test.dart';

import 'support/mommy_harness.dart';

const T = '2026-10-29';

void main() {
  setUpAll(ensureDateLocales);

  group('mommyPeriodStatus', () {
    test('is none without recorded days', () {
      final s = mommyPeriodStatus([], T, null);
      expect((s.state, s.dayNumber), ('none', 0));
    });
    test('counts the current period from its first day when today is recorded', () {
      expect(mommyPeriodStatus(['2026-10-27', '2026-10-28', '2026-10-29'], T, null), const MommyPeriodStatus('today', '2026-10-27', T, 3));
    });
    test('keeps one missed log inside the same period', () {
      final a = mommyPeriodStatus(['2026-10-26', '2026-10-28', '2026-10-29'], T, null);
      expect((a.start, a.dayNumber), ('2026-10-26', 4));
      final b = mommyPeriodStatus(['2026-10-20', '2026-10-29'], T, null);
      expect((b.start, b.dayNumber), (T, 1));
    });
    test('asks about today when the period was recorded until yesterday', () {
      final s = mommyPeriodStatus(['2026-10-27', '2026-10-28'], T, null);
      expect((s.state, s.dayNumber), ('askToday', 3));
    });
    test('is idle once ended or when the last day is older', () {
      final a = mommyPeriodStatus(['2026-10-28', T], T, T);
      expect((a.state, a.lastDay), ('idle', T));
      expect(mommyPeriodStatus(['2026-10-27', '2026-10-28'], T, '2026-10-28').state, 'idle');
      final c = mommyPeriodStatus(['2026-10-01', '2026-10-02'], T, null);
      expect((c.state, c.start), ('idle', '2026-10-01'));
    });
    test('starts again after an ended period when a new day is recorded', () {
      final s = mommyPeriodStatus(['2026-10-01', T], T, '2026-10-05');
      expect((s.state, s.start, s.dayNumber), ('today', T, 1));
    });
    test('ignores future dates', () {
      expect(mommyPeriodStatus(['2026-10-30'], T, null).state, 'none');
    });
  });

  group('recentDays', () {
    test('returns the last 14 days ending today, across months', () {
      final days = recentDays('2026-11-03');
      expect(days, hasLength(14));
      expect(days.first, '2026-10-21');
      expect(days.last, '2026-11-03');
    });
  });

  group('MommyPeriodBanner', () {
    late MommyHarness h;
    String day(int ago) => formatYmd(subDays(DomainClock.now(), ago));
    List<Map<String, dynamic>> flow(List<int> agos) => [for (final a in agos) {'log_date': day(a), 'flow_intensity': 'unspecified'}];

    setUp(() => h = MommyHarness(babyBirthDate: '2026-01-01'));
    tearDown(() => h.dispose());

    Future<void> pump(WidgetTester tester, {VoidCallback? onOpen}) async {
      await tester.pumpWidget(mommyApp(overrides: h.overrides, child: MommyPeriodBanner(onOpen: onOpen ?? () {})));
      await tester.pump();
      await tester.pump();
    }

    testWidgets('invites to track with the Menstruasiya wording and records today on Başladı', (tester) async {
      var opened = false;
      await pump(tester, onOpen: () => opened = true);
      expect(find.text('Menstruasiyanız bərpa olunub?'), findsOneWidget);
      await tester.tap(find.text('Menstruasiya izləyicinizi və təqviminizi açın'));
      expect(opened, isTrue);
      await tester.tap(find.text('Başladı'));
      await tester.pump();
      expect(h.period.writes.first, MommyPeriodWrite(dates: [day(0)], flow: 'unspecified', preserveExisting: true));
      await h.finish(tester);
    });

    testWidgets('shows the day count and ends the period over its whole range', (tester) async {
      h.period.rows = flow([2, 1, 0]);
      await pump(tester);
      expect(find.text('Gün 3'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('.')).evaluate(), isNotEmpty);
      final pressed = tester.widgetList<Semantics>(find.byType(Semantics)).where((s) => s.properties.toggled == true);
      expect(pressed, hasLength(3));
      await tester.tap(find.text('Bitdi'));
      await tester.pump();
      await tester.pump();
      final input = h.period.writes.first;
      expect(input.complete, isTrue);
      expect(input.dates, [day(2), day(1), day(0)]);
      // Ended today: the card now offers a new start.
      expect(find.text('Başladı'), findsOneWidget);
      expect(h.store.getItem('anacan.mommyPeriod.endedOn.u1'), day(0));
      await h.finish(tester);
    });

    testWidgets('asks about today when recorded until yesterday and logs it on Davam edir', (tester) async {
      h.period.rows = flow([2, 1]);
      await pump(tester);
      expect(find.text('Bu gün də davam edir?'), findsOneWidget);
      await tester.tap(find.text('Davam edir'));
      await tester.pump();
      expect(h.period.writes.first, MommyPeriodWrite(dates: [day(0)], flow: 'unspecified', preserveExisting: true));
      await h.finish(tester);
    });

    testWidgets('toggles a day in the 14-day strip', (tester) async {
      h.period.rows = flow([20]);
      await pump(tester);
      final strip = find.byKey(const ValueKey('period-strip'));
      final days = find.descendant(of: strip, matching: find.byType(GestureDetector));
      expect(days, findsNWidgets(14));
      await tester.tap(days.at(12));
      await tester.pump();
      expect(h.period.writes.first, MommyPeriodWrite(dates: [day(1)], flow: 'unspecified'));
      await h.finish(tester);
    });
  });
}
