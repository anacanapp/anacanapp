// Ported from: src/lib/i18n.ts (seed/cache/overlay merge order, paging, persistence signature),
// src/hooks/useLanguage.ts + src/bootstrap-app.tsx (language switch, Preferences restore)
import 'dart:convert';
import 'dart:io';

import 'package:anacan/core/i18n/i18n.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _Assets implements I18nAssetSource {
  _Assets(this.data);
  final Map<String, Map<String, String>> data;
  int loads = 0;
  @override
  Future<Map<String, String>> load(String lang) async {
    loads++;
    final value = data[lang];
    if (value == null) throw StateError('BUNDLED_UI_LANGUAGE_MISSING');
    return Map.of(value);
  }
}

class _Overlay implements TranslationPageFetcher {
  _Overlay(this.rows, {this.softErrorAtPage, this.hardError = false});
  final List<TranslationRow> rows;
  final int? softErrorAtPage;
  final bool hardError;
  final List<(int, int)> calls = [];
  @override
  Future<List<TranslationRow>> fetchPage(String lang, int from, int to) async {
    calls.add((from, to));
    if (hardError) throw StateError('boom');
    if (softErrorAtPage != null && calls.length - 1 == softErrorAtPage) throw const TranslationPageError('503');
    return rows.sublist(from.clamp(0, rows.length), (to + 1).clamp(0, rows.length));
  }
}

List<TranslationRow> _rows(int count) => [for (var index = 0; index < count; index++) (key: 'k$index', value: 'db$index')];

void main() {
  test('dictionarySignature matches the web FNV-1a signature', () {
    expect(dictionarySignature({'b': '1', 'a': 'xyz', '10': 'ten', '2': 'two', 'ə': 'Ə😀'}), 'v1:5:7padpo');
    expect(dictionarySignature({}), 'v1:0:ztntfp');
    final en = (jsonDecode(File('../src/locales/en.json').readAsStringSync()) as Map).cast<String, String>();
    expect(dictionarySignature(en), 'v1:10434:173qhay');
  });

  test('merge order: seed < disk cache < DB overlay', () async {
    final cache = MemoryTranslationDiskCache()
      ..data['ru'] = {'a': 'cache-a', 'b': 'cache-b'}
      ..signatures['ru'] = 'old';
    final store = TranslationStore(
      assets: _Assets({'ru': {'a': 'seed-a', 'b': 'seed-b', 'c': 'seed-c'}}),
      diskCache: cache,
      overlay: _Overlay([(key: 'b', value: 'db-b')]),
      persistDelay: Duration.zero,
    );
    expect(await store.hydrateFromDisk('ru'), isTrue);
    await store.ensureLanguageReady('ru');
    expect(store.lookup('a', 'ru'), 'cache-a'); // a previous release's cache wins over the seed (web behaviour)
    expect(store.lookup('c', 'ru'), 'seed-c');
    await store.loadTranslations('ru');
    expect(store.lookup('b', 'ru'), 'db-b');
    expect(store.isOverlayLoaded('ru'), isTrue);
    await store.flushPersists();
    expect(cache.data['ru'], {'a': 'cache-a', 'b': 'db-b', 'c': 'seed-c'});
    expect(cache.signatures['ru'], dictionarySignature(store.dictionary('ru')));
  });

  test('az never uses the disk cache', () async {
    final cache = MemoryTranslationDiskCache()..data['az'] = {'x': 'cached'};
    final store = TranslationStore(assets: _Assets({'az': {'x': 'seed'}}), diskCache: cache);
    expect(await store.hydrateFromDisk('az'), isFalse);
    await store.ensureLanguageReady('az');
    await store.flushPersists();
    expect(store.lookup('x', 'az'), 'seed');
    expect(cache.writes, 0);
  });

  test('pages the overlay 1000 rows at a time until a short page', () async {
    final overlay = _Overlay(_rows(2500));
    final store = TranslationStore(assets: _Assets({'fr': {}}), overlay: overlay);
    await store.loadTranslations('fr');
    expect(overlay.calls, [(0, 999), (1000, 1999), (2000, 2999)]);
    expect(store.lookup('k2499', 'fr'), 'db2499');
    final exact = _Overlay(_rows(1000));
    final second = TranslationStore(assets: _Assets({'fr': {}}), overlay: exact);
    await second.loadTranslations('fr');
    expect(exact.calls, [(0, 999), (1000, 1999)]);
  });

  test('a page error keeps what arrived and stays retryable; a thrown error merges nothing', () async {
    final soft = _Overlay(_rows(2500), softErrorAtPage: 1);
    final store = TranslationStore(assets: _Assets({'fr': {'seed': 's'}}), overlay: soft);
    await store.loadTranslations('fr');
    expect(store.lookup('k10', 'fr'), 'db10');
    expect(store.lookup('k1500', 'fr'), isNull);
    expect(store.isOverlayLoaded('fr'), isFalse);
    store.overlay = _Overlay(_rows(2500));
    await store.loadTranslations('fr');
    expect(store.lookup('k1500', 'fr'), 'db1500');
    expect(store.isOverlayLoaded('fr'), isTrue);
    await store.loadTranslations('fr'); // loaded: no further requests
    expect((store.overlay! as _Overlay).calls, hasLength(3));

    final cache = MemoryTranslationDiskCache();
    final hard = TranslationStore(assets: _Assets({'fr': {'seed': 's'}}), overlay: _Overlay(_rows(10), hardError: true), diskCache: cache, persistDelay: Duration.zero);
    await hard.loadTranslations('fr');
    expect(hard.lookup('k1', 'fr'), isNull);
    expect(hard.lookup('seed', 'fr'), 's');
    await hard.flushPersists();
    expect(cache.data['fr'], {'seed': 's'}); // offline-first: the seed is still cached
  });

  test('concurrent loads share one request; unchanged dictionaries are not rewritten', () async {
    final overlay = _Overlay(_rows(3));
    final cache = MemoryTranslationDiskCache();
    final assets = _Assets({'de': {'x': 'y'}});
    final store = TranslationStore(assets: assets, overlay: overlay, diskCache: cache, persistDelay: Duration.zero);
    await Future.wait([store.loadTranslations('de'), store.loadTranslations('de'), store.ensureLanguageReady('de')]);
    expect(overlay.calls, hasLength(1));
    expect(assets.loads, 1);
    await store.flushPersists();
    await store.persist('de');
    expect(cache.writes, 1);
  });

  test('clear() drops dictionaries and ignores loads started before it', () async {
    final store = TranslationStore(assets: _Assets({'en': {'a': 'b'}}));
    final pending = store.ensureLanguageReady('en');
    store.clear();
    await pending;
    expect(store.lookup('a', 'en'), isNull);
    await store.ensureLanguageReady('en');
    expect(store.lookup('a', 'en'), 'b');
  });

  test('a missing bundled language rejects and can be retried', () async {
    final assets = _Assets({});
    final store = TranslationStore(assets: assets);
    await expectLater(store.ensureLanguageReady('ja'), throwsStateError);
    assets.data['ja'] = {'a': 'あ'};
    await store.ensureLanguageReady('ja');
    expect(store.lookup('a', 'ja'), 'あ');
  });

  group('runtime and language switching', () {
    test('bootstrap restores and normalizes the Preferences language, then the seed', () async {
      final prefs = MemoryLanguagePreferenceStore({kAppLanguagePreferenceKey: 'ru-RU', kHasSelectedLanguagePreferenceKey: 'true'});
      final runtime = I18nRuntime(store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')), preferences: prefs);
      expect(await runtime.bootstrap(), 'ru');
      expect(runtime.hasSelectedLanguage, isTrue);
      expect(prefs.values[kAppLanguagePreferenceKey], 'ru');
      expect(runtime.tr('month_january', 'Yanvar'), isNot('Yanvar'));
      final empty = I18nRuntime(store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')), preferences: MemoryLanguagePreferenceStore());
      expect(await empty.bootstrap(), 'az');
    });

    test('a stuck Preferences bridge does not hold startup', () async {
      final runtime = I18nRuntime(store: TranslationStore(assets: FileI18nAssetSource('assets/i18n')), preferences: _StuckPreferences());
      expect(await runtime.bootstrap(timeout: const Duration(milliseconds: 20)), 'az');
    });

    test('changeLanguage prepares the dictionary, persists the choice and loads the overlay', () async {
      final prefs = MemoryLanguagePreferenceStore();
      final overlay = _Overlay([(key: 'month_january', value: 'DB-January')]);
      final prepared = <String>[];
      final runtime = I18nRuntime(
        store: TranslationStore(assets: FileI18nAssetSource('assets/i18n'), overlay: overlay),
        preferences: prefs,
        prepareContent: prepared.add,
      );
      final container = ProviderContainer(overrides: [i18nRuntimeProvider.overrideWithValue(runtime)]);
      addTearDown(container.dispose);
      expect(container.read(appLanguageProvider), 'az');
      await container.read(appLanguageProvider.notifier).changeLanguage('ar');
      expect(container.read(appLanguageProvider), 'ar');
      expect(container.read(textDirectionProvider).name, 'rtl');
      expect(prefs.values[kAppLanguagePreferenceKey], 'ar');
      expect(prepared, ['ar']);
      expect(runtime.store.isSeeded('ar'), isTrue);
      await runtime.loadTranslations('ar');
      expect(runtime.tr('month_january', 'Yanvar'), 'DB-January');
      runtime.setLanguageInMemory('de');
      expect(container.read(appLanguageProvider), 'de');
      expect(container.read(disabledToolsProvider), isEmpty);
    });
  });
}

class _StuckPreferences implements LanguagePreferenceStore {
  @override
  Future<String?> read(String key) => Future.delayed(const Duration(seconds: 5), () => 'ru');
  @override
  Future<void> write(String key, String value) async {}
}
