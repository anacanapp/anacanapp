// Ported from: src/lib/session-persistence.ts, src/integrations/supabase/backend-bootstrap.ts
// (the `@capacitor/preferences` get/set/remove/keys surface they depend on).

import 'dart:async';

import 'package:shared_preferences/shared_preferences.dart';

/// Minimal async string store: the surface of Capacitor `Preferences` that the
/// admission, session and migration logic use. Implemented by
/// [LegacyPreferences] (the Capacitor store itself) and by
/// [SharedPreferencesKeyValueStore] (Flutter-owned data).
abstract interface class KeyValueStore {
  Future<String?> get(String key);
  Future<void> set(String key, String value);
  Future<void> remove(String key);
  Future<Set<String>> keys();
}

/// Flutter-owned key/value data (Android `FlutterSharedPreferences`, iOS
/// `UserDefaults` keys prefixed `flutter.`). Never read by the Capacitor app.
class SharedPreferencesKeyValueStore implements KeyValueStore {
  SharedPreferencesKeyValueStore([Future<SharedPreferences>? instance])
      : _instance = instance ?? SharedPreferences.getInstance();

  final Future<SharedPreferences> _instance;

  @override
  Future<String?> get(String key) async => (await _instance).getString(key);

  @override
  Future<void> set(String key, String value) async {
    if (!await (await _instance).setString(key, value)) {
      throw StateError('shared_preferences write failed');
    }
  }

  @override
  Future<void> remove(String key) async {
    await (await _instance).remove(key);
  }

  @override
  Future<Set<String>> keys() async => (await _instance).getKeys();
}

/// In-memory [KeyValueStore] for tests and for a memory-only fallback.
class InMemoryKeyValueStore implements KeyValueStore {
  InMemoryKeyValueStore([Map<String, String>? initial]) : values = {...?initial};

  final Map<String, String> values;

  @override
  Future<String?> get(String key) async => values[key];

  @override
  Future<void> set(String key, String value) async => values[key] = value;

  @override
  Future<void> remove(String key) async => values.remove(key);

  @override
  Future<Set<String>> keys() async => values.keys.toSet();
}
