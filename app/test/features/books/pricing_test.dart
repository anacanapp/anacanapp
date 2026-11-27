// Ported from: src/lib/books/pricing.test.ts
import 'dart:io';

import 'package:anacan/features/books/books_catalog.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

void main() {
  group('printable book pricing', () {
    test('lowers the price per book with the bundle size (2.99 → 1.50 AZN)', () {
      expect([1, 2, 3, 4, 5, 9, 10, 70].map(bookUnitPrice).toList(), [2.99, 2.99, 2.5, 2.5, 2, 2, 1.5, 1.5]);
      expect([1, 3, 5, 10].map(bookOrderTotal).toList(), [2.99, 7.5, 10, 15]);
    });

    test('nudges to the next cheaper tier', () {
      expect(nextBookTier(1), (add: 2, unit: 2.5));
      expect(nextBookTier(4), (add: 1, unit: 2.0));
      expect(nextBookTier(10), isNull);
    });

    test('is identical to the server copy', () {
      // The Dart tiers / base price / order cap must equal supabase/functions/_shared/book-pricing.ts.
      final server = File('../supabase/functions/_shared/book-pricing.ts').readAsStringSync();
      final tiers = [for (final m in RegExp(r'\{ min: (\d+), unit: ([\d.]+) \}').allMatches(server)) (min: int.parse(m[1]!), unit: double.parse(m[2]!))];
      expect(tiers, kBookPriceTiers);
      expect(double.parse(RegExp(r'BOOK_BASE_PRICE = ([\d.]+)').firstMatch(server)![1]!), kBookBasePrice);
      expect(int.parse(RegExp(r'MAX_BOOKS_PER_ORDER = (\d+)').firstMatch(server)![1]!), kMaxBooksPerOrder);
    });
  });

  group('book catalog', () {
    test('has 70 books, 10 per age group, each with a cover', () {
      final catalog = loadCatalog();
      expect(catalog.books, hasLength(70));
      for (final age in ['6m', '1y', '2y', '3y', '4y', '5y', '6y']) {
        expect(catalog.books.where((book) => book.age == age), hasLength(10));
      }
      for (final book in catalog.books) {
        expect(File(bookCoverAsset(book.id)).existsSync(), isTrue, reason: book.id);
      }
    });

    test('matches the age group to the child', () {
      expect([3, 6, 11, 12, 30, 47, 70, 90].map(bookAgeForMonths).toList(), [null, '6m', '6m', '1y', '2y', '3y', '5y', '6y']);
    });
  });
}
