// Ported from: src/lib/game-score-sync.ts (client-side validation before `submit_game_score_v1`)
library;

import '../../common/engine/js.dart';

const List<String> leaderboardGameIds = ['saglam-sebet', 'birlesdir', 'color-sort', 'qabarciq'];

/// Returns the `GameScoreSyncError` code the TS throws before any network call, or null when the
/// result may be submitted. (`signin` when there is no user; `invalid_result` for out-of-range data.)
String? validateGameScoreSubmission({required String? userId, required String gameId, required num score, required num level}) {
  if (userId == null || userId.isEmpty) return 'signin';
  if (!leaderboardGameIds.contains(gameId) ||
      (gameId == 'qabarciq' && (score > 300000 || level != 1)) ||
      !isSafeInteger(score) || score < 0 || score > 10000000 ||
      !isSafeInteger(level) || level < 1 || level > 10000) {
    return 'invalid_result';
  }
  return null;
}

/// Receipt check after the RPC (`failed` when the server answer does not match the submission).
bool validGameScoreReceipt(Map<String, Object?>? receipt,
    {required String userId, required String gameId, required String submissionId, required num score, required num level}) {
  if (receipt == null) return false;
  final bestScore = receipt['bestScore'], bestLevel = receipt['bestLevel'], totalPlays = receipt['totalPlays'];
  return receipt['userId'] == userId && receipt['gameId'] == gameId && receipt['submissionId'] == submissionId &&
      isSafeInteger(bestScore) && (bestScore as num) >= score && isSafeInteger(bestLevel) && (bestLevel as num) >= level &&
      isSafeInteger(totalPlays) && (totalPlays as num) >= 1 && receipt['duplicate'] is bool;
}
