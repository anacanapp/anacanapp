// Ported from: src/components/ToolsHub.gating.test.tsx (+ hub behaviour of src/components/ToolsHub.tsx: merged host
//              sections, initial tool, Android back, analytics, hero order, week gate)
import 'dart:ui' show Tristate;

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/design/design.dart';
import 'package:anacan/features/onboarding/glass_tour.dart' show TourTargets;
import 'package:anacan/features/premium/premium_gates.dart' show PremiumToolBoundary;
import 'package:anacan/features/tools/hub/hub_copy.dart';
import 'package:anacan/features/tools/register.dart';
import 'package:anacan/features/tools/hub/hub_inputs.dart';
import 'package:anacan/features/tools/hub/hub_model.dart';
import 'package:anacan/native/purchases/purchases.dart';
import 'package:anacan/shell/shell.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../support/i18n_fakes.dart';
import 'support/tools_harness.dart';

Finder inSection(String key, String text) => find.descendant(of: find.byKey(TourTargets.key('tools-$key')), matching: find.text(text));

void main() {
  group('ToolsHub loading, offline and search', () {
    testWidgets('shows a skeleton, not "not found", while the first config load runs', (tester) async {
      final h = HubHarness(view: const ToolConfigsView(isPending: true, fetchStatus: FetchStatus.fetching));
      await h.pump(tester);
      expect(find.bySemanticsLabel('Alətlər yüklənir'), findsOneWidget);
      expect(find.text('Alət tapılmadı'), findsNothing);
      await tearDownTree(tester);
    });

    testWidgets('shows an offline/retry card when the load is paused offline or fails', (tester) async {
      var refetched = 0;
      final h = HubHarness(view: ToolConfigsView(isPending: true, fetchStatus: FetchStatus.paused, refetch: () => refetched++));
      await h.pump(tester);
      expect(find.text('Alətlər yüklənmədi'), findsOneWidget);
      expect(find.text('Alət tapılmadı'), findsNothing);
      await tester.tap(find.text('Yenidən cəhd edin'));
      expect(refetched, 1);
      await tearDownTree(tester);

      final failed = HubHarness(view: const ToolConfigsView(isError: true));
      await failed.pump(tester);
      expect(find.text('Alətlər yüklənmədi'), findsOneWidget);
      await tearDownTree(tester);
    });

    testWidgets('search is accent-insensitive and "not found" only appears for a real empty search', (tester) async {
      final h = HubHarness(rows: [cfg('recipes', 'Reseptlər'), cfg('cry-translator', 'Ağlama tərcüməçisi')]);
      await h.pump(tester);
      await tester.enterText(find.byType(EditableText), 'aglama terc');
      await tester.pump();
      expect(find.text('Ağlama tərcüməçisi'), findsOneWidget);
      expect(find.text('Reseptlər'), findsNothing);
      expect(find.text('1 nəticə'), findsOneWidget);
      await tester.enterText(find.byType(EditableText), 'zzz');
      await tester.pump();
      expect(find.text('Alət tapılmadı'), findsOneWidget);
      expect(find.text('"zzz" ilə uyğun alət yoxdur'), findsOneWidget);
      // "Hamısını göstər" clears the search.
      await tester.tap(find.text('Hamısını göstər'));
      await tester.pump();
      expect(find.text('Reseptlər'), findsOneWidget);
      expect(find.text('Ödənişsiz alətlər'), findsOneWidget);
      await tearDownTree(tester);
    });
  });

  group('ToolsHub free vs Premium gating', () {
    testWidgets('limited tools sit in the free section with a hint and open for free users; premium tools show the paywall', (tester) async {
      final h = HubHarness(rows: [
        cfg('recipes', 'Reseptlər', {'premium_type': 'premium_only'}),
        cfg('cry-translator', 'Ağlama tərcüməçisi'),
        cfg('photoshoot', 'Foto çəkiliş', {'premium_type': 'limited_total', 'premium_limit': 3}),
        cfg('poop-scanner', 'Nəcis skaneri', {'premium_type': 'limited_total', 'premium_limit': 3}),
        // Code tools: rows carry order/stage only (is_active false for old builds); name and access come from code.
        cfg('solid-food-guide', 'Əlavə qida (row)', {'is_premium': false, 'is_active': false}),
        cfg('baby-tracker', 'Körpə izləyicisi (row)', {'is_premium': false, 'is_active': false}),
      ]);
      await h.pump(tester);
      final sfg = hubFeature37Text('sfg_home_title', 'az');
      final tracker = babycareText('babytracker_tool_name');
      // recipes (code list); poop-scanner has no in-tool limit, so an admin limited_total keeps it Premium.
      expect(find.text('Pulsuz · limitli'), findsOneWidget);
      // 2026-11-09: Əlavə qida bələdçisi is Premium-only.
      expect(inSection('premium', sfg), findsOneWidget);
      expect(inSection('free', 'Reseptlər'), findsOneWidget);
      expect(inSection('free', 'Foto çəkiliş'), findsNothing);
      expect(inSection('free', 'Nəcis skaneri'), findsNothing);
      expect(inSection('free', tracker), findsNothing);
      expect(inSection('premium', 'Ağlama tərcüməçisi'), findsOneWidget);
      // Fotosessiya: Premium section, but it opens for a free user (no paywall on the tile).
      expect(inSection('premium', 'Foto çəkiliş'), findsOneWidget);
      // Baby tracker stays fully Premium (owner decision 2026-11-08).
      expect(inSection('premium', tracker), findsOneWidget);
      // Free: Reseptlər + the virtual Uşaq məşqləri tile (mommy, az content), as in React.
      expect(find.text('2 alət'), findsOneWidget);
      expect(find.text('5 alət'), findsOneWidget);

      await tester.tap(find.text('Ağlama tərcüməçisi'));
      await tester.pump();
      await tester.pump();
      // The paywall view is attributed to the tool, not the generic 'tool' source.
      expect(h.paywalls, ['cry-translator']);
      await tearDownTree(tester);
    });

    testWidgets('a free user can open a limited tool without the paywall', (tester) async {
      final h = HubHarness(rows: [cfg('horoscope', 'Bürc')]);
      await h.pump(tester);
      await tester.tap(find.text('Bürc'));
      await tester.pump();
      expect(h.paywalls, isEmpty);
      expect(find.text('Ödənişsiz alətlər'), findsNothing);
      // No tool registered for the id: the shell placeholder stands in.
      expect(find.byKey(const ValueKey('placeholder-tool:horoscope')), findsOneWidget);
      await tearDownTree(tester);
    });

    testWidgets('a preview tool opens for a free user; a premium user sees the Premium section as open', (tester) async {
      final h = HubHarness(rows: [cfg('photoshoot', 'Foto çəkiliş')], registry: fakeRegistry([ToolId.photoshoot]));
      await h.pump(tester);
      await tester.tap(find.text('Foto çəkiliş'));
      await tester.pump();
      expect(h.paywalls, isEmpty);
      expect(find.text('tool:photoshoot'), findsOneWidget);
      await tearDownTree(tester);

      final premium = HubHarness(
        context: const HubContext(lifeStage: 'mommy', isPremium: true),
        rows: [cfg('cry-translator', 'Ağlama tərcüməçisi')],
        registry: fakeRegistry([ToolId.cryTranslator]),
        subscription: const SubscriptionState(isPremium: true, entitlementReady: true),
      );
      await premium.pump(tester);
      expect(find.text('Sizdə açıqdır'), findsOneWidget);
      await tester.tap(find.text('Ağlama tərcüməçisi'));
      await tester.pump();
      expect(premium.paywalls, isEmpty);
      expect(find.text('tool:cry-translator'), findsOneWidget);
      expect(find.byType(PremiumToolBoundary), findsOneWidget);
      await tearDownTree(tester);
    });

    testWidgets('mini games are gated directly and cakes always open', (tester) async {
      final h = HubHarness(
        context: const HubContext(lifeStage: 'mommy', language: 'az'),
        rows: [cfg('mini-games', 'row', {'is_premium': true}), cfg('cakes', 'row', {'is_premium': false})],
      );
      await h.pump(tester);
      // mini-games: a DB premium flag makes it Premium; the tile goes through gatedOpenTool → paywall.
      await tester.tap(find.text('Mini Oyunlar'));
      await tester.pump();
      await tester.pump();
      expect(h.paywalls, ['mini-games']);
      await tester.tap(find.text('Tortlar'));
      await tester.pump();
      expect(find.byKey(const ValueKey('placeholder-tool:cakes')), findsOneWidget);
      await tearDownTree(tester);
    });
  });

  group('ToolsHub tools for another stage', () {
    testWidgets('shows an unavailable tile as disabled and explains with a neutral (non-error) message', (tester) async {
      final h = HubHarness(rows: [cfg('kick-counter', 'Təpik sayğacı', {'life_stages': ['bump'], 'is_premium': false})]);
      await h.pump(tester);
      final tile = tester.getSemantics(find.bySemanticsLabel('Təpik sayğacı · Başqa mərhələ üçün'));
      expect(tile.flagsCollection.isEnabled, Tristate.isFalse);
      expect(find.text('Başqa mərhələ üçün'), findsOneWidget);
      await tester.tap(find.text('Təpik sayğacı'));
      await tester.pump();
      expect(find.text('Bu alət hazırkı mərhələ üçün nəzərdə tutulmayıb'), findsOneWidget);
      expect(h.paywalls, isEmpty);
      await tearDownTree(tester);
    });

    testWidgets('a bump tool below its week shows the week hint and a toast', (tester) async {
      final h = HubHarness(
        context: const HubContext(lifeStage: 'bump', currentWeek: 12),
        rows: [cfg('contraction', 'Sancı', {'life_stages': ['bump'], 'is_premium': false, 'min_week': 28})],
      );
      await h.pump(tester);
      expect(find.text('28. həftədən'), findsOneWidget);
      await tester.tap(find.text('Sancı'));
      await tester.pump();
      expect(find.text('Bu alət 28. həftədən açılacaq'), findsOneWidget);
      await tearDownTree(tester);
    });

    testWidgets('admins open every tool regardless of the stage', (tester) async {
      final h = HubHarness(
        context: const HubContext(lifeStage: 'flow', isAdmin: true),
        rows: [cfg('danger-signs', 'Təhlükə', {'life_stages': ['bump'], 'is_premium': false})],
        registry: fakeRegistry([ToolId.dangerSigns]),
      );
      await h.pump(tester);
      expect(find.text('Başqa mərhələ üçün'), findsNothing);
      await tester.tap(find.text('Təhlükə'));
      await tester.pump();
      expect(find.text('tool:danger-signs'), findsOneWidget);
      await tearDownTree(tester);
    });
  });

  group('ToolsHub ordering', () {
    testWidgets('hero tools lead their section in hero_order', (tester) async {
      final h = HubHarness(rows: [
        cfg('first-aid', 'A first', {'is_premium': false}),
        cfg('doctors', 'B second', {'is_premium': false, 'is_hero': true, 'hero_order': 2}),
        cfg('hospital', 'C third', {'is_premium': false, 'is_hero': true, 'hero_order': 1}),
      ]);
      await h.pump(tester);
      final xs = ['C third', 'B second', 'A first'].map((t) => tester.getCenter(find.text(t)).dx).toList();
      expect(xs[0] < xs[1] && xs[1] < xs[2], isTrue);
      await tearDownTree(tester);
    });
  });

  group('ToolsHub open tool, back and analytics', () {
    testWidgets('opening a tool logs tool_opened, back returns to the list and a 5 s visit logs the session', (tester) async {
      final h = HubHarness(rows: [cfg('first-aid', 'İlk yardım', {'is_premium': false})], registry: fakeRegistry([ToolId.firstAid]));
      await h.pump(tester, withOnBack: false);
      await tester.tap(find.text('İlk yardım'));
      await tester.pump();
      expect(find.text('tool:first-aid'), findsOneWidget);
      expect(h.events, ['tool_opened {tool_id: first-aid}']);
      expect(h.back.count(BackLayer.screen), 1);

      h.now = h.now.add(const Duration(seconds: 7));
      expect(h.back.dispatch(), isTrue);
      await tester.pump();
      expect(find.text('İlk yardım'), findsOneWidget);
      expect(h.back.count(BackLayer.screen), 0);
      expect(h.events.last, 'tool_used {tool_id: first-aid, action: session, duration_s: 7}');

      // A short visit is not logged; the header back button closes the tool too.
      await tester.tap(find.text('İlk yardım'));
      await tester.pump();
      h.now = h.now.add(const Duration(seconds: 2));
      await tester.tap(find.bySemanticsLabel('Geri'));
      await tester.pump();
      expect(h.events.where((e) => e.startsWith('tool_used')), hasLength(1));
      await tearDownTree(tester);
    });

    testWidgets('a tool opened from outside (initialTool) goes back through onBack', (tester) async {
      final h = HubHarness(rows: [cfg('first-aid', 'İlk yardım', {'is_premium': false})], registry: fakeRegistry([ToolId.firstAid]));
      await h.pump(tester, initialTool: 'first-aid');
      expect(find.text('tool:first-aid'), findsOneWidget);
      expect(h.events.first, 'tool_opened {tool_id: first-aid}');
      expect(h.back.dispatch(), isTrue);
      expect(h.backs, 1);
      await tearDownTree(tester);
    });

    testWidgets('an initial premium tool for a free user opens the paywall on mount (list view)', (tester) async {
      final h = HubHarness(rows: [cfg('recipes', 'Reseptlər')]);
      await h.pump(tester, initialTool: 'unknown-tool');
      await tester.pump();
      expect(h.paywalls, ['unknown-tool']);
      expect(h.events, isEmpty);
      await tearDownTree(tester);
    });

    testWidgets('an initial premium tool for a free user is guarded and not logged as opened', (tester) async {
      final h = HubHarness(
        rows: [cfg('cry-translator', 'Ağlama tərcüməçisi')],
        registry: fakeRegistry([ToolId.cryTranslator]),
        subscription: const SubscriptionState(loading: true),
      );
      await h.pump(tester, initialTool: 'cry-translator');
      expect(find.byType(PremiumToolBoundary), findsOneWidget);
      expect(find.text('tool:cry-translator'), findsNothing);
      // React keeps the modal for the list view (it is not rendered while a tool shows).
      expect(h.paywalls, isEmpty);
      expect(h.events, isEmpty);
      await tearDownTree(tester);
    });
  });

  group('ToolsHub merged tools', () {
    testWidgets('a merged child tile is hidden; its host shows section tabs and logs section use', (tester) async {
      final h = HubHarness(
        context: const HubContext(lifeStage: 'mommy', isPremium: true),
        rows: [
          cfg('whitenoise', 'Ağ səs', {'is_premium': false, 'description': 'Sakit yuxu'}),
          cfg('noise-meter', 'Səs ölçən', {'is_premium': false}),
        ],
        registry: fakeRegistry([ToolId.whitenoise, ToolId.noiseMeter]),
        subscription: const SubscriptionState(isPremium: true, entitlementReady: true),
      );
      await h.pump(tester);
      expect(find.text('Səs ölçən'), findsNothing);
      await tester.tap(find.text('Ağ səs'));
      await tester.pump();
      expect(find.text('tool:whitenoise'), findsOneWidget);
      expect(find.byKey(const ValueKey('tool-tab-whitenoise')), findsOneWidget);
      expect(find.byKey(const ValueKey('tool-tab-noise-meter')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('tool-tab-noise-meter')));
      await tester.pump();
      expect(find.text('tool:noise-meter'), findsOneWidget);
      expect(h.events.last, 'tool_used {tool_id: whitenoise, action: section, item_id: noise-meter}');
      await tearDownTree(tester);
    });

    testWidgets('a deep link to a merged child opens its host on that section; locked sections carry a lock', (tester) async {
      final h = HubHarness(
        rows: [
          cfg('whitenoise', 'Ağ səs', {'is_premium': false}),
          cfg('noise-meter', 'Səs ölçən'),
        ],
        registry: fakeRegistry([ToolId.whitenoise, ToolId.noiseMeter]),
        subscription: const SubscriptionState(loading: true),
      );
      await h.pump(tester, initialTool: 'white-noise');
      expect(find.text('tool:whitenoise'), findsOneWidget);
      final noiseTab = find.byKey(const ValueKey('tool-tab-noise-meter'));
      expect(find.descendant(of: noiseTab, matching: find.byWidgetPredicate((w) => w is AIcon && w.icon == AIcons.lock)), findsOneWidget);
      expect(find.descendant(of: find.byKey(const ValueKey('tool-tab-whitenoise')), matching: find.byType(AIcon)), findsNothing);
      // The Premium section of a free host is wrapped in the boundary.
      await tester.tap(noiseTab);
      await tester.pump();
      expect(find.byType(PremiumToolBoundary), findsOneWidget);
      await tearDownTree(tester);
    });

    testWidgets('the sleep pair shows the intro and a link to the companion', (tester) async {
      final h = HubHarness(
        context: HubContext(
          lifeStage: 'mommy',
          isPremium: true,
          childBirthDate: '2026-07-01',
          childBirthDates: const ['2026-07-01'],
          now: DateTime(2026, 11, 27),
        ),
        rows: [
          cfg('whitenoise', 'Ağ səs', {'is_premium': false, 'description': 'Sakit yuxu üçün səslər'}),
          cfg('sleep-training', 'row', {'is_active': false}),
        ],
        registry: fakeRegistry([ToolId.whitenoise, ToolId.sleepTraining]),
        subscription: const SubscriptionState(isPremium: true, entitlementReady: true),
      );
      await h.pump(tester);
      await tester.tap(find.text('Ağ səs'));
      await tester.pump();
      expect(find.text('Sakit yuxu üçün səslər'), findsOneWidget);
      final link = babycareText('sleeptraining_title');
      await tester.tap(find.text(link));
      await tester.pump();
      expect(find.text('tool:sleep-training'), findsOneWidget);
      await tearDownTree(tester);
    });
  });

  group('registration', () {
    test('registers the Tools tab (box tab, not fillsViewport)', () {
      final r = FeatureRegistry()..registerAll([registerToolsFeature]);
      final tab = r.tab(ShellTab.tools, partner: false)!;
      expect(tab.fillsViewport, isFalse);
      expect(tab.slivers, isNull);
      expect(r.registeredIds, {'tab:tools'});
    });
  });

  group('ToolsHub tiles', () {
    testWidgets('dark mode paints the icon chip white (.dark .a-tool-icon)', (tester) async {
      final h = HubHarness(rows: [cfg('first-aid', 'İlk yardım', {'is_premium': false})]);
      await h.pump(tester, dark: true);
      final chip = tester.widgetList<Container>(find.descendant(of: find.byKey(TourTargets.key('tool-first-aid')), matching: find.byType(Container)))
          .where((c) => c.decoration is BoxDecoration && (c.decoration! as BoxDecoration).borderRadius == BorderRadius.circular(12));
      expect((chip.first.decoration! as BoxDecoration).color, const Color(0xFFFFFFFF));
      await tearDownTree(tester);
    });

    test('virtual weaning / kid-exercises tiles when their rows are missing', () {
      installTestI18n();
      final tools = buildHubTools(configs([cfg('first-aid', 'İlk yardım', {'is_premium': false})]), HubContext(
        lifeStage: 'mommy',
        language: 'az',
        childBirthDate: '2025-01-01',
        weaningSetting: 'on',
        now: DateTime(2026, 11, 27),
      ));
      expect(tools.map((t) => t.id), ['first-aid', 'weaning', 'kid-exercises']);
      expect(tools[1].name, 'Süddən ayırma');
      expect(tools[2].name, kidExTileText('az').name);
      expect(tools[1].isPremium, isFalse);
    });
  });
}
