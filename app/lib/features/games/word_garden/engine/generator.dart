// Ported from: src/components/games/word-garden/generator.ts
//
// Byte-for-byte port: every `random()` call, sort (stable, same comparator), Map/Set insertion
// order and tie-break of the TypeScript generator is reproduced, so level N of a lexicon revision
// (and player seed) is identical in Dart and in the React app.
library;

import 'dart:math' as math;

import '../../common/engine/js.dart';
import 'lexicon.dart';
import 'model.dart';

int gardenSeed(String value) {
  var hash = 2166136261;
  for (final codePoint in value.runes) {
    hash = imul(xor32(hash, codePoint), 16777619);
  }
  return toUint32(hash);
}

JsRandom gardenRandom(num seed) => Mulberry32(seed).call;

List<T> shuffleLetters<T>(Iterable<T> items, JsRandom random) => jsShuffle(items, random);

class _Rack {
  _Rack(this.root, this.words);
  final CompiledWord root;
  final List<CompiledWord> words;
}

T _memo<T extends Object>(CompiledLexicon lexicon, String key, T Function() build) {
  final cached = lexicon.cache[key];
  if (cached != null) return cached as T;
  final value = build();
  lexicon.cache[key] = value;
  return value;
}

List<_Rack> _racksFor(CompiledLexicon lexicon, int length, [int minimum = 3]) =>
    _memo(lexicon, 'racks:$length:$minimum', () {
      final seen = <String>{};
      final racks = <_Rack>[];
      final possible = stableSorted(lexicon.targets.where((word) => word.letters.length == length), (CompiledWord a, CompiledWord b) {
        final common = jsNumberOfBool(b.tier == WordTier.common) - jsNumberOfBool(a.tier == WordTier.common);
        if (common != 0) return common;
        final frequency = b.frequency - a.frequency;
        if (frequency != 0) return frequency;
        return codeOrder(a.word, b.word);
      });
      for (final root in possible) {
        if (seen.contains(root.signature)) continue;
        final words = wordsFromRack(lexicon, root.letters);
        if (words.where((word) => word.tier != WordTier.bonus).length < minimum) continue;
        seen.add(root.signature);
        racks.add(_Rack(root, words));
      }
      return racks;
    });

/// Placed word (GardenWord + letters) — GardenWord already carries letters.
typedef _Placed = GardenWord;

class _WorkingCell {
  _WorkingCell(this.row, this.column, this.letter, this.wordIds, this.across, this.down);
  final int row;
  final int column;
  final String letter;
  final List<String> wordIds;
  final bool across;
  final bool down;
}

class _Point {
  const _Point(this.row, this.column);
  final int row;
  final int column;
}

_Point _point(GardenWord word, int index) => _Point(
      word.row + (word.direction == 'down' ? index : 0),
      word.column + (word.direction == 'across' ? index : 0),
    );

class _Box {
  _Box(this.minRow, this.maxRow, this.minColumn, this.maxColumn);
  final int minRow;
  final int maxRow;
  final int minColumn;
  final int maxColumn;
}

_Box _bounds(Iterable<_WorkingCell> cells, [GardenWord? extra]) {
  var minRow = 1 << 62, maxRow = -(1 << 62), minColumn = 1 << 62, maxColumn = -(1 << 62);
  void add(int row, int column) {
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
    if (column < minColumn) minColumn = column;
    if (column > maxColumn) maxColumn = column;
  }

  for (final cell in cells) {
    add(cell.row, cell.column);
  }
  if (extra != null) {
    for (var i = 0; i < extra.letters.length; i++) {
      final p = _point(extra, i);
      add(p.row, p.column);
    }
  }
  return _Box(minRow, maxRow, minColumn, maxColumn);
}

bool _canPlace(GardenWord word, Map<String, _WorkingCell> board) {
  final stepRow = word.direction == 'across' ? 0 : 1, stepColumn = word.direction == 'across' ? 1 : 0;
  final end = _point(word, word.letters.length);
  if (board.containsKey(cellKey(word.row - stepRow, word.column - stepColumn)) || board.containsKey(cellKey(end.row, end.column))) {
    return false;
  }
  var intersections = 0;
  for (var index = 0; index < word.letters.length; index++) {
    final letter = word.letters[index];
    final here = _point(word, index);
    final existing = board[cellKey(here.row, here.column)];
    if (existing != null) {
      if (existing.letter != letter || (word.direction == 'across' ? existing.across : existing.down)) return false;
      intersections++;
    } else {
      final pr = word.direction == 'across' ? 1 : 0, pc = word.direction == 'across' ? 0 : 1;
      if (board.containsKey(cellKey(here.row - pr, here.column - pc)) || board.containsKey(cellKey(here.row + pr, here.column + pc))) {
        return false;
      }
    }
  }
  if (board.isNotEmpty && intersections == 0) return false;
  final box = _bounds(board.values, word);
  return box.maxRow - box.minRow < 11 && box.maxColumn - box.minColumn < 11;
}

void _place(GardenWord word, Map<String, _WorkingCell> board) {
  for (var index = 0; index < word.letters.length; index++) {
    final position = _point(word, index);
    final key = cellKey(position.row, position.column);
    final existing = board[key];
    board[key] = _WorkingCell(
      position.row,
      position.column,
      word.letters[index],
      [...?existing?.wordIds, word.id],
      word.direction == 'across' || (existing?.across ?? false),
      word.direction == 'down' || (existing?.down ?? false),
    );
  }
}

class GardenLayout {
  GardenLayout(this.words, this.cells, this.rows, this.columns);
  final List<GardenWord> words;
  final List<GardenCell> cells;
  final int rows;
  final int columns;
}

GardenLayout _finish(Iterable<GardenWord> placed, Map<String, _WorkingCell> board) {
  final box = _bounds(board.values);
  final cells = [
    for (final cell in board.values)
      GardenCell(row: cell.row - box.minRow, column: cell.column - box.minColumn, letter: cell.letter, wordIds: cell.wordIds),
  ];
  stableSort(cells, (GardenCell a, GardenCell b) => a.row != b.row ? a.row - b.row : a.column - b.column);
  return GardenLayout(
    [for (final word in placed) word.moved(word.row - box.minRow, word.column - box.minColumn)],
    cells,
    box.maxRow - box.minRow + 1,
    box.maxColumn - box.minColumn + 1,
  );
}

GardenWord _wordAt(CompiledWord word, String direction, int row, int column) => GardenWord(
    id: word.word, word: word.word, letters: word.letters, row: row, column: column, direction: direction, definition: word.definition);

GardenLayout _layout(CompiledWord root, List<CompiledWord> candidates, int target, JsRandom random) {
  final board = <String, _WorkingCell>{};
  final placed = <_Placed>[];
  final first = _wordAt(root, random() > 0.5 ? 'across' : 'down', 0, 0);
  _place(first, board);
  placed.add(first);
  var remaining = shuffleLetters(candidates.where((word) => word.word != root.word), random);
  for (var pass = 0; pass < 2 && placed.length < target; pass++) {
    final unused = <CompiledWord>[];
    for (final candidate in remaining) {
      if (placed.length >= target) {
        unused.add(candidate);
        continue;
      }
      GardenWord? best;
      double bestScore = double.infinity;
      for (final cell in board.values.toList(growable: false)) {
        for (var index = 0; index < candidate.letters.length; index++) {
          if (candidate.letters[index] != cell.letter) continue;
          for (final direction in const ['across', 'down']) {
            final word = _wordAt(candidate, direction, cell.row - (direction == 'down' ? index : 0),
                cell.column - (direction == 'across' ? index : 0));
            if (!_canPlace(word, board)) continue;
            final box = _bounds(board.values, word);
            final rows = box.maxRow - box.minRow + 1, columns = box.maxColumn - box.minColumn + 1;
            final score = rows * columns + (rows - columns).abs() * 2 + random() * 8;
            // options.sort(by score)[0] with a stable sort == first strict minimum.
            if (score < bestScore) {
              bestScore = score;
              best = word;
            }
          }
        }
      }
      if (best != null) {
        _place(best, board);
        placed.add(best);
      } else {
        unused.add(candidate);
      }
    }
    remaining = unused;
  }
  return _finish(placed, board);
}

List<CompiledWord> _rankCandidates(_Rack rack, int level, JsRandom random) {
  final ranked = [
    for (final word in rack.words)
      if (word.tier != WordTier.bonus && (level > 40 || word.tier == WordTier.common || word.frequency >= 90))
        (word: word, rank: (word.tier == WordTier.common ? 100 : 0) + word.frequency / 5 + random() * 35),
  ];
  stableSort(ranked, (a, b) => b.rank - a.rank);
  return [for (final item in ranked.take(20)) item.word];
}

int _modeCheck(WordGardenMode mode) => mode.index;

WordGardenLevel _generateLegacy(CompiledLexicon lexicon, int level, WordGardenMode mode) {
  final profile = getGardenLevelProfile(level);
  _modeCheck(mode);
  final data = lexicon.data;
  final seed = gardenSeed('${data.language}:${data.revision}:${mode.name}:$level');
  final random = gardenRandom(seed);
  var racks = _racksFor(lexicon, profile.rackLength);
  for (var length = profile.rackLength - 1; racks.isEmpty && length >= 4; length--) {
    racks = _racksFor(lexicon, length);
  }
  if (racks.isEmpty) throw const GameError('WORD_GARDEN_LIBRARY_RACKS_REQUIRED');
  _Rack? opening;
  if (mode == WordGardenMode.calm && level <= data.openingRacks.length) {
    for (final rack in racks) {
      if (rack.root.word == data.openingRacks[level - 1]) {
        opening = rack;
        break;
      }
    }
  }
  final pool = level <= 20 ? racks.where((rack) => rack.root.tier == WordTier.common).toList() : racks;
  final available = pool.isNotEmpty ? pool : racks;
  final initialIndex = (level - 1 + gardenSeed('${data.revision}:${mode.name}:racks')) % available.length;
  GardenLayout? best;
  _Rack? chosen;
  for (var attempt = 0; attempt < math.min(12, available.length); attempt++) {
    final rack = attempt == 0 && opening != null ? opening : available[(initialIndex + attempt) % available.length];
    final candidates = _rankCandidates(rack, level, random);
    final result = _layout(rack.root, candidates, profile.targetWords, random);
    if (best == null || result.words.length > best.words.length) {
      best = result;
      chosen = rack;
    }
    if (result.words.length >= profile.targetWords || (opening != null && attempt == 0 && result.words.length >= 3)) break;
  }
  if (best == null || chosen == null || best.words.length < 3) throw const GameError('WORD_GARDEN_CONNECTED_LEVEL_REQUIRED');
  final targets = {for (final word in best.words) word.word};
  final bonusWords = [for (final word in chosen.words) if (!targets.contains(word.word)) word.word]..sort(codeOrder);
  final letters = shuffleLetters(chosen.root.letters, random);
  return WordGardenLevel(
    language: data.language, revision: data.revision, level: level, mode: mode, seed: seed,
    id: '${data.language}:${data.revision}:${mode.name}:$level:$seed',
    words: best.words, cells: best.cells, rows: best.rows, columns: best.columns,
    letters: letters, bonusWords: bonusWords, difficulty: profile.difficulty,
    timeLimit: mode == WordGardenMode.timed ? 60 + best.words.length * 18 + profile.rackLength * 5 : null,
  );
}

class _Card {
  _Card(this.rack, this.puzzle);
  final _Rack rack;
  final GardenLayout puzzle;
}

int _tierStart(int difficulty) => const [1, 11, 41, 101, 221][difficulty - 1];

List<_Card> _variedDeck(CompiledLexicon lexicon, int difficulty, WordGardenMode mode, [int cycle = 0]) {
  final key = 'deck:${mode.name}:$difficulty:$cycle';
  final cached = lexicon.cache[key];
  if (cached != null) return cached as List<_Card>;
  final start = _tierStart(difficulty), profile = getGardenLevelProfile(start), minimum = difficulty == 1 ? 2 : 3;
  final baseline = cycle != 0 ? _variedDeck(lexicon, difficulty, mode) : null;
  var racks = _racksFor(lexicon, profile.rackLength, minimum);
  for (var length = profile.rackLength - 1; racks.isEmpty && length >= 4; length--) {
    racks = _racksFor(lexicon, length, minimum);
  }
  final familiar = difficulty <= 2 ? racks.where((rack) => rack.root.tier == WordTier.common).toList() : <_Rack>[];
  final available = baseline != null ? [for (final card in baseline) card.rack] : familiar.length >= 10 ? familiar : racks;
  final cards = <({_Rack rack, List<GardenLayout> variants, double rank})>[];
  final random = gardenRandom(gardenSeed('${lexicon.data.revision}:${mode.name}:$difficulty:$cycle:variety-deck'));
  for (final rack in available) {
    final candidates = [
      for (final word in rack.words)
        if (word.tier != WordTier.bonus && (difficulty > 2 || word.tier == WordTier.common || word.frequency >= 70)) word,
    ];
    final variants = <GardenLayout>[];
    final signatures = <String>{};
    for (var attempt = 0; attempt < 3; attempt++) {
      final result = _layout(rack.root, candidates, difficulty == 5 ? 8 : profile.targetWords, random);
      final signature = ([for (final word in result.words) word.word]..sort(codeOrder)).join('|');
      if (result.words.length < minimum || signatures.contains(signature)) continue;
      variants.add(result);
      signatures.add(signature);
    }
    GardenLayout? fallback;
    if (baseline != null) {
      for (final card in baseline) {
        if (identical(card.rack, rack)) {
          fallback = card.puzzle;
          break;
        }
      }
    }
    if (variants.isEmpty && fallback != null) variants.add(fallback);
    if (variants.isNotEmpty) cards.add((rack: rack, variants: variants, rank: random()));
  }
  if (cards.isEmpty) throw const GameError('WORD_GARDEN_LIBRARY_RACKS_REQUIRED');
  final prefix = baseline != null ? baseline.sublist(0, math.min(3, baseline.length)) : <_Card>[];
  final suffix = baseline != null ? baseline.sublist(math.max(0, baseline.length - 3)) : <_Card>[];
  final reserved = <_Rack>{...prefix.map((card) => card.rack), ...suffix.map((card) => card.rack)};
  for (var index = cards.length - 1; index >= 0; index--) {
    if (reserved.contains(cards[index].rack)) cards.removeAt(index);
  }
  final history = <List<String>>[
    for (final card in prefix) [for (final word in card.puzzle.words) word.word],
  ];
  final deck = <_Card>[...prefix];
  if (baseline == null && difficulty > 1) {
    for (var level = start - 6; level < start; level++) {
      history.add([for (final word in generateGardenLevel(lexicon, level, mode).words) word.word]);
    }
  }
  while (cards.isNotEmpty) {
    var chosenIndex = 0;
    var chosenVariant = cards[0].variants[0];
    var bestScore = double.infinity;
    final recentHistory = history.length > 6 ? history.sublist(history.length - 6) : history;
    final closingSource = cards.length <= 4 ? (suffix.isNotEmpty ? suffix.sublist(0, 1) : deck.sublist(0, math.min(2, deck.length))) : null;
    for (var index = 0; index < cards.length; index++) {
      final card = cards[index];
      for (final variant in card.variants) {
        final words = [for (final word in variant.words) word.word];
        num overlap = 0;
        for (var age = 0; age < recentHistory.length; age++) {
          final recent = recentHistory[age];
          overlap = overlap + words.where(recent.contains).length * (age == recentHistory.length - 1 ? 1000 : (age + 1) * 12);
        }
        num closing = 0;
        if (closingSource != null) {
          for (final first in closingSource) {
            closing = closing +
                words.where((word) => first.puzzle.words.any((answer) => answer.word == word)).length * (cards.length == 1 ? 1000 : 35);
          }
        }
        final score = overlap + closing + math.max(0, profile.targetWords - words.length) * 2 + card.rank;
        if (score < bestScore) {
          bestScore = score;
          chosenIndex = index;
          chosenVariant = variant;
        }
      }
    }
    final chosen = cards.removeAt(chosenIndex);
    deck.add(_Card(chosen.rack, chosenVariant));
    history.add([for (final word in chosenVariant.words) word.word]);
    if (history.length > 6) history.removeAt(0);
  }
  deck.addAll(suffix);
  lexicon.cache[key] = deck;
  return deck;
}

/// `playerSeed` only affects seeded revisions (v3+). Published v1/v2 puzzles ignore it.
WordGardenLevel generateGardenLevel(CompiledLexicon lexicon, int level, [WordGardenMode mode = WordGardenMode.calm, num playerSeed = 0]) {
  final profile = getGardenLevelProfile(level);
  final data = lexicon.data;
  if (data.revision == 'az-202610-v1') return _generateLegacy(lexicon, level, mode);
  if (isSeededGardenRevision(data.revision)) return _generateSeeded(lexicon, level, mode, playerSeed);
  final seed = gardenSeed('${data.language}:${data.revision}:${mode.name}:$level');
  final random = gardenRandom(seed);
  final initial = _variedDeck(lexicon, profile.difficulty, mode);
  final offset = level - _tierStart(profile.difficulty);
  final deck = _variedDeck(lexicon, profile.difficulty, mode, offset ~/ initial.length);
  final openingWord = profile.difficulty == 1 && level - 1 < data.openingRacks.length ? data.openingRacks[level - 1] : null;
  _Card? card;
  if (openingWord != null && openingWord.isNotEmpty) {
    for (final item in deck) {
      if (item.rack.root.word == openingWord) {
        card = item;
        break;
      }
    }
  }
  card ??= deck[offset % deck.length];
  final targetWords = card.puzzle.words.take(profile.targetWords).toList();
  final candidates = [for (final word in targetWords) lexicon.words[word.word]!];
  GardenLayout? best;
  for (var attempt = 0; attempt < 5; attempt++) {
    final result = _layout(card.rack.root, candidates, targetWords.length, random);
    if (result.words.length == targetWords.length &&
        (best == null ||
            result.rows * result.columns + (result.rows - result.columns).abs() * 3 <
                best.rows * best.columns + (best.rows - best.columns).abs() * 3)) {
      best = result;
    }
  }
  if (best == null) {
    final board = <String, _WorkingCell>{};
    for (final word in targetWords) {
      _place(word, board);
    }
    best = _finish(targetWords, board);
  }
  final targets = {for (final word in best.words) word.word};
  return WordGardenLevel(
    language: data.language, revision: data.revision, level: level, mode: mode, seed: seed,
    id: '${data.language}:${data.revision}:${mode.name}:$level:$seed',
    words: best.words, cells: best.cells, rows: best.rows, columns: best.columns,
    letters: shuffleLetters(card.rack.root.letters, random),
    bonusWords: [for (final word in card.rack.words) if (!targets.contains(word.word)) word.word]..sort(codeOrder),
    difficulty: profile.difficulty,
    timeLimit: mode == WordGardenMode.timed
        ? gardenTimeLimit([for (final word in best.words) word.letters], card.rack.root.letters.length, profile.difficulty)
        : null,
  );
}

// ---------------------------------------------------------------------------
// Per-player seeded dealing (az-202611-v3 and later revisions).
// ---------------------------------------------------------------------------
const List<int> _seededTierLevels = [10, 30, 60, 120];
const int _seededPrefixLevels = 220;
const int _seededRecentTicks = 40, _seededHardGap = 5;
const int _seededWindow = 8;

class _Dealt {
  _Dealt(this.rack, this.puzzle);
  final _Rack rack;
  final GardenLayout puzzle;
}

class _Usage {
  _Usage(this.last, this.used, this.tick);
  final Map<String, int> last;
  final Map<int, Set<String>> used;
  int tick;
  _Usage clone() => _Usage(Map.of(last), {for (final e in used.entries) e.key: Set.of(e.value)}, tick);
}

class _SeededRun {
  _SeededRun(this.prefix, this.state);
  final List<_Dealt> prefix;
  final _Usage state;
  final Map<int, List<_Dealt>> cycles = {};
}

Map<int, int> _lengthPools(CompiledLexicon lexicon) => _memo(lexicon, 'pools', () {
      final pools = <int, int>{};
      for (final word in lexicon.targets) {
        pools[word.letters.length] = (pools[word.letters.length] ?? 0) + 1;
      }
      return pools;
    });

bool _isFresh(_Usage usage, CompiledWord word) => !(usage.used[word.letters.length]?.contains(word.word) ?? false);

void _markUsed(CompiledLexicon lexicon, _Usage usage, Iterable<String> words) {
  final pools = _lengthPools(lexicon);
  for (final value in words) {
    final word = lexicon.words[value]!;
    final length = word.letters.length;
    final used = usage.used[length] ??= <String>{};
    used.add(word.word);
    usage.last[word.word] = usage.tick;
    if (used.length >= (pools[length] ?? 0)) {
      for (final recent in used.toList()) {
        if (usage.tick - usage.last[recent]! > _seededRecentTicks) used.remove(recent);
      }
    }
  }
  usage.tick++;
}

bool _seededEligible(CompiledWord word, int difficulty) =>
    word.tier != WordTier.bonus && (difficulty > 2 || word.tier == WordTier.common || word.frequency >= 70);

List<_Rack> _seededTierRacks(CompiledLexicon lexicon, int difficulty) => _memo(lexicon, 'tier:$difficulty', () {
      final profile = getGardenLevelProfile(_tierStart(difficulty)), minimum = difficulty == 1 ? 2 : 3;
      var racks = _racksFor(lexicon, profile.rackLength, minimum);
      for (var length = profile.rackLength - 1; racks.isEmpty && length >= 4; length--) {
        racks = _racksFor(lexicon, length, minimum);
      }
      if (racks.isEmpty) throw const GameError('WORD_GARDEN_LIBRARY_RACKS_REQUIRED');
      final familiar = difficulty <= 2 ? racks.where((rack) => rack.root.tier == WordTier.common).toList() : <_Rack>[];
      return difficulty <= 2 && familiar.length >= _seededTierLevels[difficulty - 1] ? familiar : racks;
    });

class _FinalPool {
  _FinalPool(this.racks, this.fallback);
  final List<_Rack> racks;
  final Map<_Rack, GardenLayout> fallback;
}

_FinalPool _seededFinalPool(CompiledLexicon lexicon) => _memo(lexicon, 'final-pool', () {
      final random = gardenRandom(gardenSeed('${lexicon.data.revision}:seeded-viable-5'));
      final fallback = <_Rack, GardenLayout>{};
      final racks = <_Rack>[];
      for (final rack in _seededTierRacks(lexicon, 5)) {
        final candidates = [for (final word in rack.words) if (word.word != rack.root.word && _seededEligible(word, 5)) word];
        for (var attempt = 0; attempt < 2; attempt++) {
          final result = _layout(rack.root, candidates, 7, random);
          if (result.words.length >= 3) {
            racks.add(rack);
            fallback[rack] = result;
            break;
          }
        }
      }
      if (racks.isEmpty) throw const GameError('WORD_GARDEN_LIBRARY_RACKS_REQUIRED');
      return _FinalPool(racks, fallback);
    });

GardenLayout? _dealPuzzle(_Rack rack, int difficulty, int target, int minimum, _Usage usage, JsRandom random) {
  final candidates = [for (final word in rack.words) if (word.word != rack.root.word && _seededEligible(word, difficulty)) word];
  final ranked = [
    for (final word in candidates)
      if (_isFresh(usage, word)) (word: word, rank: (word.tier == WordTier.common ? 30 : 0) + word.frequency / 8 + random() * 40),
  ];
  stableSort(ranked, (a, b) {
    final diff = b.rank - a.rank;
    return diff != 0 ? diff : codeOrder(a.word.word, b.word.word);
  });
  final fresh = [for (final item in ranked.take(24)) item.word];
  final freshWords = {for (final word in fresh) word.word};
  final stale = stableSorted(
    candidates.where((word) => !freshWords.contains(word.word) && !_isFresh(usage, word)),
    (CompiledWord a, CompiledWord b) {
      final diff = (usage.last[a.word] ?? -1) - (usage.last[b.word] ?? -1);
      return diff != 0 ? diff : codeOrder(a.word, b.word);
    },
  );
  final settled = [for (final word in stale) if (usage.tick - usage.last[word.word]! > _seededHardGap) word];
  GardenLayout? best;
  var bestScore = double.negativeInfinity;
  final passes = <(List<CompiledWord>, int)>[
    (settled, 0),
    (settled, math.max(2, target - fresh.length + 2)),
    (settled, 8),
    (stale, 8),
  ];
  for (final (pool, extra) in passes) {
    if ((extra != 0 && pool.isEmpty) || (best != null && identical(pool, stale))) break;
    for (var attempt = 0; attempt < 2; attempt++) {
      final result = _layout(rack.root, [...fresh, ...pool.take(extra)], target, random);
      final reused = result.words.where((word) => word.word != rack.root.word && !freshWords.contains(word.word)).length;
      final score = math.min(result.words.length, target) * 100 - reused * 60 - result.rows * result.columns * .1;
      if (result.words.length >= minimum && score > bestScore) {
        best = result;
        bestScore = score;
      }
    }
    if (best != null && best.words.length >= target) break;
  }
  return best;
}

_Dealt? _dealNext(CompiledLexicon lexicon, List<_Rack> queue, int from, int until, int difficulty, int target, int minimum, _Usage usage,
    JsRandom random, bool freshRoot) {
  ({int index, GardenLayout puzzle, num score})? best;
  for (final (start, width) in [(from, _seededWindow), (from + _seededWindow, _seededWindow * 4)]) {
    if (best != null && best.score < 1000) break;
    final options = <({int index, int fresh})>[];
    for (var index = start; index < math.min(until, start + width); index++) {
      final rack = queue[index];
      if (freshRoot && !_isFresh(usage, rack.root)) continue;
      final fresh = rack.words
          .where((word) => word.word != rack.root.word && _seededEligible(word, difficulty) && _isFresh(usage, word))
          .length;
      options.add((index: index, fresh: math.min(fresh, target - 1)));
    }
    stableSort(options, (a, b) => b.fresh != a.fresh ? b.fresh - a.fresh : a.index - b.index);
    for (var rank = 0; rank < options.length; rank++) {
      final option = options[rank];
      if (rank >= 3 && best != null && best.score < 1000) break;
      final puzzle = _dealPuzzle(queue[option.index], difficulty, target, minimum, usage, random);
      if (puzzle == null) continue;
      final reused = puzzle.words.where((word) => !_isFresh(usage, lexicon.words[word.word]!)).length;
      final recent = puzzle.words.where((word) {
        final last = usage.last[word.word];
        return last != null && usage.tick - last <= _seededHardGap;
      }).length;
      final score = recent * 1000 + reused * 10 - math.min(puzzle.words.length, target);
      if (best == null || score < best.score) best = (index: option.index, puzzle: puzzle, score: score);
      if (reused == 0 && puzzle.words.length >= target) break;
    }
  }
  if (best == null) return null;
  final tmp = queue[from];
  queue[from] = queue[best.index];
  queue[best.index] = tmp;
  return _Dealt(queue[from], best.puzzle);
}

_SeededRun _seededRun(CompiledLexicon lexicon, WordGardenMode mode, num playerSeed) {
  final key = 'run:${mode.name}:${toUint32(playerSeed)}';
  final cached = lexicon.cache[key];
  if (cached != null) return cached as _SeededRun;
  final usage = _Usage({}, {}, 0);
  final prefix = <_Dealt>[];
  final data = lexicon.data;
  final seedText = jsSeedText(playerSeed);
  for (final difficulty in const [1, 2, 3, 4]) {
    final racks = _seededTierRacks(lexicon, difficulty);
    final random = gardenRandom(gardenSeed('${data.language}:${data.revision}:${mode.name}:$seedText:$difficulty:player-deal'));
    var queue = shuffleLetters(racks, random);
    var cursor = 0, pass = 0;
    for (var index = 0; index < _seededTierLevels[difficulty - 1]; index++) {
      final profile = getGardenLevelProfile(_tierStart(difficulty) + index), minimum = difficulty == 1 ? 2 : 3;
      _Dealt? dealt;
      while (dealt == null) {
        if (cursor >= queue.length) {
          if (++pass > 3) throw const GameError('WORD_GARDEN_CONNECTED_LEVEL_REQUIRED');
          queue = shuffleLetters(racks, random);
          cursor = 0;
        }
        dealt = _dealNext(lexicon, queue, cursor, queue.length, difficulty, profile.targetWords, minimum, usage, random, pass == 0);
        cursor += dealt != null ? 1 : _seededWindow;
      }
      prefix.add(dealt);
      _markUsed(lexicon, usage, [for (final word in dealt.puzzle.words) word.word]);
    }
  }
  final run = _SeededRun(prefix, usage);
  // Bounded like the TS cache (at most 4 runs per lexicon).
  final runKeys = lexicon.cache.keys.where((k) => k.startsWith('run:')).toList();
  if (runKeys.length >= 4) lexicon.cache.remove(runKeys.first);
  lexicon.cache[key] = run;
  return run;
}

/// `${playerSeed}` — integer seeds print like JS numbers.
String jsSeedText(num seed) => seed is int || seed == seed.truncateToDouble() ? '${seed.toInt()}' : '$seed';

List<_Rack> _cycleShuffle(CompiledLexicon lexicon, WordGardenMode mode, num playerSeed, int cycle) => shuffleLetters(
    _seededFinalPool(lexicon).racks,
    gardenRandom(gardenSeed('${lexicon.data.language}:${lexicon.data.revision}:${mode.name}:${jsSeedText(playerSeed)}:5:$cycle:cycle')));

List<_Rack> _cycleOrder(CompiledLexicon lexicon, WordGardenMode mode, num playerSeed, int cycle) {
  final order = _cycleShuffle(lexicon, mode, playerSeed, cycle), size = order.length;
  if (cycle == 0 || size < 40) return order;
  final previous = _cycleShuffle(lexicon, mode, playerSeed, cycle - 1);
  final tail = previous.sublist(math.max(0, previous.length - 8)).toSet();
  var swap = 16;
  for (var index = 0; index < 8; index++) {
    if (tail.contains(order[index])) {
      while (swap < size - 9 && tail.contains(order[swap])) {
        swap++;
      }
      if (swap >= size - 9) break;
      final tmp = order[index];
      order[index] = order[swap];
      order[swap] = tmp;
      swap++;
    }
  }
  return order;
}

List<_Dealt> _seededCycle(CompiledLexicon lexicon, WordGardenMode mode, num playerSeed, int cycle) {
  final run = _seededRun(lexicon, mode, playerSeed);
  final cached = run.cycles[cycle];
  if (cached != null) return cached;
  final pool = _seededFinalPool(lexicon), order = _cycleOrder(lexicon, mode, playerSeed, cycle);
  final usage = cycle == 0 ? run.state.clone() : _Usage({}, {}, 0);
  if (cycle != 0) {
    final previous = _cycleShuffle(lexicon, mode, playerSeed, cycle - 1);
    for (final rack in previous.sublist(math.max(0, previous.length - 6))) {
      _markUsed(lexicon, usage, [for (final word in rack.words) if (_seededEligible(word, 5)) word.word]);
    }
  }
  final random = gardenRandom(
      gardenSeed('${lexicon.data.language}:${lexicon.data.revision}:${mode.name}:${jsSeedText(playerSeed)}:5:$cycle:deal'));
  final first = _seededPrefixLevels + 1 + cycle * order.length;
  final cards = <_Dealt>[];
  final body = order.length - (order.length >= 40 ? 8 : 0);
  for (var index = 0; index < order.length; index++) {
    final target = getGardenLevelProfile(first + index).targetWords;
    final dealt = index < body ? _dealNext(lexicon, order, index, body, 5, target, 3, usage, random, false) : null;
    final rack = dealt?.rack ?? order[index];
    final puzzle = dealt?.puzzle ?? _dealPuzzle(rack, 5, target, 3, usage, random) ?? pool.fallback[rack]!;
    cards.add(_Dealt(rack, puzzle));
    _markUsed(lexicon, usage, [for (final word in puzzle.words) word.word]);
  }
  if (run.cycles.length >= 3) {
    for (final key in run.cycles.keys) {
      if (key != 0 && key != cycle) {
        run.cycles.remove(key);
        break;
      }
    }
  }
  run.cycles[cycle] = cards;
  return cards;
}

WordGardenLevel _generateSeeded(CompiledLexicon lexicon, int level, WordGardenMode mode, num playerSeed) {
  if (!isSafeInteger(playerSeed) || playerSeed < 0 || playerSeed > 0xFFFFFFFF) throw const GameError('WORD_GARDEN_PLAYER_SEED_INVALID');
  final profile = getGardenLevelProfile(level);
  final _Dealt dealt;
  if (level <= _seededPrefixLevels) {
    dealt = _seededRun(lexicon, mode, playerSeed).prefix[level - 1];
  } else {
    final size = _seededFinalPool(lexicon).racks.length, offset = level - _seededPrefixLevels - 1;
    dealt = _seededCycle(lexicon, mode, playerSeed, offset ~/ size)[offset % size];
  }
  final data = lexicon.data;
  final seed = gardenSeed('${data.language}:${data.revision}:${mode.name}:$level:${jsSeedText(playerSeed)}');
  final random = gardenRandom(seed);
  final rack = dealt.rack, puzzle = dealt.puzzle;
  final targets = {for (final word in puzzle.words) word.word};
  return WordGardenLevel(
    language: data.language, revision: data.revision, level: level, mode: mode, seed: seed,
    id: '${data.language}:${data.revision}:${mode.name}:$level:$seed',
    words: [for (final word in puzzle.words) word.moved(word.row, word.column)],
    cells: [for (final cell in puzzle.cells) GardenCell(row: cell.row, column: cell.column, letter: cell.letter, wordIds: [...cell.wordIds])],
    rows: puzzle.rows, columns: puzzle.columns,
    letters: shuffleLetters(rack.root.letters, random),
    bonusWords: [for (final word in rack.words) if (!targets.contains(word.word)) word.word]..sort(codeOrder),
    difficulty: profile.difficulty,
    timeLimit: mode == WordGardenMode.timed
        ? gardenTimeLimit([for (final word in puzzle.words) word.letters], rack.root.letters.length, profile.difficulty)
        : null,
  );
}

bool validateGardenLevel(WordGardenLevel level, CompiledLexicon lexicon) {
  if (level.language != lexicon.data.language || level.revision != lexicon.data.revision ||
      level.words.length < (level.difficulty == 1 ? 2 : 3) || level.words.length > 8 ||
      {for (final w in level.words) w.word}.length != level.words.length || level.rows > 11 || level.columns > 11 || level.cells.isEmpty) {
    return false;
  }
  final board = <String, GardenCell>{};
  for (final cell in level.cells) {
    final key = cellKey(cell.row, cell.column);
    if (cell.row < 0 || cell.column < 0 || cell.row >= level.rows || cell.column >= level.columns || board.containsKey(key)) return false;
    board[key] = cell;
  }
  for (final word in level.words) {
    if (!lexicon.words.containsKey(word.word) || !canSpellWord(level.letters, word.letters)) return false;
    for (var index = 0; index < word.letters.length; index++) {
      final p = _point(word, index);
      if (board[cellKey(p.row, p.column)]?.letter != word.letters[index]) return false;
    }
    if (!level.cells.any((cell) => cell.wordIds.length == 2 && cell.wordIds.contains(word.id))) return false;
  }
  final visited = <String>{level.words[0].id};
  for (var pass = 0; pass < level.words.length; pass++) {
    for (final cell in level.cells) {
      if (cell.wordIds.any(visited.contains)) visited.addAll(cell.wordIds);
    }
  }
  return visited.length == level.words.length &&
      level.bonusWords.every((word) => lexicon.words.containsKey(word) && canSpellWord(level.letters, lexicon.words[word]!.letters));
}

/// Worker entry point (`word-garden.worker.ts`) as a pure top-level function for `Isolate.run`.
/// [lexiconJson] is the lexicon asset text for the requested revision.
Map<String, Object?> generateGardenLevelJob(
    ({String lexiconJson, String language, int level, String mode, int? seed}) request) {
  try {
    final lexicon = compileLexicon(parseWordLexicon(request.lexiconJson), request.language);
    final mode = WordGardenMode.parse(request.mode);
    if (mode == null) throw const GameError('WORD_GARDEN_MODE_INVALID');
    return {'level': generateGardenLevel(lexicon, request.level, mode, request.seed ?? 0).toJson()};
  } catch (error) {
    return {'error': error is GameError && error.code.startsWith('WORD_GARDEN_') ? error.code : 'WORD_GARDEN_GENERATION_FAILED'};
  }
}
