// Ported from: src/components/games/word-garden/state.ts, src/components/games/iki-dost/state.ts,
// src/components/games/casual/storage.ts (object-spread update semantics of saved game state).
//
// Saved game objects are kept as ordered JSON maps so that `{...value, key: next}` updates keep
// JavaScript's property order and any unknown properties from an older/newer save survive a
// read→write round trip exactly as they do in the React app.
library;

typedef JsonMap = Map<String, Object?>;

/// `{ ...base, ...changes }` (existing keys keep their position, new keys are appended).
JsonMap spread(JsonMap base, [JsonMap changes = const {}]) => {...base, ...changes};

/// `const { key, ...rest } = value`.
JsonMap omit(JsonMap value, String key) => {
      for (final entry in value.entries)
        if (entry.key != key) entry.key: entry.value,
    };

JsonMap asMap(Object? value) => (value as Map).cast<String, Object?>();
List<Object?> asList(Object? value) => (value as List).cast<Object?>();

/// Structural equality for decoded JSON (map key order ignored, `1 == 1.0`).
bool jsonEquals(Object? a, Object? b) {
  if (a is num && b is num) return a == b;
  if (a is List && b is List) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!jsonEquals(a[i], b[i])) return false;
    }
    return true;
  }
  if (a is Map && b is Map) {
    if (a.length != b.length) return false;
    for (final key in a.keys) {
      if (!b.containsKey(key) || !jsonEquals(a[key], b[key])) return false;
    }
    return true;
  }
  return a == b;
}

/// Deep copy of decoded JSON (`structuredClone`).
Object? jsonClone(Object? value) {
  if (value is Map) return <String, Object?>{for (final e in value.entries) e.key as String: jsonClone(e.value)};
  if (value is List) return [for (final item in value) jsonClone(item)];
  return value;
}

/// JavaScript truthiness of a decoded JSON value.
bool jsTruthy(Object? value) =>
    value != null && value != false && value != '' && !(value is num && (value == 0 || value.isNaN));

/// `Object.entries(value)` for a decoded JSON value (strings expose their characters, other
/// primitives have no own enumerable properties).
List<MapEntry<String, Object?>> jsObjectEntries(Object? value) {
  if (value is Map) return [for (final e in value.entries) MapEntry(e.key as String, e.value)];
  if (value is List) return [for (var i = 0; i < value.length; i++) MapEntry('$i', value[i])];
  if (value is String) return [for (var i = 0; i < value.length; i++) MapEntry('$i', value[i])];
  return const [];
}
