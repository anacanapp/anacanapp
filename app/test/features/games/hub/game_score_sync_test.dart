// Ported from: src/lib/game-score-sync.test.ts
import 'package:anacan/features/games/hub/data/game_score_sync.dart';
import 'package:flutter_test/flutter_test.dart';

const actor = '10000000-0000-4000-8000-000000000001';
const realm = 'https://tntbjulojatnrqmylorp.supabase.co';

GameScoreSubmission make() => createGameScoreSubmission(const GameScoreInput(score: 500, level: 8), actor, realm, 'color-sort');

Map<String, Object?> receipt(GameScoreSubmission submission, [bool duplicate = false]) => {
      'userId': submission.userId,
      'gameId': submission.gameId,
      'submissionId': submission.submissionId,
      'bestScore': 500,
      'bestLevel': 8,
      'totalPlays': 1,
      'duplicate': duplicate,
    };

class FakeClient implements GameScoreClient {
  FakeClient({this.onSession, List<GameRpcResult Function()>? results}) : results = results ?? [];
  final void Function()? onSession;
  final List<GameRpcResult Function()> results;
  int sessionCalls = 0;
  final List<(String, Map<String, Object?>)> rpcCalls = [];

  @override
  Future<({String? userId, Object? error})> getSession() async {
    sessionCalls++;
    onSession?.call();
    return (userId: actor, error: null);
  }

  @override
  Future<GameRpcResult> rpc(String name, Map<String, Object?> args) async {
    rpcCalls.add((name, args));
    return results.removeAt(0)();
  }
}

Matcher syncError(String code) => isA<GameScoreSyncError>().having((e) => e.code, 'code', code);

void main() {
  group('game score actor and retry contract', () {
    test('never sends an anonymous result as a successful sync', () async {
      final client = FakeClient();
      await expectLater(submitGameScore(client, make().withUser(null), () => true), throwsA(syncError('signin')));
      expect(client.sessionCalls, 0);
      expect(client.rpcCalls, isEmpty);
    });

    test('rejects account/realm changes while waiting for a session, before any write', () async {
      var current = true;
      final client = FakeClient(onSession: () => current = false);
      await expectLater(submitGameScore(client, make(), () => current), throwsA(syncError('account_changed')));
      expect(client.rpcCalls, isEmpty);
    });

    test('binds the RPC to its original actor and reuses the same idempotency key on retry', () async {
      final submission = make();
      final client = FakeClient(results: [
        () => const GameRpcResult(failed: true, errorCode: 'NETWORK'),
        () => GameRpcResult(data: receipt(submission, true)),
      ]);
      await expectLater(submitGameScore(client, submission, () => true), throwsA(syncError('failed')));
      final second = await submitGameScore(client, submission, () => true);
      expect(second.duplicate, true);
      expect(second.totalPlays, 1);
      expect(client.rpcCalls.first.$1, 'submit_game_score_v1');
      expect(client.rpcCalls.first.$2['p_expected_user_id'], actor);
      expect(client.rpcCalls.first.$2['p_submission_id'], submission.submissionId);
      expect(client.rpcCalls[0].$2, client.rpcCalls[1].$2);
    });

    test('does not return an old-account receipt after the account changes during the request', () async {
      final submission = make();
      var current = true;
      final client = FakeClient(results: [
        () {
          current = false;
          return GameRpcResult(data: receipt(submission));
        },
      ]);
      await expectLater(submitGameScore(client, submission, () => current), throwsA(syncError('account_changed')));
    });

    test('reports a missing server contract distinctly and never exposes backend error text', () async {
      final client = FakeClient(results: [() => const GameRpcResult(failed: true, errorCode: 'PGRST202', errorMessage: 'backend internal details')]);
      await expectLater(
        submitGameScore(client, make(), () => true),
        throwsA(isA<GameScoreSyncError>().having((e) => e.code, 'code', 'server_update').having((e) => e.message, 'message', 'server_update')),
      );
    });
  });
}
