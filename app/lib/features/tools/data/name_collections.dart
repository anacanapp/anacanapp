// Ported from: src/lib/name-collections.ts (nameCollectionLanguage)
import '../../../core/i18n/app_languages.dart';

/// The `baby_names_db.lang` collection for a country / app language: US, AU, NZ, IE → English; a country whose
/// flag is an app language → that language; otherwise the app language.
String nameCollectionLanguage(String? country, String language) {
  final code = country?.toUpperCase() ?? '';
  if (const ['US', 'AU', 'NZ', 'IE'].contains(code)) return 'en';
  for (final item in kAppLanguages) {
    if (item.flag.toUpperCase() == code && code.isNotEmpty) return item.code;
  }
  return normalizeAppLanguage(language);
}
