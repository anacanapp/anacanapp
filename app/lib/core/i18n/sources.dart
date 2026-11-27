// Ported from: src/lib/i18n.ts (seed loading, localStorage cache), src/lib/local-storage.ts (writeStorageCache)
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:flutter/services.dart';

/// Bundled per-language dictionaries (`assets/i18n/<lang>.json`, produced by app/tool/i18n/export.mjs).
abstract interface class I18nAssetSource {
  /// Returns the flat key -> string map. Called once per language; decoding should stay off the UI isolate.
  Future<Map<String, String>> load(String lang);
}

/// Decodes UTF-8 JSON bytes into a flat string map. Runs inside [Isolate.run].
Map<String, String> decodeDictionary(Uint8List bytes) {
  final decoded = jsonDecode(utf8.decode(bytes));
  if (decoded is! Map) throw const FormatException('I18N_DICTIONARY_INVALID');
  final out = <String, String>{};
  decoded.forEach((key, value) {
    if (value is String) out[key as String] = value;
  });
  return out;
}

/// Reads `assets/i18n/<lang>.json` from the Flutter asset bundle and decodes it in a background isolate.
class BundleI18nAssetSource implements I18nAssetSource {
  BundleI18nAssetSource({AssetBundle? bundle, this.directory = 'assets/i18n'}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;
  final String directory;

  @override
  Future<Map<String, String>> load(String lang) async {
    final data = await _bundle.load('$directory/$lang.json');
    final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    return Isolate.run(() => decodeDictionary(bytes));
  }
}

/// Reads the dictionaries straight from a directory (tests, tools).
class FileI18nAssetSource implements I18nAssetSource {
  FileI18nAssetSource(this.directory);

  final String directory;

  @override
  Future<Map<String, String>> load(String lang) async {
    final bytes = await File('$directory/$lang.json').readAsBytes();
    return Isolate.run(() => decodeDictionary(bytes));
  }
}

/// Durable copy of the merged dictionary, the Flutter counterpart of localStorage
/// `anacan_i18n_cache:<lang>` + `anacan_i18n_sig:<lang>`.
abstract interface class TranslationDiskCache {
  Future<Map<String, String>?> read(String lang);
  Future<String?> readSignature(String lang);

  /// Stores [data] and its [signature]. Returns false when it could not be written (the web
  /// counterpart returns false on quota/budget limits); the signature is only stored on success.
  Future<bool> write(String lang, Map<String, String> data, String signature);
}

/// Web key names, kept as file names so the two caches are recognisable side by side.
const String kI18nCachePrefix = 'anacan_i18n_cache:';
const String kI18nSignaturePrefix = 'anacan_i18n_sig:';

/// Files under `<app support>/i18n_cache/`: `anacan_i18n_cache_<lang>.json`, `anacan_i18n_sig_<lang>.txt`.
class FileTranslationDiskCache implements TranslationDiskCache {
  FileTranslationDiskCache(this.directory);

  final Directory directory;

  File _data(String lang) => File('${directory.path}/anacan_i18n_cache_$lang.json');
  File _signature(String lang) => File('${directory.path}/anacan_i18n_sig_$lang.txt');

  @override
  Future<Map<String, String>?> read(String lang) async {
    try {
      final file = _data(lang);
      if (!await file.exists()) return null;
      final bytes = await file.readAsBytes();
      return await Isolate.run(() => decodeDictionary(bytes));
    } catch (_) {
      return null; // damaged cache: the seed / DB path still works
    }
  }

  @override
  Future<String?> readSignature(String lang) async {
    try {
      final file = _signature(lang);
      return await file.exists() ? await file.readAsString() : null;
    } catch (_) {
      return null;
    }
  }

  @override
  Future<bool> write(String lang, Map<String, String> data, String signature) async {
    try {
      await directory.create(recursive: true);
      final copy = Map<String, String>.of(data);
      final bytes = await Isolate.run(() => utf8.encode(jsonEncode(copy)));
      final temp = File('${_data(lang).path}.tmp');
      await temp.writeAsBytes(bytes, flush: true);
      await temp.rename(_data(lang).path);
      try {
        await _signature(lang).writeAsString(signature, flush: true);
      } catch (_) {
        // the signature is optional
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}

/// In-memory cache for tests.
class MemoryTranslationDiskCache implements TranslationDiskCache {
  final Map<String, Map<String, String>> data = {};
  final Map<String, String> signatures = {};
  int writes = 0;

  @override
  Future<Map<String, String>?> read(String lang) async => data[lang] == null ? null : Map.of(data[lang]!);

  @override
  Future<String?> readSignature(String lang) async => signatures[lang];

  @override
  Future<bool> write(String lang, Map<String, String> value, String signature) async {
    writes++;
    data[lang] = Map.of(value);
    signatures[lang] = signature;
    return true;
  }
}

/// `dictionarySignature`: `v1:<count>:<FNV-1a base36>` over the dictionary in JS `for…in` order
/// (array-index keys ascending first, then insertion order). For each key and value: the hash is
/// mixed with the UTF-16 length, then with every UTF-16 code unit (`Math.imul(h ^ x, 16777619)`).
String dictionarySignature(Map<String, String> data) {
  var hash = 0x811c9dc5;
  var count = 0;
  void mix(String text) {
    hash = _imul(hash ^ text.length, 16777619);
    for (var index = 0; index < text.length; index++) {
      hash = _imul(hash ^ text.codeUnitAt(index), 16777619);
    }
  }

  for (final key in jsForInOrder(data.keys)) {
    count++;
    mix(key);
    mix(data[key]!);
  }
  return 'v1:$count:${(hash & 0xffffffff).toRadixString(36)}';
}

int _imul(int a, int b) {
  final product = ((a & 0xffffffff) * (b & 0xffffffff)) & 0xffffffff;
  return product >= 0x80000000 ? product - 0x100000000 : product;
}

final RegExp _arrayIndex = RegExp(r'^(?:0|[1-9][0-9]*)$');

/// Property enumeration order of a JS object built with the same insertion order.
Iterable<String> jsForInOrder(Iterable<String> keys) {
  final indices = <String>[];
  final others = <String>[];
  for (final key in keys) {
    if (_arrayIndex.hasMatch(key) && key.length <= 10 && int.parse(key) < 4294967295) {
      indices.add(key);
    } else {
      others.add(key);
    }
  }
  indices.sort((a, b) => int.parse(a).compareTo(int.parse(b)));
  return [...indices, ...others];
}
