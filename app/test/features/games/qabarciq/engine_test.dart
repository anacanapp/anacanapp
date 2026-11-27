// Ported from: src/components/games/qabarciq/engine.test.ts (+ fixtures from app/tool/games/entries/qabarciq.ts)
import 'package:anacan/features/games/common/data/game_messages.dart';
import 'package:anacan/features/games/common/engine/json_object.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/qabarciq/data/messages.dart';
import 'package:anacan/features/games/qabarciq/engine/engine.dart';
import 'package:anacan/features/games/qabarciq/persistence/storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../fixture_io.dart';

BoardState fixed(List<List<int>> colors) {
  var id = 1;
  final grid = [for (final col in colors) [for (final color in col) Bubble(id++, color)]];
  return BoardState(grid, id, _ZeroRng());
}

class _ZeroRng extends BubbleRng {
  _ZeroRng() : super(1);
  @override
  double next() => 0;
}

List<int> column(int color) => List.filled(rows, color);
List<List<int>> ids(BoardState board) => [for (final col in board.grid) for (final b in col) [b.id, b.color]];

void main() {
  group('cross-language fixtures (TypeScript → Dart)', () {
    final data = asMap(loadFixture('qabarciq'));

    test('xorshift32 streams (including Date.now()-sized and negative seeds)', () {
      for (final raw in asList(data['rngs'])) {
        final item = asMap(raw), rng = BubbleRng(item['seed'] as num);
        expect([for (var i = 0; i < 16; i++) rng.next()], item['values'], reason: '${item['seed']}');
      }
    });

    test('scripted 120-tap rounds: boards, combos, boosters and scores', () {
      for (final raw in asList(data['rounds'])) {
        final item = asMap(raw), seed = item['seed'] as int;
        final round = BubbleRound(createBubbleBoard(seed));
        expect([for (final col in round.board.grid) for (final b in col) [b.id, b.color]], [for (final col in asList(item['initial'])) ...asList(col)]);
        final pick = mulberry32(seed ^ 0x5bd1e995);
        var now = 1000000;
        final log = asList(item['log']);
        var entry = 0;
        for (var tap = 0; tap < 120; tap++) {
          now += [300, 900, 1700, 2500][(pick() * 4).floor()];
          round.tick(now);
          final c = (pick() * cols).floor(), r = (pick() * rows).floor();
          round.mode = tap % 37 == 5 && round.wands > 0 ? 'wand' : tap % 53 == 20 && round.rainbows > 0 ? 'rainbow' : 'pop';
          final shakeId = round.board.grid[c][r].id;
          final result = round.tap(c, r, now);
          final expected = asMap(log[entry++]);
          if (result == null) {
            expect(expected['shake'], shakeId, reason: 'seed $seed tap $tap');
            continue;
          }
          expect([for (final (x, y) in result.cells) [x, y]], expected['cells'], reason: 'seed $seed tap $tap');
          expect([result.gained, result.combo, round.board.nextId], [expected['gained'], expected['combo'], expected['nextId']]);
        }
        expect(entry, log.length);
        expect([for (final col in round.board.grid) for (final b in col) [b.id, b.color]], [for (final col in asList(item['final'])) ...asList(col)]);
        expect(round.stats.toJson(), item['stats']);
      }
    });

    test('scoring tables, ensureMove and copy', () {
      final scoring = asMap(data['scoring']);
      for (final raw in asList(scoring['points'])) {
        final item = asMap(raw);
        expect(pointsFor(item['n'] as int, item['combo'] as int), item['value']);
      }
      for (final raw in asList(scoring['multipliers'])) {
        final item = asMap(raw);
        expect(multiplierFor(item['combo'] as int), item['value']);
      }
      final ensure = asMap(data['ensure']);
      final grid = [
        for (var c = 0; c < cols; c++) [for (var r = 0; r < rows; r++) Bubble(c * rows + r + 1, (c + r) % 2 == 0 ? c % 3 : 3 + r % 3)],
      ];
      final board = BoardState(grid, 81, BubbleRng(7));
      expect(hasMove(board.grid), ensure['before']);
      ensureMove(board);
      expect(hasMove(board.grid), ensure['after']);
      expect([for (final col in board.grid) [for (final b in col) b.color]], ensure['grid']);
      final messages = BubbleMessages.parse(loadAssetText('assets/games/qabarciq/messages.json'));
      expect(messages.catalog.languages.keys.toList()..sort(), List.of(gameAppLanguageCodes)..sort());
      for (final raw in asList(data['text'])) {
        final item = asMap(raw);
        expect(messages.text(item['language'] as String, item['key'] as String, {'n': 4, 'score': 1250}), item['value']);
      }
    });

    test('best score and sound preferences', () {
      final store = MemoryGameStore();
      expect(readBubbleBest(store), 0);
      expect(recordBubbleBest(store, 1200, readBubbleBest(store)), isTrue);
      expect(store.getItem(bubbleBestKey), '1200');
      expect(recordBubbleBest(store, 900, readBubbleBest(store)), isFalse);
      store.setItem(bubbleBestKey, 'garbage');
      expect(readBubbleBest(store), 0);
      expect(readBubbleSound(store), isTrue);
      writeBubbleSound(store, false);
      expect(store.getItem(bubbleSoundKey), 'off');
      expect(readBubbleSound(store), isFalse);
    });
  });

  group('qabarciq engine', () {
    test('creates a full board with at least one move, deterministically', () {
      final a = createBubbleBoard(42), b = createBubbleBoard(42);
      expect(a.grid, hasLength(cols));
      expect(a.grid.every((col) => col.length == rows), isTrue);
      expect(ids(a), ids(b));
      expect(hasMove(a.grid), isTrue);
    });

    test('finds the connected same-colour group only', () {
      final colors = [for (var c = 0; c < cols; c++) [for (var r = 0; r < rows; r++) (c + r) % 2 != 0 ? 1 : 2]];
      colors[0][0] = 3;
      colors[0][1] = 3;
      colors[1][1] = 3;
      colors[3][3] = 3;
      expect(findGroup(fixed(colors).grid, 0, 0), hasLength(3));
    });

    test('pops, drops the rest down and refills to a full board', () {
      final colors = [for (var c = 0; c < cols; c++) column(c % 2 != 0 ? 4 : 5)];
      colors[0] = [0, 1, 2, 3, 4, 5, 0, 1, 2, 3];
      final board = fixed(colors);
      final topId = board.grid[0][0].id;
      final next = removeCells(board, [(0, 9), (0, 8)]);
      expect(next.grid[0], hasLength(rows));
      expect(next.grid[0][2].id, topId);
      expect(next.grid[0][0].id, greaterThanOrEqualTo(board.nextId));
    });

    test('scores bigger groups and combos higher, capped multiplier', () {
      expect(pointsFor(2, 1), 20);
      expect(pointsFor(5, 1), 125);
      expect(pointsFor(5, 3), 250);
      expect(multiplierFor(100), 5);
    });

    test('collects every cell of a colour for the rainbow booster', () {
      final colors = [for (var c = 0; c < cols; c++) column(1)];
      colors[2][4] = 0;
      colors[6][1] = 0;
      expect(cellsOfColor(fixed(colors).grid, 0), hasLength(2));
    });
  });
}
