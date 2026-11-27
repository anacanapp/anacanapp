// Ported from: src/hooks/useLocalGameProgress.ts
//
// Key: `anacan_minigame_progress_<gameId>` (saglam-sebet, birlesdir, color-sort):
// `{unlockedLevel, levels:{<n>:{stars,bestScore}}, bestScoreOverall}`.
library;

import 'dart:math' as math;

import '../../common/engine/js_json.dart';
import '../../common/engine/json_object.dart';
import '../../common/persistence/game_store.dart';

const String localProgressPrefix = 'anacan_minigame_progress_';

extension type GameProgress(JsonMap json) {
  /// `parsed.unlockedLevel || 1` keeps whatever truthy value was stored (normally an integer).
  num get unlockedLevel => json['unlockedLevel'] as num;
  JsonMap get levels => asMap(json['levels']);
  num get bestScoreOverall => json['bestScoreOverall'] as num;
  bool isLevelUnlocked(int level) => level <= unlockedLevel;
}

GameProgress defaultGameProgress() => GameProgress({'unlockedLevel': 1, 'levels': <String, Object?>{}, 'bestScoreOverall': 0});

GameProgress readGameProgress(GameStore store, String gameId) {
  try {
    final raw = store.getItem('$localProgressPrefix$gameId');
    if (raw == null || raw.isEmpty) return defaultGameProgress();
    final parsed = jsonParse(raw);
    if (parsed == null) return defaultGameProgress(); // `null.unlockedLevel` throws → default
    final value = parsed is Map ? parsed : const {};
    Object? or(Object? v, Object? fallback) => jsTruthy(v) ? v : fallback;
    return GameProgress({
      'unlockedLevel': or(value['unlockedLevel'], 1),
      'levels': or(value['levels'], <String, Object?>{}),
      'bestScoreOverall': or(value['bestScoreOverall'], 0),
    });
  } catch (_) {
    return defaultGameProgress();
  }
}

void writeGameProgress(GameStore store, String gameId, GameProgress progress) {
  try {
    store.setItem('$localProgressPrefix$gameId', jsonStringify(progress.json));
  } catch (_) {
    // ignore quota / private-mode errors
  }
}

/// `recordLevelResult(level, score, stars, passed)`.
GameProgress recordLevelResult(GameProgress previous, int level, num score, int stars, bool passed) {
  final existing = previous.levels['$level'];
  final existingMap = existing is Map ? existing : const {};
  Object? or(Object? v, Object? fallback) => jsTruthy(v) ? v : fallback;
  return GameProgress({
    'unlockedLevel': passed ? math.max(previous.unlockedLevel, level + 1) : previous.unlockedLevel,
    'levels': {
      ...previous.levels,
      '$level': {
        'stars': math.max(or(existingMap['stars'], 0) as num, stars),
        'bestScore': math.max(or(existingMap['bestScore'], 0) as num, score),
      },
    },
    'bestScoreOverall': math.max(previous.bestScoreOverall, score),
  });
}
