// Ported from: src/lib/content-packs.ts (PackStore, createIndexedDbStore, createMemoryStore)
import 'dart:convert';
import 'dart:io';

/// Durable key/value store for manifests (`m:<lang>`) and shards (`s:<lang>:<shardId>`), holding
/// the canonical JSON text. The web uses IndexedDB `anacan-content-packs` / object store `kv`.
abstract interface class PackStore {
  Future<String?> get(String key);
  Future<void> set(String key, String value);
  Future<void> delete(String key);
  Future<List<String>> keys(String prefix);
}

class MemoryPackStore implements PackStore {
  MemoryPackStore([Map<String, String>? initial]) : data = {...?initial};

  final Map<String, String> data;

  @override
  Future<String?> get(String key) async => data[key];

  @override
  Future<void> set(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);

  @override
  Future<List<String>> keys(String prefix) async => data.keys.where((key) => key.startsWith(prefix)).toList();
}

/// One file per key under [directory] (by default `<application support>/content-packs/`), named by
/// the URI-encoded key (`m%3Afr`, `s%3Afr%3A_misc.0`). Writes go through a temp file + rename so a
/// killed app never leaves a torn shard (a torn file would fail the hash check anyway).
class FilePackStore implements PackStore {
  FilePackStore(this.directory);

  final Directory directory;

  File _file(String key) => File('${directory.path}/${Uri.encodeComponent(key)}');

  @override
  Future<String?> get(String key) async {
    final file = _file(key);
    if (!await file.exists()) return null;
    return utf8.decode(await file.readAsBytes());
  }

  @override
  Future<void> set(String key, String value) async {
    await directory.create(recursive: true);
    final file = _file(key);
    final temp = File('${file.path}.tmp');
    await temp.writeAsBytes(utf8.encode(value), flush: true);
    await temp.rename(file.path);
  }

  @override
  Future<void> delete(String key) async {
    final file = _file(key);
    if (await file.exists()) await file.delete();
  }

  @override
  Future<List<String>> keys(String prefix) async {
    if (!await directory.exists()) return [];
    final out = <String>[];
    await for (final entity in directory.list()) {
      if (entity is! File) continue;
      final name = entity.uri.pathSegments.last;
      if (name.endsWith('.tmp')) continue;
      final key = Uri.decodeComponent(name);
      if (key.startsWith(prefix)) out.add(key);
    }
    out.sort();
    return out;
  }
}
