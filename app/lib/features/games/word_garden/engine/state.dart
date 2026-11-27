// Ported from: src/components/games/word-garden/state.ts, src/components/games/word-garden/GardenGame.tsx
// (round resume across revisions, clock flush and rewarded extra time)
//
// Profiles and rounds are ordered JSON maps (see json_object.dart) with typed views, so every
// transaction produces exactly the object the React app would store.
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';
import '../../common/engine/json_object.dart';
import 'model.dart';

/// Typed view of a `GardenProfile` JSON object.
extension type GardenProfile(JsonMap json) {
  String get language => json['language'] as String;
  String get revision => json['revision'] as String;
  WordGardenMode get mode => WordGardenMode.parse(json['mode'])!;
  GardenProgress get progress => GardenProgress(asMap(json['progress']));
  GardenRound? get round => json['round'] == null ? null : GardenRound(asMap(json['round']));
  num? get seed => json['seed'] as num?;
  GardenProfile copyWith({GardenProgress? progress, Object? round = _keep, num? seed}) => GardenProfile({
        ...json,
        if (progress != null) 'progress': progress.json,
        if (!identical(round, _keep)) 'round': (round as GardenRound?)?.json,
        'seed': ?seed,
      });
}

const Object _keep = Object();

extension type GardenProgress(JsonMap json) {
  int get unlockedLevel => (json['unlockedLevel'] as num).toInt();
  num get coins => json['coins'] as num;
  num get totalWords => json['totalWords'] as num;
  num get totalBonusWords => json['totalBonusWords'] as num;
  num get bestScore => json['bestScore'] as num;
  JsonMap get levels => asMap(json['levels']);
  JsonMap get bonusClaims => asMap(json['bonusClaims']);
  num get bonusClaimLevel => bonusClaims['level'] as num;
  List<String> get bonusClaimWords => (bonusClaims['words'] as List).cast<String>();
}

extension type GardenRound(JsonMap json) {
  String get levelId => json['levelId'] as String;
  List<String> get found => (json['found'] as List).cast<String>();
  List<String> get bonus => (json['bonus'] as List).cast<String>();
  List<String> get revealed => (json['revealed'] as List).cast<String>();
  num get hintsUsed => json['hintsUsed'] as num;
  num get elapsedSeconds => json['elapsedSeconds'] as num;
  num? get remainingSeconds => json['remainingSeconds'] as num?;
  bool get awarded => json['awarded'] as bool;
  bool? get started => json['started'] as bool?;
  GardenRound copyWith(JsonMap changes) => GardenRound({...json, ...changes});
}

class GardenResult {
  const GardenResult({required this.level, required this.score, required this.stars, required this.bonusWords, required this.hintsUsed});
  final int level;
  final num score;
  final int stars;
  final int bonusWords;
  final num hintsUsed;
  JsonMap toJson() => {'level': level, 'score': score, 'stars': stars, 'bonusWords': bonusWords, 'hintsUsed': hintsUsed};
}

GardenProfile createGardenProfile(String language, String revision, WordGardenMode mode) => GardenProfile({
      'schema': 'anacan-word-garden-profile-v1',
      'language': language,
      'revision': revision,
      'mode': mode.name,
      'progress': {
        'unlockedLevel': 1, 'coins': 75, 'totalWords': 0, 'totalBonusWords': 0, 'bestScore': 0, 'levels': <String, Object?>{},
        'bonusClaims': {'level': 1, 'words': <Object?>[]},
      },
      'round': null,
    });

GardenRound createGardenRound(WordGardenLevel level) => GardenRound({
      'levelId': level.id, 'found': <Object?>[], 'bonus': <Object?>[], 'revealed': <Object?>[], 'hintsUsed': 0, 'elapsedSeconds': 0,
      'remainingSeconds': level.timeLimit, 'awarded': false, 'started': level.mode == WordGardenMode.calm,
    });

Set<String> visibleGardenCells(WordGardenLevel level, GardenRound round) {
  final found = round.found.toSet();
  return {
    ...round.revealed,
    for (final cell in level.cells)
      if (cell.wordIds.any(found.contains)) cellKey(cell.row, cell.column),
  };
}

GardenResult gardenResult(WordGardenLevel level, GardenRound round) {
  final hints = round.hintsUsed;
  final stars = hints == 0 ? 3 : hints <= 2 ? 2 : 1;
  final letters = level.words.fold<int>(0, (sum, word) => sum + word.letters.length);
  final clockBonus = level.mode == WordGardenMode.timed ? math.min(300, (math.max(0, round.remainingSeconds ?? 0) * 2).floor()) : 0;
  return GardenResult(
    level: level.level,
    score: math.max(10, letters * 30 + stars * 100 + round.bonus.length * 25 + clockBonus - hints * 15),
    stars: stars,
    bonusWords: round.bonus.length,
    hintsUsed: hints,
  );
}

bool isGardenSolved(WordGardenLevel level, GardenRound round) =>
    round.levelId == level.id && level.words.every((word) => round.found.contains(word.id));

enum WordDecision { found, bonus, already, short, invalid }

({GardenProfile profile, WordDecision decision, int reward}) submitGardenWord(GardenProfile profile, WordGardenLevel level, String word) {
  final round = profile.round;
  if (round == null || round.levelId != level.id || round.awarded || round.remainingSeconds == 0) {
    return (profile: profile, decision: WordDecision.invalid, reward: 0);
  }
  if (word.runes.length < 3) return (profile: profile, decision: WordDecision.short, reward: 0);
  if (round.found.contains(word) || round.bonus.contains(word)) return (profile: profile, decision: WordDecision.already, reward: 0);
  if (level.words.any((item) => item.word == word)) {
    return (profile: profile.copyWith(round: round.copyWith({'found': [...round.found, word]})), decision: WordDecision.found, reward: 0);
  }
  if (!level.bonusWords.contains(word)) return (profile: profile, decision: WordDecision.invalid, reward: 0);
  final newRound = round.copyWith({'bonus': [...round.bonus, word]});
  final progress = profile.progress;
  final eligible = level.level == progress.unlockedLevel &&
      (progress.bonusClaimLevel != level.level || !progress.bonusClaimWords.contains(word));
  return (
    decision: WordDecision.bonus,
    reward: eligible ? 5 : 0,
    profile: profile.copyWith(
      round: newRound,
      progress: eligible
          ? GardenProgress({
              ...progress.json,
              'coins': progress.coins + 5,
              'totalBonusWords': progress.totalBonusWords + 1,
              'bonusClaims': {
                'level': level.level,
                'words': [...(progress.bonusClaimLevel == level.level ? progress.bonusClaimWords : const <String>[]), word],
              },
            })
          : progress,
    ),
  );
}

({GardenProfile profile, bool used}) revealGardenHint(GardenProfile profile, WordGardenLevel level, String key) {
  final round = profile.round;
  if (round == null || round.levelId != level.id || round.awarded || round.remainingSeconds == 0) return (profile: profile, used: false);
  final visible = visibleGardenCells(level, round);
  final cost = round.hintsUsed == 0 ? 0 : hintCost;
  if (visible.contains(key) || !level.cells.any((cell) => cellKey(cell.row, cell.column) == key) || profile.progress.coins < cost) {
    return (profile: profile, used: false);
  }
  return (
    used: true,
    profile: profile.copyWith(
      progress: GardenProgress({...profile.progress.json, 'coins': profile.progress.coins - cost}),
      round: round.copyWith({'revealed': [...round.revealed, key], 'hintsUsed': round.hintsUsed + 1}),
    ),
  );
}

({GardenProfile profile, GardenResult result, int reward})? completeGardenLevel(GardenProfile profile, WordGardenLevel level) {
  final round = profile.round;
  if (round == null || !isGardenSolved(level, round)) return null;
  final result = gardenResult(level, round);
  if (round.awarded) return (profile: profile, result: result, reward: 0);
  final progress = profile.progress;
  final firstWin = level.level == progress.unlockedLevel;
  final previous = progress.levels['${level.level}'] as Map?;
  final levels = <String, Object?>{
    ...progress.levels,
    '${level.level}': {
      'stars': math.max((previous?['stars'] as num?) ?? 0, result.stars),
      'bestScore': math.max((previous?['bestScore'] as num?) ?? 0, result.score),
    },
  };
  // Keep the 180 most recent (highest) level numbers, like Object.entries(...).sort(desc).slice(0, 180).
  final entries = stableSorted(levels.entries, (MapEntry<String, Object?> a, MapEntry<String, Object?> b) {
    final diff = (num.tryParse(b.key) ?? double.nan) - (num.tryParse(a.key) ?? double.nan);
    return diff.isNaN ? 0 : diff;
  });
  final recent = {for (final entry in entries.take(180)) entry.key: entry.value};
  final reward = firstWin ? 20 + result.stars * 10 : 0;
  return (
    result: result,
    reward: reward,
    profile: profile.copyWith(
      round: round.copyWith({'awarded': true}),
      progress: GardenProgress({
        ...progress.json,
        'levels': recent,
        'unlockedLevel': firstWin ? level.level + 1 : progress.unlockedLevel,
        'coins': progress.coins + reward,
        'bestScore': math.max(progress.bestScore, result.score),
        'totalWords': progress.totalWords + (firstWin ? level.words.length : 0),
        'bonusClaims': firstWin ? {'level': level.level + 1, 'words': <Object?>[]} : progress.bonusClaims,
      }),
    ),
  );
}

bool validGardenRound(Object? round, WordGardenLevel level) {
  if (round is! Map) return false;
  final value = round.cast<String, Object?>();
  bool unique(Object? items, bool Function(String item) valid, int max) {
    if (items is! List || items.length > max) return false;
    if (items.toSet().length != items.length) return false;
    return items.every((item) => item is String && valid(item));
  }

  final remaining = value['remainingSeconds'];
  final hints = value['hintsUsed'];
  final elapsed = value['elapsedSeconds'];
  final started = value['started'];
  final awarded = value['awarded'];
  return value['levelId'] == level.id &&
      unique(value['found'], (id) => level.words.any((word) => word.id == id), level.words.length) &&
      unique(value['bonus'], level.bonusWords.contains, level.bonusWords.length) &&
      unique(value['revealed'], (key) => level.cells.any((cell) => cellKey(cell.row, cell.column) == key), level.cells.length) &&
      isSafeInteger(hints) && (hints as num) >= 0 && hints <= level.cells.length &&
      isJsFinite(elapsed) && (elapsed as num) >= 0 && elapsed < 365 * 86400 &&
      (level.mode == WordGardenMode.calm
          ? remaining == null && value.containsKey('remainingSeconds')
          : isJsFinite(remaining) && (remaining as num) >= 0 && remaining <= level.timeLimit! + 600) &&
      (!value.containsKey('started') || started is bool) &&
      awarded is bool &&
      (!awarded || level.words.every((word) => (value['found'] as List).contains(word.id)));
}

// --- GardenGame.tsx round lifecycle (pure parts) ------------------------------------------------

/// Revision to generate [level] with: an unfinished saved round of that level keeps the revision
/// in its id (`<language>:<revision>:<mode>:<level>:<seed>`), so a v1/v2 round reopens unchanged.
String gardenLevelRevision(GardenProfile profile, int level) {
  final saved = profile.round;
  if (saved != null && !saved.awarded) {
    final parts = saved.levelId.split(':');
    if (parts.length > 3 && num.tryParse(parts[3]) == level) return parts[1];
  }
  return profile.revision;
}

/// A legacy timed level resumed under a newer revision gets the current short time budget.
WordGardenLevel adoptGardenLevel(WordGardenLevel generated, String profileRevision) {
  if (generated.mode != WordGardenMode.timed || generated.revision == profileRevision) return generated;
  return WordGardenLevel(
    language: generated.language, revision: generated.revision, level: generated.level, mode: generated.mode, seed: generated.seed,
    id: generated.id, words: generated.words, cells: generated.cells, rows: generated.rows, columns: generated.columns,
    letters: generated.letters, bonusWords: generated.bonusWords, difficulty: generated.difficulty,
    timeLimit: gardenTimeLimit([for (final word in generated.words) word.letters], generated.letters.length, generated.difficulty),
  );
}

/// Resumes the saved round when it is valid for [value] (clamping legacy remaining time), else starts a new one.
GardenProfile resumeGardenRound(GardenProfile profile, WordGardenLevel generated, WordGardenLevel value) {
  final saved = profile.round;
  final resumed = saved != null && validGardenRound(saved.json, value) && !saved.awarded;
  if (!resumed) return profile.copyWith(round: createGardenRound(value));
  final remaining = saved.remainingSeconds;
  return profile.copyWith(
    round: saved.copyWith({
      'remainingSeconds': generated.revision != profile.revision && remaining != null ? math.min(remaining, value.timeLimit!) : remaining,
    }),
  );
}

/// Clock flush while playing: adds elapsed time and spends the timed budget.
GardenProfile tickGardenRound(GardenProfile profile, WordGardenLevel definition, double seconds) {
  final round = profile.round;
  if (seconds <= 0 || round == null || round.levelId != definition.id || round.awarded) return profile;
  final remaining = round.remainingSeconds;
  return profile.copyWith(
    round: round.copyWith({
      'elapsedSeconds': round.elapsedSeconds + seconds,
      'remainingSeconds': remaining == null ? null : math.max(0, remaining - seconds),
    }),
  );
}

/// Confirmed rewarded extra time (`restore`): +floor(seconds), capped at 600 s, and the round starts.
GardenProfile reviveGardenRound(GardenProfile profile, WordGardenLevel definition, num seconds) {
  final round = profile.round;
  if (definition.mode != WordGardenMode.timed || !seconds.isFinite || seconds <= 0 || round == null || round.levelId != definition.id) {
    return profile;
  }
  return profile.copyWith(
    round: round.copyWith({'started': true, 'remainingSeconds': math.min(600, (round.remainingSeconds ?? 0) + seconds.floor())}),
  );
}
