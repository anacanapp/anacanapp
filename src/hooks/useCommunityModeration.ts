import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import type { OwnAdReview } from '@/lib/community-moderation';

export function useMyAdReviews(postId: string | null = null, page = 0) {
  const { user, loading } = useAuth();
  const backend = getBackendConfig().url, client = useQueryClient(), actor = user?.id;
  const previous = useRef<{ actor?: string; backend: string; ids: string[] }>({ actor, backend, ids: [] });
  const query = useQuery({
    queryKey: ['community-ad-mine', backend, actor, postId, page],
    meta: { persist: false },
    enabled: !!actor && !loading,
    staleTime: 0,
    refetchInterval: 10000,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc('my_community_ad_reviews_v1', {
        p_actor: actor, p_post: postId, p_limit: 30, p_offset: page * 30,
      }).abortSignal(signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('MODERATION_INVALID_RESPONSE');
      return data as OwnAdReview[];
    },
  });
  useEffect(() => {
    if (query.data && previous.current.actor === actor && previous.current.backend === backend
      && previous.current.ids.some(id => !query.data.some(row => row.id === id))) {
      void client.invalidateQueries({ queryKey: ['community-feed', actor] });
      void client.invalidateQueries({ queryKey: ['community-profile-stats', actor] });
    }
    previous.current = { actor, backend, ids: query.data?.map(row => row.id) || [] };
    if (postId && query.data?.some(row => row.state === 'approved')) {
      void client.invalidateQueries({ queryKey: ['single-post', postId, actor] });
      void client.invalidateQueries({ queryKey: ['community-feed', actor] });
    }
  }, [actor, backend, postId, query.data, client]);
  return query;
}
