// Ported from: src/lib/onboarding-i18n.ts, src/lib/stage-names.ts (lifeStageName)
//
// Reviewed bundled copy: first-launch/offline screens cannot depend on a remote translation cache. Lookup:
// the dictionary value `onboarding.<key>` (DB overlay / pack seeds of the 16 new languages), else the bundled
// column of the nine original languages (az fallback). `stage_*` keys are the shared mode labels.

import '../../core/i18n/i18n.dart';
import 'data/onboarding_copy.g.dart';
import 'data/onboarding_intl.g.dart';

export 'data/onboarding_copy.g.dart' show kOnboardingLanguages, kOnboardingCopy;

/// `ONBOARDING_LANGUAGES`.
const List<String> onboardingLanguages = kOnboardingLanguages;

/// `getCachedTranslation(key, language)` (replaceable in tests).
String? Function(String key, String language) onboardingCachedTranslation =
    (key, language) => I18nRuntime.instance.store.lookup(key, language);

/// `lifeStageName(stage, language)`: 'flow' | 'bump' | 'mommy'.
String lifeStageName(String stage, [String? language]) {
  final names = kStageNames[normalizeAppLanguage(language ?? currentLanguage())] ?? kStageNames['az']!;
  return names[stage == 'flow' ? 0 : stage == 'bump' ? 1 : 2];
}

class OnboardingTranslationMissing implements Exception {
  const OnboardingTranslationMissing(this.key);
  final String key;
  @override
  String toString() => 'ONBOARDING_TRANSLATION_MISSING:$key';
}

/// `onboardingText(language, key, values)`; `{name}` placeholders replaced (unknown ones stay).
String onboardingText(String language, String key, [Map<String, Object?> values = const {}]) {
  if (key == 'stage_flow' || key == 'stage_bump' || key == 'stage_mommy') return lifeStageName(key.substring(6), language);
  final index = onboardingLanguages.indexOf(language);
  final column = kOnboardingCopy[key];
  final copy = onboardingCachedTranslation('onboarding.$key', language) ?? column?[index < 0 ? 0 : index];
  if (copy == null) throw OnboardingTranslationMissing(key);
  return copy.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m[1]) ? jsString(values[m[1]]) : m[0]!);
}

/// `onboardingLocale(language)`.
String onboardingLocale(String language) => appLanguageLocale(language);

/// `Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)`.
String onboardingNumber(String language, num value) => formatIntlNumber(language, value, maximumFractionDigits: 2);

/// `Intl.DateTimeFormat(locale, {year, month: '2-digit', day: '2-digit', timeZone: 'UTC'})` of a `YYYY-MM-DD`.
String onboardingDate(String language, String value) {
  final lang = normalizeAppLanguage(language);
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(value);
  if (m == null) return value;
  final template = kOnbDateTemplates[lang] ?? kOnbDateTemplates['en']!;
  final zeroDigit = formatIntlNumber(lang, 0);
  String digits(String text) => zeroDigit == '0'
      ? text
      : text.replaceAllMapped(RegExp('[0-9]'), (d) => String.fromCharCode(zeroDigit.codeUnitAt(0) + d[0]!.codeUnitAt(0) - 48));
  return template
      .replaceAll('{d}', digits(m[3]!))
      .replaceAll('{M}', digits(m[2]!))
      .replaceAll('{y}', digits('${int.parse(m[1]!)}'));
}

/// `new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)` (ICU layout and symbols of
/// the common store currencies; other codes print the ISO code).
String formatCurrency(String language, double amount, String currency) {
  final lang = normalizeAppLanguage(language);
  final code = RegExp(r'^[A-Z]{3}$').hasMatch(currency) ? currency : 'USD';
  final digits = kCurrencyDigits[code] ?? 2;
  final number = formatIntlNumber(lang, amount, maximumFractionDigits: digits, minimumFractionDigits: digits);
  final symbol = kCurrencySymbols[lang]?[code] ?? code;
  return (kCurrencyTemplates[lang] ?? '{c}{n}').replaceAll('{n}', number).replaceAll('{c}', symbol);
}
