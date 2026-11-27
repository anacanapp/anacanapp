// Ported from: src/lib/i18n.ts
import 'dart:async';

import 'package:flutter/foundation.dart';

import 'app_languages.dart';
import 'overlay.dart';
import 'sources.dart';

/// In-memory dictionaries per language plus the three layers of src/lib/i18n.ts:
///
///  1. disk cache (`anacan_i18n_cache:<lang>`), hydrated before the first frame;
///  2. the bundled dictionary (`assets/i18n/<lang>.json`), merged UNDER existing values;
///  3. the DB overlay (`translations` table), merged OVER existing values, then persisted.
///
/// Lookups ([lookup]) are synchronous; everything else is async and never needed in build methods.
class TranslationStore {
  TranslationStore({
    required this.assets,
    this.diskCache,
    this.overlay,
    this.persistDelay = const Duration(milliseconds: 1500),
  });

  final I18nAssetSource assets;
  final TranslationDiskCache? diskCache;
  TranslationPageFetcher? overlay;
  final Duration persistDelay;

  final Map<String, Map<String, String>> _cache = {};
  final Map<String, Future<void>> _seedLoads = {};
  final Set<String> _seeded = {};
  final Set<String> _dbLoadedFor = {};
  final Map<String, Future<void>> _dbLoads = {};
  final Map<String, String> _persistedSignature = {};
  final Map<String, Timer> _persistTimers = {};
  int _generation = 0;

  /// Bumped whenever a dictionary changes (seed, cache, overlay); widgets may listen to re-render.
  final ValueNotifier<int> revision = ValueNotifier<int>(0);

  /// `getCachedTranslation`.
  String? lookup(String key, String lang) => _cache[lang]?[key];

  /// Whether the bundled dictionary of [lang] has been merged (az included, unlike the web where az
  /// is a static import).
  bool isSeeded(String lang) => _seeded.contains(lang);

  /// Read-only view (tests, diagnostics).
  Map<String, String> dictionary(String lang) => Map.unmodifiable(_cache[lang] ?? const {});

  bool isOverlayLoaded(String lang) => _dbLoadedFor.contains(lang);

  void _bump() => revision.value++;

  /// `hydrateFromLocalStorage`: the web does this synchronously at module load for the boot
  /// language when it is not `az`. Cache values go OVER what is in memory; the stored signature is
  /// remembered so an unchanged dictionary is not rewritten.
  Future<bool> hydrateFromDisk(String lang) async {
    lang = normalizeAppLanguage(lang);
    if (lang == 'az' || diskCache == null) return false;
    final generation = _generation;
    final parsed = await diskCache!.read(lang);
    if (generation != _generation || parsed == null || parsed.isEmpty) return false;
    _cache[lang] = {...?_cache[lang], ...parsed};
    final signature = await diskCache!.readSignature(lang);
    if (signature != null && signature.isNotEmpty) _persistedSignature[lang] = signature;
    _bump();
    return true;
  }

  /// `loadLocalSeed`: merges the bundled dictionary UNDER the current values (cache/overlay win).
  Future<void> loadLocalSeed(String lang) {
    lang = normalizeAppLanguage(lang);
    final running = _seedLoads[lang];
    if (running != null) return running;
    final generation = _generation;
    final loading = () async {
      try {
        final seed = await assets.load(lang);
        if (generation == _generation) {
          _cache[lang] = {...seed, ...?_cache[lang]};
          _seeded.add(lang);
          _bump();
        }
      } catch (error) {
        if (generation == _generation) _seedLoads.remove(lang);
        rethrow;
      }
    }();
    _seedLoads[lang] = loading;
    return loading;
  }

  /// `ensureLanguageReady`: the bundled dictionary (which also carries the copy sections) is merged
  /// before the first translated frame; afterwards the merged set is persisted (debounced).
  /// Content packs are prepared separately and never awaited here.
  Future<void> ensureLanguageReady(String lang) async {
    lang = normalizeAppLanguage(lang);
    await loadLocalSeed(lang);
    if (lang != 'az') _persistSoon(lang);
  }

  /// `loadTranslations`: seed first, then the paged overlay (1000 rows per page) merged OVER the
  /// cache. A soft page error stops paging, merges what arrived and leaves the language retryable;
  /// a thrown error merges nothing. Either way the dictionary is persisted. Concurrent calls share
  /// one load; a successful load is not repeated.
  Future<void> loadTranslations(String lang) {
    lang = normalizeAppLanguage(lang);
    if (_dbLoadedFor.contains(lang)) return Future.value();
    final running = _dbLoads[lang];
    if (running != null) return running;
    final generation = _generation;
    final future = () async {
      try {
        await loadLocalSeed(lang);
        final fetcher = overlay;
        if (fetcher == null) {
          _persistSoon(lang);
          return;
        }
        final merged = <String, String>{};
        var from = 0;
        var hasMore = true;
        var succeeded = true;
        while (hasMore) {
          List<TranslationRow> page;
          try {
            page = await fetcher.fetchPage(lang, from, from + kTranslationPageSize - 1);
          } on TranslationPageError {
            succeeded = false;
            break;
          }
          for (final row in page) {
            merged[row.key] = row.value;
          }
          hasMore = page.length == kTranslationPageSize;
          from += kTranslationPageSize;
        }
        if (generation != _generation) return;
        _cache[lang] = {...?_cache[lang], ...merged};
        if (succeeded) _dbLoadedFor.add(lang);
        _bump();
        _persistSoon(lang);
      } catch (error) {
        debugPrint('Translation load error: $error');
        _persistSoon(lang);
      } finally {
        if (generation == _generation) _dbLoads.remove(lang);
      }
    }();
    _dbLoads[lang] = future;
    return future;
  }

  void _persistSoon(String lang) {
    if (diskCache == null || _persistTimers.containsKey(lang)) return;
    _persistTimers[lang] = Timer(persistDelay, () {
      _persistTimers.remove(lang);
      unawaited(persist(lang));
    });
  }

  /// `persistToLocalStorage`: writes the merged dictionary unless its signature is unchanged.
  Future<void> persist(String lang) async {
    final cache = diskCache;
    final data = _cache[lang];
    if (cache == null || data == null || data.isEmpty) return;
    final signature = dictionarySignature(data);
    if (_persistedSignature[lang] == signature) return;
    if (await cache.write(lang, data, signature)) _persistedSignature[lang] = signature;
  }

  /// Runs pending debounced writes now (app pause, tests).
  Future<void> flushPersists() async {
    final pending = _persistTimers.keys.toList();
    for (final lang in pending) {
      _persistTimers.remove(lang)?.cancel();
      await persist(lang);
    }
  }

  /// `clearTranslationCache`: drops every dictionary and in-flight load result. The web re-seeds az
  /// synchronously; here callers re-run [ensureLanguageReady] for the language they render.
  void clear() {
    _generation++;
    _seedLoads.clear();
    _seeded.clear();
    _cache.clear();
    _dbLoadedFor.clear();
    _dbLoads.clear();
    for (final timer in _persistTimers.values) {
      timer.cancel();
    }
    _persistTimers.clear();
    _bump();
  }

  /// Test/diagnostic hook: puts values straight into a dictionary (over existing values).
  @visibleForTesting
  void debugMerge(String lang, Map<String, String> values) {
    _cache[lang] = {...?_cache[lang], ...values};
    _bump();
  }
}
