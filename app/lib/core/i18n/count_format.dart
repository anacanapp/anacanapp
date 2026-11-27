// Ported from: src/lib/count-format.ts, src/lib/count-plural.ts, src/lib/recap/numbers.ts (pluralOf),
// src/lib/utils.ts (getOrdinal, turkmenOrdinalSuffix)
import 'app_languages.dart';
import 'generated/app_languages.g.dart';
import 'generated/intl_data.g.dart';
import 'tr.dart';

/// Languages whose simple duration labels use CLDR unit forms (LANGUAGE_EXPANSION_21/23/25).
final Set<String> kCountUnitLanguages = {...kLanguageExpansion21, ...kLanguageExpansion23, ...kLanguageExpansion25};

const Map<String, (String, bool)> _units = {
  'day': ('day', false), 'days': ('day', false), 'gün': ('day', false),
  'week': ('week', false), 'weeks': ('week', false), 'həftə': ('week', false),
  'month': ('month', false), 'months': ('month', false), 'ay': ('month', false),
  'year': ('year', false), 'years': ('year', false), 'il': ('year', false),
  'hour': ('hour', false), 'hours': ('hour', false), 'saat': ('hour', false),
  'minute': ('minute', false), 'minutes': ('minute', false), 'dəqiqə': ('minute', false),
  'min': ('minute', true), 'dəq': ('minute', true),
  'second': ('second', false), 'seconds': ('second', false), 'saniyə': ('second', false),
  'sec': ('second', true), 'san': ('second', true),
};

final RegExp _countTemplate = RegExp(
  r'^\{([A-Za-z_][A-Za-z0-9_]*)\}\s+(day|days|gün|week|weeks|həftə|month|months|ay|year|years|il|hour|hours|saat|minute|minutes|dəqiqə|min|dəq|second|seconds|saniyə|sec|san)\.?$',
  caseSensitive: false,
  unicode: true,
);

/// `formatCountUnit`: `{count} days`-style templates in the 11 expansion languages become CLDR unit
/// text (`1 dzień / 2 dni`). Everything else returns null and goes through normal `formatTr`.
String? formatCountUnit(String language, String template, Map<String, Object?> values) {
  if (!kCountUnitLanguages.contains(language)) return null;
  final match = _countTemplate.firstMatch(template.trim());
  if (match == null) return null;
  final value = values[match[1]!];
  if (value is! num || !value.isFinite) return null;
  final unit = _units[match[2]!.toLowerCase()];
  if (unit == null) return null;
  final patterns = kUnitPatterns[language]?['${unit.$1}:${unit.$2 ? 'short' : 'long'}'];
  if (patterns == null) return null;
  final decimal = _DecimalText.of(value, 2);
  final category = cldrPluralCategory(language, decimal);
  final pattern = patterns[category] ?? patterns['other']!;
  return pattern.replaceAll('{0}', formatIntlNumber(language, value, maximumFractionDigits: 2));
}

/// Decimal digits of a rounded number (the operands CLDR plural rules use).
class _DecimalText {
  _DecimalText(this.integer, this.fraction);

  factory _DecimalText.of(num value, int maximumFractionDigits) {
    final fixed = value.abs().toDouble().toStringAsFixed(maximumFractionDigits);
    final point = fixed.indexOf('.');
    final integer = point < 0 ? fixed : fixed.substring(0, point);
    var fraction = point < 0 ? '' : fixed.substring(point + 1);
    fraction = fraction.replaceFirst(RegExp(r'0+$'), '');
    return _DecimalText(integer, fraction);
  }

  final String integer;
  final String fraction;

  int get i => int.parse(integer.length > 15 ? integer.substring(integer.length - 15) : integer);
  int get v => fraction.length;
  double get n => double.parse(fraction.isEmpty ? integer : '$integer.$fraction');
}

/// CLDR cardinal category (`Intl.PluralRules(locale).select`) for the expansion languages.
String cldrPluralCategory(String language, Object decimalOrNumber) {
  final d = decimalOrNumber is _DecimalText ? decimalOrNumber : _DecimalText.of(decimalOrNumber as num, 3);
  final i = d.i, v = d.v, n = d.n;
  final i10 = i % 10, i100 = i % 100;
  switch (language) {
    case 'hi':
      return i == 0 || n == 1 ? 'one' : 'other';
    case 'pl':
      if (i == 1 && v == 0) return 'one';
      if (v == 0 && i10 >= 2 && i10 <= 4 && (i100 < 12 || i100 > 14)) return 'few';
      if (v == 0 && ((i != 1 && i10 <= 1) || (i10 >= 5) || (i100 >= 12 && i100 <= 14))) return 'many';
      return 'other';
    case 'uk':
    case 'ru':
      if (v == 0 && i10 == 1 && i100 != 11) return 'one';
      if (v == 0 && i10 >= 2 && i10 <= 4 && (i100 < 12 || i100 > 14)) return 'few';
      if (v == 0 && (i10 == 0 || i10 >= 5 || (i100 >= 11 && i100 <= 14))) return 'many';
      return 'other';
    case 'nl':
    case 'sv':
    case 'et':
    case 'en':
    case 'de':
      return i == 1 && v == 0 ? 'one' : 'other';
    case 'ky':
    case 'tk':
      return n == 1 ? 'one' : 'other';
    default:
      return 'other';
  }
}

/// `new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)` with the ICU symbols of
/// the language (generated from Node ICU): grouping (respecting minimum grouping digits), decimal
/// separator, minus sign and digits.
String formatIntlNumber(String language, num value, {int maximumFractionDigits = 3, int minimumFractionDigits = 0}) {
  final symbols = kNumberSymbols[normalizeAppLanguage(language)] ?? kNumberSymbols['en']!;
  final (group, decimal, minus, zero, minGrouping) = symbols;
  var fixed = value.abs().toDouble().toStringAsFixed(maximumFractionDigits);
  var integer = fixed;
  var fraction = '';
  final point = fixed.indexOf('.');
  if (point >= 0) {
    integer = fixed.substring(0, point);
    fraction = fixed.substring(point + 1);
  }
  while (fraction.length > minimumFractionDigits && fraction.endsWith('0')) {
    fraction = fraction.substring(0, fraction.length - 1);
  }
  if (integer.length >= 4 + (minGrouping - 1) && group.isNotEmpty) {
    final buffer = StringBuffer();
    for (var index = 0; index < integer.length; index++) {
      if (index > 0 && (integer.length - index) % 3 == 0) buffer.write(group);
      buffer.write(integer[index]);
    }
    integer = buffer.toString();
  }
  final isZero = double.parse(fixed) == 0;
  var text = fraction.isEmpty ? integer : '$integer$decimal$fraction';
  if (zero != '0') {
    final base = zero.codeUnitAt(0);
    text = text.replaceAllMapped(RegExp('[0-9]'), (m) => String.fromCharCode(base + m[0]!.codeUnitAt(0) - 48));
  }
  return value < 0 && !isZero ? '$minus$text' : text;
}

// ── src/lib/recap/numbers.ts ──

/// `pluralOf`: the project's own CLDR categories (count-plural.ts / recap), independent of ICU.
String pluralOf(String lang, num n) {
  final isInt = n == n.truncate();
  final i = n.abs().floor();
  final m10 = i % 10, m100 = i % 100;
  switch (lang) {
    case 'en':
    case 'de':
    case 'nl':
    case 'sv':
    case 'es':
    case 'et':
      return isInt && i == 1 ? 'one' : 'other';
    case 'pt':
    case 'fr':
    case 'hi':
      return i <= 1 ? 'one' : 'other';
    case 'ru':
    case 'uk':
      if (!isInt) return 'other';
      if (m10 == 1 && m100 != 11) return 'one';
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
      return 'many';
    case 'pl':
      if (!isInt) return 'other';
      if (i == 1) return 'one';
      if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'few';
      return 'many';
    case 'ar':
      if (!isInt) return 'other';
      if (i == 0) return 'zero';
      if (i == 1) return 'one';
      if (i == 2) return 'two';
      if (m100 >= 3 && m100 <= 10) return 'few';
      if (m100 >= 11) return 'many';
      return 'other';
    default:
      return 'other';
  }
}

// ── src/lib/count-plural.ts ──

enum CountNoun { articles, records }

const Map<CountNoun, (String, String)> _countNouns = {
  CountNoun.articles: ('count_articles', '{count} məqalə'),
  CountNoun.records: ('count_records', '{count} qeyd'),
};

String pluralCategory(String language, num count) {
  final category = pluralOf(language, count);
  return category == 'one' || category == 'few' || category == 'many' ? category : 'other';
}

/// `formatCount`: `<noun>_<category>` templates, falling back to `<noun>_other`, then Azerbaijani.
String formatCount(CountNoun noun, num count, {String? language}) {
  final lang = language ?? currentLanguage();
  final safe = count.isFinite ? count : 0;
  final (key, azFallback) = _countNouns[noun]!;
  final category = pluralCategory(lang, safe);
  final fallback = tr('${key}_other', azFallback);
  final template = category == 'other' ? fallback : tr('${key}_$category', fallback);
  return template.replaceAll('{count}', jsString(safe));
}

String weekOrdinal(int week) => formatTr('ordinal_week_label', '{week}. həftə', {'week': week});
String trimesterOrdinal(int trimester) => formatTr('ordinal_trimester_label', '{n}. trimestr', {'n': trimester});

// ── src/lib/utils.ts ──

/// Turkmen ordinal suffix after digits (1-nji, 6-njy, 9-njy, 10-njy, 20-nji, 100-nji).
String turkmenOrdinalSuffix(num num) {
  final n = num.truncate().abs();
  final bool back;
  if (n % 10 != 0) {
    back = n % 10 == 6 || n % 10 == 9;
  } else if (n % 100 != 0) {
    back = const [1, 3, 4, 6, 9].contains((n % 100) ~/ 10);
  } else {
    back = n == 0;
  }
  return back ? 'njy' : 'nji';
}

/// `getOrdinal(num, lang)`.
String getOrdinal(int num, String lang) {
  switch (lang) {
    case 'en':
      final j = num % 10, k = num % 100;
      if (j == 1 && k != 11) return '${num}st';
      if (j == 2 && k != 12) return '${num}nd';
      if (j == 3 && k != 13) return '${num}rd';
      return '${num}th';
    case 'ru':
      return '$num-й';
    case 'kk':
      return '$num-ші';
    case 'uz':
      return '$num-chi';
    case 'ka':
      return '$num-ე';
    case 'de':
      return '$num.';
    case 'ar':
      return '$num';
    case 'zh':
      return '第$num';
    case 'id':
      return 'ke-$num';
    case 'fr':
      return num == 1 ? '1er' : '${num}e';
    case 'es':
    case 'pt':
      return '$num.º';
    case 'vi':
      return 'thứ $num';
    case 'hi':
      return '$numवाँ';
    case 'ja':
      return '第$num';
    case 'ko':
      return '$num번째';
    case 'pl':
      return '$num.';
    case 'nl':
      return '${num}e';
    case 'sv':
      return '$num:${(num % 10 == 1 || num % 10 == 2) && num % 100 != 11 && num % 100 != 12 ? 'a' : 'e'}';
    case 'et':
      return '$num.';
    case 'ky':
      const units = ['', 'чи', 'чи', 'чү', 'чү', 'чи', 'чы', 'чи', 'чи', 'чу'];
      const tens = ['чү', 'чу', 'чы', 'чу', 'чы', 'чү', 'чы', 'чи', 'чи', 'чу'];
      final suffix = num % 10 != 0 ? units[num % 10] : (num % 100 != 0 ? tens[(num % 100) ~/ 10] : 'чү');
      return '$num-$suffix';
    case 'tk':
      return '$num-${turkmenOrdinalSuffix(num)}';
    case 'uk':
      return '$num-й';
  }
  final lastDigit = num % 10;
  if (lastDigit == 0) {
    final tens = num % 100;
    if (tens == 10 || tens == 30) return '$num-cu';
    if (tens == 40 || tens == 60 || tens == 90) return '$num-cı';
    if (tens == 20 || tens == 50 || tens == 70 || tens == 80) return '$num-ci';
    return '$num-cü';
  }
  if (const [1, 2, 5, 7, 8].contains(lastDigit)) return '$num-ci';
  if (const [3, 4].contains(lastDigit)) return '$num-cü';
  if (lastDigit == 6) return '$num-cı';
  if (lastDigit == 9) return '$num-cu';
  return '$num-ci';
}
