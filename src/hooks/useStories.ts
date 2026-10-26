import { useState, useCallback } from 'react';
import { tr } from '@/lib/tr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import type { StoryScene } from '@/lib/story-editor';
import type { Json } from '@/integrations/supabase/types';

export interface Story {
  id: string;
  user_id: string;
  group_id: string | null;
  media_url: string;
  media_type: 'image' | 'video';
  text_overlay: string | null;
  editor_layout?: unknown;
  background_color: string | null;
  created_at: string;
  expires_at: string;
  view_count: number;
  likes_count: number;
  is_liked?: boolean;
  replies_count: number;
  moderation_version?: number | null;
  moderation_removed_at?: string | null;
  author?: {
    name: string;
    avatar_url: string | null;
  };
  is_viewed?: boolean;
}

export interface UserStoryGroup {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  stories: Story[];
  has_unviewed: boolean;
}

export const useStories = (groupId?: string | null) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stories = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['stories', userId, groupId],
    queryFn: async () => {
      let query = supabase.
      from('community_stories').
      select('*').
      gt('expires_at', new Date().toISOString()).
      order('created_at', { ascending: false });

      if (groupId) {
        query = query.eq('group_id', groupId);
      }

      const { data: sourceRows, error } = await query;
      if (error) throw error;
      const data = (sourceRows || []).filter((row: any) => !row.moderation_removed_at);
      if (!data?.length) return [];

      const storyIds = data.map((s: any) => s.id);
      const [authorMap, likes, views] = await Promise.all([
        getPublicProfileCards(data.map((s: any) => s.user_id)),
        userId ? supabase.
        from('story_likes' as any).
        select('story_id').
        eq('user_id', userId).
        in('story_id', storyIds) : { data: [], error: null },
        userId ? supabase.
        from('story_views').
        select('story_id').
        eq('user_id', userId).
        in('story_id', storyIds) : { data: [], error: null }
      ]);
      if (likes.error) throw likes.error;
      if (views.error) throw views.error;
      const likedSet = new Set<string>((likes.data || []).map((r: any) => r.story_id));
      const viewedSet = new Set<string>((views.data || []).map((r: any) => r.story_id));

      const storiesWithDetails = data.map((story: any) => {
        const authorData = authorMap[story.user_id];
        return {
          ...story,
          likes_count: story.likes_count || 0,
          is_liked: likedSet.has(story.id),
          replies_count: story.replies_count || 0,
          author: authorData ?
          { name: authorData.name || tr("usestories_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), avatar_url: authorData.avatar_url || null } :
          { name: tr("usestories_istifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), avatar_url: null },
          is_viewed: viewedSet.has(story.id)
        };
      });

      return storiesWithDetails as Story[];
    },
    staleTime: 30000,
    enabled: !authLoading
  });

  // Group stories by user
  const storyGroups: UserStoryGroup[] = stories.reduce((acc: UserStoryGroup[], story) => {
    const existingGroup = acc.find((g) => g.user_id === story.user_id);
    if (existingGroup) {
      existingGroup.stories.push(story);
      if (!story.is_viewed) {
        existingGroup.has_unviewed = true;
      }
    } else {
      acc.push({
        user_id: story.user_id,
        user_name: story.author?.name || tr("usestories_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
        user_avatar: story.author?.avatar_url || null,
        stories: [story],
        has_unviewed: !story.is_viewed
      });
    }
    return acc;
  }, []);

  // Instagram davranışı: qrup DAXİLİNDƏ story-lər XRONOLOJİ (köhnə → yeni)
  // göstərilir. Sorğu DESC gətirir (qrupların sırası "ən son paylaşan öndə"
  // qalsın deyə) — ona görə hər qrupun daxilini burada çeviririk.
  storyGroups.forEach((g) => {
    g.stories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  });

  // Sort so current user is first, then unviewed, then viewed
  storyGroups.sort((a, b) => {
    if (a.user_id === user?.id) return -1;
    if (b.user_id === user?.id) return 1;
    if (a.has_unviewed && !b.has_unviewed) return -1;
    if (!a.has_unviewed && b.has_unviewed) return 1;
    return 0;
  });

  const createStoryMutation = useMutation({
    mutationFn: async ({
      mediaUrl,
      mediaType,
      textOverlay,
      backgroundColor,
      groupId: storyGroupId,
      storyId,
      editorLayout,
    }: {mediaUrl: string;mediaType: 'image' | 'video';textOverlay?: string;backgroundColor?: string;groupId?: string;storyId?: string;editorLayout?: StoryScene | null;}) => {
      if (!user) throw new Error('Not authenticated');

      const row = {
        ...(storyId ? { id: storyId } : {}),
        user_id: user.id,
        group_id: storyGroupId || null,
        media_url: mediaUrl,
        media_type: mediaType,
        text_overlay: textOverlay || null,
        background_color: backgroundColor || null,
        ...(editorLayout !== undefined ? { editor_layout: editorLayout as unknown as Json } : {}),
      };
      const { error } = storyId ? await (supabase as any).rpc('save_story_editor', {
        p_expected_user_id: user.id, p_story_id: storyId, p_group_id: storyGroupId || null,
        p_media_url: mediaUrl, p_media_type: mediaType, p_text_overlay: textOverlay || null,
        p_background_color: backgroundColor || null, p_editor_layout: editorLayout || null,
      }) : await supabase.from('community_stories').insert(row);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast({ title: tr("usestories_story_paylasildi_e1288f", "Story paylaşıldı! 📸") });
    },
    onError: (_error, variables) => {
      if (!variables.storyId) toast({ title: tr("usestories_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });

  const markAsViewed = useCallback(async (storyId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.
      from('story_views').
      upsert({
        story_id: storyId,
        user_id: user.id
      }, {
        onConflict: 'story_id,user_id'
      });
      if (error) throw error;

      // KRİTİK PERF/UX DÜZƏLİŞİ: əvvəllər burada invalidateQueries(['stories'])
      // çağırılırdı — HƏR baxılan story tam refetch + qrupların YENİDƏN
      // sıralanmasına səbəb olurdu. Açıq StoryViewer altında qrup indeksləri
      // sürüşürdü → "daxil olanda 2-3 story birdən keçir" bug-ı. İndi keş
      // yerində yamaqlanır (refetch YOX, sıra dəyişmir); StoriesBar halqaları
      // viewer bağlananda bir dəfə yenilənir (bax StoriesBar onClose).
      queryClient.setQueriesData({ queryKey: ['stories', user.id] }, (old: Story[] | undefined) => {
        if (!old) return old;
        return old.map((s) => s.id === storyId ? { ...s, is_viewed: true } : s);
      });
    } catch (error) {
      console.error('Error marking story as viewed:', error);
    }
  }, [user, queryClient]);

  const deleteStory = useMutation({
    mutationFn: async (storyId: string) => {
      if (!user) throw new Error('Not authenticated');

      // Sahiblik yoxlaması RLS-dədir ("Users can delete own stories" +
      // "Admins can manage all stories" — Duzelis61). Client filtri admin
      // silməsini səssizcə sındırırdı (bax useDeletePost şərhi).
      const { data, error } = await supabase.
      from('community_stories').
      delete().
      eq('id', storyId).
      select('id');

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Not permitted');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast({ title: tr("stories_story_silindi", 'Story silindi') });
    }
  });

  return {
    stories,
    storyGroups,
    isLoading,
    isFetching,
    refetch,
    createStory: createStoryMutation.mutate,
    createStoryAsync: createStoryMutation.mutateAsync,
    isCreating: createStoryMutation.isPending,
    markAsViewed,
    deleteStory: deleteStory.mutate
  };
};

/**
 * Story like toggle — optimistic (useCommunity.ts-dəki useToggleLike ilə eyni prinsip).
 *  - Ürək DƏRHAL dolur/boşalır (server cavabı gözlənilmir)
 *  - Push bildirişi arxa planda göndərilir (öz story-nə like YOX)
 *  - Duplicate insert (sürətli double-tap, 23505) uğur sayılır
 *  - Xətada cache geri qaytarılır (rollback)
 */
export const useToggleStoryLike = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const queryKey = ['stories', user?.id ?? null];

  // Update every group for this viewer, without changing another user's flags.
  const patchStoryInCaches = (storyId: string, patch: (s: Story) => Story) => {
    queryClient.setQueriesData({ queryKey }, (old: any) =>
    Array.isArray(old) ? old.map((s: Story) => s.id === storyId ? patch(s) : s) : old
    );
  };

  return useMutation({
    mutationFn: async ({ storyId, isLiked }: {storyId: string;isLiked: boolean;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isLiked) {
        const { error } = await supabase.
        from('story_likes' as any).
        delete().
        eq('story_id', storyId).
        eq('user_id', user.id);
        if (error) throw error;
        return;
      }

      const { data: insertedLike, error } = await supabase.
      from('story_likes').
      insert({ story_id: storyId, user_id: user.id }).select('id').single();

      if (error) {
        // 23505 = unikal açar (artıq bəyənilib) — double-tap yarışı, uğur say
        if ((error as any).code === '23505') return;
        throw error;
      }
      if (!insertedLike?.id) return;

      // Push bildirişi ARXA PLANDA — story sahibinə (özünə deyilsə)
      void (async () => {
        try {
          const { data: story } = await supabase.from('community_stories').select('user_id').eq('id', storyId).maybeSingle();
          if (story && story.user_id !== user.id) {
            const { data: profile } = await supabase.from('public_profile_cards').select('name').eq('user_id', user.id).maybeSingle();
            const likerName = profile?.name || tr("usestories_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i");
            const { invokeSendPush } = await import('@/lib/push');
            await invokeSendPush({
              userId: story.user_id,
              title: tr('usestories_yeni_beyenme_3fd88a', 'Yeni bəyənmə ❤️'),
              body: `${likerName} ${tr('usestories_story_nizi_beyendi', "story-nizi bəyəndi")}`,
              data: { type: 'story_like', storyId, context: 'community_story', interactionId: insertedLike.id },
              kind: 'story_like'
            });
          }
        } catch (e) {console.error('Story like notification error:', e);}
      })();
    },
    onMutate: async ({ storyId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueriesData({ queryKey });

      patchStoryInCaches(storyId, (s) => ({
        ...s,
        is_liked: !isLiked,
        likes_count: Math.max(0, (s.likes_count || 0) + (isLiked ? -1 : 1))
      }));

      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev?.forEach(([key, data]) => queryClient.setQueryData(key, data as any));
    }
  });
};
