import { tr } from "@/lib/tr";import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPublicProfileCards } from '@/lib/public-profile-cards';

export interface StoryViewer {
  user_id: string;
  name: string;
  avatar_url: string | null;
  viewed_at: string;
  /** Bu izləyici story-ni bəyənib? (story_likes join) */
  has_liked?: boolean;
}

export const useStoryViewers = (storyId: string | null) => {
  return useQuery({
    queryKey: ['story-viewers', storyId],
    queryFn: async (): Promise<StoryViewer[]> => {
      if (!storyId) return [];

      // Baxanlar + bəyənənlər paralel — bəyənmə ürəyi ad yanında göstərilir
      const [viewsRes, likesRes] = await Promise.all([
      supabase.
      from('story_views').
      select('user_id, viewed_at').
      eq('story_id', storyId).
      order('viewed_at', { ascending: false }),
      supabase.
      from('story_likes').
      select('user_id').
      eq('story_id', storyId)]
      );

      if (viewsRes.error) throw viewsRes.error;
      const data = viewsRes.data;
      if (!data || data.length === 0) return [];

      const likedSet = new Set(((likesRes.data || []) as Array<{user_id: string;}>).map((l) => l.user_id));

      const userIds = data.map((v) => v.user_id);
      const profileMap = await getPublicProfileCards(userIds);

      const viewers = data.map((view) => {
        const profile = profileMap[view.user_id];
        return {
          user_id: view.user_id,
          name: profile?.name || tr("usestoryviewers_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
          avatar_url: profile?.avatar_url || null,
          viewed_at: view.viewed_at,
          has_liked: likedSet.has(view.user_id)
        };
      });
      // Instagram davranışı: bəyənənlər siyahının əvvəlində
      viewers.sort((a, b) => Number(b.has_liked) - Number(a.has_liked));
      return viewers;
    },
    enabled: !!storyId,
    staleTime: 10000
  });
};