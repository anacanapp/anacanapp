// Ported from: (no vitest file for PlayTogetherTool.tsx) — behaviour checks of the port: the default band, today's
// picks, played / favourite state under the WebView key, the category filter, the book strip and sheet (Azerbaijani
// only) and the analytics events.
import 'package:anacan/domain/play_together/play_together.dart';
import 'package:anacan/features/tools/kit/kit.dart' show ToolHeader;
import 'package:anacan/features/tools/play_together/play_together_tool.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../more_support/more_harness.dart';

void main() {
  setUpAll(BabyToolsHarness.loadRealI18n);
  late MoreToolsHarness h;
  late List<String> opened;
  setUp(() {
    h = MoreToolsHarness();
    opened = [];
    h.extra.add(playOpenBookStoreProvider.overrideWithValue(opened.add));
  });

  Future<void> settle(WidgetTester tester) async {
    // Asset files are read from disk for real: wait until the page left the loading state.
    for (var i = 0; i < 100 && find.byType(ToolHeader).evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
      await tester.pump(const Duration(milliseconds: 50));
    }
    await tester.pump();
  }

  Finder byPrefix(String prefix) => find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key! as ValueKey).value}'.startsWith(prefix));

  testWidgets('opens on the 2-year band without a child with three picks, the screen-time guide and books', (tester) async {
    await h.pump(tester, PlayTogetherTool(onBack: () {}));
    await settle(tester);
    expect(find.text('Uşaqla oyun'), findsWidgets);
    expect(byPrefix('play-pick-'), findsNWidgets(3));
    expect(find.textContaining('📵'), findsOneWidget);
    expect(byPrefix('play-book-'), findsWidgets);
    expect(h.lastEvent('play_together_opened'), {'band': '2y', 'has_child': false});
    await h.finish(tester);
  });

  testWidgets('a band choice is stored, the game screen logs played once a day and toggles the favourite', (tester) async {
    await h.pump(tester, PlayTogetherTool(onBack: () {}));
    await settle(tester);
    await tester.ensureVisible(find.byKey(const ValueKey('play-band-3y')));
    await tester.tap(find.byKey(const ValueKey('play-band-3y')));
    await tester.pump();
    expect(parsePlayState(h.store.getItem(playStateKey('u1'))).band, '3y');
    final first = byPrefix('play-row-').first;
    final id = '${(tester.widget(first).key! as ValueKey).value}'.substring('play-row-'.length);
    await tester.tap(first);
    await tester.pump();
    expect(h.lastEvent('play_game_viewed')['game'], id);
    await tester.tap(find.byKey(const ValueKey('play-played')));
    await tester.pump();
    expect(h.eventNames, contains('play_game_done'));
    var stored = parsePlayState(h.store.getItem(playStateKey('u1')));
    expect(playedOn(stored, dayKey(DateTime.now())), {id});
    expect(find.text('Bu gün oynadıq'), findsWidgets);
    await tester.tap(find.byKey(const ValueKey('play-fav')));
    await tester.pump();
    stored = parsePlayState(h.store.getItem(playStateKey('u1')));
    expect(stored.favs, [id]);
    await tester.tap(find.byKey(const ValueKey('play-played')));
    await tester.pump();
    expect(playedOn(parsePlayState(h.store.getItem(playStateKey('u1'))), dayKey(DateTime.now())), isEmpty);
    await h.finish(tester);
  });

  testWidgets('filters by category and shows the favourites hint when empty', (tester) async {
    await h.pump(tester, PlayTogetherTool(onBack: () {}));
    await settle(tester);
    await tester.ensureVisible(find.byKey(const ValueKey('play-cat-favs')));
    await tester.tap(find.byKey(const ValueKey('play-cat-favs')));
    await tester.pump();
    expect(byPrefix('play-row-'), findsNothing);
    expect(find.text('Ürəyə toxunub oyunları sevimlilərə əlavə edin.'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const ValueKey('play-cat-move')));
    await tester.tap(find.byKey(const ValueKey('play-cat-move')));
    await tester.pump();
    expect(byPrefix('play-row-'), findsWidgets);
    await h.finish(tester);
  });

  testWidgets('a book opens the sheet and the store link hands the book id to the PDF store', (tester) async {
    await h.pump(tester, PlayTogetherTool(onBack: () {}));
    await settle(tester);
    final book = byPrefix('play-book-').first;
    final id = '${(tester.widget(book).key! as ValueKey).value}'.substring('play-book-'.length);
    await tester.ensureVisible(book);
    await tester.tap(book);
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('play-book-sheet')), findsOneWidget);
    expect(h.lastEvent('play_book_clicked'), {'book_id': id, 'from': 'age'});
    await tester.tap(find.byKey(const ValueKey('play-open-store')));
    await tester.pumpAndSettle(const Duration(milliseconds: 50));
    expect(find.byKey(const ValueKey('play-book-sheet')), findsNothing);
    expect(opened, [id]);
    await h.finish(tester);
  });

  testWidgets('other languages load their own text and hide the Azerbaijani-only books', (tester) async {
    h.setLanguage('en');
    addTearDown(() => h.setLanguage('az'));
    await h.pump(tester, PlayTogetherTool(onBack: () {}));
    await settle(tester);
    expect(find.text('Play together'), findsWidgets);
    expect(byPrefix('play-book-'), findsNothing);
    await h.finish(tester);
  });
}
