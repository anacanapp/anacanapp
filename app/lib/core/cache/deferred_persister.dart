// Ported from: src/lib/deferred-persister.ts, src/App.tsx (persister key `anacan-rq-cache`).
//
// Query-cache persister that never serialises during use: it keeps the latest snapshot builder in
// memory and writes it when the app goes to the background, plus at most every [idle] (2 min).
// A snapshot taken before a logout (clearPersistedQueryCache) is dropped. JSON encoding and file
// I/O run off the UI isolate. When the encoded cache is larger than [maxBytes] (or the write
// fails), the newer half of the queries is kept and written once more ("storage full" in React).

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:path_provider/path_provider.dart';

import 'persist_policy.dart';

/// `<application support>/query_cache/anacan-rq-cache.json` (temp file + rename).
class FileQueryPersistStorage implements QueryPersistStorage {
  FileQueryPersistStorage({Future<Directory> Function()? directory, this.fileName = '$persistedQueryCacheKey.json'})
      : _directory = directory ??
            (() async => Directory('${(await getApplicationSupportDirectory()).path}/query_cache'));

  final Future<Directory> Function() _directory;
  final String fileName;

  Future<File> _file() async {
    final dir = await _directory();
    if (!await dir.exists()) await dir.create(recursive: true);
    return File('${dir.path}/$fileName');
  }

  @override
  Future<String?> read() async {
    final file = await _file();
    if (!await file.exists()) return null;
    return file.readAsString();
  }

  @override
  Future<void> write(String value) async {
    final file = await _file();
    final temp = File('${file.path}.tmp');
    await temp.writeAsString(value, flush: true);
    await temp.rename(file.path);
  }

  @override
  Future<void> remove() async {
    final file = await _file();
    if (await file.exists()) await file.delete();
  }
}

/// In-memory storage (tests).
class MemoryQueryPersistStorage implements QueryPersistStorage {
  String? value;
  int writes = 0;
  Object? failWith;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String next) async {
    if (failWith != null) throw failWith!;
    writes++;
    value = next;
  }

  @override
  Future<void> remove() async => value = null;
}

/// A dehydrated client: `{timestamp, buster, clientState: {mutations: [], queries: [...]}}`.
typedef PersistedClient = Map<String, Object?>;

class DeferredQueryPersister {
  DeferredQueryPersister({
    required this.storage,
    this.idle = const Duration(minutes: 2),
    this.maxBytes = 4 * 1024 * 1024,
    int Function()? now,
  }) : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final QueryPersistStorage? storage;
  final Duration idle;

  /// Byte budget (UTF-16 units, like localStorage) before the older half is evicted.
  final int maxBytes;
  final int Function() _now;

  PersistedClient Function()? _pending;
  int _pendingAt = 0;
  Timer? _timer;
  Future<void> _writing = Future.value();

  bool get hasPending => _pending != null;

  /// `persistClient(client)`: remembers the latest snapshot; no serialisation now.
  void persistClient(PersistedClient Function() snapshot) {
    _pending = snapshot;
    _pendingAt = _now();
    _timer ??= Timer(idle, () {
      _timer = null;
      unawaited(flush());
    });
  }

  /// Writes the pending snapshot (app backgrounded, idle timer). Never throws.
  Future<void> flush() {
    _timer?.cancel();
    _timer = null;
    final pending = _pending;
    if (pending == null) return _writing;
    _pending = null;
    if (_pendingAt <= getPersistClearedAt()) return _writing;
    final PersistedClient client;
    try {
      client = pending();
    } catch (_) {
      return _writing;
    }
    return _writing = _writing.then((_) => _write(client));
  }

  Future<void> _write(PersistedClient client) async {
    final target = storage;
    if (target == null) return;
    try {
      final text = await _encode(client);
      if (text.length > maxBytes) throw const _TooLarge();
      await target.write(text);
    } catch (_) {
      // Storage full: keep the newer half of the queries and try once more.
      try {
        final state = client['clientState'] as Map<String, Object?>;
        final queries = state['queries'] as List;
        final trimmed = {
          ...client,
          'clientState': {...state, 'queries': queries.sublist(queries.length ~/ 2)},
        };
        final text = await _encode(trimmed);
        if (text.length > maxBytes) return;
        await target.write(text);
      } catch (_) {
        // Give up quietly; the cache is an optimisation.
      }
    }
  }

  static Future<String> _encode(PersistedClient client) =>
      Isolate.run(() => jsonEncode(client));

  /// `restoreClient()`: the stored snapshot or null (unreadable → null).
  Future<PersistedClient?> restoreClient() async {
    final target = storage;
    if (target == null) return null;
    try {
      final raw = await target.read();
      if (raw == null || raw.isEmpty) return null;
      final decoded = raw.length > 64 * 1024 ? await Isolate.run(() => jsonDecode(raw)) : jsonDecode(raw);
      return decoded is Map<String, Object?> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  /// `removeClient()`.
  Future<void> removeClient() async {
    _pending = null;
    try {
      await storage?.remove();
    } catch (_) {
      // blocked storage
    }
  }

  void dispose() {
    _timer?.cancel();
    _timer = null;
  }
}

class _TooLarge implements Exception {
  const _TooLarge();
}
