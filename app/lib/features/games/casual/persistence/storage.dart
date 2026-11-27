// Ported from: src/components/games/casual/storage.ts
//
// Key: `anacan_casual_v1:<game>:<revision>` — Leaf Flight (`leaf-flight:flight-202610-v1`) and
// Clear the Way (`clear-the-way:parking-202610-v1`). Value ≤ 28 000 chars:
// `{schema:"anacan-casual-profile-v1",game,revision,unlocked,levels:{<n>:{stars,score}},round}`.
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';
import '../../common/engine/js_json.dart';
import '../../common/engine/json_object.dart';
import '../../common/persistence/game_store.dart';

String casualStorageKey(String game, String revision) => 'anacan_casual_v1:$game:$revision';

extension type CasualProfile(JsonMap json) {
  String get game => json['game'] as String;
  String get revision => json['revision'] as String;
  int get unlocked => (json['unlocked'] as num).toInt();
  JsonMap get levels => asMap(json['levels']);
  Object? get round => json['round'];
  CasualProfile withRound(Object? round) => CasualProfile({...json, 'round': round});
}

CasualProfile readCasualProfile(GameStore store, String game, String revision, int count, bool Function(Object? round) validateRound) {
  final fallback = CasualProfile({
    'schema': 'anacan-casual-profile-v1', 'game': game, 'revision': revision, 'unlocked': 1, 'levels': <String, Object?>{}, 'round': null,
  });
  try {
    final raw = store.getItem(casualStorageKey(game, revision));
    if (raw == null || raw.isEmpty || raw.length > 28000) return fallback;
    final parsed = jsonParse(raw);
    if (parsed == null) return fallback;
    final value = parsed is Map ? parsed.cast<String, Object?>() : <String, Object?>{};
    final unlocked = value['unlocked'];
    final levels = value['levels'];
    if (value['schema'] != fallback.json['schema'] || value['game'] != game || value['revision'] != revision || !isJsInteger(unlocked) ||
        (unlocked as num) < 1 || unlocked > count || !jsTruthy(levels) || levels is List || jsObjectEntries(levels).length > count ||
        !jsObjectEntries(levels).every((entry) {
          final number = jsToNumber(entry.key), result = entry.value;
          return RegExp(r'^\d+$').hasMatch(entry.key) && number >= 1 && number <= count && result is Map &&
              const [1, 2, 3].contains(result['stars']) && isSafeInteger(result['score']) && (result['score'] as num) >= 0;
        })) {
      return fallback;
    }
    final round = value['round'];
    final keep = validateRound(round) && round is Map && round['level'] is num && (round['level'] as num) <= unlocked;
    return CasualProfile({...value, 'round': keep ? round : null});
  } catch (_) {
    return fallback;
  }
}

bool writeCasualProfile(GameStore store, CasualProfile value) {
  try {
    store.setItem(casualStorageKey(value.game, value.revision), jsonStringify(value.json));
    return true;
  } catch (_) {
    return false;
  }
}

CasualProfile recordCasualWin(CasualProfile profile, int level, int count, ({int stars, num score}) result) {
  final previous = profile.levels['$level'] as Map?;
  return CasualProfile({
    ...profile.json,
    'round': null,
    'unlocked': math.max(profile.unlocked, math.min(count, level + 1)),
    'levels': {
      ...profile.levels,
      '$level': {
        'stars': math.max((previous?['stars'] as num?) ?? 0, result.stars),
        'score': math.max((previous?['score'] as num?) ?? 0, result.score),
      },
    },
  });
}
