// Ported from: scripts/i18n/content-packs.mjs (buildLanguagePacks) — test helper only; the app never builds packs.
import 'dart:convert';

import 'package:anacan/core/content_packs/content_key.dart';
import 'package:anacan/core/i18n/js_compat.dart';

typedef PackFile = ({String path, String text});

const int kTargetShardBytes = 256 * 1024;
const int kMaxBuckets = 32;

/// `Buffer.byteLength(JSON.stringify(value))` (insertion order).
int _jsonBytes(Object? value) => utf8.encode(jsonStringify(value)).length;

({Map<String, dynamic> manifest, List<PackFile> files}) buildLanguagePacks(
  Map<String, dynamic> bundle, {
  int targetBytes = kTargetShardBytes,
  int maxBuckets = kMaxBuckets,
}) {
  final language = bundle['language'] as String;
  final values = Map<String, dynamic>.from(bundle['values'] as Map);
  final byField = <String, ({List<MapEntry<String, dynamic>> entries, List<int> bytes})>{};
  for (final entry in values.entries) {
    final field = keyField(entry.key);
    if (field == null || !RegExp(r'^[a-z0-9_]+$').hasMatch(field)) throw StateError('CONTENT_PACK_KEY_INVALID');
    final group = byField.putIfAbsent(field, () => (entries: [], bytes: [0]));
    group.entries.add(entry);
    group.bytes[0] += utf8.encode(entry.key).length + _jsonBytes(entry.value) + 4;
  }
  final shardValues = <String, Map<String, dynamic>>{};
  final fields = <String, List<String>>{};
  final small = <String>[];
  for (final field in byField.keys.toList()..sort()) {
    final group = byField[field]!;
    if (group.bytes[0] < targetBytes / 8) {
      small.add(field);
      continue;
    }
    var buckets = 1;
    while (buckets < maxBuckets && group.bytes[0] / buckets > targetBytes) {
      buckets *= 2;
    }
    final ids = List.generate(buckets, (index) => buckets == 1 ? field : '$field.$index');
    for (final id in ids) {
      shardValues[id] = {};
    }
    for (final entry in group.entries) {
      shardValues[ids[keyBucket(entry.key, buckets)]]![entry.key] = entry.value;
    }
    fields[field] = ids;
  }
  var misc = -1;
  num miscBytes = double.infinity;
  for (final field in small) {
    final group = byField[field]!;
    if (miscBytes + group.bytes[0] > targetBytes) {
      misc++;
      miscBytes = 0;
      shardValues['_misc.$misc'] = {};
    }
    final id = '_misc.$misc';
    for (final entry in group.entries) {
      shardValues[id]![entry.key] = entry.value;
    }
    miscBytes += group.bytes[0];
    fields[field] = [id];
  }
  final files = <PackFile>[];
  final shards = <String, dynamic>{};
  for (final id in shardValues.keys.toList()..sort()) {
    final shardValuesMap = shardValues[id]!;
    final text = canonicalJson({'schema': 'anacan-content-pack-shard-v1', 'language': language, 'shard': id, 'values': shardValuesMap});
    final hash = sha256Hex(text);
    final file = '$id.${hash.substring(0, 16)}.json';
    shards[id] = {'file': file, 'sha256': hash, 'count': shardValuesMap.length, 'bytes': utf8.encode(text).length};
    files.add((path: '$language/$file', text: text));
  }
  final manifest = <String, dynamic>{
    'schema': 'anacan-content-pack-manifest-v1',
    'language': language,
    'sourceHash': bundle['sourceHash'],
    'keys': values.length,
    'fields': fields,
    'shards': shards,
  };
  files.add((path: '$language/manifest.json', text: canonicalJson(manifest)));
  return (manifest: manifest, files: files);
}
