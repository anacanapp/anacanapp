// Ported from: src/lib/i18n.ts (loadTranslations overlay paging, fetchActiveLanguages)
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app_languages.dart';

/// One `translations(key, value, lang)` row.
typedef TranslationRow = ({String key, String value});

/// Soft failure of one page (supabase-js returns `{ error }`): the loop stops, rows fetched so far
/// are still merged, and the language is not marked loaded (retried on the next call).
class TranslationPageError implements Exception {
  const TranslationPageError([this.cause]);
  final Object? cause;
  @override
  String toString() => 'TranslationPageError($cause)';
}

/// Fetches `select key, value from translations where lang = :lang` rows `[from, to]` (inclusive,
/// PostgREST `range`). Throw [TranslationPageError] for a returned error; any other exception
/// aborts the load without merging anything (the web `catch` branch).
abstract interface class TranslationPageFetcher {
  Future<List<TranslationRow>> fetchPage(String lang, int from, int to);
}

/// Page size used by the web client.
const int kTranslationPageSize = 1000;

/// Supabase-backed fetcher. supabase-js reports network and HTTP failures as `{ error }`, so every
/// failure maps to the soft [TranslationPageError] path here.
class SupabaseTranslationPageFetcher implements TranslationPageFetcher {
  SupabaseTranslationPageFetcher(this.client);

  final SupabaseClient client;

  @override
  Future<List<TranslationRow>> fetchPage(String lang, int from, int to) async {
    try {
      final rows = await client.from('translations').select('key, value').eq('lang', lang).range(from, to);
      return [
        for (final row in rows)
          if (row['key'] is String && row['value'] is String) (key: row['key'] as String, value: row['value'] as String),
      ];
    } catch (error) {
      throw TranslationPageError(error);
    }
  }
}

/// Source of the remote `app_languages` rows.
abstract interface class ActiveLanguagesFetcher {
  Future<List<RemoteAppLanguage>> fetch();
}

class SupabaseActiveLanguagesFetcher implements ActiveLanguagesFetcher {
  SupabaseActiveLanguagesFetcher(this.client);

  final SupabaseClient client;

  @override
  Future<List<RemoteAppLanguage>> fetch() async {
    final rows = await client
        .from('app_languages')
        .select('code, name, native_name, is_active, sort_order, disabled_tools')
        .order('sort_order', ascending: true);
    return [for (final row in rows) RemoteAppLanguage.fromRow(row)];
  }
}

/// `fetchActiveLanguages`: bundled languages stay available offline; any failure or an empty
/// answer yields the bundled registry.
Future<List<RemoteAppLanguage>> fetchActiveLanguages(ActiveLanguagesFetcher? fetcher) async {
  if (fetcher == null) return resolveAppLanguages();
  try {
    final rows = await fetcher.fetch();
    if (rows.isEmpty) return resolveAppLanguages();
    return resolveAppLanguages(rows);
  } catch (_) {
    return resolveAppLanguages();
  }
}
