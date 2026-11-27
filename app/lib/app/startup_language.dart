// Ported from: src/lib/startup-i18n.ts (storedStartupLanguage → readAppLanguage), src/lib/app-languages.ts
//              (readAppLanguage cold fallback), src/bootstrap-app.tsx (restorePreferences reads Capacitor
//              Preferences)
import '../core/i18n/app_languages.dart' show languageFromWebStorage, normalizeAppLanguage;
import '../core/i18n/language_preferences.dart';
import '../core/i18n/tr.dart' show I18nRuntime;
import '../core/storage/legacy_preferences.dart';
import '../state/local_store.dart';
import '../state/user_store.dart' show userStoreEnvelope;

/// The i18n layer's Preferences access over the Capacitor Preferences channel (same keys and raw values, so a
/// 52/53 install keeps its language and a rollback still finds it).
class LegacyLanguagePreferenceStore implements LanguagePreferenceStore {
  LegacyLanguagePreferenceStore(this.preferences);
  final LegacyPreferences preferences;

  @override
  Future<String?> read(String key) => preferences.get(key);

  @override
  Future<void> write(String key, String value) => preferences.set(key, value);
}

/// `storedStartupLanguage()`: the language the SDK-free screens use. React reads the in-memory store value,
/// which on a bootstrap failure is still the persisted zustand snapshot (`anacan-user-store`), else
/// localStorage `language`, else az. When the i18n runtime already restored the Preferences choice, that wins
/// (it is the value `userStore.language` would hold after `restorePreferences`).
String storedStartupLanguage({LocalStore? store, I18nRuntime? runtime}) {
  final r = runtime;
  if (r != null && r.language.isNotEmpty && r.language != 'az') return r.language;
  if (store == null) return normalizeAppLanguage(r?.language ?? 'az');
  try {
    return languageFromWebStorage(
      userStoreJson: store.getItem(userStoreEnvelope.name),
      languageKey: store.getItem('language'),
    );
  } catch (_) {
    return 'az';
  }
}
