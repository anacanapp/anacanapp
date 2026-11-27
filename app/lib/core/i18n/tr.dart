// Ported from: src/lib/tr.ts (tr, formatTr), src/hooks/useTranslation.ts (t), src/lib/ui-copy.ts (copyText),
// src/lib/startup-i18n.ts (startupText), src/lib/i18n.ts (ensureLanguageReady, getLocaleTag),
// src/bootstrap-app.tsx (restorePreferences / prepareStartupLanguage), src/store/userStore.ts (setLanguage),
// scripts/i18n/inline-localization.mjs (inline key derivation)
import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';

import 'app_languages.dart';
import 'count_format.dart';
import 'generated/startup_copy.g.dart';
import 'js_compat.dart';
import 'language_preferences.dart';
import 'sources.dart';
import 'translation_store.dart';

export 'js_compat.dart' show jsString;

/// Prefix of ui-copy entries inside the per-language dictionaries: `@copy.<section>.<key>`.
const String kCopyKeyPrefix = '@copy.';

/// Process-wide i18n state: the active language (read synchronously by [tr], like `readAppLanguage`)
/// and the [TranslationStore]. Replace [I18nRuntime.instance] in tests or at bootstrap.
class I18nRuntime {
  I18nRuntime({required this.store, this.preferences, this.prepareContent});

  static I18nRuntime? _instance;
  static I18nRuntime get instance => _instance ??= I18nRuntime(store: TranslationStore(assets: BundleI18nAssetSource()));
  static set instance(I18nRuntime runtime) => _instance = runtime;

  final TranslationStore store;
  LanguagePreferenceStore? preferences;

  /// Starts (never awaited) the background content-pack load for a language
  /// (`prepareContentLanguage`); wired by content_packs.
  void Function(String language)? prepareContent;

  String _language = 'az';
  bool _hasSelectedLanguage = false;

  /// Notifies language changes (the Riverpod controller mirrors it).
  final ValueNotifier<String> languageListenable = ValueNotifier<String>('az');

  String get language => _language;
  bool get hasSelectedLanguage => _hasSelectedLanguage;

  /// `setCachedAppLanguage` + in-memory part of `userStore.setLanguage` (no persistence).
  void setLanguageInMemory(Object? value) {
    _language = normalizeAppLanguage(value);
    languageListenable.value = _language;
  }

  /// `userStore.setLanguage`: normalizes, makes it current and persists it to Preferences
  /// (`anacan_app_language`). Call [ensureLanguageReady] first so the next frame is translated.
  Future<void> setLanguage(Object? value) async {
    setLanguageInMemory(value);
    final prefs = preferences;
    if (prefs != null) {
      try {
        await prefs.write(kAppLanguagePreferenceKey, _language);
      } catch (_) {
        // the selection still applies for this session
      }
    }
  }

  Future<void> setHasSelectedLanguage(bool value) async {
    _hasSelectedLanguage = value;
    try {
      await preferences?.write(kHasSelectedLanguagePreferenceKey, '$value');
    } catch (_) {}
  }

  /// `restorePreferences` + `prepareStartupLanguage` (bootstrap-app.tsx): reads Preferences (bounded
  /// by [timeout], a stuck bridge must not hold startup), normalizes, hydrates the disk cache and
  /// merges the bundled dictionary before the first frame. Returns the startup language.
  Future<String> bootstrap({Duration timeout = const Duration(seconds: 3), String? fallbackLanguage}) async {
    String? stored;
    bool selected = false;
    final prefs = preferences;
    if (prefs != null) {
      try {
        await () async {
          stored = await prefs.read(kAppLanguagePreferenceKey);
          selected = await prefs.read(kHasSelectedLanguagePreferenceKey) == 'true';
        }()
            .timeout(timeout);
      } catch (_) {
        debugPrint('[bootstrap] restorePreferences failed');
      }
    }
    final raw = stored;
    setLanguageInMemory(raw != null && raw.isNotEmpty ? raw : (fallbackLanguage ?? _language));
    if (selected) _hasSelectedLanguage = true;
    if (raw != null && raw.isNotEmpty && raw != _language && prefs != null) {
      unawaited(prefs.write(kAppLanguagePreferenceKey, _language).catchError((Object _) {}));
    }
    await store.hydrateFromDisk(_language);
    await ensureLanguageReady(_language);
    return _language;
  }

  /// `ensureLanguageReady`.
  Future<void> ensureLanguageReady(String lang) async {
    lang = normalizeAppLanguage(lang);
    if (lang != 'az') prepareContent?.call(lang);
    await store.ensureLanguageReady(lang);
  }

  /// `loadTranslations` (DB overlay). The web calls it for every non-az language after startup and
  /// on each language change.
  Future<void> loadTranslations(String lang) => store.loadTranslations(lang);

  /// `tr(key, azDefault)`: the active language's dictionary value, else [azDefault].
  /// Note az also consults its dictionary (src/locales/az.json + inline texts), as the web does.
  String tr(String key, String azDefault) => store.lookup(key, _language) ?? azDefault;

  /// `formatTr`: CLDR unit forms for `{count} days`-style templates in the expansion languages,
  /// otherwise `tr` + `{name}` substitution (unknown placeholders stay).
  String formatTr(String key, String azDefault, Map<String, Object?> values) {
    final counted = formatCountUnit(_language, azDefault, values);
    if (counted != null) return counted;
    return substitutePlaceholders(tr(key, azDefault), values);
  }

  /// `useTranslation().t`: az always returns [azDefault]; elsewhere an empty value also falls back.
  String t(String key, String azDefault) {
    if (_language == 'az') return azDefault;
    final cached = store.lookup(key, _language);
    return cached == null || cached.isEmpty ? azDefault : cached;
  }

  /// `copyText(section, key, language, vars)`: own text, else English, else the key (resolved at
  /// export time); `{name}` replaced everywhere. [language] defaults to the active language and
  /// must have been made ready.
  String copyText(String section, String key, {String? language, Map<String, Object?>? vars}) {
    final lang = language == null ? _language : normalizeAppLanguage(language);
    var text = store.lookup('$kCopyKeyPrefix$section.$key', lang) ?? key;
    if (vars != null) {
      vars.forEach((name, value) => text = text.split('{$name}').join(jsString(value)));
    }
    return text;
  }

  /// `getLocaleTag()`.
  String localeTag() => appLanguageLocale(_language);
}

final RegExp _placeholder = RegExp(r'\{([A-Za-z_][A-Za-z0-9_]*)\}');

/// `{name}` substitution of formatTr: only own keys of [values]; others stay verbatim.
String substitutePlaceholders(String template, Map<String, Object?> values) =>
    template.replaceAllMapped(_placeholder, (match) => values.containsKey(match[1]) ? jsString(values[match[1]]) : match[0]!);

/// Active language (`getPersistedLanguage()` / `readAppLanguage()`).
String currentLanguage() => I18nRuntime.instance.language;

/// `tr(key, azDefault)` — synchronous; safe in build methods.
String tr(String key, String azDefault) => I18nRuntime.instance.tr(key, azDefault);

/// `formatTr(key, azDefault, values)`.
String formatTr(String key, String azDefault, Map<String, Object?> values) => I18nRuntime.instance.formatTr(key, azDefault, values);

/// `useTranslation().t(key, azDefault)`.
String t(String key, String azDefault) => I18nRuntime.instance.t(key, azDefault);

/// `copyText(section, key, language, vars)`.
String copyText(String section, String key, {String? language, Map<String, Object?>? vars}) =>
    I18nRuntime.instance.copyText(section, key, language: language, vars: vars);

/// `getLocaleTag()`.
String getLocaleTag() => I18nRuntime.instance.localeTag();

/// `startupText(language, key, fallback)`: SDK-free copy for the language picker and admission
/// errors, available before any dictionary is loaded.
String startupText(String language, String key, String fallback) => kStartupCopy[normalizeAppLanguage(language)]?[key] ?? fallback;

// ── Inline keys (scripts/i18n/inline-localization.mjs) ──

final Map<String, String> _inlineKeys = {};

/// The key the Vite plugin gives literal UI text of a React file:
/// `inline_<basename without .ts/.tsx, lower-cased>_<sha256(text) hex[0:12]>`.
/// [reactFile] is the React source path or file name (`src/components/ads/AdCard.tsx` or `AdCard.tsx`);
/// [azText] is the literal exactly as extracted (trimmed; JSX whitespace collapsed; entities decoded;
/// template literals as `a {inline_0} b`). `node app/tool/i18n/find-key.mjs` looks keys up.
String inlineKey(String reactFile, String azText) {
  final cacheKey = '$reactFile\u0000$azText';
  return _inlineKeys[cacheKey] ??= () {
    final base = reactFile.split('/').last.replaceFirst(RegExp(r'\.tsx?$'), '').toLowerCase();
    final hash = sha256.convert(utf8.encode(azText)).toString().substring(0, 12);
    return 'inline_${base}_$hash';
  }();
}

/// `tr(inlineKey(file, text), text)` — the call the Vite plugin injects for literal JSX text.
String trInline(String reactFile, String azText) => tr(inlineKey(reactFile, azText), azText);

/// `formatTr(inlineKey(file, template), template, {inline_0: …})` — the injected call for template
/// literals. [values] are positional: `inline_0`, `inline_1`, …
String formatTrInline(String reactFile, String template, List<Object?> values) => formatTr(
      inlineKey(reactFile, template),
      template,
      {for (var index = 0; index < values.length; index++) 'inline_$index': values[index]},
    );
