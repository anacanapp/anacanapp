// Ported from: (no React UI suite for BubblePop.tsx — widget checks of the port: lobby/best score, pops and combos,
//              shake, pause, the 90 s clock, record save, sound preference, weekly board and score submission)
import 'package:anacan/core/auth/auth_providers.dart';
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/games/common/persistence/game_store.dart';
import 'package:anacan/features/games/hub/data/game_score_sync.dart';
import 'package:anacan/features/games/hub/data/game_scores.dart';
import 'package:anacan/features/games/qabarciq/engine/engine.dart';
import 'package:anacan/features/games/qabarciq/persistence/storage.dart';
import 'package:anacan/features/games/qabarciq/ui/bubble_pop.dart';
import 'package:anacan/features/games/qabarciq/ui/weekly_leaderboard.dart';
import 'package:anacan/features/games/ui_common/game_data.dart';
import 'package:anacan/features/games/ui_common/game_env.dart';
import 'package:anacan/features/games/ui_common/game_widgets.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show User;

import '../batch_b_support.dart';

const int _seed = 1700000000000;

class _BindingClock implements GameClock {
  _BindingClock(this.tester);
  final WidgetTester tester;
  @override
  double nowMs() => tester.binding.clock.now().millisecondsSinceEpoch.toDouble();
}

class _ScoreClient implements GameScoreClient {
  final List<(String, Map<String, Object?>)> calls = [];
  @override
  Future<({String? userId, Object? error})> getSession() async => (userId: 'user-1', error: null);
  @override
  Future<GameRpcResult> rpc(String name, Map<String, Object?> args) async {
    calls.add((name, args));
    return const GameRpcResult(failed: true);
  }
}

class _ScoresBackend implements GameScoresBackend {
  @override
  final _ScoreClient client = _ScoreClient();
  @override
  Future<List<Map<String, dynamic>>> leaderboardRows(String gameId, int limit) async => const [];
  @override
  Future<Map<String, dynamic>?> myScore(String gameId, String userId) async => {'best_score': 700, 'best_level': 1, 'total_plays': 3};
  @override
  Future<Map<String, Map<String, dynamic>>> profileCards(List<String> userIds) async => {
        'u-2': {'name': ' Aysel ', 'avatar_url': null},
      };
}

class _Weekly implements WeeklyLeaderboardBackend {
  @override
  Future<Object?> weekly(String gameId, int limit) async => {
        'weekStart': '2026-11-23',
        'weekEnds': '2026-11-30',
        'players': 12,
        'top': [
          {'rank': 1, 'userId': 'u-2', 'score': 9000},
          {'rank': 2, 'userId': 'u-3', 'score': 4000},
        ],
        'me': {'rank': 7, 'score': 1200, 'plays': 4},
      };
}

User _user() => User(id: 'user-1', appMetadata: const {}, userMetadata: const {}, aud: 'authenticated', createdAt: '2026-01-01T00:00:00Z');

late GameData data;
late QueryClient client;

Future<void> _end(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  client.clear();
}

Future<void> _pump(WidgetTester tester, MemoryGameStore store, {User? user, _ScoresBackend? scores}) async {
  final overrides = <Override>[
    ...gameOverrides(store: store, data: data),
    gameClockProvider.overrideWithValue(_BindingClock(tester)),
    authUserProvider.overrideWithValue(user),
    queryClientProvider.overrideWithValue(client = QueryClient()),
    gameScoresBackendProvider.overrideWithValue(scores ?? _ScoresBackend()),
    weeklyLeaderboardBackendProvider.overrideWithValue(_Weekly()),
  ];
  await pumpGame(tester, BubblePop(onBack: () {}, seed: () => _seed), overrides: overrides);
  await tester.pump();
  await tester.pump();
}

BubblePopState _state(WidgetTester tester) => tester.state<BubblePopState>(find.byType(BubblePop));

/// A cell whose same-colour group has at least [min] bubbles (and one that stands alone, when [lonely]).
(int, int)? _cell(BubbleRound round, {int min = 2, bool lonely = false}) {
  for (var c = 0; c < cols; c++) {
    for (var r = 0; r < rows; r++) {
      final size = findGroup(round.board.grid, c, r).length;
      if (lonely ? size == 1 : size >= min) return (c, r);
    }
  }
  return null;
}

Future<void> _tapBubble(WidgetTester tester, (int, int) cell) async {
  await tester.tap(find.bySemanticsLabel('${cell.$1 + 1}:${cell.$2 + 1}'), warnIfMissed: false);
  await tester.pump();
}

void main() {
  setUpAll(() async => data = await loadTestGameData());

  group('Qabarcıq player', () {
    testWidgets('shows the saved local best in the lobby and starts a 90 second round', (tester) async {
      final store = MemoryGameStore({bubbleBestKey: '4321'});
      await _pump(tester, store);
      expect(find.text(data.bubble.text('az', 'title')), findsOneWidget);
      expect(find.textContaining(gameNumber('az', 4321), findRichText: true), findsOneWidget);
      expect(_state(tester).phase, 'menu');
      await tester.tap(find.byWidgetPredicate((w) => w is GameButton && w.label == data.bubble.text('az', 'play')));
      await tester.pump();
      expect(_state(tester).phase, 'playing');
      expect(find.text('1:30'), findsOneWidget);
      await _end(tester);
    });

    testWidgets('pops a connected group for points, shakes a lonely bubble and counts combos', (tester) async {
      await _pump(tester, MemoryGameStore());
      await tester.tap(find.byWidgetPredicate((w) => w is GameButton && w.label == data.bubble.text('az', 'play')));
      await tester.pump();
      final state = _state(tester);
      final lonely = _cell(state.round, lonely: true);
      if (lonely != null) {
        await _tapBubble(tester, lonely);
        expect(state.round.stats.score, 0);
      }
      final first = _cell(state.round)!;
      final size = findGroup(state.round.board.grid, first.$1, first.$2).length;
      await _tapBubble(tester, first);
      expect(state.round.stats.score, pointsFor(size, 1));
      expect(state.round.stats.pops, 1);
      await tester.pump(const Duration(milliseconds: 300));
      final second = _cell(state.round)!;
      await _tapBubble(tester, second);
      expect(state.round.combo, 2);
      expect(find.text(data.bubble.text('az', 'combo', {'n': '2'})), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 2000));
      expect(state.round.combo, 0);
      await _end(tester);
    });

    testWidgets('pauses, resumes and ends the round after 90 seconds with a saved record', (tester) async {
      final store = MemoryGameStore();
      await _pump(tester, store);
      await tester.tap(find.byWidgetPredicate((w) => w is GameButton && w.label == data.bubble.text('az', 'play')));
      await tester.pump();
      final state = _state(tester);
      await _tapBubble(tester, _cell(state.round)!);
      final score = state.round.stats.score;
      await tester.tap(find.byWidgetPredicate((w) => w is GameButton && w.label == data.bubble.text('az', 'paused')));
      await tester.pump();
      expect(state.phase, 'paused');
      await tester.pump(const Duration(seconds: 5));
      expect(state.left, 90000);
      await tester.tap(find.text(data.bubble.text('az', 'resume')));
      await tester.pump();
      expect(state.phase, 'playing');
      await tester.pump(const Duration(seconds: 91));
      expect(state.phase, 'won');
      expect(find.text(data.bubble.text('az', 'newRecord')), findsOneWidget);
      expect(store.getItem(bubbleBestKey), '$score');
      await _end(tester);
    });

    testWidgets('remembers the sound preference', (tester) async {
      final store = MemoryGameStore();
      await _pump(tester, store);
      await tester.tap(find.byWidgetPredicate((w) => w is GameButton && w.label == data.bubble.text('az', 'sound')));
      await tester.pump();
      expect(store.getItem(bubbleSoundKey), 'off');
      await tester.tap(find.byWidgetPredicate((w) => w is GameButton && w.label == data.bubble.text('az', 'sound')));
      await tester.pump();
      expect(store.getItem(bubbleSoundKey), 'on');
      await _end(tester);
    });

    testWidgets('shows the weekly board with profile names and submits a signed-in score', (tester) async {
      final scores = _ScoresBackend();
      await _pump(tester, MemoryGameStore(), user: _user(), scores: scores);
      await tester.pump();
      expect(find.text('Aysel'), findsOneWidget);
      expect(find.text(data.bubble.text('az', 'player')), findsOneWidget);
      expect(find.text(data.bubble.text('az', 'you')), findsOneWidget);
      expect(find.text(data.bubble.text('az', 'players', {'n': '12'})), findsOneWidget);
      expect(find.textContaining('700'), findsOneWidget);
      await tester.tap(find.byWidgetPredicate((w) => w is GameButton && w.label == data.bubble.text('az', 'play')));
      await tester.pump();
      await _tapBubble(tester, _cell(_state(tester).round)!);
      await tester.pump(const Duration(seconds: 91));
      await tester.pump();
      expect(scores.client.calls.where((call) => call.$1 == 'submit_game_score_v1'), hasLength(1));
      expect(scores.client.calls.first.$2['p_game_id'], bubbleId);
      await _end(tester);
    });
  });
}
