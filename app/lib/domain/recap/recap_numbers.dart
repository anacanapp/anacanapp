// Ported from: src/lib/recap/numbers.ts
//
// Deterministic number, percent and unit formatting for the 25 app languages, without Intl (reduced ICU data on
// some devices would make frames differ). Separator and plural tables: data/recap_data.g.dart.

import 'dart:math' as math;

import '../js_compat.dart';
import 'data/recap_data.g.dart';

const String _nb = ' ';
const String _nnb = ' ';

String formatNumber(String lang, num n, [int decimals = 0]) {
  final s = recapSeparators[lang] ?? recapSeparators['en']!;
  final neg = n < 0;
  final fixed = n.abs().toStringAsFixed(decimals);
  final parts = fixed.split('.');
  final intPart = parts[0];
  final frac = parts.length > 1 ? parts[1] : '';
  final minGroup = (s['minGroup'] as num?)?.toInt() ?? 1;
  final grouped = intPart.length > 3 + (minGroup - 1)
      ? intPart.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => s['group']! as String)
      : intPart;
  return '${neg ? '-' : ''}$grouped${frac.isNotEmpty ? '${s['decimal']}$frac' : ''}';
}

String formatPercent(String lang, num n) {
  final v = formatNumber(lang, jsRound(n));
  if (lang == 'tr') return '%$v';
  if (const ['de', 'ru', 'fr', 'sv', 'pl', 'et', 'kk', 'ky', 'tk', 'uz', 'ka', 'nl', 'es', 'pt'].contains(lang)) {
    return '$v${lang == 'fr' ? _nnb : _nb}%';
  }
  return '$v%';
}

/// 'zero' | 'one' | 'two' | 'few' | 'many' | 'other' (CLDR cardinal categories).
String pluralOf(String lang, num n) {
  final isInt = jsIsInteger(n);
  final i = n.abs().floor(), m10 = i % 10, m100 = i % 100;
  switch (lang) {
    case 'en' || 'de' || 'nl' || 'sv' || 'es' || 'et':
      return isInt && i == 1 ? 'one' : 'other';
    case 'pt' || 'fr' || 'hi':
      return i <= 1 ? 'one' : 'other';
    case 'ru' || 'uk':
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

const Set<String> _glue = {'zh', 'ja', 'ko'};

/// 'day' | 'hour' | 'kilogram'
typedef RecapUnit = String;

String formatUnit(String lang, num n, RecapUnit unit, [int decimals = 0]) {
  final rounded = double.parse(n.toStringAsFixed(decimals));
  final value = formatNumber(lang, rounded, jsIsInteger(rounded) ? 0 : decimals);
  if (unit == 'kilogram') return '$value${_glue.contains(lang) && lang == 'zh' ? '' : _nb}${recapKg[lang] ?? 'kg'}';
  final table = unit == 'day' ? recapDayForms : recapHourForms;
  final forms = table[lang] ?? table['en']!;
  final word = forms[pluralOf(lang, rounded)] ?? forms['other']!;
  return _glue.contains(lang) ? '$value$word' : '$value$_nb$word';
}

/// 24-hour clock, "22:00".
String formatHour(num hour) => '${math.max(0, math.min(23, hour.floor())).toString().padLeft(2, '0')}:00';
