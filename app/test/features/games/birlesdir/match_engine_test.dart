// Ported from: src/components/games/birlesdir/matchEngine.test.ts (+ fixtures from app/tool/games/entries/birlesdir.ts,
// which replace Math.random with the shared mulberry32 test stream)
import 'dart:convert';

import 'package:anacan/features/games/birlesdir/engine/level_config.dart';
import 'package:anacan/features/games/birlesdir/engine/match_engine.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

Board makeBoardFromTypes(List<List<int>> types) {
  var id = 1;
  return [for (final row in types) [for (final t in row) t == -9 ? null : Tile(id++, t)]];
}

List<List<Object?>> view(Board board) => [
      for (final row in board) [for (final tile in row) tile == null ? null : [tile.type, if (tile.special != null) tile.special]],
    ];

Pos pos(Object? raw) => Pos(asMap(raw)['row'] as int, asMap(raw)['col'] as int);

Pos? firstMoveTarget(Board board, int r, int c) => null;

(Pos, Pos)? firstMove(Board board) {
  for (var r = 0; r < board.length; r++) {
    for (var c = 0; c < board[0].length; c++) {
      if (board[r][c]?.special == 'color-bomb') return (Pos(r, c), Pos(r, c + 1 < board[0].length ? c + 1 : c - 1));
    }
  }
  for (var r = board.length - 1; r >= 0; r--) {
    for (var c = 0; c < board[0].length; c++) {
      for (final (dr, dc) in const [(0, 1), (1, 0)]) {
        final b = Pos(r + dr, c + dc);
        if (b.row >= board.length || b.col >= board[0].length) continue;
        if (findMatchGroups(swap(board, Pos(r, c), b)).groups.isNotEmpty) return (Pos(r, c), b);
      }
    }
  }
  return null;
}

void main() {
  group('cross-language fixtures (TypeScript → Dart)', () {
    final data = asMap(loadFixture('birlesdir'));

    test('seeded games: boards, cascades, specials, reshuffles and scores', () {
      for (final raw in asList(data['games'])) {
        final item = asMap(raw);
        final config = getBirlesdirLevelConfig(item['level'] as int);
        final typeCount = getTilePool(config.tileTypesCount).length;
        expect(typeCount, item['typeCount']);
        final engine = Match3(random: mulberry32((item['seed'] as int) * 7919));
        var board = engine.createBoard(8, 8, typeCount);
        expect(view(board), item['initial'], reason: 'initial ${item['level']}');
        var score = 0, moves = config.movesLimit, turn = 0;
        final turns = asList(item['turns']);
        while (moves > 0) {
          final move = firstMove(board);
          if (move == null) break;
          final expected = asMap(turns[turn++]);
          expect([move.$1.toJson(), move.$2.toJson()], expected['move']);
          final outcome = engine.playSwap(board, move.$1, move.$2, typeCount, config.scoreMultiplier)!;
          final steps = asList(expected['steps']);
          expect(outcome.steps.length, steps.length, reason: 'level ${item['level']} turn $turn');
          for (var i = 0; i < steps.length; i++) {
            final step = asMap(steps[i]);
            expect(outcome.steps[i].clearedCount, step['cleared']);
            expect([for (final e in outcome.steps[i].events) e.toJson()], step['events']);
            expect(view(outcome.steps[i].board), step['board']);
          }
          expect(outcome.gained, expected['gained']);
          expect(outcome.reshuffled, expected['reshuffled']);
          board = outcome.board;
          expect(view(board), expected['board']);
          score += outcome.gained;
          moves--;
        }
        expect(turn, turns.length);
        expect(score, item['score']);
        final finalScore = birlesdirFinalScore(score, moves, config.targetScore, config.scoreMultiplier);
        expect(finalScore, item['finalScore']);
        expect(getBirlesdirStarsForScore(finalScore, config.targetScore), item['stars']);
      }
    });

    test('level configuration, stars, sections, tile pools and reshuffle', () {
      final configs = asList(data['configs']);
      for (var level = 0; level < configs.length; level++) {
        expect(getBirlesdirLevelConfig(level).toJson(), configs[level], reason: 'level $level');
      }
      for (final raw in asList(data['stars'])) {
        final item = asMap(raw);
        expect(getBirlesdirStarsForScore(item['score'] as num, item['target'] as num), item['value']);
      }
      expect([for (final s in getBirlesdirLevelSections()) {'label': s.label, 'levels': s.levels}], data['sections']);
      expect([for (final n in [1, 3, 5, 7, 9]) [for (final t in getTilePool(n)) t.type]], data['pools']);
      final engine = Match3(random: mulberry32(5));
      for (final raw in asList(data['shuffles'])) {
        final item = asMap(raw), typeCount = item['typeCount'] as int;
        final board = engine.createBoard(6, 7, typeCount);
        board[0][0] = const Tile(9999, -1, 'color-bomb');
        board[2][3] = Tile(board[2][3]!.id, board[2][3]!.type, 'striped-v');
        expect(view(board), item['before']);
        expect(view(engine.reshuffleBoard(board, typeCount)), item['after']);
      }
      final tiles = asMap(jsonDecode(loadAssetText('assets/games/birlesdir/tiles.json')));
      expect([for (final t in tileDefs) {'type': t.type, 'emoji': t.emoji, 'label': t.label}], tiles['tiles']);
      expect({for (final e in bonusNames.entries) e.key: {'key': e.value.key, 'name': e.value.name, 'emoji': e.value.emoji}}, tiles['bonusNames']);
    });
  });

  group('matchEngine', () {
    test('createBoard produces a board with no initial matches and at least one move', () {
      final board = Match3().createBoard(8, 8, 5);
      expect(board.length, 8);
      expect(board[0].length, 8);
      expect(findMatchGroups(board).groups.length, 0);
      expect(hasAnyPossibleMove(board, 5), isTrue);
    });

    test('detects a simple horizontal 3-match with no special', () {
      final board = makeBoardFromTypes([
        [0, 0, 0, 1, 2], [1, 2, 3, 4, 0], [2, 3, 4, 0, 1], [3, 4, 0, 1, 2], [4, 0, 1, 2, 3],
      ]);
      final result = findMatchGroups(board);
      expect(result.groups.length, 1);
      expect(result.groups[0].shape, 'plain');
      expect(result.groups[0].cells.length, 3);
    });

    test('detects a straight 4-match and spawns a striped tile', () {
      final board = makeBoardFromTypes([
        [0, 0, 0, 0, 2], [1, 2, 3, 4, 0], [2, 3, 4, 0, 1], [3, 4, 0, 1, 2], [4, 0, 1, 2, 3],
      ]);
      final result = findMatchGroups(board, [const Pos(0, 1)]);
      expect(result.groups.length, 1);
      expect(result.groups[0].shape, 'striped-h');
      expect(result.groups[0].spawnCell, const Pos(0, 1));
      final step = Match3().applyMatchResult(board, result, 5);
      expect(step.events.any((e) => e.kind == 'striped-h' && e.created), isTrue);
    });

    test('detects an L-shaped 5-match and spawns a wrapped bomb', () {
      final board = makeBoardFromTypes([
        [0, 1, 2, 3, 4], [0, 2, 3, 4, 0], [0, 0, 0, 1, 2], [3, 4, 1, 2, 3], [4, 1, 2, 3, 4],
      ]);
      final result = findMatchGroups(board, [const Pos(2, 0)]);
      expect(result.groups.length, 1);
      expect(result.groups[0].shape, 'wrapped');
    });

    test('detects a straight 5-match and spawns a color bomb', () {
      final board = makeBoardFromTypes([
        [0, 0, 0, 0, 0], [1, 2, 3, 4, 1], [2, 3, 4, 1, 2], [3, 4, 1, 2, 3], [4, 1, 2, 3, 4],
      ]);
      final result = findMatchGroups(board, [const Pos(0, 2)]);
      expect(result.groups.length, 1);
      expect(result.groups[0].shape, 'color-bomb');
    });

    test('striped tile activation clears the full row when caught in a later match', () {
      final Board board = [
        [const Tile(1, 0), const Tile(2, 0), const Tile(3, 0, 'striped-h'), const Tile(4, 1), const Tile(5, 2)],
        [const Tile(6, 1), const Tile(7, 2), const Tile(8, 3), const Tile(9, 4), const Tile(10, 0)],
      ];
      final cells = const [Pos(0, 0), Pos(0, 1), Pos(0, 2)];
      final step = Match3().applyMatchResult(board, MatchResult([MatchGroup(0, cells, 'plain', null)], cells), 5);
      expect(step.clearedCount, 5);
      expect(step.events.any((e) => e.kind == 'striped-h' && !e.created), isTrue);
    });

    test('isAdjacent works correctly', () {
      expect(isAdjacent(const Pos(0, 0), const Pos(0, 1)), isTrue);
      expect(isAdjacent(const Pos(0, 0), const Pos(1, 0)), isTrue);
      expect(isAdjacent(const Pos(0, 0), const Pos(1, 1)), isFalse);
      expect(isAdjacent(const Pos(0, 0), const Pos(0, 0)), isFalse);
    });

    test('swap exchanges two tiles without mutating the original board', () {
      final board = makeBoardFromTypes([[0, 1], [2, 3]]);
      final swapped = swap(board, const Pos(0, 0), const Pos(0, 1));
      expect(swapped[0][0]?.type, 1);
      expect(swapped[0][1]?.type, 0);
      expect(board[0][0]?.type, 0);
    });

    test('gravity refills columns and keeps existing tiles at the bottom', () {
      final board = makeBoardFromTypes([
        [0, 0, 0, 1, 2], [1, 2, 3, 4, 0], [2, 3, 4, 0, 1], [3, 4, 0, 1, 2], [4, 0, 1, 2, 3],
      ]);
      final step = Match3().applyMatchResult(board, findMatchGroups(board), 5);
      for (var r = 0; r < 5; r++) {
        for (var c = 0; c < 5; c++) {
          expect(step.board[r][c], isNotNull);
        }
      }
    });
  });
}
