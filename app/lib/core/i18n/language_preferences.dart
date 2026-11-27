// Ported from: src/bootstrap-app.tsx (restorePreferences), src/store/userStore.ts (setLanguage)

/// Capacitor Preferences keys that hold the language choice on native (Preferences
/// `anacan_app_language` = normalized code, `anacan_has_selected_language` = "true"/"false").
const String kAppLanguagePreferenceKey = 'anacan_app_language';
const String kHasSelectedLanguagePreferenceKey = 'anacan_has_selected_language';

/// Web keys (localStorage) that also hold it: `language` (plain code) and the zustand snapshot
/// `anacan-user-store` (`state.language`). Only relevant to the localStorage migration path.
const String kWebLanguageKey = 'language';
const String kWebUserStoreKey = 'anacan-user-store';

/// The small key-value interface the i18n layer needs for the persisted language choice.
///
/// Implemented elsewhere (app/lib/native/): reads/writes the Capacitor Preferences store
/// (iOS `UserDefaults` with the `CapacitorStorage.` prefix, Android `CapacitorStorage`
/// SharedPreferences) so a 52/53 install keeps its language and a rollback to Capacitor still
/// finds it. Values are plain strings exactly as Capacitor stores them.
abstract interface class LanguagePreferenceStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
}

/// In-memory implementation (tests, web).
class MemoryLanguagePreferenceStore implements LanguagePreferenceStore {
  MemoryLanguagePreferenceStore([Map<String, String>? initial]) : values = {...?initial};

  final Map<String, String> values;

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;
}
