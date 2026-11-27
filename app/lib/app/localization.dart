// Ported from: src/lib/app-languages.ts (APP_LANGUAGES locale tags), src/lib/rtl.ts (dir), src/App.tsx
//              (DirectionProvider)
//
// The WebView needed no framework localizations; Flutter's Material/Cupertino widgets do. The 25 app languages
// are the supported locales. flutter_localizations has tables for 24 of them; Turkmen (`tk`) has none, so the
// fallback delegates load the table of `materialLocaleFor(code)` (tk → ru, as the content fallback does) and,
// if that is unsupported too, English. Text direction never comes from a fallback table: [appDirectionFor]
// wraps the app in the language's own direction (only `ar` is RTL).
import 'package:flutter/widgets.dart';
import 'package:material_ui/material_ui.dart' show GlobalMaterialLocalizations;

import '../core/i18n/app_languages.dart';

/// `Locale` of every bundled language, bundle order (`az-AZ`, `en-US`, …, `ar`, `zh-CN`, …).
final List<Locale> kAppSupportedLocales = List.unmodifiable(
  kAppLanguages.map((l) => l.locale),
);

/// The locale a framework table is loaded for when [locale] has none.
Locale fallbackLocaleFor(Locale locale) {
  if (!kAppLanguageCodes.contains(locale.languageCode))
    return const Locale('en', 'US');
  final mapped = materialLocaleFor(locale.languageCode);
  return mapped.languageCode == locale.languageCode
      ? const Locale('en', 'US')
      : mapped;
}

/// Loads [inner]'s resources for [fallbackLocaleFor] when [inner] has no table for the requested locale.
class FallbackLocalizationsDelegate<T> extends LocalizationsDelegate<T> {
  const FallbackLocalizationsDelegate(this.inner);
  final LocalizationsDelegate<T> inner;

  @override
  Type get type => inner.type;

  Locale _target(Locale locale) {
    var target = fallbackLocaleFor(locale);
    if (!inner.isSupported(target)) target = const Locale('en', 'US');
    return target;
  }

  @override
  bool isSupported(Locale locale) =>
      !inner.isSupported(locale) && inner.isSupported(_target(locale));

  @override
  Future<T> load(Locale locale) => inner.load(_target(locale));

  @override
  bool shouldReload(covariant LocalizationsDelegate<T> old) => false;

  @override
  String toString() => 'FallbackLocalizationsDelegate($inner)';
}

/// Global Material / Cupertino / Widgets tables, then the fallbacks for languages they lack.
final List<LocalizationsDelegate<dynamic>> kAppLocalizationsDelegates = [
  ...GlobalMaterialLocalizations.delegates,
  for (final d in GlobalMaterialLocalizations.delegates)
    FallbackLocalizationsDelegate<dynamic>(d),
];

/// The direction the app renders with (`dir` on `<html>`).
TextDirection appDirectionFor(String language) =>
    textDirectionFor(normalizeAppLanguage(language));
