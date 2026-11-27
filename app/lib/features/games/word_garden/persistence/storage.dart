// Ported from: src/components/games/word-garden/storage.ts
//
// Keys: `anacan_word_garden_v1:<language>:<revision>:<calm|timed>` and
// `anacan_word_garden_preferences_v1`. Raw values are the React app's JSON; writes use
// JavaScript JSON.stringify ordering so the Capacitor app can read them back unchanged.
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';
import '../../common/engine/js_json.dart';
import '../../common/engine/json_object.dart';
import '../../common/persistence/game_store.dart';
import '../engine/library.dart';
import '../engine/model.dart';
import '../engine/state.dart';

String gardenStorageKey(String language, String revision, WordGardenMode mode) =>
    'anacan_word_garden_v1:$language:$revision:${mode.name}';
const String gardenPreferencesKey = 'anacan_word_garden_preferences_v1';

class GardenPreferences {
  const GardenPreferences({this.sound = false, this.haptics = true, this.highContrast = false, this.reducedMotion = false, this.theme = 'garden'});
  final bool sound;
  final bool haptics;
  final bool highContrast;
  final bool reducedMotion;
  final String theme;
  JsonMap toJson() => {'sound': sound, 'haptics': haptics, 'highContrast': highContrast, 'reducedMotion': reducedMotion, 'theme': theme};
}

const GardenPreferences defaultGardenPreferences = GardenPreferences();

/// A random uint32 created once per player profile (`crypto.getRandomValues`).
int createGardenPlayerSeed([math.Random? random]) => (random ?? math.Random.secure()).nextInt(0x100000000);

GardenProfile readGardenProfile(GameStore store, String language, String revision, WordGardenMode mode, {int Function()? newSeed}) {
  final profile = _readStored(store, language, revision, mode);
  if (wordGardenLibraries[language]?.revision != revision || !isSeededGardenRevision(revision) || isGardenPlayerSeed(profile.seed)) {
    return profile;
  }
  return GardenProfile({...profile.json, 'seed': (newSeed ?? createGardenPlayerSeed)()});
}

bool _integer(Object? n) => isSafeInteger(n) && (n as num) >= 0;

GardenProfile _readStored(GameStore store, String language, String revision, WordGardenMode mode) {
  final fallback = createGardenProfile(language, revision, mode);
  try {
    final text = store.getItem(gardenStorageKey(language, revision, mode));
    if (text == null || text.isEmpty) {
      if (wordGardenLibraries[language]?.revision == revision) {
        for (final previous in wordGardenPreviousRevisions[language] ?? const <String>[]) {
          final raw = store.getItem(gardenStorageKey(language, previous, mode));
          if (raw == null || raw.isEmpty) continue;
          final saved = omit(_readStored(store, language, previous, mode).json, 'seed');
          final round = saved['round'];
          final awarded = round is Map && round['awarded'] != null && round['awarded'] != false && round['awarded'] != 0 && round['awarded'] != '';
          return GardenProfile({...saved, 'revision': revision, 'round': awarded ? null : round});
        }
      }
      return fallback;
    }
    if (text.length > 100000) return fallback;
    final parsed = jsonParse(text);
    if (parsed is! Map) return fallback;
    final value = parsed.cast<String, Object?>();
    final progress = value['progress'];
    if (value['schema'] != fallback.json['schema'] || value['language'] != language || value['revision'] != revision ||
        value['mode'] != mode.name || progress is! Map) {
      return fallback;
    }
    final levels = progress['levels'];
    final claims = progress['bonusClaims'];
    final unlocked = progress['unlockedLevel'];
    if (!_integer(unlocked) || (unlocked as num) < 1 || unlocked >= 9007199254740991 ||
        ![progress['coins'], progress['totalWords'], progress['totalBonusWords'], progress['bestScore']].every(_integer) ||
        levels is! Map || levels.length > 180 ||
        !levels.entries.every((entry) {
          final result = entry.value;
          return RegExp(r'^\d+$').hasMatch(entry.key as String) && result is Map && const [1, 2, 3].contains(result['stars']) &&
              _integer(result['bestScore']);
        }) ||
        claims is! Map || !_integer(claims['level']) || claims['words'] is! List ||
        (claims['words'] as List).length > 1000 ||
        !(claims['words'] as List).every((word) => word is String && word.length < 40)) {
      return fallback;
    }
    final saved = value['round'];
    Object? round;
    if (saved is Map && saved['levelId'] is String) {
      final levelId = saved['levelId'] as String;
      final versions = [revision, ...?wordGardenPreviousRevisions[language]];
      final found = saved['found'], bonus = saved['bonus'], revealed = saved['revealed'];
      if (versions.any((version) => levelId.startsWith('$language:$version:${mode.name}:')) && levelId.length < 160 &&
          found is List && bonus is List && revealed is List && found.length <= 8 && bonus.length <= 1000 && revealed.length <= 121 &&
          saved['awarded'] is bool) {
        round = saved;
      }
    }
    final seed = value['seed'];
    return GardenProfile({...omit(value, 'seed'), if (isGardenPlayerSeed(seed)) 'seed': seed, 'round': round});
  } catch (_) {
    return fallback;
  }
}

/// `writeGardenProfile`: returns false when the store rejects the write.
bool writeGardenProfile(GameStore store, GardenProfile profile) {
  try {
    store.setItem(gardenStorageKey(profile.language, profile.revision, profile.mode), jsonStringify(profile.json));
    return true;
  } catch (_) {
    return false;
  }
}

GardenPreferences readGardenPreferences(GameStore store) {
  try {
    final raw = store.getItem(gardenPreferencesKey);
    final saved = jsonParse(raw == null || raw.isEmpty ? 'null' : raw);
    if (saved == null || saved == false || saved == 0 || saved == '') return defaultGardenPreferences;
    final map = saved is Map ? saved : const {};
    final theme = map['theme'];
    return GardenPreferences(
      sound: map['sound'] == true,
      haptics: map['haptics'] != false,
      highContrast: map['highContrast'] == true,
      reducedMotion: map['reducedMotion'] == true,
      theme: const ['garden', 'lake', 'night'].contains(theme) ? theme as String : 'garden',
    );
  } catch (_) {
    return defaultGardenPreferences;
  }
}

void writeGardenPreferences(GameStore store, GardenPreferences value) {
  try {
    store.setItem(gardenPreferencesKey, jsonStringify(value.toJson()));
  } catch (_) {
    // Optional preferences stay in memory.
  }
}
