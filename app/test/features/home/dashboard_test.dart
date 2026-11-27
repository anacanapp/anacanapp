// Ported from: (widget coverage of src/components/Dashboard.tsx — block order and visibility per stage and data
// state; no React test exists for the frame. src/components/DashboardHomeBlocks.test.tsx covers ParentingHomeCard /
// BooksHomeCarousel, which belong to the mommy and books features and are not ported here.)
import 'dart:async';

import 'package:anacan/core/i18n/i18n.dart' show ensureDateLocales;
import 'package:anacan/features/home/dashboard.dart';
import 'package:anacan/features/home/home_slots.dart';
import 'package:anacan/features/home/home_stage_registry.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../../support/i18n_fakes.dart';
import 'home_fixtures.dart';
import 'home_test_support.dart';

double _y(WidgetTester tester, Key key) => tester.getTopLeft(find.byKey(key)).dy;

void main() {
  setUpAll(ensureDateLocales);
  setUp(installTestI18n);

  Future<HomeTestEnv> pumpHome(
    WidgetTester tester, {
    String stage = 'bump',
    Map<String, dynamic>? profile,
    Object? stories,
    HomeSlots? slots,
    void Function(FakeHomeRepository r)? seed,
    bool settleAll = true,
  }) async {
    final env = HomeTestEnv(
      now: fixtureNow,
      stage: stage,
      lastPeriod: fixtureLmp,
      profile: profile,
      storiesSetting: stories,
      extra: [if (slots != null) homeSlotsProvider.overrideWithValue(slots)],
    );
    addTearDown(env.dispose);
    registerBumpHomeBody();
    seedBumpFixtures(env.repo);
    seed?.call(env.repo);
    phoneSurface(tester, height: 3200);
    await tester.pumpWidget(env.wrap(Dashboard(now: () => fixtureNow)));
    if (settleAll) await settle(tester);
    return env;
  }

  group('bump home', () {
    testWidgets('orders the blocks like Dashboard.tsx', (tester) async {
      await pumpHome(tester);
      final keys = <Key>[
        const ValueKey('dashboard-topbar'),
        const ValueKey('bump-hero'),
        const ValueKey('trimester-tips'),
        const ValueKey('upcoming-add'),
        const ValueKey('quick-vitamin'),
        const ValueKey('blog-rail'),
        const ValueKey('medical-disclaimer'),
      ];
      final ys = [for (final k in keys) _y(tester, k)];
      for (var i = 1; i < ys.length; i++) {
        expect(ys[i], greaterThan(ys[i - 1]), reason: '${keys[i]} after ${keys[i - 1]}');
      }
      expect(find.text('SABAHINIZ XEYİR'), findsOneWidget);
      expect(find.text('Leyla 👋'), findsOneWidget);
      expect(find.text('24. HƏFTƏ,'), findsOneWidget);
      expect(find.text('2. GÜN •'), findsOneWidget);
      expect(find.text('171. gün'), findsOneWidget);
      expect(find.text('109 gün qaldı'), findsOneWidget);
      expect(find.textContaining('Bədəndəki Dəyişikliklər'), findsOneWidget);
      expect(find.textContaining('Günün Tövsiyəsi'), findsOneWidget);
      expect(find.text('61%'), findsOneWidget);
    });

    testWidgets('hides data blocks while empty and on errors (no skeleton except the blog card)', (tester) async {
      await pumpHome(
        tester,
        seed: (r) {
          r.trimesterTipRows = [];
          r.pregnancyContent = {};
          r.weeklyTipRows = [];
          r.blogRows = [];
        },
      );
      expect(find.byKey(const ValueKey('trimester-tips')), findsNothing);
      expect(find.textContaining('Bədəndəki Dəyişikliklər'), findsNothing);
      expect(find.byKey(const ValueKey('blog-rail')), findsNothing);
      // The hero falls back to FRUIT_SIZES.
      expect(find.byKey(const ValueKey('bump-hero-headline')), findsOneWidget);
      expect(find.byKey(const ValueKey('medical-disclaimer')), findsOneWidget);
    });

    testWidgets('shows the blog loading card while posts load, then the rail', (tester) async {
      final gate = Completer<void>();
      final env = await pumpHome(tester, seed: (r) => r.readGate = gate, settleAll: false);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byKey(const ValueKey('blog-rail')), findsNothing);
      expect(find.byKey(const ValueKey('trimester-tips')), findsNothing);
      env.repo.readGate = null;
      gate.complete();
      await settle(tester);
      expect(find.byKey(const ValueKey('blog-rail')), findsOneWidget);
      expect(find.byKey(const ValueKey('trimester-tips')), findsOneWidget);
    });

    testWidgets('error from the backend leaves the hero and static blocks', (tester) async {
      await pumpHome(tester, seed: (r) => r.readError = StateError('offline'));
      expect(find.byKey(const ValueKey('bump-hero')), findsOneWidget);
      expect(find.byKey(const ValueKey('trimester-tips')), findsNothing);
      expect(find.byKey(const ValueKey('quick-vitamin')), findsOneWidget);
    });

    testWidgets('water tap shows the new count before the server answers', (tester) async {
      final env = await pumpHome(tester);
      expect(find.text('0 / 10 stəkan · Bu gün'), findsOneWidget);
      env.repo.gate = Completer<void>();
      await tester.ensureVisible(find.byKey(const ValueKey('bump-water-add')));
      await tester.tap(find.byKey(const ValueKey('bump-water-add')));
      await tester.pump();
      await tester.pump();
      expect(find.text('1 / 10 stəkan · Bu gün'), findsOneWidget);
      expect(env.outbox.readOutbox('u1'), hasLength(1));
      env.repo.gate!.complete();
      env.repo.gate = null;
      await settle(tester);
      expect(find.text('1 / 10 stəkan · Bu gün'), findsOneWidget);
      expect(env.repo.dailyRows[fixtureToday]?['water_intake'], 1);
      expect(env.outbox.readOutbox('u1'), isEmpty);
      expect(find.text('Su əlavə edildi! 💧'), findsOneWidget);
    });

    testWidgets('quick tiles open the tools from the dashboard', (tester) async {
      final env = await pumpHome(tester);
      await tester.ensureVisible(find.byKey(const ValueKey('quick-vitamin')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('quick-vitamin')));
      await tester.tap(find.byKey(const ValueKey('quick-exercise')));
      await tester.tap(find.byKey(const ValueKey('quick-mood')));
      await tester.tap(find.byKey(const ValueKey('dashboard-chat')));
      expect(env.nav.map((n) => '$n'), ['tool:vitamin-tracker', 'tool:safety', 'tool:mood-diary', 'chat:null']);
    });

    testWidgets('red flag banner for a high reading today opens the BP tool', (tester) async {
      final env = await pumpHome(
        tester,
        seed: (r) => r.bpRows = [
          {'systolic': 150, 'diastolic': 95, 'measured_at': fixtureNow.subtract(const Duration(hours: 1)).toUtc().toIso8601String()},
        ],
      );
      expect(find.byKey(const ValueKey('red-flag-banner')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('red-flag-banner')));
      expect(env.nav.single.toString(), 'tool:blood-pressure');
    });

    testWidgets('stories row only when the setting allows it', (tester) async {
      await pumpHome(tester, stories: 'on');
      expect(find.byKey(const ValueKey('dashboard-stories')), findsOneWidget);
      expect(_y(tester, const ValueKey('dashboard-stories')), lessThan(_y(tester, const ValueKey('bump-hero'))));
    });

    testWidgets('recap card, partner card and slots render in their places', (tester) async {
      final env = await pumpHome(
        tester,
        profile: {'linked_partner_id': 'p1'},
        seed: (r) => r.recapResult = {'available': true, 'year': 2026},
        slots: HomeSlots(
          partnerCareCard: (c, stage) => const SizedBox(key: ValueKey('slot-partner'), height: 10),
          bannerSlot: (c, p) => SizedBox(key: ValueKey('slot-$p'), height: 10),
          dailySummaryAutoSync: (c) => const SizedBox(key: ValueKey('slot-sync')),
        ),
      );
      expect(find.byKey(const ValueKey('recap-home-card')), findsOneWidget);
      expect(find.byKey(const ValueKey('slot-sync')), findsOneWidget);
      expect(_y(tester, const ValueKey('slot-home_top')), lessThan(_y(tester, const ValueKey('bump-hero'))));
      expect(_y(tester, const ValueKey('slot-partner')), greaterThan(_y(tester, const ValueKey('quick-vitamin'))));
      expect(_y(tester, const ValueKey('slot-home_bottom')), greaterThan(_y(tester, const ValueKey('blog-rail'))));
      await tester.tap(find.byKey(const ValueKey('recap-home-card')));
      expect(env.nav.single.toString(), 'screen:recap');
    });
  });

  group('other stages', () {
    testWidgets('flow / mommy bodies come from the stage registry (nothing until registered)', (tester) async {
      await pumpHome(tester, stage: 'flow');
      expect(find.byKey(const ValueKey('bump-hero')), findsNothing);
      expect(find.byKey(const ValueKey('dashboard-topbar')), findsOneWidget);
      expect(find.byKey(const ValueKey('medical-disclaimer')), findsOneWidget);
    });

    testWidgets('a registered mommy body sits between the top blocks and the blog', (tester) async {
      registerHomeStageBody('mommy', (context) => const SizedBox(key: ValueKey('mommy-body'), height: 50));
      await pumpHome(
        tester,
        stage: 'mommy',
        slots: HomeSlots(childSelectorCompact: (c) => const SizedBox(key: ValueKey('child-selector'), width: 40, height: 40)),
      );
      expect(find.byKey(const ValueKey('child-selector')), findsOneWidget);
      expect(find.byKey(const ValueKey('dashboard-chat')), findsNothing);
      expect(_y(tester, const ValueKey('mommy-body')), lessThan(_y(tester, const ValueKey('medical-disclaimer'))));
    });

    testWidgets('pregnancy-loss recovery shows only the recovery home', (tester) async {
      await pumpHome(
        tester,
        stage: 'flow',
        stories: 'on',
        profile: {'loss_recovery_active': true},
        slots: HomeSlots(recoveryHome: (c) => const SizedBox(key: ValueKey('recovery'), height: 20)),
      );
      expect(find.byKey(const ValueKey('recovery')), findsOneWidget);
      expect(find.text('Leyla 🤍'), findsOneWidget);
      expect(find.byKey(const ValueKey('dashboard-stories')), findsNothing);
      expect(find.byKey(const ValueKey('blog-rail')), findsNothing);
      expect(find.byKey(const ValueKey('medical-disclaimer')), findsNothing);
    });
  });
}
