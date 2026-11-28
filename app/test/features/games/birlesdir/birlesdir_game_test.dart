// Ported from: (no React UI suite for BirlesdirGame.tsx — widget checks of the port: tap / swipe swaps, the
//              invalid swap-back, cascades with the React delays, move bonus and one-shot onLevelComplete)
import 'package:anacan/features/games/birlesdir/engine/level_config.dart';
import 'package:anacan/features/games/birlesdir/engine/match_engine.dart';
import 'package:anacan/features/games/birlesdir/ui/birlesdir_game.dart';
import 'package:anacan/features/games/common/engine/js.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/ui_common/game_registry.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import '../batch_b_support.dart';

BirlesdirLevelConfig Function(int) _config({int target = 99999, int moves = 20}) => (level) {
      final o = getBirlesdirLevelConfig(level);
      return BirlesdirLevelConfig(o.level, moves, target, o.tileTypesCount, o.tierName, o.scoreMultiplier);
    };

(Pos, Pos)? _validSwap(Board board) {
  for (var r = 0; r < boardRows; r++) {
    for (var c = 0; c < boardCols; c++) {
      for (final b in [Pos(r, c + 1), Pos(r + 1, c)]) {
        if (b.row >= boardRows || b.col >= boardCols) continue;
        if (findMatchGroups(swap(board, Pos(r, c), b), [Pos(r, c), b]).groups.isNotEmpty) return (Pos(r, c), b);
      }
    }
  }
  return null;
}

(Pos, Pos)? _invalidSwap(Board board) {
  for (var r = 0; r < boardRows; r++) {
    for (var c = 0; c + 1 < boardCols; c++) {
      final a = Pos(r, c), b = Pos(r, c + 1);
      if (board[r][c]?.special != null || board[r][c + 1]?.special != null) continue;
      if (findMatchGroups(swap(board, a, b), [a, b]).groups.isEmpty) return (a, b);
    }
  }
  return null;
}

Offset _cellCenter(WidgetTester tester, Pos pos) {
  final rect = tester.getRect(find.byKey(const ValueKey('birlesdir-board')));
  const gap = 5.0;
  final colWidth = (rect.width - gap * (boardCols - 1)) / boardCols;
  final cell = colWidth.floorToDouble();
  return Offset(rect.left + pos.col * (colWidth + gap) + cell / 2, rect.top + pos.row * (cell + gap) + cell / 2);
}

Future<BirlesdirGameState> _start(WidgetTester tester, BirlesdirGame game) async {
  await pumpGame(tester, game, overrides: gameOverrides(store: MemoryGameStore()));
  await tapText(tester, 'Başla');
  await tester.pump();
  return tester.state<BirlesdirGameState>(find.byType(BirlesdirGame));
}

Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 60; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  group('Birləşdir player', () {
    testWidgets('a tapped valid swap spends one move, scores and settles the cascade', (tester) async {
      final state = await _start(tester, BirlesdirGame(level: 1, onExit: () {}, onLevelComplete: (_) {}, levelConfig: _config(), random: Mulberry32(7).call));
      expect(state.phase, 'playing');
      final (a, b) = _validSwap(state.board)!;
      await tester.tapAt(_cellCenter(tester, a));
      await tester.pump();
      await tester.tapAt(_cellCenter(tester, b));
      await tester.pump();
      expect(state.busy, isTrue);
      expect(state.movesLeft, 19);
      await _settle(tester);
      expect(state.busy, isFalse);
      expect(state.score, greaterThan(0));
      expect(findMatchGroups(state.board).groups, isEmpty);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('an invalid swipe swaps back after 230 ms without spending a move', (tester) async {
      final state = await _start(tester, BirlesdirGame(level: 1, onExit: () {}, onLevelComplete: (_) {}, levelConfig: _config(), random: Mulberry32(11).call));
      final before = [for (final row in state.board) [for (final tile in row) tile?.id]];
      final (a, b) = _invalidSwap(state.board)!;
      await tester.dragFrom(_cellCenter(tester, a), _cellCenter(tester, b) - _cellCenter(tester, a));
      await tester.pump();
      expect(state.busy, isTrue);
      await tester.pump(const Duration(milliseconds: 240));
      expect(state.busy, isFalse);
      expect(state.movesLeft, 20);
      expect([for (final row in state.board) [for (final tile in row) tile?.id]], before);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets('reaching the target converts unused moves into bonus points and reports the win once', (tester) async {
      final results = <GameLevelResult>[];
      final state = await _start(tester, BirlesdirGame(level: 1, onExit: () {}, onLevelComplete: results.add, levelConfig: _config(target: 1), random: Mulberry32(3).call));
      final (a, b) = _validSwap(state.board)!;
      await tester.tapAt(_cellCenter(tester, a));
      await tester.pump();
      await tester.tapAt(_cellCenter(tester, b));
      await _settle(tester);
      expect(state.phase, 'won');
      final config = getBirlesdirLevelConfig(1);
      final perMove = 12 > jsRound(55 * config.scoreMultiplier) ? 12 : jsRound(55 * config.scoreMultiplier);
      expect(find.textContaining('+${19 * perMove}'), findsOneWidget);
      expect(results, hasLength(1));
      expect(results.single.passed, isTrue);
      expect(results.single.score, state.score);
      expect(results.single.stars, 3);
      await tester.pump(const Duration(seconds: 2));
      expect(results, hasLength(1));
      await tester.pumpWidget(const SizedBox());
    });
  });
}
