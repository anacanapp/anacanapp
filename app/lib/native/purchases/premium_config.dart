// Ported from: src/hooks/usePremiumConfig.ts (usePremiumConfig), src/lib/premium-i18n.ts (localizePremiumRows)
//
// Public Premium catalog (`premium_features`, `premium_plans`, active rows by sort order). Copy falls back to
// the bundled source-bound translations (scripts/i18n/premium-copy.json → data/premium_copy.g.dart), bound to
// the whole source tuple so an edited row never reuses stale copy. An explicit `<field>_<lang>` column wins.

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/cache/cache.dart';
import '../../core/content_packs/content_key.dart' show contentTranslationKey;
import '../../core/data/data.dart';
import '../../core/i18n/i18n.dart';
import 'data/premium_copy.g.dart';

/// `localizePremiumRows(rows, language, fields)`.
List<Map<String, dynamic>> localizePremiumRows(
  List<Map<String, dynamic>> rows,
  String language,
  List<String> fields, {
  List<Map<String, dynamic>> Function(List<Map<String, dynamic>> rows, String language, List<String> fields)? mapRows,
}) {
  final mapped = (mapRows ?? (r, l, f) => mapRowsTranslation(r, l, f))(rows, language, fields);
  if (language == 'az') return mapped;
  return [
    for (var index = 0; index < mapped.length; index++)
      () {
        final row = rows[index], result = {...mapped[index]};
        for (final field in fields) {
          final server = row['${field}_$language'];
          if (server is String && server.trim().isNotEmpty) continue;
          final key = contentTranslationKey(row, field);
          final translated = key == null ? null : kPremiumCopy[key]?[language];
          if (translated != null && translated.isNotEmpty) {
            result[field] = translated;
            result['${field}_$language'] = translated;
          }
        }
        return result;
      }(),
  ];
}

class PremiumCatalog {
  const PremiumCatalog({this.features = const [], this.plans = const [], this.loading = true});
  final List<Map<String, dynamic>> features;
  final List<Map<String, dynamic>> plans;
  final bool loading;
}

/// Source rows are kept; the language is applied at read time (a slower request never overwrites the
/// current language with text localized for an earlier render).
final premiumCatalogQuery = queryProvider<({List<Map<String, dynamic>> features, List<Map<String, dynamic>> plans})>(
  (ref) => QueryOptions(
    queryKey: const ['premium-config'],
    queryFn: (_) async {
      final db = ref.read(dbProvider);
      final results = await Future.wait([
        db.from('premium_features').select().eq('is_active', true).order('sort_order', ascending: true),
        db.from('premium_plans').select().eq('is_active', true).order('sort_order', ascending: true),
      ]);
      return (features: List<Map<String, dynamic>>.from(results[0]), plans: List<Map<String, dynamic>>.from(results[1]));
    },
  ),
  name: 'premiumCatalogQuery',
);

/// `usePremiumConfig()`.
final premiumConfigProvider = Provider<PremiumCatalog>((ref) {
  final q = ref.watch(premiumCatalogQuery);
  final language = ref.watch(appLanguageProvider);
  final data = q.data;
  return PremiumCatalog(
    features: localizePremiumRows(data?.features ?? const [], language, const ['title', 'description']),
    plans: localizePremiumRows(data?.plans ?? const [], language, const ['name', 'description', 'badge_text']),
    loading: !q.isSuccess && !q.isError,
  );
});
