// Ported from: src/components/games/color-sort/difficulty.ts
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';
import 'engine.dart';

const String colorSortId = 'color-sort';
const int initialLevelCount = 30;
const int levelPackSize = 10;
const int maxLevelCount = 300;
const int capacity = 4;

class LevelProfile {
  const LevelProfile({
    required this.level,
    required this.difficulty,
    required this.colors,
    required this.emptyTubes,
    required this.lockedTubes,
    required this.hiddenTubes,
    required this.hiddenDepth,
    required this.limitedMoves,
  });
  final int level;

  /// 'easy' | 'medium' | 'hard' | 'master' | 'expert'
  final String difficulty;
  final int colors;
  final int emptyTubes;
  final int lockedTubes;
  final int hiddenTubes;
  final int hiddenDepth;
  final bool limitedMoves;

  Map<String, Object?> toJson() => {
        'level': level, 'difficulty': difficulty, 'colors': colors, 'emptyTubes': emptyTubes, 'lockedTubes': lockedTubes,
        'hiddenTubes': hiddenTubes, 'hiddenDepth': hiddenDepth, 'limitedMoves': limitedMoves,
      };
}

class ColorSortLevel {
  ColorSortLevel({
    required this.profile,
    required this.seed,
    required this.board,
    required this.rules,
    required this.solution,
    required this.parMoves,
    required this.moveLimit,
  });
  final LevelProfile profile;
  final int seed;
  final Board board;
  final Rules rules;
  final List<Move> solution;
  final int parMoves;
  final int? moveLimit;

  int get level => profile.level;
  int get colors => profile.colors;
  int get hiddenTubes => profile.hiddenTubes;
  int get hiddenDepth => profile.hiddenDepth;

  Map<String, Object?> toJson() => {
        ...profile.toJson(),
        'version': 1,
        'seed': seed,
        'board': board,
        'rules': rules.toJson(),
        'solution': [for (final move in solution) move.toJson()],
        'parMoves': parMoves,
        'moveLimit': moveLimit,
      };

  /// Typed view of an already validated level JSON (see `validateLevel`).
  static ColorSortLevel fromJson(Map<String, Object?> json) => ColorSortLevel(
        profile: LevelProfile(
          level: (json['level'] as num).toInt(),
          difficulty: json['difficulty'] as String,
          colors: (json['colors'] as num).toInt(),
          emptyTubes: (json['emptyTubes'] as num).toInt(),
          lockedTubes: (json['lockedTubes'] as num).toInt(),
          hiddenTubes: (json['hiddenTubes'] as num).toInt(),
          hiddenDepth: (json['hiddenDepth'] as num).toInt(),
          limitedMoves: json['limitedMoves'] as bool,
        ),
        seed: (json['seed'] as num).toInt(),
        board: [for (final tube in json['board'] as List) [for (final color in tube as List) (color as num).toInt()]],
        rules: rulesFromJson((json['rules'] as Map).cast()),
        solution: [for (final move in json['solution'] as List) moveFromJson(move)!],
        parMoves: (json['parMoves'] as num).toInt(),
        moveLimit: (json['moveLimit'] as num?)?.toInt(),
      );
}

Rules rulesFromJson(Map<String, Object?> json) => Rules(
      (json['capacity'] as num).toInt(),
      [
        for (final lock in json['locks'] as List)
          TubeLock(((lock as Map)['tube'] as num).toInt(), (lock['after'] as num).toInt()),
      ],
    );

Move? moveFromJson(Object? json) {
  if (json is Map && isJsInteger(json['from']) && isJsInteger(json['to'])) return Move((json['from'] as num).toInt(), (json['to'] as num).toInt());
  if (json is List && json.length == 2) return Move((json[0] as num).toInt(), (json[1] as num).toInt());
  return null;
}

int normalizeLevel(num level) => level.isFinite ? math.min(maxLevelCount, math.max(1, level.floor())) : 1;

LevelProfile getLevelProfile(num input) {
  final level = normalizeLevel(input);
  final colors = level == 1 ? 2 : level <= 3 ? 3 : level <= 9 ? 4 : level <= 15 ? 5 : level <= 21 ? 6 : level <= 27 ? 7 : 8;
  final difficulty = level <= 6 ? 'easy' : level <= 12 ? 'medium' : level <= 18 ? 'hard' : level <= 24 ? 'master' : 'expert';
  return LevelProfile(
    level: level,
    difficulty: difficulty,
    colors: colors,
    emptyTubes: level <= 6 ? 3 : level <= 15 ? 2 : 1,
    lockedTubes: level < 11 ? 0 : level < 19 ? 1 : 2,
    hiddenTubes: level < 13 ? 0 : level < 19 ? 1 : level < 25 ? 2 : math.min(colors - 1, 3 + (level - 25) ~/ 10),
    hiddenDepth: level < 25 ? 2 : 3,
    limitedMoves: level > 6,
  );
}

Rules rulesForProfile(LevelProfile profile) => Rules(capacity, [
      for (var index = 0; index < profile.lockedTubes; index++)
        TubeLock(profile.colors + profile.emptyTubes + index, index == 0 ? 1 : profile.level >= 28 ? 3 : 2),
    ]);

ColorSortLevel makeLevel(LevelProfile profile, int seed, Board board, List<Move> solution) {
  final slack = profile.difficulty == 'medium' ? 14 : profile.difficulty == 'hard' ? 10 : profile.difficulty == 'master' ? 8 : 6;
  return ColorSortLevel(
    profile: profile,
    seed: seed,
    board: board,
    rules: rulesForProfile(profile),
    solution: solution,
    parMoves: solution.length,
    moveLimit: profile.limitedMoves ? solution.length + math.max(slack, (solution.length * 0.3).ceil()) : null,
  );
}

class ColorSortResult {
  const ColorSortResult(this.level, this.score, this.stars);
  final int level;
  final int score;
  final int stars;
  bool get passed => true;
  Map<String, Object?> toJson() => {'level': level, 'score': score, 'stars': stars, 'passed': true};
}

ColorSortResult resultForLevel(ColorSortLevel level, int moves, int hints, int extraTubes, int undos) {
  final stars = extraTubes > 0
      ? 1
      : moves <= level.parMoves + 2 && hints == 0
          ? 3
          : moves <= (level.parMoves * 1.35).ceil() + 3
              ? 2
              : 1;
  final efficiency = math.max(0, (level.moveLimit ?? level.parMoves + 14) - moves);
  final score = math.max(100, level.colors * 150 + level.level * 20 + stars * 100 + efficiency * 10 - hints * 35 - extraTubes * 80 - undos * 5);
  return ColorSortResult(level.level, score, stars);
}
