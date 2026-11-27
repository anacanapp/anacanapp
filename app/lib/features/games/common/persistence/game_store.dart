// Ported from: src/lib/local-storage.ts (the synchronous `localStorage` surface game saves use).
//
// Game codecs are synchronous like the React code (`localStorage.getItem/setItem`). The UI layer
// backs [GameStore] with a preloaded snapshot of the platform key/value store and flushes writes;
// tests use [MemoryGameStore].
library;

abstract interface class GameStore {
  String? getItem(String key);

  /// Throws on a failed write (quota); callers report `storageReady = false` like the TS.
  void setItem(String key, String value);
  void removeItem(String key);
  Iterable<String> get keys;
}

class MemoryGameStore implements GameStore {
  MemoryGameStore([Map<String, String>? initial]) : values = {...?initial};
  final Map<String, String> values;

  /// When true every write throws (simulates a full/private store).
  bool failWrites = false;

  @override
  String? getItem(String key) => values[key];

  @override
  void setItem(String key, String value) {
    if (failWrites) throw StateError('QuotaExceededError');
    values[key] = value;
  }

  @override
  void removeItem(String key) => values.remove(key);

  @override
  Iterable<String> get keys => values.keys;

  void clear() => values.clear();
}
