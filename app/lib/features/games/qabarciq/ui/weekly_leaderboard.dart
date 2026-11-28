// Ported from: src/components/games/qabarciq/useWeeklyLeaderboard.ts
//
// `game_weekly_leaderboard_v1(p_game_id, p_limit)` → `{weekStart, weekEnds, players, top:[{rank,userId,score}],
// me:{rank,score,plays}|null}`, the top rows decorated with public profile cards (name, avatar).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/cache/cache.dart';
import '../../../../core/data/db.dart';
import '../../hub/data/game_scores.dart' show gameAuthLoadingProvider, gameRealmProvider, gameScoresBackendProvider;

class WeeklyRow {
  const WeeklyRow({required this.rank, required this.userId, required this.score, required this.name, required this.avatarUrl});
  final int rank;
  final String userId;
  final int score;
  final String? name;
  final String? avatarUrl;
}

class WeeklyMe {
  const WeeklyMe({required this.rank, required this.score, required this.plays});
  final int rank;
  final int score;
  final int plays;
}

class WeeklyBoard {
  const WeeklyBoard({required this.weekStart, required this.weekEnds, required this.players, required this.top, required this.me});
  final String weekStart;
  final String weekEnds;
  final int players;
  final List<WeeklyRow> top;
  final WeeklyMe? me;
}

/// The RPC (tests replace it). Throws on an RPC error like `if (error) throw error`.
abstract interface class WeeklyLeaderboardBackend {
  Future<Object?> weekly(String gameId, int limit);
}

class SupabaseWeeklyLeaderboardBackend implements WeeklyLeaderboardBackend {
  SupabaseWeeklyLeaderboardBackend(this.ref);
  final Ref ref;
  @override
  Future<Object?> weekly(String gameId, int limit) =>
      ref.read(dbProvider).client.rpc<Object?>('game_weekly_leaderboard_v1', params: {'p_game_id': gameId, 'p_limit': limit});
}

final weeklyLeaderboardBackendProvider = Provider<WeeklyLeaderboardBackend>((ref) => SupabaseWeeklyLeaderboardBackend(ref));

int _int(Object? value) => value is num ? value.toInt() : int.tryParse('$value') ?? 0;
String? _nonEmpty(String? value) => value == null || value.isEmpty ? null : value;

/// `useWeeklyLeaderboard(gameId, limit)`.
final weeklyLeaderboardQuery = queryProviderFamily<WeeklyBoard, ({String gameId, int limit})>((ref, arg) {
  final user = ref.watch(authUserProvider);
  final loading = ref.watch(gameAuthLoadingProvider);
  final realm = ref.watch(gameRealmProvider);
  return QueryOptions(
    queryKey: ['game-weekly-leaderboard', realm, arg.gameId, user?.id, arg.limit],
    enabled: !loading && user != null,
    retry: noRetry,
    staleTime: const Duration(seconds: 20),
    meta: const {'persist': false},
    queryFn: (_) async {
      final data = await ref.read(weeklyLeaderboardBackendProvider).weekly(arg.gameId, arg.limit);
      final board = data is Map ? data : const {};
      final top = [for (final row in (board['top'] as List?) ?? const []) if (row is Map) row];
      final cards = top.isEmpty
          ? const <String, Map<String, dynamic>>{}
          : await ref.read(gameScoresBackendProvider).profileCards([for (final row in top) '${row['userId']}']);
      final me = board['me'];
      return WeeklyBoard(
        weekStart: '${board['weekStart'] ?? ''}',
        weekEnds: '${board['weekEnds'] ?? ''}',
        players: _int(board['players']),
        top: [
          for (final row in top)
            WeeklyRow(
              rank: _int(row['rank']),
              userId: '${row['userId']}',
              score: _int(row['score']),
              name: _nonEmpty((cards['${row['userId']}']?['name'] as String?)?.trim()),
              avatarUrl: _nonEmpty(cards['${row['userId']}']?['avatar_url'] as String?),
            ),
        ],
        me: me is Map ? WeeklyMe(rank: _int(me['rank']), score: _int(me['score']), plays: _int(me['plays'])) : null,
      );
    },
  );
});
