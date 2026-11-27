// Ported from: window.localStorage as used across src/ (direct `localStorage.getItem/setItem` callers,
// zustand `persist` (src/store/*), src/lib/local-storage.ts quotaManagedStorage).
//
// One key-value store with the SAME keys and raw string values as the WebView localStorage of the
// Capacitor app, so feature ports keep their key names and JSON shapes 1:1 and values imported from the
// 53.0 export (MigrationImport) work unchanged.
//
// - Reads are synchronous after [LocalStore.load] (localStorage is synchronous on the web).
// - Writes update memory at once and reach disk debounced (default 250 ms), temp file + rename, JSON
//   encoded off the UI isolate when the store is large. [flush] writes now (call on app pause).
// - No byte quota: a file has no 5 MB localStorage limit, so `QuotaExceededError` cannot happen.
//   React's "best effort" writers (zustand UI snapshots) and strict writers therefore behave the
//   same: a failed disk write is reported through [onWriteError] and never throws to the caller.

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:path_provider/path_provider.dart';

/// Where the key-value map lives between launches.
abstract interface class LocalStoreBackend {
  /// The whole map, or an empty map when nothing was stored (corrupt data reads as empty).
  Future<Map<String, String>> read();

  /// Replace the stored map.
  Future<void> write(Map<String, String> values);
}

/// In-memory backend (tests, previews).
class MemoryLocalStoreBackend implements LocalStoreBackend {
  MemoryLocalStoreBackend([Map<String, String>? initial]) : values = {...?initial};

  Map<String, String> values;
  int writes = 0;

  /// When set, [write] throws it (simulates a full disk).
  Object? failWith;

  @override
  Future<Map<String, String>> read() async => {...values};

  @override
  Future<void> write(Map<String, String> next) async {
    if (failWith != null) throw failWith!;
    writes++;
    values = {...next};
  }
}

/// `<application support>/local_store/anacan_local_store_v1.json`, temp file + rename.
class FileLocalStoreBackend implements LocalStoreBackend {
  FileLocalStoreBackend({Future<Directory> Function()? directory, this.fileName = 'anacan_local_store_v1.json'})
      : _directory = directory ?? (() async => Directory('${(await getApplicationSupportDirectory()).path}/local_store'));

  final Future<Directory> Function() _directory;
  final String fileName;

  /// Above this many UTF-16 units the encode runs on a background isolate.
  static const int isolateThreshold = 64 * 1024;

  Future<File> _file() async {
    final dir = await _directory();
    if (!await dir.exists()) await dir.create(recursive: true);
    return File('${dir.path}/$fileName');
  }

  @override
  Future<Map<String, String>> read() async {
    try {
      final file = await _file();
      if (!await file.exists()) return {};
      final text = await file.readAsString();
      final decoded = text.length > isolateThreshold ? await Isolate.run(() => jsonDecode(text)) : jsonDecode(text);
      if (decoded is! Map) return {};
      return {
        for (final entry in decoded.entries)
          if (entry.key is String && entry.value is String) entry.key as String: entry.value as String,
      };
    } catch (_) {
      return {};
    }
  }

  @override
  Future<void> write(Map<String, String> values) async {
    final size = values.entries.fold<int>(0, (sum, e) => sum + e.key.length + e.value.length);
    final text = size > isolateThreshold ? await Isolate.run(() => jsonEncode(values)) : jsonEncode(values);
    final file = await _file();
    final temp = File('${file.path}.tmp');
    await temp.writeAsString(text, flush: true);
    await temp.rename(file.path);
  }
}

/// A change of one key (`storage` event equivalent; also fired for writes from this process).
class LocalStoreChange {
  const LocalStoreChange(this.key, this.oldValue, this.newValue);
  final String key;
  final String? oldValue;
  final String? newValue;
}

/// Synchronous localStorage-compatible store.
class LocalStore {
  LocalStore(this.backend, {this.debounce = const Duration(milliseconds: 250), this.onWriteError});

  /// Memory-only store (tests).
  factory LocalStore.memory([Map<String, String>? initial]) {
    final store = LocalStore(MemoryLocalStoreBackend(initial));
    store._values.addAll({...?initial});
    store._loaded = true;
    return store;
  }

  final LocalStoreBackend backend;
  final Duration debounce;
  final void Function(Object error)? onWriteError;

  final Map<String, String> _values = {};
  final StreamController<LocalStoreChange> _changes = StreamController.broadcast(sync: true);
  bool _loaded = false;
  Future<void>? _loading;
  Timer? _timer;
  bool _dirty = false;
  Future<void> _writing = Future.value();

  bool get isLoaded => _loaded;

  /// Every set/remove, synchronously.
  Stream<LocalStoreChange> get changes => _changes.stream;

  /// Loads the stored map once. Values written before the load completes win over stored ones.
  Future<void> load() => _loading ??= () async {
        final stored = await backend.read();
        final written = Map.of(_values);
        _values
          ..clear()
          ..addAll(stored)
          ..addAll(written);
        _loaded = true;
      }();

  int get length => _values.length;
  Iterable<String> get keys => List.unmodifiable(_values.keys);

  /// `localStorage.key(index)`.
  String? key(int index) => index >= 0 && index < _values.length ? _values.keys.elementAt(index) : null;

  String? getItem(String key) => _values[key];

  bool containsKey(String key) => _values.containsKey(key);

  void setItem(String key, String value) {
    final old = _values[key];
    _values[key] = value;
    if (old != value) _changes.add(LocalStoreChange(key, old, value));
    _schedule();
  }

  void removeItem(String key) {
    if (!_values.containsKey(key)) return;
    final old = _values.remove(key);
    _changes.add(LocalStoreChange(key, old, null));
    _schedule();
  }

  /// Removes every key starting with one of [prefixes].
  void removeWhere(bool Function(String key) test) {
    for (final key in _values.keys.where(test).toList()) {
      removeItem(key);
    }
  }

  void clear() => removeWhere((_) => true);

  /// `JSON.parse(getItem(key))`, or null when absent/unparseable.
  Object? readJson(String key) {
    final raw = _values[key];
    if (raw == null) return null;
    try {
      return jsonDecode(raw);
    } catch (_) {
      return null;
    }
  }

  /// `setItem(key, JSON.stringify(value))`.
  void writeJson(String key, Object? value) => setItem(key, jsonEncode(value));

  void _schedule() {
    _dirty = true;
    _timer?.cancel();
    _timer = Timer(debounce, () => unawaited(flush()));
  }

  /// Writes pending changes now (app pause). Serialized; never throws.
  Future<void> flush() {
    _timer?.cancel();
    _timer = null;
    if (!_dirty) return _writing;
    _dirty = false;
    return _writing = _writing.then((_) async {
      try {
        // Never replace the stored map with a partial one written before the load finished.
        if (!_loaded) await load();
        await backend.write(Map<String, String>.of(_values));
      } catch (error) {
        _dirty = true;
        onWriteError?.call(error);
      }
    });
  }

  Future<void> dispose() async {
    await flush();
    await _changes.close();
  }
}
