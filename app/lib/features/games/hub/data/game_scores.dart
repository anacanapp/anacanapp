// Ported from: src/hooks/useGameScores.ts
//
// Global leaderboard of the Mini Games. Gameplay stays local-first; leaderboards need a settled account, their
// cache is bound to the backend realm and the user, and sync failures stay visible.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../../core/auth/auth_providers.dart';
import '../../../../core/cache/cache.dart';
import '../../../../core/data/db.dart';
import '../../../../core/i18n/tr.dart';
import '../../../../state/shell_bindings.dart' show backendUrlProvider;
import '../../../chat/data/chat_backend.dart' show chatBackendProvider, getPublicProfileCards;
import 'game_score_sync.dart';

class LeaderboardEntry {
  const LeaderboardEntry({required this.userId, required this.name, required this.avatarUrl, required this.bestScore, required this.bestLevel});
  final String userId;
  final String name;
  final String? avatarUrl;
  final num bestScore;
  final num bestLevel;
}

/// The data access of the leaderboard (tests replace it).
abstract interface class GameScoresBackend {
  /// `game_scores.select('user_id, best_score, best_level').eq('game_id').order('best_score', desc).limit(limit)`.
  Future<List<Map<String, dynamic>>> leaderboardRows(String gameId, int limit);

  /// `select('best_score, best_level, total_plays').eq('game_id').eq('user_id').maybeSingle()`.
  Future<Map<String, dynamic>?> myScore(String gameId, String userId);

  /// `getPublicProfileCards(ids)` → `{user_id: {name, avatar_url}}` (throws on a failed read).
  Future<Map<String, Map<String, dynamic>>> profileCards(List<String> userIds);

  GameScoreClient get client;
}

class SupabaseGameScoresBackend implements GameScoresBackend {
  SupabaseGameScoresBackend(this.ref);
  final Ref ref;

  Db get _db => ref.read(dbProvider);

  @override
  Future<List<Map<String, dynamic>>> leaderboardRows(String gameId, int limit) async {
    final data = await _db.from('game_scores').select('user_id, best_score, best_level').eq('game_id', gameId).order('best_score', ascending: false).limit(limit);
    return [for (final row in data) Map<String, dynamic>.from(row)];
  }

  @override
  Future<Map<String, dynamic>?> myScore(String gameId, String userId) async {
    final data = await _db.from('game_scores').select('best_score, best_level, total_plays').eq('game_id', gameId).eq('user_id', userId).maybeSingle();
    return data == null ? null : Map<String, dynamic>.from(data);
  }

  @override
  Future<Map<String, Map<String, dynamic>>> profileCards(List<String> userIds) async {
    final cards = await getPublicProfileCards(ref.read(chatBackendProvider), userIds);
    return {for (final entry in cards.entries) entry.key: Map<String, dynamic>.from(entry.value)};
  }

  @override
  GameScoreClient get client => _SupabaseScoreClient(_db);
}

class _SupabaseScoreClient implements GameScoreClient {
  _SupabaseScoreClient(this.db);
  final Db db;

  @override
  Future<({String? userId, Object? error})> getSession() async => (userId: db.client.auth.currentSession?.user.id, error: null);

  @override
  Future<GameRpcResult> rpc(String name, Map<String, Object?> args) async {
    try {
      return GameRpcResult(data: await db.client.rpc<Object?>(name, params: args));
    } on PostgrestException catch (error) {
      return GameRpcResult(failed: true, errorCode: error.code, errorMessage: error.message);
    } catch (error) {
      return const GameRpcResult(failed: true);
    }
  }
}

final gameScoresBackendProvider = Provider<GameScoresBackend>((ref) => SupabaseGameScoresBackend(ref));

/// `getBackendConfig().url` ('' before the backend opened).
final gameRealmProvider = Provider<String>((ref) {
  try {
    return ref.watch(backendUrlProvider);
  } catch (_) {
    return '';
  }
});

/// `useAuth().loading`. The app wiring may override it with the auth controller's loading flag.
final gameAuthLoadingProvider = Provider<bool>((ref) => false);

/// `useGameLeaderboard(gameId, limit)`.
final gameLeaderboardQuery = queryProviderFamily<List<LeaderboardEntry>, ({String gameId, int limit})>((ref, arg) {
  final user = ref.watch(authUserProvider);
  final loading = ref.watch(gameAuthLoadingProvider);
  final realm = ref.watch(gameRealmProvider);
  return QueryOptions(
    queryKey: ['game-leaderboard', realm, arg.gameId, user?.id, arg.limit],
    enabled: !loading && user != null,
    retry: noRetry,
    staleTime: const Duration(seconds: 30),
    meta: const {'persist': false},
    queryFn: (_) async {
      if (loading || user == null) throw const GameScoreSyncError('signin');
      final backend = ref.read(gameScoresBackendProvider);
      final rows = await backend.leaderboardRows(arg.gameId, arg.limit);
      if (rows.isEmpty) return const [];
      final ids = <String>{for (final row in rows) '${row['user_id']}'}.toList();
      // Failed / anonymous author lookups are not cached as generic names.
      final cards = await backend.profileCards(ids);
      return [
        for (final row in rows)
          LeaderboardEntry(
            userId: '${row['user_id']}',
            name: _nonEmpty((cards['${row['user_id']}']?['name'] as String?)?.trim()) ?? tr('games_user_fallback', 'Anacan istifadəçisi'),
            avatarUrl: _nonEmpty(cards['${row['user_id']}']?['avatar_url'] as String?),
            bestScore: row['best_score'] as num,
            bestLevel: row['best_level'] as num,
          ),
      ];
    },
  );
});

String? _nonEmpty(String? value) => value == null || value.isEmpty ? null : value;

/// `useMyGameScore(gameId)` → `{best_score, best_level, total_plays}` or null.
final myGameScoreQuery = queryProviderFamily<Map<String, dynamic>?, String>((ref, gameId) {
  final user = ref.watch(authUserProvider);
  final loading = ref.watch(gameAuthLoadingProvider);
  final realm = ref.watch(gameRealmProvider);
  return QueryOptions(
    queryKey: ['my-game-score', realm, gameId, user?.id],
    enabled: !loading && user != null,
    retry: noRetry,
    meta: const {'persist': false},
    queryFn: (_) async => user == null ? null : ref.read(gameScoresBackendProvider).myScore(gameId, user.id),
  );
});

/// What `useSubmitGameScore` shows after a submission (`toast.success / info / error`).
enum GameScoreToastKind { success, info, error }

class GameScoreToast {
  const GameScoreToast(this.kind, this.message, {this.retry});
  final GameScoreToastKind kind;
  final String message;

  /// The error toast's "Retry" action (same submission and idempotency key; only for the same account/realm).
  final void Function()? retry;
}

/// `useSubmitGameScore(gameId).mutate({score, level})`: creates the submission for the current account/realm,
/// submits it, invalidates the leaderboard caches on success and reports the toast to show through [onToast].
class GameScoreSubmitter {
  GameScoreSubmitter(this.ref, this.gameId);
  final Ref ref;
  final String gameId;

  bool _current(GameScoreSubmission submission) =>
      ref.read(authUserProvider)?.id == submission.userId && ref.read(gameRealmProvider) == submission.realm;

  Future<void> mutate(GameScoreInput input, {required String language, void Function(GameScoreToast toast)? onToast}) =>
      _submit(createGameScoreSubmission(input, ref.read(authUserProvider)?.id, ref.read(gameRealmProvider), gameId), language, onToast);

  Future<void> _submit(GameScoreSubmission submission, String language, void Function(GameScoreToast toast)? onToast) async {
    String m(String key) => gameScoreMessage(language, key);
    try {
      await submitGameScore(ref.read(gameScoresBackendProvider).client, submission, () => _current(submission));
      final client = ref.read(queryClientProvider);
      unawaited(client.invalidateQueries(queryKey: ['game-leaderboard', submission.realm, submission.gameId]));
      unawaited(client.invalidateQueries(queryKey: ['my-game-score', submission.realm, submission.gameId, submission.userId]));
      if (_current(submission)) onToast?.call(GameScoreToast(GameScoreToastKind.success, m('saved')));
    } catch (error) {
      final code = error is GameScoreSyncError ? error.code : 'failed';
      if (code == 'signin') {
        onToast?.call(GameScoreToast(GameScoreToastKind.info, m('localOnly')));
      } else if (!_current(submission) || code == 'account_changed') {
        onToast?.call(GameScoreToast(GameScoreToastKind.info, m('accountChanged')));
      } else if (code == 'server_update') {
        onToast?.call(GameScoreToast(GameScoreToastKind.error, m('serverUpdate')));
      } else {
        onToast?.call(GameScoreToast(GameScoreToastKind.error, m('failed'), retry: () {
          if (_current(submission)) unawaited(_submit(submission, language, onToast));
        }));
      }
    }
  }
}

final gameScoreSubmitterProvider = Provider.family<GameScoreSubmitter, String>((ref, gameId) => GameScoreSubmitter(ref, gameId));
