// Ported from: src/lib/followup-content.ts (mapFollowupContent)
//
// Exact source-tuple fallback for legacy Source schemas: explicit server copy (`<field>_<lang>`) wins; otherwise the
// bundled translation bound to `contentTranslationKey(row, field)` (scripts/i18n/followup36-content.json, bundled
// as assets/i18n/followup36-content.json with only its `values`) fills `<field>_<lang>`, then `mapRowsTranslation`.
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/content_packs/content_key.dart' show contentTranslationKey;
import '../../../core/data/data.dart' show mapRowsTranslation;

const String kFollowupContentAsset = 'assets/i18n/followup36-content.json';

/// `copy.values`: translation key → `{lang: value}`. Empty when the asset cannot be read.
final followupContentValuesProvider = FutureProvider<Map<String, Map<String, Object?>>>((ref) async {
  try {
    final decoded = jsonDecode(await rootBundle.loadString(kFollowupContentAsset));
    final values = decoded is Map ? decoded['values'] : null;
    if (values is! Map) return const {};
    return {
      for (final e in values.entries)
        if (e.value is Map) '${e.key}': Map<String, Object?>.from(e.value as Map),
    };
  } catch (_) {
    return const {};
  }
});

/// `mapFollowupContent(rows, language, fields)` with the bundled [values].
List<Map<String, dynamic>> mapFollowupContent(
  List<Map<String, dynamic>>? rows,
  String language,
  List<String> fields, {
  Map<String, Map<String, Object?>> values = const {},
}) {
  final enriched = [
    for (final row in rows ?? const <Map<String, dynamic>>[])
      () {
        final next = Map<String, dynamic>.of(row);
        for (final field in fields) {
          final key = '${field}_$language';
          if (next[key] == null || next[key] == '') {
            final tk = contentTranslationKey(row, field);
            final byLang = tk == null ? null : values[tk];
            if (byLang != null && byLang.containsKey(language) && byLang[language] != null) next[key] = byLang[language];
          }
        }
        return next;
      }(),
  ];
  return mapRowsTranslation(enriched, language, fields);
}
