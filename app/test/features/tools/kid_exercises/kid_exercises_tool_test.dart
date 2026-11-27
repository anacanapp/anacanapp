// Ported from: (no vitest file for KidExercisesTool.tsx) — behaviour checks of the port: the child's age group,
// today's picks, the done / favourite state stored under the WebView key, search, the exercise screen with prev /
// next and the stopwatch, and the analytics events.
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/domain/kid_exercises/kid_exercises.dart';
import 'package:anacan/features/tools/kid_exercises/kid_exercises_tool.dart';
import 'package:anacan/features/tools/kit/kit.dart' show ToolHeader;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more_support/more_harness.dart';

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late MoreToolsHarness h;
  setUp(() => h = MoreToolsHarness());

  Future<void> settle(WidgetTester tester) async {
    // Asset files are read from disk for real: wait until the page left the loading state.
    for (var i = 0; i < 100 && find.byType(ToolHeader).evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.pump();
  }

  testWidgets('opens on the 0-1 group without a child, picks three exercises and logs the open', (tester) async {
    await h.pump(tester, KidExercisesTool(onBack: () {}));
    await settle(tester);
    expect(find.text('Uşaq məşqləri'), findsWidgets);
    expect(find.byKey(const ValueKey('kidex-set-0-1')), findsOneWidget);
    expect(find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key! as ValueKey).value}'.startsWith('kidex-pick-')), findsNWidgets(3));
    expect(h.lastEvent('kid_exercises_opened'), {'set': '0-1', 'has_child': false, 'language': 'az'});
    expect(find.byKey(const ValueKey('kidex-row-0-1/01_tummy_time')), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('picking another group is stored under the WebView key and search filters the list', (tester) async {
    await h.pump(tester, KidExercisesTool(onBack: () {}));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('kidex-set-2-3')));
    await tester.pump();
    expect(parseKidExState(h.store.getItem(kidExStorageKey('u1'))).set, '2-3');
    expect(find.byKey(const ValueKey('kidex-row-0-1/01_tummy_time')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('kidex-set-0-1')));
    await tester.pump();
    await tester.enterText(find.byKey(const ValueKey('kidex-search')), 'qarin ustə');
    await tester.pump();
    expect(find.byKey(const ValueKey('kidex-row-0-1/01_tummy_time')), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('kidex-search')), 'zzzz');
    await tester.pump();
    expect(find.text('Uyğun məşq tapılmadı.'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('the exercise screen marks done, toggles the favourite and walks the list', (tester) async {
    await h.pump(tester, KidExercisesTool(onBack: () {}));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('kidex-row-0-1/01_tummy_time')));
    await tester.pump();
    expect(h.lastEvent('kid_exercise_viewed'), {'exercise': '0-1/01_tummy_time', 'from': 'list'});
    expect(find.text('Qarın üstə uzanma'), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('kidex-done')));
    await tester.pump();
    expect(find.text('Bu gün etdik'), findsOneWidget);
    expect(h.lastEvent('kid_exercise_done'), {'exercise': '0-1/01_tummy_time', 'set': '0-1'});
    await tester.tap(find.byKey(const ValueKey('kidex-fav')));
    await tester.pump();
    final stored = parseKidExState(h.store.getItem(kidExStorageKey('u1')));
    expect(stored.favs, ['0-1/01_tummy_time']);
    expect(doneOn(stored, dayKey(DateTime.now())), {'0-1/01_tummy_time'});
    // First of the list: no previous; next opens the second row.
    await tester.tap(find.byKey(const ValueKey('kidex-prev')));
    await tester.pump();
    expect(find.text('Qarın üstə uzanma'), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('kidex-next')));
    await tester.pump();
    expect(find.text('Bu gün etdik'), findsNothing);
    await h.finish(tester);
  });

  testWidgets('the stopwatch counts and resets', (tester) async {
    await h.pump(tester, KidExercisesTool(onBack: () {}));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('kidex-row-0-1/01_tummy_time')));
    await tester.pump();
    expect(find.text('00:00'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('kidex-play')));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 1300)));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('00:00'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('kidex-play')));
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('kidex-reset')));
    await tester.pump();
    expect(find.text('00:00'), findsOneWidget);
    await h.finish(tester);
  });

  testWidgets('a child selects its own group and shows the current-age badge', (tester) async {
    DomainClock.setSystemTime(DateTime(2026, 11, 27, 10));
    addTearDown(DomainClock.reset);
    h.repo.children = [childRow('c1', name: 'Aylin', birth: '2026-07-01')];
    await h.pump(tester, KidExercisesTool(onBack: () {}));
    await settle(tester);
    expect(find.textContaining('Aylin'), findsNothing);
    expect(find.text('İNDİKİ YAŞ'), findsWidgets);
    await h.finish(tester);
  });
}
