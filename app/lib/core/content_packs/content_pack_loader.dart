// Ported from: src/lib/content-packs.ts
import 'dart:async';
import 'dart:convert';

import 'content_key.dart';
import 'pack_store.dart';

const String kManifestSchema = 'anacan-content-pack-manifest-v1';
const String kShardSchema = 'anacan-content-pack-shard-v1';
final RegExp _hex64 = RegExp(r'^[a-f0-9]{64}$');
final RegExp _shardId = RegExp(r'^[a-z0-9_]+(?:\.[0-9]+)?$');
final RegExp _shardFile = RegExp(r'^[a-z0-9_]+(?:\.[0-9]+)?\.[a-f0-9]{16}\.json$');

const Duration kManifestTimeout = Duration(seconds: 15);
const Duration kShardTimeout = Duration(seconds: 20);
const int kMaxWantedKeys = 5000;
const int kMaxHotShards = 64;

/// `min(10 min, 15 s · 2^(failures-1))`.
int contentPackBackoffMs(int failures) {
  final value = 15000 * (1 << (failures - 1 < 0 ? 0 : (failures - 1 > 20 ? 20 : failures - 1)));
  return value > 600000 ? 600000 : value;
}

/// Resolves with the response body (text, or JSON already parsed by a native bridge); throws on a
/// network error, timeout or non-200 status.
typedef FetchPack = Future<Object?> Function(String url, {required bool fresh, required Duration timeout});

/// The recently used shard ids per language (web: localStorage `anacan_content_pack_hot:<lang>`).
abstract interface class HotShardList {
  List<String> read(String language);
  void write(String language, List<String> ids);
}

class ShardMeta {
  const ShardMeta({required this.file, required this.sha256, this.count, this.bytes});
  final String file;
  final String sha256;
  final int? count;
  final int? bytes;
}

/// Parsed `manifest.json` (`anacan-content-pack-manifest-v1`).
class ContentPackManifest {
  ContentPackManifest._(this.raw, this.language, this.sourceHash, this.fields, this.shards);

  /// The parsed JSON object; its [canonicalJson] text is what is stored and compared.
  final Map<String, dynamic> raw;
  final String language;
  final String sourceHash;
  final Map<String, List<String>> fields;
  final Map<String, ShardMeta> shards;
}

final Object _invalid = Object();
Object? _safeParse(String text) {
  try {
    return jsonDecode(text);
  } catch (_) {
    return _invalid;
  }
}

/// `parseManifest`: schema, language, hex hashes, shard ids/file names (no path traversal) and that
/// every field routes to listed shards. Null when anything is off.
ContentPackManifest? parseManifest(Object? value, String language) {
  final data = value is String ? _safeParse(value) : value;
  if (data is! Map || data['schema'] != kManifestSchema || data['language'] != language) return null;
  final sourceHash = data['sourceHash'];
  if (sourceHash is! String || !_hex64.hasMatch(sourceHash)) return null;
  final rawFields = data['fields'], rawShards = data['shards'];
  if (rawFields is! Map || rawShards is! Map) return null;
  final shards = <String, ShardMeta>{};
  for (final entry in rawShards.entries) {
    final id = entry.key, meta = entry.value;
    if (id is! String || !_shardId.hasMatch(id) || meta is! Map) return null;
    final file = meta['file'], hash = meta['sha256'];
    if (file is! String || !_shardFile.hasMatch(file) || hash is! String || !_hex64.hasMatch(hash) || !file.startsWith('$id.${hash.substring(0, 16)}.')) {
      return null;
    }
    shards[id] = ShardMeta(file: file, sha256: hash, count: (meta['count'] as num?)?.toInt(), bytes: (meta['bytes'] as num?)?.toInt());
  }
  final fields = <String, List<String>>{};
  for (final entry in rawFields.entries) {
    final ids = entry.value;
    if (ids is! List || ids.isEmpty || ids.any((id) => id is! String || !shards.containsKey(id))) return null;
    fields['${entry.key}'] = List<String>.from(ids);
  }
  return ContentPackManifest._(Map<String, dynamic>.from(data), language, sourceHash, fields, shards);
}

class _Shard {
  _Shard(this.sha256, this.values);
  final String sha256;
  final Map<String, dynamic> values;
}

class _LanguageState {
  ContentPackManifest? manifest;
  String? manifestText;
  Future<void>? prepared;
  Future<void>? revalidation;
  bool revalidated = false;
  int manifestFailedUntil = 0;
  final Map<String, _Shard> shards = {};
  final Map<String, Future<void>> loading = {};
  final Map<String, int> failedUntil = {};
  final Map<String, int> failures = {};
  final Set<String> wantedKeys = {};
  List<String> hot = [];
}

/// `createContentPackLoader`: lookups stay synchronous; a missing shard returns null (callers fall
/// back to en/ru) and is fetched in the background; when it arrives listeners are told once.
class ContentPackLoader {
  ContentPackLoader({
    required String baseUrl,
    required List<String> languages,
    required this.fetchPack,
    required this.store,
    Future<String> Function(String text)? sha256Hex,
    this.hot,
    int Function()? now,
  })  : _base = baseUrl.replaceFirst(RegExp(r'/$'), ''),
        _languages = List.unmodifiable(languages),
        _sha256Hex = sha256Hex ?? ((text) async => contentSha256(text)),
        _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final String _base;
  final List<String> _languages;
  final FetchPack fetchPack;
  final PackStore store;
  final Future<String> Function(String text) _sha256Hex;
  final HotShardList? hot;
  final int Function() _now;

  final Map<String, _LanguageState> _states = {};
  final Set<void Function()> _listeners = {};
  int _version = 0;
  bool _missed = false;

  bool _supported(String language) => _languages.contains(language);

  _LanguageState _state(String language) => _states.putIfAbsent(language, () {
        final item = _LanguageState();
        try {
          item.hot = (hot?.read(language) ?? const []).where(_shardId.hasMatch).take(kMaxHotShards).toList();
        } catch (_) {
          item.hot = [];
        }
        return item;
      });

  void _notify() {
    if (!_missed) return;
    _missed = false;
    _version++;
    for (final listener in [..._listeners]) {
      try {
        listener();
      } catch (_) {
        // listener errors stay local
      }
    }
  }

  void _rememberHot(String language, _LanguageState item, String id) {
    if (item.hot.isNotEmpty && item.hot.first == id) return;
    item.hot = [id, ...item.hot.where((value) => value != id)].take(kMaxHotShards).toList();
    try {
      hot?.write(language, item.hot);
    } catch (_) {}
  }

  bool _setShard(String language, _LanguageState item, String id, String text, String hash) {
    final data = _safeParse(text);
    if (data is! Map || data['schema'] != kShardSchema || data['language'] != language || data['shard'] != id || data['values'] is! Map) {
      return false;
    }
    item.shards[id] = _Shard(hash, Map<String, dynamic>.from(data['values'] as Map));
    return true;
  }

  Future<void> _requestShard(String language, String id) {
    final item = _state(language);
    final meta = item.manifest?.shards[id];
    if (meta == null) return Future.value();
    if (item.shards[id]?.sha256 == meta.sha256) return Future.value();
    final running = item.loading[id];
    if (running != null) return running;
    if ((item.failedUntil[id] ?? 0) > _now()) return Future.value();
    final storeKey = 's:$language:$id';
    Future<void> operation() async {
      String? cached;
      try {
        cached = await store.get(storeKey);
      } catch (_) {}
      if (cached != null) {
        final hash = await _sha256Hex(cached);
        // An older cached revision is still correct for every key it holds (keys bind the exact
        // source text), so it is served while the current one downloads.
        final current = hash == meta.sha256;
        if ((current || !item.shards.containsKey(id)) && _setShard(language, item, id, cached, hash)) {
          _notify();
          if (current) return;
        }
      }
      Object? body;
      try {
        body = await fetchPack('$_base/content-packs/$language/${meta.file}', fresh: false, timeout: kShardTimeout);
      } catch (_) {
        // The deploy may have replaced this shard: refresh a cache-only manifest once.
        if (!item.revalidated) unawaited(revalidate(language));
        rethrow;
      }
      final parsed = body is String ? _safeParse(body) : body;
      if (identical(parsed, _invalid)) throw StateError('CONTENT_PACK_SHARD_INVALID');
      final text = canonicalJson(parsed);
      final hash = await _sha256Hex(text);
      if (hash != meta.sha256 || !_setShard(language, item, id, text, hash)) throw StateError('CONTENT_PACK_SHARD_INVALID');
      item.failures.remove(id);
      item.failedUntil.remove(id);
      try {
        await store.set(storeKey, text);
      } catch (_) {}
      _notify();
    }

    late final Future<void> tracked;
    tracked = operation().then((_) => true, onError: (Object _) {
      final failures = (item.failures[id] ?? 0) + 1;
      item.failures[id] = failures;
      item.failedUntil[id] = _now() + contentPackBackoffMs(failures);
      return false;
    }).then((succeeded) {
      if (identical(item.loading[id], tracked)) item.loading.remove(id);
      // The manifest may have been revalidated while this (older) revision loaded.
      final latest = item.manifest?.shards[id];
      if (succeeded && latest != null && latest.sha256 != meta.sha256) unawaited(_requestShard(language, id));
    });
    item.loading[id] = tracked;
    return tracked;
  }

  String? _shardForKey(ContentPackManifest manifest, String key) {
    final parts = key.split(':');
    final field = parts.length >= 2 ? parts[parts.length - 2] : parts.first;
    final ids = manifest.fields[field];
    return ids == null ? null : ids[keyBucket(key, ids.length)];
  }

  List<String> _useManifest(String language, _LanguageState item, ContentPackManifest manifest, String text) {
    item.manifest = manifest;
    item.manifestText = text;
    final wanted = [...item.wantedKeys];
    item.wantedKeys.clear();
    final ids = <String>{};
    for (final key in wanted) {
      final id = _shardForKey(manifest, key);
      if (id != null) ids.add(id);
    }
    // Refresh shards already in use whose revision changed.
    item.shards.forEach((id, shard) {
      final meta = manifest.shards[id];
      if (meta != null && meta.sha256 != shard.sha256) ids.add(id);
    });
    for (final id in ids) {
      unawaited(_requestShard(language, id));
    }
    return ids.toList();
  }

  /// Fetches `manifest.json` (no-cache), adopts it when it changed, stores it and prunes cached
  /// shards it no longer lists. Failures back off 30 s.
  Future<void> revalidate(String language) {
    final item = _state(language);
    final running = item.revalidation;
    if (running != null) return running;
    if (item.manifestFailedUntil > _now()) return Future.value();
    Future<void> run() async {
      final body = await fetchPack('$_base/content-packs/$language/manifest.json', fresh: true, timeout: kManifestTimeout);
      final manifest = parseManifest(body, language);
      if (manifest == null) throw StateError('CONTENT_PACK_MANIFEST_INVALID');
      item.revalidated = true;
      final text = canonicalJson(manifest.raw);
      if (text == item.manifestText) return;
      _useManifest(language, item, manifest, text);
      try {
        await store.set('m:$language', text);
      } catch (_) {}
      List<String> keys;
      try {
        keys = await store.keys('s:$language:');
      } catch (_) {
        keys = const [];
      }
      final prefix = 's:$language:';
      await Future.wait(keys.where((key) => !manifest.shards.containsKey(key.substring(prefix.length))).map((key) async {
        try {
          await store.delete(key);
        } catch (_) {}
      }));
    }

    final future = run().catchError((Object _) {
      item.manifestFailedUntil = _now() + 30000;
    }).whenComplete(() => item.revalidation = null);
    item.revalidation = future;
    return future;
  }

  /// Never throws and never needs awaiting before rendering. Completes once the cached manifest and
  /// recently used shards are in memory (or the first download ended).
  Future<void> prepare(String language) {
    if (!_supported(language)) return Future.value();
    final item = _state(language);
    final prepared = item.prepared;
    if (prepared != null) {
      if (item.manifest == null) unawaited(revalidate(language)); // e.g. offline at launch, online now
      return prepared;
    }
    Future<void> run() async {
      String? text;
      try {
        text = await store.get('m:$language');
      } catch (_) {}
      final manifest = text != null ? parseManifest(text, language) : null;
      if (manifest != null && item.manifest == null) _useManifest(language, item, manifest, canonicalJson(manifest.raw));
      final network = item.revalidated ? Future<void>.value() : revalidate(language);
      if (item.manifest == null) await network;
      final current = item.manifest;
      if (current != null) {
        await Future.wait(item.hot.where(current.shards.containsKey).map((id) => _requestShard(language, id)));
      }
    }

    final future = run().catchError((Object _) {});
    item.prepared = future;
    return future;
  }

  /// Translation of `row[field]` for [language] from the pack, or null (not ready, not in the pack,
  /// or the source text changed since the pack was built).
  Object? lookup(Map<String, dynamic> row, String field, String language) {
    if (!_supported(language)) return null;
    final item = _state(language);
    final key = contentTranslationKey(row, field);
    if (key == null) return null;
    final manifest = item.manifest;
    if (manifest == null) {
      if (item.wantedKeys.length < kMaxWantedKeys) item.wantedKeys.add(key);
      _missed = true;
      unawaited(prepare(language));
      return null;
    }
    final id = _shardForKey(manifest, key);
    if (id == null) return null;
    final shard = item.shards[id];
    if (shard == null || shard.sha256 != manifest.shards[id]!.sha256) {
      if (shard == null) _missed = true;
      _rememberHot(language, item, id);
      unawaited(_requestShard(language, id));
    }
    return shard != null && shard.values.containsKey(key) ? shard.values[key] : null;
  }

  /// Retry what failed (connectivity regained).
  void retry() {
    _states.forEach((language, item) {
      item.manifestFailedUntil = 0;
      item.failedUntil.clear();
      if (item.manifest == null || !item.revalidated) unawaited(revalidate(language));
      for (final id in [...item.failures.keys]) {
        unawaited(_requestShard(language, id));
      }
    });
  }

  /// Settles every in-flight load (tests).
  Future<void> settled(String language) async {
    final item = _state(language);
    for (var round = 0; round < 10; round++) {
      final work = [...item.loading.values, if (item.revalidation != null) item.revalidation!];
      if (work.isEmpty) return;
      await Future.wait(work);
    }
  }

  /// Subscribes to "a shard a lookup waited for arrived". Returns the unsubscribe function.
  void Function() subscribe(void Function() listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  int get version => _version;
}

/// sha256 hex of the UTF-8 text.
String contentSha256(String text) => sha256Hex(text);
