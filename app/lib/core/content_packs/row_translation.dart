// Ported from: src/lib/tr.ts (mapRowTranslation, mapRowsTranslation)
import 'dart:convert';

import '../i18n/app_languages.dart';
import 'content_translations.dart';

/// Kyrgyz/Turkmen readers get Russian while a pack shard is missing; other pack languages English.
const Set<String> kRuFallbackLanguages = {'ky', 'tk'};

/// Pack lookup used by [mapRowTranslation]; defaults to [ContentTranslations.instance].
typedef BundledContentLookup = Object? Function(Map<String, dynamic> row, String field, String language);

Object? _defaultLookup(Map<String, dynamic> row, String field, String language) =>
    ContentTranslations.instance?.lookup(row, field, language);

/// Fallback chain of `mapRowTranslation`, per language (first non-null wins):
///
/// * az: `field_az`, `field`
/// * pack languages (16): `field_<lang>`, pack translation, [ky/tk: `field_ru`], `field_en`, `field_az`, `field`
/// * kk / uz / ka: `field_<lang>`, `field_ru`, `field`, `field_az`
/// * de / ar: `field_<lang>`, `field_en`, `field`, `field_az`
/// * en / ru / tr: `field_<lang>`, `field`, `field_az`
///
/// When the base column is an array and the chosen value is a string, it is JSON-parsed; if that
/// fails, a multi-line string is split into trimmed non-empty lines, else the base array is kept.
/// A pack value is also projected into `field_<lang>` so re-mapping a mapped row is idempotent.
Map<String, dynamic>? mapRowTranslation(
  Map<String, dynamic>? row,
  String language,
  List<String> fields, {
  BundledContentLookup lookup = _defaultLookup,
}) {
  if (row == null) return null;
  final result = Map<String, dynamic>.of(row);
  for (final field in fields) {
    Object? value;
    var bundledField = false;
    Object? col(String suffix) => row['${field}_$suffix'];
    if (language == 'az') {
      value = col('az') ?? row[field];
    } else if (isPackLanguage(language)) {
      final bundled = lookup(row, field, language);
      bundledField = col(language) == null && bundled != null;
      value = col(language) ?? bundled ?? (kRuFallbackLanguages.contains(language) ? col('ru') : null) ?? col('en') ?? col('az') ?? row[field];
    } else if (language == 'kk' || language == 'uz' || language == 'ka') {
      value = col(language) ?? col('ru') ?? row[field] ?? col('az');
    } else if (language == 'de' || language == 'ar') {
      value = col(language) ?? col('en') ?? row[field] ?? col('az');
    } else {
      value = col(language) ?? row[field] ?? col('az');
    }

    if (row[field] is List && value is String) {
      final text = value;
      try {
        value = jsonDecode(text);
      } catch (_) {
        value = text.contains('\n') ? text.split('\n').map((line) => line.trim()).where((line) => line.isNotEmpty).toList() : row[field];
      }
    }

    result[field] = value;
    if (bundledField) result['${field}_$language'] = value;
  }
  return result;
}

/// `mapRowsTranslation`.
List<Map<String, dynamic>> mapRowsTranslation(
  List<Map<String, dynamic>>? rows,
  String language,
  List<String> fields, {
  BundledContentLookup lookup = _defaultLookup,
}) {
  if (rows == null) return const [];
  return [for (final row in rows) mapRowTranslation(row, language, fields, lookup: lookup)!];
}
