// Ported from: src/components/games/iki-dost/state.ts (readFriendsProfile/writeFriendsProfile),
// src/components/games/iki-dost/TwoFriends.tsx (preferences)
//
// Keys: `anacan_two_friends_v1:friends-202610-v1` (profile, ≤ 24 000 chars, path ≤ 320 moves) and
// `anacan_two_friends_preferences_v1` (`{sound, haptics}`).
library;

import '../../common/engine/js.dart';
import '../../common/engine/js_json.dart';
import '../../common/engine/json_object.dart';
import '../../common/persistence/game_store.dart';
import '../engine/engine.dart';
import '../engine/state.dart';

const String friendsStorageKey = 'anacan_two_friends_v1:$twoFriendsRevision';
const String friendsPreferencesKey = 'anacan_two_friends_preferences_v1';

bool _integer(Object? value) => isSafeInteger(value) && (value as num) >= 0;

FriendsProfile readFriendsProfile(GameStore store, FriendsCatalog catalog) {
  final fallback = createFriendsProfile();
  try {
    final raw = store.getItem(friendsStorageKey);
    if (raw == null || raw.isEmpty || raw.length > 24000) return fallback;
    final parsed = jsonParse(raw);
    if (parsed == null) return fallback; // `null.progress` throws → caught → fallback
    final saved = parsed is Map ? parsed.cast<String, Object?>() : <String, Object?>{};
    final progress = saved['progress'];
    if (saved['schema'] != fallback.json['schema'] || saved['revision'] != twoFriendsRevision || !jsTruthy(progress)) return fallback;
    final p = progress is Map ? progress : const {};
    final levels = p['levels'];
    if (!_integer(p['unlocked']) || (p['unlocked'] as num) < 1 || (p['unlocked'] as num) > twoFriendsLevels ||
        !_integer(p['totalRescues']) || (p['totalRescues'] as num) > twoFriendsLevels * 2 || !_integer(p['bestScore']) ||
        !jsTruthy(levels) || levels is List || jsObjectEntries(levels).length > twoFriendsLevels ||
        !jsObjectEntries(levels).every((entry) {
          final key = entry.key, value = entry.value;
          final number = jsToNumber(key);
          return RegExp(r'^\d+$').hasMatch(key) && number >= 1 && number <= twoFriendsLevels && value is Map &&
              const [1, 2, 3].contains(value['stars']) && _integer(value['score']);
        })) {
      return fallback;
    }
    Object? round = saved['round'];
    if (jsTruthy(round)) {
      try {
        final r = round is Map ? round : const {};
        final path = r['path'];
        if (!_integer(r['level']) || (r['level'] as num) < 1 || (r['level'] as num) > (p['unlocked'] as num) || path is! List ||
            path.length > friendsPathLimit || ![r['moves'], r['hints'], r['undos']].every(_integer) || (r['moves'] as num) < path.length ||
            (r['hints'] as num) > friendsHintLimit || r['awarded'] is! bool) {
          throw const GameError('INVALID_ROUND');
        }
        final level = catalog.level((r['level'] as num).toInt());
        final replay = replayFriends(level, path);
        if (r['awarded'] == true && !friendsSolved(level, replay.state)) throw const GameError('INVALID_AWARDED_ROUND');
      } catch (_) {
        round = null;
      }
    }
    return FriendsProfile({...saved, 'round': round});
  } catch (_) {
    return fallback;
  }
}

bool writeFriendsProfile(GameStore store, FriendsProfile profile) {
  try {
    store.setItem(friendsStorageKey, jsonStringify(profile.json));
    return true;
  } catch (_) {
    return false;
  }
}

({bool sound, bool haptics}) readFriendsPreferences(GameStore store) {
  try {
    final raw = store.getItem(friendsPreferencesKey);
    final value = jsonParse(raw == null || raw.isEmpty ? 'null' : raw);
    final map = value is Map ? value : const {};
    return (sound: map['sound'] == true, haptics: map['haptics'] != false);
  } catch (_) {
    return (sound: false, haptics: true);
  }
}

void writeFriendsPreferences(GameStore store, ({bool sound, bool haptics}) value) {
  try {
    store.setItem(friendsPreferencesKey, jsonStringify({'sound': value.sound, 'haptics': value.haptics}));
  } catch (_) {}
}
