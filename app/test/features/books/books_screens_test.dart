// Ported from: src/components/DashboardHomeBlocks.test.tsx ("Books home carousel"), plus behaviour checks of
//              src/components/books/BookStoreScreen.tsx (React has no vitest for the store screen)
import 'package:anacan/features/baby/hooks/use_children.dart';
import 'package:anacan/features/books/book_store_screen.dart';
import 'package:anacan/features/books/books_api.dart';
import 'package:anacan/features/books/books_home.dart';
import 'package:anacan/features/tools/play_together/play_together_tool.dart' show pendingBookOpenProvider, PendingBookOpen;
import 'package:anacan/native/purchases/purchase_analytics.dart';
import 'package:anacan/native/purchases/purchases_providers.dart' show analyticsSinkProvider;
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../settings/support/harness.dart';
import 'support.dart';

List<Override> _overrides({FakeBooksApi? api, RecordingAnalyticsSink? analytics, bool isAdmin = false, LocalStore? store, Child? child, PendingBookOpen? pending}) => [
      ...baseOverrides(isAdmin: isAdmin, store: store),
      diskAssets(),
      booksApiProvider.overrideWithValue(api ?? FakeBooksApi()),
      analyticsSinkProvider.overrideWithValue(analytics ?? RecordingAnalyticsSink()),
      childrenProvider.overrideWith((ref) => ChildrenView(children: [?child], selectedChild: child, loading: false, loadError: false)),
      if (pending != null) pendingBookOpenProvider.overrideWithValue(pending),
    ];

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 4; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pump();
  }
}

void main() {
  setUpAll(loadAnacanFonts);

  group('Books home carousel', () {
    screenTest('shows the 10 books of the child’s age group with cover, title and age', (tester) async {
      await pumpApp(tester, BooksHomeCarousel(childMonths: 28, onOpen: () {}), overrides: _overrides());
      await _settle(tester);
      final rail = find.byKey(const ValueKey('books-home-carousel-2y'));
      expect(rail, findsOneWidget);
      expect(find.descendant(of: rail, matching: find.text('Yaşına uyğun kitablar')), findsOneWidget);
      final expected = loadCatalog().books.where((b) => b.age == '2y').toList();
      final slides = find.byWidgetPredicate((w) => w.key is ValueKey && '${(w.key as ValueKey).value}'.startsWith('books-home-slide-'));
      expect(slides, findsNWidgets(10));
      for (final book in expected) {
        expect(find.descendant(of: rail, matching: find.text(book.title)), findsOneWidget);
      }
      final firstImage = tester.widget<Image>(find.descendant(of: find.byKey(ValueKey('books-home-slide-${expected[0].id}')), matching: find.byType(Image)));
      expect((firstImage.image as AssetImage).assetName, 'assets/books/covers/${expected[0].id}.webp');
      expect(find.descendant(of: find.byKey(ValueKey('books-home-slide-${expected[0].id}')), matching: find.text('2+ yaş')), findsOneWidget);
      expect(find.textContaining('₼'), findsNothing);
    });

    screenTest('falls back to the youngest group without a child age', (tester) async {
      await pumpApp(tester, BooksHomeCarousel(childMonths: null, onOpen: () {}), overrides: _overrides());
      await _settle(tester);
      expect(find.byKey(const ValueKey('books-home-carousel-6m')), findsOneWidget);
    });

    screenTest('opens the book store from a slide and from the header', (tester) async {
      var opened = 0;
      final analytics = RecordingAnalyticsSink();
      await pumpApp(tester, BooksHomeCarousel(childMonths: 8, onOpen: () => opened++), overrides: _overrides(analytics: analytics));
      await _settle(tester);
      final fourth = loadCatalog().books.where((b) => b.age == '6m').toList()[3];
      await tester.ensureVisible(find.byKey(ValueKey('books-home-slide-${fourth.id}')));
      await tester.tap(find.byKey(ValueKey('books-home-slide-${fourth.id}')));
      await tester.tap(find.byKey(const ValueKey('books-home-all')));
      expect(opened, 2);
      expect(analytics.events.any((e) => e.$1 == 'books_reco_clicked' && (e.$2.first as Map)['mode'] == 'mommy_carousel' && (e.$2.first as Map)['age'] == '6m'), isTrue);
    });
  });

  group('Books home card', () {
    screenTest('shows the 6+ month set from pregnancy week 28 and nothing before', (tester) async {
      await pumpApp(tester, Column(children: [BooksHomeCard(mode: 'bump', pregnancyWeek: 27, onOpen: () {}), BooksHomeCard(mode: 'bump', pregnancyWeek: 30, onOpen: () {})]), overrides: _overrides());
      await _settle(tester);
      expect(find.byKey(const ValueKey('books-home-card')), findsOneWidget);
      expect(find.textContaining('· 6+ ay'), findsOneWidget);
    });
  });

  group('Book store', () {
    screenTest('opens on the book handed over by Uşaqla oyun (read once)', (tester) async {
      final book = loadCatalog().books[12];
      final pending = PendingBookOpen()..set(book.id);
      await pumpApp(tester, BookStoreScreen(onBack: () {}), overrides: _overrides(pending: pending), scroll: false);
      await _settle(tester);
      expect(pending.peek(), isNull);
      expect(find.byKey(const ValueKey('book-detail-toggle')), findsOneWidget);
      expect(find.text(book.subtitle), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('book-detail-toggle')));
      await tester.pump();
      expect(find.text('Səbətdə'), findsWidgets);
    });

    screenTest('cart: tier nudge, consent before paying, card checkout in the browser with a pending record', (tester) async {
      final api = FakeBooksApi()..ready = true;
      final store = seededStore();
      final books = loadCatalog().books.where((b) => b.age == '6m').toList();
      await pumpApp(tester, BookStoreScreen(onBack: () {}), overrides: _overrides(api: api, store: store), scroll: false);
      await _settle(tester);
      for (final b in books.take(3)) {
        await tester.ensureVisible(find.byKey(ValueKey('book-add-${b.id}')));
        await tester.tap(find.byKey(ValueKey('book-add-${b.id}')));
        await tester.pump();
      }
      expect(readBooksCart(store), [for (final b in books.take(3)) b.id]);
      expect(find.text('7,50 ₼'), findsWidgets);
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byKey(const ValueKey('books-cartbar')));
      await tester.pump();
      expect(find.byKey(const ValueKey('books-cart-total')), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('books-checkout')));
      await tester.pump();
      expect(api.calls, isEmpty, reason: 'no payment before the digital-delivery consent');
      await tester.tap(find.byKey(const ValueKey('books-consent')));
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('books-checkout')));
      await _settle(tester);
      expect(api.calls, ['checkout:${books.take(3).map((b) => b.id).join(',')}:az', 'open:https://pay.example/1']);
      expect(PendingBooks.read(store)?.orderId, 'order-1');
      await tester.pump(const Duration(seconds: 5));
    });

    screenTest('payments off: users see "soon", admins get the free test grant', (tester) async {
      final api = FakeBooksApi();
      final book = loadCatalog().books.first;
      final store = seededStore(extra: {kBooksCartKey: '["${book.id}"]'});
      await pumpApp(tester, BookStoreScreen(onBack: () {}), overrides: _overrides(api: api, store: store, isAdmin: true), scroll: false);
      await _settle(tester);
      await tester.pump(const Duration(milliseconds: 300));
      await tester.tap(find.byKey(const ValueKey('books-cartbar')));
      await tester.pump();
      expect(find.textContaining('Admin test rejimi'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('books-checkout')));
      await _settle(tester);
      expect(api.calls, ['grant:${book.id}:leyla@example.com']);
      expect(readBooksCart(store), isEmpty);
      await tester.pump(const Duration(seconds: 5));
    });

    screenTest('Kitablarım lists owned books, drops them from the cart and downloads the PDF', (tester) async {
      final book = loadCatalog().books[3];
      final api = FakeBooksApi()..owned = [OwnedBook(bookId: book.id, grantedAt: '2026-01-01', orderId: 'o')];
      final store = seededStore(extra: {kBooksCartKey: '["${book.id}"]'});
      await pumpApp(tester, BookStoreScreen(onBack: () {}, initialTab: 'mine'), overrides: _overrides(api: api, store: store), scroll: false);
      await _settle(tester);
      expect(find.byKey(ValueKey('my-book-${book.id}')), findsOneWidget);
      expect(readBooksCart(store), isEmpty);
      await tester.tap(find.byKey(ValueKey('my-book-download-${book.id}')));
      await _settle(tester);
      expect(api.calls, ['open:https://files.example/${book.id}.pdf']);
    });
  });
}
