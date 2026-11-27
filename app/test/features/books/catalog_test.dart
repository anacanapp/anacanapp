// Ported from: src/lib/books/catalog.test.ts
import 'package:anacan/features/books/books_catalog.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support.dart';

void main() {
  group('home carousel age group', () {
    const cases = <(num?, String)>[
      (null, '6m'), (null, '6m'), (0, '6m'), (4, '6m'), (5, '6m'), (11, '6m'),
      (12, '1y'), (23, '1y'), (24, '2y'), (36, '3y'), (48, '4y'), (60, '5y'), (71, '5y'), (72, '6y'), (150, '6y'),
    ];
    for (final (i, (months, age)) in cases.indexed) {
      // vitest prints `undefined` for the second case.
      test('${i == 1 ? 'undefined' : months} months → $age', () => expect(homeBookAge(months), age));
    }

    test('keeps the old card rule for real ages (null under 5 months)', () {
      expect(bookAgeForMonths(4), isNull);
      expect(bookAgeForMonths(5), '6m');
    });

    test('has 10 books for each of the 7 groups', () {
      final catalog = loadCatalog();
      expect(kBookAges, hasLength(7));
      for (final age in kBookAges) {
        final books = booksForAge(catalog, age);
        expect(books, hasLength(10));
        expect(books.every((book) => book.age == age), isTrue);
      }
    });
  });
}
