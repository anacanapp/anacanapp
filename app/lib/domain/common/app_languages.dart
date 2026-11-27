// Ported from: src/lib/app-languages.ts (registry lookups only; the i18n runtime owns the full registry)

import 'data/app_languages_data.g.dart';

/// `normalizeAppLanguage`: 'en-US' / 'EN_us' → 'en'; unknown → 'az'.
String normalizeAppLanguage(Object? value) {
  final code = value is String ? value.trim().toLowerCase().replaceAll('_', '-').split('-')[0] : '';
  return appLanguagesData.any((l) => l['code'] == code) ? code : 'az';
}

/// `appLanguageLocale`.
String appLanguageLocale(String code) =>
    appLanguagesData.firstWhere((l) => l['code'] == normalizeAppLanguage(code))['locale']!;

/// Country flag (lower-case ISO code) of the language's default region.
String appLanguageFlag(String code) => appLanguagesData.firstWhere((l) => l['code'] == normalizeAppLanguage(code))['flag']!;

final List<String> appLanguageCodes = [for (final l in appLanguagesData) l['code']!];
