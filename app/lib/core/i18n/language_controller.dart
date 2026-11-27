// Ported from: src/hooks/useLanguage.ts, src/components/LanguageSelector.tsx (change), src/App.tsx (overlay on
// language change), src/lib/rtl.ts (useIsRtl)
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_languages.dart';
import 'overlay.dart';
import 'tr.dart';

/// The process-wide runtime. Override in tests with `i18nRuntimeProvider.overrideWithValue(...)`.
final i18nRuntimeProvider = Provider<I18nRuntime>((ref) => I18nRuntime.instance);

/// Optional `app_languages` source; null keeps the bundled registry.
final activeLanguagesFetcherProvider = Provider<ActiveLanguagesFetcher?>((ref) => null);

/// Active language code. Widgets that call [tr] watch this so they rebuild on a switch
/// (the web reloads the page instead).
final appLanguageProvider = NotifierProvider<AppLanguageController, String>(AppLanguageController.new);

/// Text direction of the active language (`useIsRtl`).
final textDirectionProvider = Provider<TextDirection>((ref) => textDirectionFor(ref.watch(appLanguageProvider)));

/// `Locale` of the active language (region from the registry tag).
final appLocaleProvider = Provider<Locale>((ref) => appLanguage(ref.watch(appLanguageProvider)).locale);

/// Remote `app_languages` merged with the bundle (`fetchActiveLanguages`).
final activeLanguagesProvider = FutureProvider<List<RemoteAppLanguage>>(
  (ref) => fetchActiveLanguages(ref.watch(activeLanguagesFetcherProvider)),
);

/// `disabled_tools` of the active language.
final disabledToolsProvider = Provider<List<String>>((ref) {
  final language = ref.watch(appLanguageProvider);
  final languages = ref.watch(activeLanguagesProvider).value ?? resolveAppLanguages();
  for (final item in languages) {
    if (item.code == language) return item.disabledTools ?? const [];
  }
  return const [];
});

class AppLanguageController extends Notifier<String> {
  @override
  String build() {
    final runtime = ref.watch(i18nRuntimeProvider);
    void listener() {
      if (state != runtime.language) state = runtime.language;
    }

    runtime.languageListenable.addListener(listener);
    ref.onDispose(() => runtime.languageListenable.removeListener(listener));
    return runtime.language;
  }

  /// `changeLanguage` / LanguageSelector `change`: the bundled dictionary is merged before the
  /// switch (throws when it cannot be loaded, the caller shows the retry state), then the choice is
  /// made current and persisted and the DB overlay loads in the background.
  Future<void> changeLanguage(String code) async {
    final runtime = ref.read(i18nRuntimeProvider);
    final lang = normalizeAppLanguage(code);
    if (lang == state) return;
    await runtime.ensureLanguageReady(lang);
    await runtime.setLanguage(lang);
    state = lang;
    if (lang != 'az') unawaited(runtime.loadTranslations(lang));
  }
}
