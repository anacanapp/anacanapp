// Ported from: node_modules/@capacitor/preferences (8.0.1) native storage layout,
// used by src/lib/session-persistence.ts and src/integrations/supabase/backend-bootstrap.ts.
//
// The Capacitor Preferences plugin stores plain strings:
// - Android: SharedPreferences file "CapacitorStorage" (MODE_PRIVATE), keys unprefixed
//   (android/src/main/java/com/capacitorjs/plugins/preferences/Preferences.java).
// - iOS: UserDefaults.standard, key prefix "CapacitorStorage."
//   (ios/Sources/PreferencesPlugin/Preferences.swift).
// The app never calls Preferences.configure(), so the default group applies on both.
// The native halves live in MainActivity.kt / LegacyPreferencesChannel.kt and AppDelegate.swift.

import 'dart:async';

import 'package:flutter/services.dart';

import 'key_value_store.dart';

/// The Capacitor Preferences store, shared byte-for-byte with the Capacitor
/// build so a rollback finds the same keys.
abstract class LegacyPreferences implements KeyValueStore {
  const LegacyPreferences();
}

/// Platform implementation over the `az.anacan/legacy_prefs` method channel.
///
/// Methods: `get {key}` → String?, `set {key, value}`, `remove {key}`,
/// `keys` → `List<String>`. Errors surface as [PlatformException].
class MethodChannelLegacyPreferences extends LegacyPreferences {
  const MethodChannelLegacyPreferences([this.channel = defaultChannel]);

  static const MethodChannel defaultChannel = MethodChannel('az.anacan/legacy_prefs');

  final MethodChannel channel;

  @override
  Future<String?> get(String key) => channel.invokeMethod<String>('get', {'key': key});

  @override
  Future<void> set(String key, String value) =>
      channel.invokeMethod<void>('set', {'key': key, 'value': value});

  @override
  Future<void> remove(String key) => channel.invokeMethod<void>('remove', {'key': key});

  @override
  Future<Set<String>> keys() async =>
      ((await channel.invokeListMethod<String>('keys')) ?? const <String>[]).toSet();
}

typedef LegacyGetHandler = Future<String?> Function(String key);
typedef LegacySetHandler = Future<void> Function(String key, String value);
typedef LegacyRemoveHandler = Future<void> Function(String key);

/// In-memory fake of the Capacitor store with call logs and overridable
/// handlers (errors, delays) for tests.
class InMemoryLegacyPreferences extends LegacyPreferences {
  InMemoryLegacyPreferences([Map<String, String>? initial]) : values = {...?initial};

  final Map<String, String> values;
  final List<String> getCalls = [];
  final List<MapEntry<String, String>> setCalls = [];
  final List<String> removeCalls = [];

  /// When set, replaces the default behaviour for one call kind. The default
  /// behaviour is available through [defaultGet]/[defaultSet]/[defaultRemove].
  LegacyGetHandler? onGet;
  LegacySetHandler? onSet;
  LegacyRemoveHandler? onRemove;

  Future<String?> defaultGet(String key) async => values[key];
  Future<void> defaultSet(String key, String value) async => values[key] = value;
  Future<void> defaultRemove(String key) async => values.remove(key);

  @override
  Future<String?> get(String key) {
    getCalls.add(key);
    return (onGet ?? defaultGet)(key);
  }

  @override
  Future<void> set(String key, String value) {
    setCalls.add(MapEntry(key, value));
    return (onSet ?? defaultSet)(key, value);
  }

  @override
  Future<void> remove(String key) {
    removeCalls.add(key);
    return (onRemove ?? defaultRemove)(key);
  }

  @override
  Future<Set<String>> keys() async => values.keys.toSet();
}
