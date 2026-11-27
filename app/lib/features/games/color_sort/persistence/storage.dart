// Ported from: src/components/games/color-sort/session.ts (save/read/clear), src/components/games/color-sort/levels.ts
// (generated-level cache), src/components/games/color-sort/useColorSortLibrary.ts, src/components/games/color-sort/ColorSortGame.tsx (markers)
//
// Keys: `anacan_colorsort_round_v1` `{version:1,level,seed,session}`, `anacan_colorsort_level_count_v1` ("44"),
// `anacan_colorsort_markers_v1` ("true"/"false"), `anacan_colorsort_level_v1_<n>` + `anacan_colorsort_level_index_v1`.
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';
import '../../common/engine/js_json.dart';
import '../../common/persistence/game_store.dart';
import '../engine/difficulty.dart';
import '../engine/levels.dart';
import '../engine/session.dart';

const String colorSortSaveKey = 'anacan_colorsort_round_v1';
const String colorSortLevelCountKey = 'anacan_colorsort_level_count_v1';
const String colorSortMarkersKey = 'anacan_colorsort_markers_v1';
const String colorSortCachePrefix = 'anacan_colorsort_level_v1_';
const String colorSortCacheIndexKey = 'anacan_colorsort_level_index_v1';
const int maxCachedLevels = 20;

ColorSortSession? readSavedSession(GameStore store, ColorSortLevel definition) {
  try {
    final raw = store.getItem(colorSortSaveKey);
    if (raw == null || raw.isEmpty || raw.length > 150000) return null;
    final saved = jsonParse(raw);
    if (saved is! Map || saved['version'] != 1 || saved['level'] != definition.level || saved['seed'] != definition.seed ||
        !validSessionJson(saved['session'], definition)) {
      return null;
    }
    final session = ColorSortSession((saved['session'] as Map).cast());
    return session.copyWith({'revealed': revealSurface(session.tubes, session.revealed)});
  } catch (_) {
    return null;
  }
}

void saveSession(GameStore store, ColorSortSession state, ColorSortLevel definition) {
  try {
    store.setItem(colorSortSaveKey, jsonStringify({'version': 1, 'level': definition.level, 'seed': definition.seed, 'session': state.json}));
  } catch (_) {
    // Local gameplay remains available when storage is full or private.
  }
}

void clearSavedSession(GameStore store, ColorSortLevel definition) {
  try {
    final raw = store.getItem(colorSortSaveKey);
    final saved = jsonParse(raw == null || raw.isEmpty ? 'null' : raw);
    if (saved is Map && saved['level'] == definition.level && saved['seed'] == definition.seed) store.removeItem(colorSortSaveKey);
  } catch (_) {
    // Nothing to clear.
  }
}

/// `readLevelCount` (useColorSortLibrary).
int readLevelCount(GameStore store) {
  try {
    final stored = jsToNumber(store.getItem(colorSortLevelCountKey));
    return isJsInteger(stored)
        ? math.min(maxLevelCount, math.max(initialLevelCount, (stored / levelPackSize).ceil() * levelPackSize))
        : initialLevelCount;
  } catch (_) {
    return initialLevelCount;
  }
}

void writeLevelCount(GameStore store, int count) {
  try {
    store.setItem(colorSortLevelCountKey, '$count');
  } catch (_) {}
}

bool readMarkers(GameStore store) {
  try {
    return store.getItem(colorSortMarkersKey) != 'false';
  } catch (_) {
    return true;
  }
}

void writeMarkers(GameStore store, bool markers) {
  try {
    store.setItem(colorSortMarkersKey, '$markers');
  } catch (_) {}
}

/// `getCachedLevel`: bundled levels first, then a validated generated level from the cache.
ColorSortLevel? getCachedLevel(GameStore store, ColorSortCatalog catalog, num input) {
  final level = normalizeLevel(input);
  final bundled = catalog.bundledLevel(level);
  if (bundled != null) return ColorSortLevel.fromJson(bundled.toJson());
  try {
    final raw = store.getItem('$colorSortCachePrefix$level');
    final cached = jsonParse(raw == null || raw.isEmpty ? 'null' : raw);
    if (validateLevelJson(cached, level)) return ColorSortLevel.fromJson((cached as Map).cast());
  } catch (_) {}
  return null;
}

List<int> _readCacheIndex(GameStore store) {
  final raw = store.getItem(colorSortCacheIndexKey);
  if (raw != null) {
    try {
      final parsed = jsonParse(raw);
      if (parsed is List) return [for (final value in parsed) if (isJsInteger(value)) (value as num).toInt()];
    } catch (_) {}
  }
  final levels = <int>[];
  for (final key in store.keys.toList()) {
    if (!key.startsWith(colorSortCachePrefix)) continue;
    final value = jsToNumber(key.substring(colorSortCachePrefix.length));
    if (isJsInteger(value)) levels.add(value.toInt());
  }
  return levels..sort();
}

void cacheLevel(GameStore store, ColorSortLevel level) {
  try {
    store.setItem('$colorSortCachePrefix${level.level}', jsonStringify(level.toJson()));
    final index = _readCacheIndex(store).where((value) => value != level.level).toList()..add(level.level);
    final evicted = index.sublist(0, math.max(0, index.length - maxCachedLevels));
    index.removeRange(0, evicted.length);
    for (final value in evicted) {
      store.removeItem('$colorSortCachePrefix$value');
    }
    store.setItem(colorSortCacheIndexKey, jsonStringify(index));
  } catch (_) {
    // memory-only play
  }
}
