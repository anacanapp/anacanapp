// Ported from: src/components/games/word-garden/model.ts
library;

import '../../common/engine/js.dart';

const String wordGardenId = 'word-garden';
const int levelPageSize = 20;
const int hintCost = 25;

/// Revisions dealt from one shared sequence (kept byte-for-byte reproducible).
const Set<String> wordGardenUnseededRevisions = {'az-202610-v1', 'az-202610-v2'};
bool isSeededGardenRevision(String revision) => !wordGardenUnseededRevisions.contains(revision);
bool isGardenPlayerSeed(Object? value) =>
    isSafeInteger(value) && (value as num) >= 0 && value <= 0xFFFFFFFF;

enum WordGardenMode {
  calm,
  timed;

  static WordGardenMode? parse(Object? value) =>
      value == 'calm' ? calm : value == 'timed' ? timed : null;
}

enum WordTier {
  common,
  standard,
  bonus;

  static WordTier? parse(Object? value) => switch (value) {
        'common' => common,
        'standard' => standard,
        'bonus' => bonus,
        _ => null,
      };
}

enum GardenTheme { garden, lake, night }

class LexiconWord {
  const LexiconWord({required this.word, required this.frequency, required this.tier, this.definition});
  final String word;
  final num frequency;
  final WordTier tier;
  final String? definition;
}

class WordLexicon {
  WordLexicon({
    required this.schema,
    required this.language,
    required this.revision,
    required this.locale,
    required this.alphabet,
    required this.minLength,
    required this.maxLength,
    required this.openingRacks,
    required this.words,
    required this.source,
  });
  final String schema;
  final String language;
  final String revision;
  final String locale;
  final List<String> alphabet;
  final int minLength;
  final int maxLength;
  final List<String> openingRacks;
  final List<LexiconWord> words;
  final Map<String, Object?> source;
}

class GardenWord {
  GardenWord({
    required this.id,
    required this.word,
    required this.letters,
    required this.row,
    required this.column,
    required this.direction,
    this.definition,
  });
  final String id;
  final String word;
  final List<String> letters;
  final int row;
  final int column;

  /// 'across' | 'down'
  final String direction;
  final String? definition;

  GardenWord moved(int row, int column) =>
      GardenWord(id: id, word: word, letters: letters, row: row, column: column, direction: direction, definition: definition);

  Map<String, Object?> toJson() => {
        'id': id,
        'word': word,
        'letters': letters,
        'row': row,
        'column': column,
        'direction': direction,
        if (definition != null) 'definition': definition,
      };

  static GardenWord fromJson(Map<String, Object?> json) => GardenWord(
        id: json['id'] as String,
        word: json['word'] as String,
        letters: (json['letters'] as List).cast<String>(),
        row: (json['row'] as num).toInt(),
        column: (json['column'] as num).toInt(),
        direction: json['direction'] as String,
        definition: json['definition'] as String?,
      );
}

class GardenCell {
  GardenCell({required this.row, required this.column, required this.letter, required this.wordIds});
  final int row;
  final int column;
  final String letter;
  final List<String> wordIds;

  Map<String, Object?> toJson() => {'row': row, 'column': column, 'letter': letter, 'wordIds': wordIds};
  static GardenCell fromJson(Map<String, Object?> json) => GardenCell(
        row: (json['row'] as num).toInt(),
        column: (json['column'] as num).toInt(),
        letter: json['letter'] as String,
        wordIds: (json['wordIds'] as List).cast<String>(),
      );
}

class WordGardenLevel {
  WordGardenLevel({
    required this.language,
    required this.revision,
    required this.level,
    required this.mode,
    required this.seed,
    required this.id,
    required this.words,
    required this.cells,
    required this.rows,
    required this.columns,
    required this.letters,
    required this.bonusWords,
    required this.difficulty,
    required this.timeLimit,
  });
  static const String schema = 'anacan-word-garden-level-v1';
  final String language;
  final String revision;
  final int level;
  final WordGardenMode mode;
  final int seed;
  final String id;
  final List<GardenWord> words;
  final List<GardenCell> cells;
  final int rows;
  final int columns;
  final List<String> letters;
  final List<String> bonusWords;
  final int difficulty;
  final int? timeLimit;

  Map<String, Object?> toJson() => {
        'schema': schema,
        'language': language,
        'revision': revision,
        'level': level,
        'mode': mode.name,
        'seed': seed,
        'id': id,
        'words': [for (final w in words) w.toJson()],
        'cells': [for (final c in cells) c.toJson()],
        'rows': rows,
        'columns': columns,
        'letters': letters,
        'bonusWords': bonusWords,
        'difficulty': difficulty,
        'timeLimit': timeLimit,
      };

  static WordGardenLevel fromJson(Map<String, Object?> json) => WordGardenLevel(
        language: json['language'] as String,
        revision: json['revision'] as String,
        level: (json['level'] as num).toInt(),
        mode: WordGardenMode.parse(json['mode'])!,
        seed: (json['seed'] as num).toInt(),
        id: json['id'] as String,
        words: [for (final w in json['words'] as List) GardenWord.fromJson((w as Map).cast())],
        cells: [for (final c in json['cells'] as List) GardenCell.fromJson((c as Map).cast())],
        rows: (json['rows'] as num).toInt(),
        columns: (json['columns'] as num).toInt(),
        letters: (json['letters'] as List).cast<String>(),
        bonusWords: (json['bonusWords'] as List).cast<String>(),
        difficulty: (json['difficulty'] as num).toInt(),
        timeLimit: (json['timeLimit'] as num?)?.toInt(),
      );
}

class LevelProfile {
  const LevelProfile(this.rackLength, this.targetWords, this.difficulty);
  final int rackLength;
  final int targetWords;
  final int difficulty;
}

LevelProfile getGardenLevelProfile(int level) {
  if (!isSafeInteger(level) || level < 1) throw const GameError('WORD_GARDEN_LEVEL_INVALID');
  if (level <= 10) return const LevelProfile(4, 3, 1);
  if (level <= 40) return const LevelProfile(5, 4, 2);
  if (level <= 100) return const LevelProfile(6, 5, 3);
  if (level <= 220) return const LevelProfile(7, 6, 4);
  return LevelProfile(8, 7 + level % 2, 5);
}

int gardenTimeLimit(List<List<String>> wordLetters, int rackLength, int difficulty) {
  final letters = wordLetters.fold<int>(0, (sum, word) => sum + word.length);
  final raw = 10 + wordLetters.length * 4 + letters * .9 + (rackLength - 4 > 0 ? rackLength - 4 : 0) * 2 + (difficulty - 1) * 2;
  final rounded = jsRound(raw);
  return rounded < 25 ? 25 : rounded > 100 ? 100 : rounded;
}

String cellKey(int row, int column) => '$row:$column';
