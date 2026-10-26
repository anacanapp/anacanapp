export interface GameScoreInput { score: number; level: number }
export interface GameScoreSubmission extends GameScoreInput { userId: string | null; realm: string; gameId: string; submissionId: string }
export interface GameScoreReceipt { userId: string; gameId: string; submissionId: string; bestScore: number; bestLevel: number; totalPlays: number; duplicate: boolean }
export class GameScoreSyncError extends Error {
  constructor(public code: 'signin' | 'account_changed' | 'invalid_result' | 'server_update' | 'failed') { super(code); }
}
interface Client {
  getSession: () => Promise<{ data: { session: { user: { id: string } } | null }; error: unknown }>;
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
}

export function createGameScoreSubmission(input: GameScoreInput, userId: string | null, realm: string, gameId: string): GameScoreSubmission {
  return { ...input, userId, realm, gameId, submissionId: crypto.randomUUID() };
}

export async function submitGameScore(client: Client, submission: GameScoreSubmission, stillCurrent: () => boolean): Promise<GameScoreReceipt> {
  if (!submission.userId) throw new GameScoreSyncError('signin');
  if (!stillCurrent()) throw new GameScoreSyncError('account_changed');
  if (!['saglam-sebet', 'birlesdir', 'color-sort'].includes(submission.gameId)
    || !Number.isSafeInteger(submission.score) || submission.score < 0 || submission.score > 10_000_000
    || !Number.isSafeInteger(submission.level) || submission.level < 1 || submission.level > 10_000) throw new GameScoreSyncError('invalid_result');
  const session = await client.getSession();
  if (!stillCurrent() || session.data.session?.user.id !== submission.userId) throw new GameScoreSyncError('account_changed');
  if (session.error) throw new GameScoreSyncError('failed');
  const result = await client.rpc('submit_game_score_v1', {
    p_expected_user_id: submission.userId, p_game_id: submission.gameId, p_submission_id: submission.submissionId,
    p_score: submission.score, p_level: submission.level,
  });
  if (!stillCurrent()) throw new GameScoreSyncError('account_changed');
  if (result.error) throw new GameScoreSyncError(result.error.code === 'PGRST202' ? 'server_update'
    : result.error.code === '42501' || result.error.message === 'game_score_account_changed' ? 'account_changed' : 'failed');
  const receipt = result.data as GameScoreReceipt | null;
  if (!receipt || receipt.userId !== submission.userId || receipt.gameId !== submission.gameId || receipt.submissionId !== submission.submissionId
    || !Number.isSafeInteger(receipt.bestScore) || receipt.bestScore < submission.score
    || !Number.isSafeInteger(receipt.bestLevel) || receipt.bestLevel < submission.level
    || !Number.isSafeInteger(receipt.totalPlays) || receipt.totalPlays < 1 || typeof receipt.duplicate !== 'boolean') throw new GameScoreSyncError('failed');
  return receipt;
}
