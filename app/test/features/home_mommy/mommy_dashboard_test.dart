// Ported from: (no RTL suite for MommyDashboard) behaviour of src/components/Dashboard.tsx (MommyDashboard),
//              src/components/mommy/{ChildSelector,BabyCrisisWidget,TeethingWidget,PrematurityBackfillCard}.tsx
import 'package:anacan/core/i18n/date_utils.dart' show ensureDateLocales;
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:anacan/features/baby/widgets/child_selector.dart';
import 'package:anacan/features/home_mommy/mommy_dashboard.dart';
import 'package:anacan/features/home_mommy/widgets/prematurity_backfill_card.dart';
import 'package:anacan/features/home_mommy/widgets/teething_widget.dart';
import 'package:anacan/state/timer_store.dart';
import 'package:flutter/widgets.dart' hide FocusManager;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../design/harness.dart';
import 'support/mommy_fixture.dart';
import 'support/mommy_harness.dart';

void main() {
  setUpAll(() async {
    await ensureDateLocales();
    await loadAnacanFonts();
  });
  late MommyHarness h;
  setUp(() {
    resetChildrenSeedGuard();
    h = MommyHarness(babyBirthDate: '2026-05-20');
    seedMommyFixture(h);
  });
  tearDown(DomainClock.reset);

  Future<void> pumpHome(WidgetTester tester, {Widget? top}) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(mommyApp(
      overrides: h.overrides,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [?top, const MommyDashboard()]),
    ));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  Future<void> tap(WidgetTester tester, Finder f) async {
    // Let earlier toasts (5 s, top of the screen) go so they do not cover the target.
    await tester.pump(const Duration(seconds: 6));
    await tester.ensureVisible(f);
    await tester.pump();
    await tester.tap(f);
    for (var i = 0; i < 4; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
  }

  testWidgets('renders the hero, daily info, message and sections for the selected child', (tester) async {
    await pumpHome(tester);
    expect(find.text('192 gündür Aylin həyatınızdadır'), findsOneWidget);
    expect(find.textContaining('Körpəniz artıq əşyaları'), findsOneWidget);
    expect(find.textContaining('Özünüzə də vaxt ayırın'), findsOneWidget);
    expect(find.text('Bu gün: 2 dəfə'), findsNWidgets(2)); // feeding + diaper
    expect(find.text('Kriz Təqvimi'), findsOneWidget);
    expect(find.text('Diş Çıxarma'), findsOneWidget);
    expect(find.text('2/6'), findsOneWidget); // milestones achieved
    await h.finish(tester);
  });

  testWidgets('switching the child in the selector re-renders the home for that child', (tester) async {
    await pumpHome(tester, top: const Align(alignment: AlignmentDirectional.centerEnd, child: ChildSelector(compact: true)));
    await tap(tester, find.byKey(const ValueKey('child-selector-button')));
    expect(find.byKey(const ValueKey('child-selector-dropdown')), findsOneWidget);
    await tap(tester, find.byKey(const ValueKey('child-option-c2')));
    for (var i = 0; i < 5; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    expect(find.text('64 gündür Elif həyatınızdadır'), findsOneWidget);
    expect(find.textContaining('Körpə səslərə'), findsOneWidget);
    expect(find.text('Bu gün: 0 dəfə'), findsNWidgets(2));
    expect(h.store.getItem('selected-child-storage'), contains('"c2"'));
    await h.finish(tester);
  });

  testWidgets('sleep timer: start, then stop saves a sleep log for the selected child', (tester) async {
    await pumpHome(tester);
    await tap(tester, find.byKey(const ValueKey('sleep-toggle')));
    final timers = tester.element(find.byType(MommyDashboard));
    final container = ProviderScope.containerOf(timers);
    final running = container.read(timerStoreProvider).activeTimers;
    expect(running.single.type, 'sleep');
    expect(running.single.childId, 'c1');
    expect(running.single.childName, 'Aylin', reason: 'two children: the name goes to the lock screen');
    expect(find.text('Yuxu başladı! 😴'), findsOneWidget);
    expect(find.textContaining('Yuxu davam edir'), findsOneWidget);
    await tap(tester, find.byKey(const ValueKey('sleep-toggle')));
    await tester.pump(const Duration(milliseconds: 200));
    expect(container.read(timerStoreProvider).activeTimers, isEmpty);
    final saved = h.repo.logs.where((l) => l['log_type'] == 'sleep' && l['id'] != 'l1').toList();
    expect(saved, hasLength(1));
    expect(saved.single['child_id'], 'c1');
    expect(saved.single['end_time'], isNotNull);
    expect(find.text('Yuxu bitdi! ☀️'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('feeding timer: left breast starts from the picker and Bitir saves breast_left', (tester) async {
    await pumpHome(tester);
    await tap(tester, find.byKey(const ValueKey('feeding-add')));
    await tap(tester, find.byKey(const ValueKey('feed-left')));
    final container = ProviderScope.containerOf(tester.element(find.byType(MommyDashboard)));
    expect(container.read(timerStoreProvider).activeTimers.single.feedType, 'left');
    expect(find.byKey(const ValueKey('feeding-finish')), findsOneWidget);
    await tap(tester, find.byKey(const ValueKey('feeding-finish')));
    expect(container.read(timerStoreProvider).activeTimers, isEmpty);
    expect(h.repo.logs.where((l) => l['feed_type'] == 'breast_left'), hasLength(2));
    expect(find.text('Sol sinə bitti!'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('formula preset is saved with its ml note', (tester) async {
    await pumpHome(tester);
    await tap(tester, find.byKey(const ValueKey('feeding-add')));
    await tap(tester, find.byKey(const ValueKey('feed-formula')));
    await tap(tester, find.byKey(const ValueKey('formula-120')));
    expect(h.repo.logs.where((l) => l['notes'] == '120 ml'), hasLength(1));
    expect(find.text('Süd əvəzedicisi 120 ml 🍼 qeyd edildi!'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('diaper offline: queued in the outbox, shown at once as pending, toast says saved offline', (tester) async {
    await pumpHome(tester);
    h.server.mode = 'offline';
    await tap(tester, find.byKey(const ValueKey('diaper-add')));
    await tap(tester, find.byKey(const ValueKey('diaper-wet')));
    expect(h.outbox.readOutbox('u1'), hasLength(1));
    expect(h.outbox.readOutbox('u1').single.payload['diaper_type'], 'wet');
    expect(find.text('Saxlanıldı, internet gələndə göndəriləcək'), findsOneWidget);
    expect(find.text('Bu gün: 3 dəfə'), findsOneWidget, reason: 'the queued row counts immediately');
    h.server.mode = 'ok';
    await h.outbox.flush('u1');
    await tester.pump(const Duration(milliseconds: 100));
    expect(h.outbox.readOutbox('u1'), isEmpty);
    expect(find.text('Bu gün: 3 dəfə'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('diaper rejected by the server: destructive toast, picker stays open, nothing queued', (tester) async {
    await pumpHome(tester);
    h.server.mode = 'reject';
    await tap(tester, find.byKey(const ValueKey('diaper-add')));
    await tap(tester, find.byKey(const ValueKey('diaper-dirty')));
    expect(find.text('Yadda saxlanılmadı'), findsOneWidget);
    expect(find.byKey(const ValueKey('diaper-dirty')), findsOneWidget);
    expect(h.outbox.readOutbox('u1'), isEmpty);
    await h.finish(tester);
  });

  testWidgets('crisis widget: active crisis at 27 weeks, hidden after week 75', (tester) async {
    await pumpHome(tester);
    expect(find.text('AKTİV KRİZ DÖVRÜ'), findsOneWidget);
    expect(find.text('Məsafələr'), findsOneWidget);
    expect(find.text('+1'), findsOneWidget);
    await h.finish(tester);

    h = MommyHarness(babyBirthDate: '2025-01-01');
    seedMommyFixture(h);
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2025-03-01', due: '2025-03-01')];
    await pumpHome(tester);
    expect(find.text('Kriz Təqvimi'), findsNothing);
    await h.finish(tester);
  });

  testWidgets('crisis widget: upcoming crises before the first leap; detail sheets open', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-08-01', due: '2026-08-01')];
    await pumpHome(tester);
    expect(find.text('Növbəti: 26. həftə'), findsOneWidget);
    expect(find.text('📏 Məsafələr'), findsOneWidget);
    await tap(tester, find.text('📏 Məsafələr'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.textContaining('Aylin • '), findsOneWidget);
    await h.finish(tester);
  });

  test('teething expectations by age', () {
    expect([3, 6, 9, 11, 13, 17, 23, 30].map(expectedTeethFor), [0, 2, 4, 6, 8, 12, 16, 20]);
    expect(nextTeethInfo(30, 20), isNull);
    expect(nextTeethInfo(30, 12)!.$2, 'Tezliklə');
  });

  testWidgets('teething widget shows emerged / expected teeth for the child age', (tester) async {
    await pumpHome(tester);
    expect(find.text('1/20'), findsOneWidget);
    expect(find.text('6 aylıq üçün ~2 diş gözlənilir'), findsOneWidget);
    expect(find.text('Normal inkişaf'), findsOneWidget);
    expect(find.text('Yuxarı mərkəzi kəsicilər'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('prematurity backfill: asked without a due date, term answer saves the birth date', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-05-20')];
    await pumpHome(tester);
    expect(find.text('Aylin vaxtında doğulub?'), findsOneWidget);
    await tap(tester, find.text('Bəli, vaxtında (37+ həftə)'));
    expect(h.repo.dueDates['c1'], '2026-05-20');
    expect(find.text('Aylin vaxtında doğulub?'), findsNothing);
    await h.finish(tester);
  });

  testWidgets('prematurity backfill: preterm weeks give birth + (280 − 7·N) days; dismiss is remembered', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-05-20')];
    await pumpHome(tester);
    await tap(tester, find.text('Vaxtından əvvəl'));
    expect(find.text('34'), findsOneWidget);
    await tap(tester, find.text('-'));
    await tap(tester, find.text('Yadda saxla').first);
    expect(h.repo.dueDates['c1'], pretermDueDate('2026-05-20', 33));
    expect(pretermDueDate('2026-05-20', 33), '2026-07-08');
    await h.finish(tester);

    h = MommyHarness(babyBirthDate: '2026-05-20');
    seedMommyFixture(h, withDueDate: false);
    await pumpHome(tester);
    final close = find.bySemanticsLabel('Bağla');
    await tap(tester, close);
    expect(h.store.getItem(preemieDismissKey('c1')), '1');
    expect(find.text('Aylin vaxtında doğulub?'), findsNothing);
    await h.finish(tester);
  });

  testWidgets('premature child: corrected age line and the Preemie entry', (tester) async {
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-08-01', due: '2026-09-26')];
    await pumpHome(tester);
    expect(find.text('KORREKSİYA OLUNMUŞ YAŞ:'), findsOneWidget);
    expect(find.text('Preemie Bələdçisi'), findsOneWidget);
    await h.finish(tester);
  });
}
