import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { getPublicProfileCards } from '@/lib/public-profile-cards';

export interface WeeklyRow { rank: number; userId: string; score: number; name: string | null; avatarUrl: string | null }
export interface WeeklyBoard { weekStart: string; weekEnds: string; players: number; top: WeeklyRow[]; me: { rank: number; score: number; plays: number } | null }

export function useWeeklyLeaderboard(gameId: string, limit = 20) {
  const { user, loading } = useAuth();
  const realm = getBackendConfig().url;
  return useQuery({
    queryKey: ['game-weekly-leaderboard', realm, gameId, user?.id, limit],
    enabled: !loading && !!user,
    retry: false,
    staleTime: 20_000,
    queryFn: async (): Promise<WeeklyBoard> => {
      const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
      const { data, error } = await rpc('game_weekly_leaderboard_v1', { p_game_id: gameId, p_limit: limit });
      if (error) throw error;
      const board = data as Omit<WeeklyBoard, 'top'> & { top: { rank: number; userId: string; score: number }[] };
      const cards = board.top.length ? await getPublicProfileCards(board.top.map(row => row.userId)) : {};
      return {
        ...board,
        top: board.top.map(row => ({ ...row, name: cards[row.userId]?.name?.trim() || null, avatarUrl: cards[row.userId]?.avatar_url || null })),
      };
    },
  });
}
