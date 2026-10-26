import { describe, expect, it, vi } from 'vitest';
import { createGameScoreSubmission, submitGameScore } from './game-score-sync';

const actor = '10000000-0000-4000-8000-000000000001';
const realm = 'https://tntbjulojatnrqmylorp.supabase.co';
const make = () => createGameScoreSubmission({ score: 500, level: 8 }, actor, realm, 'color-sort');
const receipt = (submission: ReturnType<typeof make>, duplicate = false) => ({ userId: submission.userId, gameId: submission.gameId,
  submissionId: submission.submissionId, bestScore: 500, bestLevel: 8, totalPlays: 1, duplicate });

describe('game score actor and retry contract', () => {
  it('never sends an anonymous result as a successful sync', async () => {
    const client = { getSession: vi.fn(), rpc: vi.fn() };
    await expect(submitGameScore(client, { ...make(), userId: null }, () => true)).rejects.toMatchObject({ code: 'signin' });
    expect(client.getSession).not.toHaveBeenCalled(); expect(client.rpc).not.toHaveBeenCalled();
  });
  it('rejects account/realm changes while waiting for a session, before any write', async () => {
    let current = true;
    const client = { getSession: vi.fn(async () => { current = false; return { data: { session: { user: { id: actor } } }, error: null }; }), rpc: vi.fn() };
    await expect(submitGameScore(client, make(), () => current)).rejects.toMatchObject({ code: 'account_changed' });
    expect(client.rpc).not.toHaveBeenCalled();
  });
  it('binds the RPC to its original actor and reuses the same idempotency key on retry', async () => {
    const submission = make();
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' } })
      .mockResolvedValueOnce({ data: receipt(submission, true), error: null });
    const client = { getSession: vi.fn(async () => ({ data: { session: { user: { id: actor } } }, error: null })), rpc };
    await expect(submitGameScore(client, submission, () => true)).rejects.toMatchObject({ code: 'failed' });
    await expect(submitGameScore(client, submission, () => true)).resolves.toMatchObject({ duplicate: true, totalPlays: 1 });
    expect(rpc).toHaveBeenNthCalledWith(1, 'submit_game_score_v1', expect.objectContaining({ p_expected_user_id: actor, p_submission_id: submission.submissionId }));
    expect(rpc.mock.calls[0][1]).toEqual(rpc.mock.calls[1][1]);
  });
  it('does not return an old-account receipt after the account changes during the request', async () => {
    const submission = make(); let current = true;
    const client = { getSession: async () => ({ data: { session: { user: { id: actor } } }, error: null }),
      rpc: vi.fn(async () => { current = false; return { data: receipt(submission), error: null }; }) };
    await expect(submitGameScore(client, submission, () => current)).rejects.toMatchObject({ code: 'account_changed' });
  });
  it('reports a missing server contract distinctly and never exposes backend error text', async () => {
    const client = { getSession: async () => ({ data: { session: { user: { id: actor } } }, error: null }),
      rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202', message: 'backend internal details' } })) };
    await expect(submitGameScore(client, make(), () => true)).rejects.toMatchObject({ code: 'server_update', message: 'server_update' });
  });
});
