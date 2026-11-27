// Ported from: src/lib/content-packs.test.ts, src/lib/content-packs-build.test.ts (runtime half),
// src/lib/content-pack-refresh.test.ts
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/content_packs/content_packs.dart';
import 'package:flutter_test/flutter_test.dart';

import 'pack_builder.dart';

final _row = <String, dynamic>{'id': 'row-1', 'description': 'Source text: 3 mg', 'description_en': 'Source text: 3 mg'};
final _titleRow = <String, dynamic>{'id': 'row-2', 'title': 'Pregnancy week'};
final _key = contentTranslationKey(_row, 'description')!;
final _titleKey = contentTranslationKey(_titleRow, 'title')!;

Map<String, dynamic> _bundle([Map<String, dynamic>? values]) => {
      'schema': 'anacan-content-translations-v1',
      'language': 'fr',
      'sourceHash': 'a' * 64,
      'values': values ?? {_key: 'Texte source : 3 mg', _titleKey: 'Semaine de grossesse'},
    };

class _Setup {
  _Setup(List<PackFile> files, [MemoryPackStore? store, Map<String, List<String>>? hot]) : store = store ?? MemoryPackStore() {
    if (hot != null) hotList.addAll(hot);
    remote = {for (final file in files) 'https://app.anacan.az/content-packs/${file.path}': file.text};
    loader = ContentPackLoader(
      baseUrl: 'https://app.anacan.az',
      languages: const ['fr', 'ky'],
      fetchPack: (url, {required fresh, required timeout}) async {
        calls.add(url);
        if (override != null) return override!(url);
        if (!online) throw const SocketException('offline');
        final text = remote[url];
        if (text == null) throw const HttpException('404');
        return text;
      },
      store: this.store,
      now: () => clock,
      hot: CallbackHotShardList(initial: hotList, onWrite: (language, ids) => hotList[language] = ids),
    );
  }

  final MemoryPackStore store;
  late final Map<String, String> remote;
  late final ContentPackLoader loader;
  final List<String> calls = [];
  final Map<String, List<String>> hotList = {};
  bool online = true;
  int clock = 0;
  Object? Function(String url)? override;
}

_Setup _setup({List<PackFile>? files, MemoryPackStore? store, Map<String, List<String>>? hot}) {
  return _Setup(files ?? buildLanguagePacks(_bundle()).files, store, hot);
}

void main() {
  group('content pack loader', () {
    test('serves nothing until ready, downloads only the needed shard, then notifies once', () async {
      final s = _setup();
      var notified = 0;
      s.loader.subscribe(() => notified++);
      expect(s.loader.lookup(_row, 'description', 'fr'), isNull); // non-blocking: fallback first
      await s.loader.prepare('fr');
      await s.loader.settled('fr');
      expect(s.loader.lookup(_row, 'description', 'fr'), 'Texte source : 3 mg');
      expect(notified, 1);
      expect(s.loader.version, 1);
      // manifest + the one shard holding the waited key
      expect(s.calls.map((url) => url.split('/').last).toList(), ['manifest.json', matches(RegExp(r'^_misc\.0\.[a-f0-9]{16}\.json$'))]);
      expect(s.loader.lookup({..._row, 'description': 'Edited source'}, 'description', 'fr'), isNull); // source-bound
      expect(s.loader.lookup(_row, 'description', 'de'), isNull);
    });

    test('reuses the durable cache offline (cache hit, no network)', () async {
      final first = _setup();
      await first.loader.prepare('fr');
      first.loader.lookup(_row, 'description', 'fr');
      await first.loader.settled('fr');
      expect(first.store.data.keys.toList()..sort(), ['m:fr', 's:fr:_misc.0']);
      final second = _setup(store: first.store, hot: {'fr': first.hotList['fr']!});
      second.online = false;
      await second.loader.prepare('fr');
      expect(second.loader.lookup(_row, 'description', 'fr'), 'Texte source : 3 mg');
      expect(second.calls.length, 1); // only the failed manifest revalidation
    });

    test('offline without cache falls back and recovers on retry', () async {
      final s = _setup();
      s.online = false;
      await s.loader.prepare('fr');
      expect(s.loader.lookup(_row, 'description', 'fr'), isNull);
      s.online = true;
      s.loader.retry();
      await s.loader.settled('fr');
      expect(s.calls.length, greaterThan(1));
      expect(s.loader.lookup(_row, 'description', 'fr'), 'Texte source : 3 mg');
    });

    test('rejects a shard whose hash does not match the manifest and does not cache it', () async {
      final files = buildLanguagePacks(_bundle()).files.map((file) => file.path.endsWith('manifest.json')
          ? file
          : (path: file.path, text: file.text.replaceAll('Texte source : 3 mg', 'Tampered'))).toList();
      final s = _setup(files: files);
      await s.loader.prepare('fr');
      s.loader.lookup(_row, 'description', 'fr');
      await s.loader.settled('fr');
      expect(s.loader.lookup(_row, 'description', 'fr'), isNull);
      expect(s.store.data.keys.toList(), ['m:fr']);
    });

    test('rejects an invalid or foreign manifest', () async {
      final manifest = buildLanguagePacks(_bundle()).manifest;
      expect(parseManifest(canonicalJson(manifest), 'fr'), isNotNull);
      expect(parseManifest(canonicalJson(manifest), 'es'), isNull);
      final shards = Map<String, dynamic>.from(manifest['shards'] as Map);
      shards['_misc.0'] = {...(shards['_misc.0'] as Map), 'file': '../../x.json'};
      expect(parseManifest({...manifest, 'shards': shards}, 'fr'), isNull);
      final files = buildLanguagePacks(_bundle()).files.map((file) => file.path.endsWith('manifest.json') ? (path: file.path, text: '{"schema":"x"}') : file).toList();
      final s = _setup(files: files);
      await s.loader.prepare('fr');
      s.loader.lookup(_row, 'description', 'fr');
      await s.loader.settled('fr');
      expect(s.loader.lookup(_row, 'description', 'fr'), isNull);
    });

    test('accepts JSON already parsed by a native bridge (hash is over canonical JSON)', () async {
      final s = _setup();
      s.override = (url) {
        final parsed = jsonDecode(s.remote[url]!) as Map<String, dynamic>;
        // re-ordered keys, like a native dictionary round trip
        return Map.fromEntries(parsed.entries.toList().reversed);
      };
      await s.loader.prepare('fr');
      s.loader.lookup(_titleRow, 'title', 'fr');
      await s.loader.settled('fr');
      expect(s.loader.lookup(_titleRow, 'title', 'fr'), 'Semaine de grossesse');
    });

    test('keeps serving a cached older shard while a new revision downloads, and prunes removed shards', () async {
      final first = _setup();
      await first.loader.prepare('fr');
      first.loader.lookup(_row, 'description', 'fr');
      await first.loader.settled('fr');
      await first.store.set('s:fr:gone', 'x');
      final newer = buildLanguagePacks(_bundle({_key: 'Texte source : 3 mg', _titleKey: 'Semaine', 'row-3:title:${'b' * 64}': 'Nouveau'})).files;
      final second = _setup(files: newer, store: first.store, hot: {'fr': first.hotList['fr']!});
      await second.loader.prepare('fr');
      await second.loader.settled('fr');
      expect(second.loader.lookup(_row, 'description', 'fr'), 'Texte source : 3 mg');
      expect(second.loader.lookup(_titleRow, 'title', 'fr'), 'Semaine');
      expect(second.store.data.containsKey('s:fr:gone'), isFalse);
    });

    test('backs off after a failed shard instead of hammering the server', () async {
      final s = _setup();
      await s.loader.prepare('fr');
      s.remote.removeWhere((url, _) => !url.endsWith('manifest.json'));
      s.loader.lookup(_row, 'description', 'fr');
      await s.loader.settled('fr');
      final calls = s.calls.length;
      s.loader.lookup(_row, 'description', 'fr');
      await s.loader.settled('fr');
      expect(s.calls.length, calls);
      s.clock += 60000;
      s.loader.lookup(_row, 'description', 'fr');
      await s.loader.settled('fr');
      expect(s.calls.length, greaterThan(calls));
    });
  });

  group('content pack emitter (Node-built fixtures)', () {
    final fixture = jsonDecode(File('test/core/content_packs/fixtures/content_samples.json').readAsStringSync()) as Map<String, dynamic>;
    List<PackFile> files(String name) =>
        [for (final file in (fixture['packs'][name] as List)) (path: file['path'] as String, text: file['text'] as String)];

    for (final name in ['default', 'split']) {
      test('runtime recomputes the identical canonical text and routes every key to its shard ($name)', () {
        final packFiles = files(name);
        final manifest = parseManifest(packFiles.last.text, 'fr')!;
        expect(canonicalJson(manifest.raw), packFiles.last.text);
        var total = 0;
        for (final file in packFiles.where((file) => !file.path.endsWith('manifest.json'))) {
          final data = jsonDecode(file.text) as Map<String, dynamic>;
          final meta = manifest.shards[data['shard']]!;
          expect(file.path, 'fr/${meta.file}');
          expect(contentSha256(file.text), meta.sha256);
          expect(canonicalJson(data), file.text);
          for (final key in (data['values'] as Map).keys.cast<String>()) {
            final ids = manifest.fields[keyField(key)]!;
            expect(ids[keyBucket(key, ids.length)], data['shard']);
          }
          total += (data['values'] as Map).length;
        }
        expect(total, manifest.raw['keys']);
        if (name == 'split') expect(manifest.shards.length, greaterThan(1));
      });

      test('the Dart test builder reproduces the Node build byte for byte ($name)', () {
        final packFiles = files(name);
        final manifest = jsonDecode(packFiles.last.text) as Map<String, dynamic>;
        final values = <String, dynamic>{};
        for (final file in packFiles.where((file) => !file.path.endsWith('manifest.json'))) {
          values.addAll(Map<String, dynamic>.from((jsonDecode(file.text) as Map)['values'] as Map));
        }
        // Insertion order of the Node bundle = fixture row order.
        final ordered = <String, dynamic>{};
        for (final sample in (fixture['rows'] as List)) {
          for (final field in (sample['fields'] as List)) {
            final key = sample['keys'][field] as String;
            ordered[key] = values[key];
          }
        }
        final built = buildLanguagePacks({...manifest, 'schema': 'anacan-content-translations-v1', 'values': ordered},
            targetBytes: name == 'split' ? 4096 : kTargetShardBytes);
        expect(built.files.map((file) => file.text).toList(), packFiles.map((file) => file.text).toList());
      });
    }

    test('a real pack serves real rows and falls back for an edited row', () async {
      final packFiles = files('split');
      final remote = {for (final file in packFiles) 'https://app.anacan.az/content-packs/${file.path}': file.text};
      final loader = ContentPackLoader(
        baseUrl: 'https://app.anacan.az/',
        languages: kPackLanguageCodesForTest,
        fetchPack: (url, {required fresh, required timeout}) async => remote[url] ?? (throw const HttpException('404')),
        store: MemoryPackStore(),
      );
      await loader.prepare('fr');
      final samples = (fixture['rows'] as List).cast<Map<String, dynamic>>();
      for (final sample in samples) {
        for (final field in (sample['fields'] as List).cast<String>()) {
          loader.lookup(Map<String, dynamic>.from(sample['row'] as Map), field, 'fr');
        }
      }
      await loader.settled('fr');
      for (final sample in samples) {
        final row = Map<String, dynamic>.from(sample['row'] as Map);
        for (final field in (sample['fields'] as List).cast<String>()) {
          expect(loader.lookup(row, field, 'fr'), sample['translations']['fr'][field]);
        }
      }
      final edited = Map<String, dynamic>.from(samples.first['row'] as Map)..['title'] = 'Redaktə olunub';
      expect(loader.lookup(edited, 'title', 'fr'), isNull);
    });
  });

  group('content translation refresh', () {
    test('coalesces shard arrivals into one refresh of the current language', () async {
      final s = _setup();
      final service = ContentTranslations(s.loader);
      final refreshed = <String>[];
      final uninstall = installContentTranslationRefresh(service,
          language: () => 'fr', onRefresh: refreshed.add, delay: const Duration(milliseconds: 30));
      s.loader.lookup(_row, 'description', 'fr');
      s.loader.lookup(_titleRow, 'title', 'fr');
      await s.loader.prepare('fr');
      await s.loader.settled('fr');
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(refreshed, ['fr']);
      expect(service.version.value, s.loader.version);
      uninstall();
    });
  });
}

const List<String> kPackLanguageCodesForTest = ['fr', 'ja', 'tk'];
