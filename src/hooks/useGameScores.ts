import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { tr } from '@/lib/tr';
import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import { gameScoreMessage } from '@/lib/game-score-messages';
import { createGameScoreSubmission, GameScoreSyncError, submitGameScore, type GameScoreInput, type GameScoreSubmission } from '@/lib/game-score-sync';

// Global leaderboard support for Mini Games.
// Gameplay stays local-first. Leaderboards require a settled account/session;
// their cache is bound to both backend realm and user. Sync failures stay visible.

export interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bestScore: number;
  bestLevel: number;
  isCurrentUser?: boolean;
}

export function useGameLeaderboard(gameId: string, limit = 20) {
  const { user, loading } = useAuth();
  const realm = getBackendConfig().url;
  return useQuery({
    queryKey: ['game-leaderboard', realm, gameId, user?.id, limit],
    enabled: !loading && !!user,
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      if (loading || !user) throw new GameScoreSyncError('signin');
      const { data, error } = await supabase
        .from('game_scores' as any)
        .select('user_id, best_score, best_level')
        .eq('game_id', gameId)
        .order('best_score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!data) return [];

      const rows = data as unknown as { user_id: string; best_score: number; best_level: number }[];
      if (rows.length === 0) return [];

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      // Do not cache failed/anonymous author lookups as successful generic names.
      const profileMap = await getPublicProfileCards(userIds);

      return rows.map((r) => ({
        userId: r.user_id,
        name: profileMap[r.user_id]?.name?.trim() || tr("games_user_fallback", "Anacan istifadəçisi"),
        avatarUrl: profileMap[r.user_id]?.avatar_url || null,
        bestScore: r.best_score,
        bestLevel: r.best_level,
      }));
    },
    retry: false,
    staleTime: 30_000,
  });
}

export function useMyGameScore(gameId: string) {
  const { user, loading } = useAuth();
  const realm = getBackendConfig().url;
  return useQuery({
    queryKey: ['my-game-score', realm, gameId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('game_scores' as any)
        .select('best_score, best_level, total_plays')
        .eq('game_id', gameId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return data as unknown as { best_score: number; best_level: number; total_plays: number };
    },
    enabled: !loading && !!user,
    retry: false,
  });
}

export function useSubmitGameScore(gameId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const realm = getBackendConfig().url;
  const account = useRef({ userId: user?.id ?? null, realm });
  account.current = { userId: user?.id ?? null, realm };
  const current = (submission: GameScoreSubmission) => account.current.userId === submission.userId && account.current.realm === submission.realm;
  const mutation = useMutation({
    mutationFn: (submission: GameScoreSubmission) => submitGameScore({
      getSession: () => supabase.auth.getSession(),
      rpc: (name, args) => (supabase.rpc as any)(name, args),
    }, submission, () => current(submission)),
    retry: false,
    onSuccess: (_receipt, submission) => {
      queryClient.invalidateQueries({ queryKey: ['game-leaderboard', submission.realm, submission.gameId] });
      queryClient.invalidateQueries({ queryKey: ['my-game-score', submission.realm, submission.gameId, submission.userId] });
      if (current(submission)) toast.success(gameScoreMessage('saved'));
    },
    onError: (error, submission) => {
      const code = error instanceof GameScoreSyncError ? error.code : 'failed';
      if (code === 'signin') { toast.info(gameScoreMessage('localOnly')); return; }
      if (!current(submission) || code === 'account_changed') { toast.info(gameScoreMessage('accountChanged')); return; }
      if (code === 'server_update') { toast.error(gameScoreMessage('serverUpdate')); return; }
      toast.error(gameScoreMessage('failed'), { action: { label: gameScoreMessage('retry'), onClick: () => {
        // Retry keeps the original idempotency key and can never change its actor/realm.
        if (current(submission)) mutation.mutate(submission);
      } } });
    },
  });
  const mutate = useCallback((input: GameScoreInput) => {
    mutation.mutate(createGameScoreSubmission(input, user?.id ?? null, realm, gameId));
  }, [mutation.mutate, user?.id, realm, gameId]);
  const mutateAsync = useCallback((input: GameScoreInput) => mutation.mutateAsync(createGameScoreSubmission(input, user?.id ?? null, realm, gameId)),
    [mutation.mutateAsync, user?.id, realm, gameId]);
  return { ...mutation, mutate, mutateAsync };
}
