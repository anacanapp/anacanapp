// Ported from: src/lib/books/catalog.ts (BOOK_AGES, BOOK_TOPICS, bookAgeForMonths, homeBookAge, booksForAge,
//              AGE_TINT, tintVars), src/lib/books/pricing.ts, src/components/books/booksCopy.ts (booksText)
//
// The catalogue itself (`Book`, `BOOKS`, `findBook`, covers) is already ported with the play-together tool
// (assets/books/catalog.json, assets/books/covers/<id>.webp); this adds the store helpers.
import 'package:flutter/widgets.dart';

import '../../core/i18n/app_languages.dart';
import '../../core/i18n/tr.dart';
import '../tools/play_together/play_content.dart' show Book, BookCatalog;
import 'books_copy.g.dart';

export '../tools/play_together/play_content.dart' show Book, BookCatalog, bookCatalogProvider, bookCoverAsset;

/// `BOOK_AGES`.
const List<String> kBookAges = ['6m', '1y', '2y', '3y', '4y', '5y', '6y'];

/// `BOOK_TOPICS`.
const List<String> kBookTopics = ['numbers', 'letters', 'logic', 'nature', 'feelings', 'habits', 'art'];

/// `bookAgeForMonths(months)`: 6-11 m → 6m, 12-23 m → 1y … 72 m+ → 6y; null under 5 months or unknown.
String? bookAgeForMonths(num? months) {
  if (months == null || !months.isFinite || months < 5) return null;
  if (months < 12) return '6m';
  final years = (months / 12).floor().clamp(0, 6);
  return '${years}y';
}

/// `homeBookAge(months)`: the child's group, else the youngest group.
String homeBookAge(num? months) => bookAgeForMonths(months) ?? kBookAges.first;

/// `booksForAge(age, limit)`: books of one age group in catalogue order.
List<Book> booksForAge(BookCatalog catalog, String age, [int limit = 10]) => catalog.books.where((b) => b.age == age).take(limit).toList();

/// `AGE_TINT`: accent colours per age group (light bg/ink, dark bg/ink), matched to the cover badges.
const Map<String, ({Color bg, Color ink, Color bgDark, Color inkDark})> kAgeTint = {
  '6m': (bg: Color(0xFFEFE6FF), ink: Color(0xFF6B4BC8), bgDark: Color(0xFF2C2540), inkDark: Color(0xFFC7B6FF)),
  '1y': (bg: Color(0xFFFFF0D6), ink: Color(0xFFB86E00), bgDark: Color(0xFF3A2E1A), inkDark: Color(0xFFFFC56B)),
  '2y': (bg: Color(0xFFFFE4EF), ink: Color(0xFFC2185B), bgDark: Color(0xFF3D2230), inkDark: Color(0xFFFF9CC4)),
  '3y': (bg: Color(0xFFDDF6F0), ink: Color(0xFF0F7F6B), bgDark: Color(0xFF1C3732), inkDark: Color(0xFF7EDCC6)),
  '4y': (bg: Color(0xFFFFE7E1), ink: Color(0xFFD2452F), bgDark: Color(0xFF3D2723), inkDark: Color(0xFFFFA48F)),
  '5y': (bg: Color(0xFFE3E8FF), ink: Color(0xFF3A4FC0), bgDark: Color(0xFF232A45), inkDark: Color(0xFFA9B6FF)),
  '6y': (bg: Color(0xFFFFE3E3), ink: Color(0xFFC62F3A), bgDark: Color(0xFF3E2326), inkDark: Color(0xFFFF9AA1)),
};

/// `.bk-tint-bg` / `.bk-tint-ink` / `.bk-tint-solid` colours of an age group (light or dark pair; solid is the ink
/// with white text in both).
({Color bg, Color ink, Color solid}) bookTint(String age, {required bool dark}) {
  final t = kAgeTint[age] ?? kAgeTint['6m']!;
  return (bg: dark ? t.bgDark : t.bg, ink: dark ? t.inkDark : t.ink, solid: t.ink);
}

// ── pricing.ts ──

/// `BOOK_PRICE_TIERS` (identical to supabase/functions/_shared/book-pricing.ts).
const List<({int min, double unit})> kBookPriceTiers = [(min: 10, unit: 1.5), (min: 5, unit: 2.0), (min: 3, unit: 2.5), (min: 1, unit: 2.99)];
const double kBookBasePrice = 2.99;
const int kMaxBooksPerOrder = 70;

/// `bookUnitPrice(count)`.
double bookUnitPrice(int count) {
  for (final tier in kBookPriceTiers) {
    if (count >= tier.min) return tier.unit;
  }
  return kBookBasePrice;
}

/// `bookOrderTotal(count)`.
double bookOrderTotal(int count) => (bookUnitPrice(count) * count * 100).round() / 100;

/// `nextBookTier(count)`: the next tier that lowers the per-book price.
({int add, double unit})? nextBookTier(int count) {
  for (final tier in kBookPriceTiers.reversed) {
    if (tier.min > count && tier.unit < bookUnitPrice(count)) return (add: tier.min - count, unit: tier.unit);
  }
  return null;
}

/// `formatAzn(value)`: `2,99 ₼`.
String formatAzn(num value) => '${value.toStringAsFixed(2).replaceAll('.', ',')} ₼';

// ── booksCopy.ts ──

/// `booksText(key, language, vars)`: own language, else English, else Azerbaijani; `{name}` placeholders.
String booksText(String key, [String? language, Map<String, Object?> vars = const {}]) {
  final lang = normalizeAppLanguage(language ?? currentLanguage());
  String? pick(String l) {
    final v = kBooksCopy[l]?[key];
    return v != null && v.isNotEmpty ? v : null;
  }

  var text = pick(lang) ?? pick('en') ?? kBooksCopy['az']?[key] ?? key;
  vars.forEach((name, value) => text = text.split('{$name}').join('$value'));
  return text;
}
