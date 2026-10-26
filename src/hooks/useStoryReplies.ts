import { useEffect } from 'react';
import { tr } from '@/lib/tr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { getPublicProfileCards } from '@/lib/public-profile-cards';

export interface StoryReply {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: {
    name: string;
    avatar_url: string | null;
  };
}

/**
 * Story-yə cavablar — post_comments/usePostComments ilə eyni prinsip (v1 üçün
 * sadələşdirilib: parent_comment_id/şəkil/anonim yoxdur, sadə düz xronoloji siyahı).
 */
export const useStoryReplies = (storyId: string | null, enabled: boolean = true) => {
  const queryClient = useQueryClient();
  const isEnabled = !!storyId && enabled;

  // Story açıqkən başqasının göndərdiyi cavab canlı görünsün
  useEffect(() => {
    if (!isEnabled || !storyId) return;
    const channel = supabase.
    channel(`story-replies-${storyId}`).
    on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'story_replies', filter: `story_id=eq.${storyId}` },
      () => {queryClient.invalidateQueries({ queryKey: ['story-replies', storyId] });}
    ).
    subscribe();
    return () => {supabase.removeChannel(channel);};
  }, [isEnabled, storyId, queryClient]);

  return useQuery({
    queryKey: ['story-replies', storyId],
    enabled: isEnabled,
    queryFn: async (): Promise<StoryReply[]> => {
      if (!storyId) return [];

      const { data, error } = await supabase.
      from('story_replies' as any).
      select('*').
      eq('story_id', storyId).
      eq('is_active', true).
      order('created_at', { ascending: true });

      if (error) throw error;
      const replies = (data || []) as any[];
      if (replies.length === 0) return [];

      const authorMap = await getPublicProfileCards(replies.map((r) => r.user_id));

      return replies.map((reply) => ({
        ...reply,
        author: authorMap[reply.user_id] ?
        { name: authorMap[reply.user_id].name || tr("usestoryreplies_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), avatar_url: authorMap[reply.user_id].avatar_url || null } :
        { name: tr("usestoryreplies_istifadeci_b6bdd6", "İstifadəçi"), avatar_url: null }
      })) as StoryReply[];
    },
    staleTime: 10000
  });
};

export const useCreateStoryReply = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      storyId,
      content,
      storyAuthorId,
      replierName



    }: {storyId: string;content: string;storyAuthorId?: string;replierName?: string;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: insertedReply, error } = await supabase.
      from('story_replies').
      insert({ story_id: storyId, user_id: user.id, content }).select('id').single();

      if (error) throw error;

      // Push bildirişi ARXA PLANDA — story sahibinə (özünə deyilsə)
      if (storyAuthorId && storyAuthorId !== user.id && insertedReply?.id) {
        void (async () => {
          try {
            const preview = content.length > 50 ? `${content.slice(0, 50)}...` : content;
            const { invokeSendPush } = await import('@/lib/push');
            await invokeSendPush({
              userId: storyAuthorId,
              title: tr('usestoryreplies_yeni_cavab_923a12', 'Yeni cavab 💬'),
              body: `${replierName || tr("usestoryreplies_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")}: ${preview}`,
              data: { type: 'story_reply', storyId, context: 'community_story', interactionId: insertedReply.id },
              kind: 'story_reply'
            });
          } catch (e) {console.error('Story reply notification error:', e);}
        })();
      }
    },
    onMutate: async ({ storyId, content }) => {
      await queryClient.cancelQueries({ queryKey: ['story-replies', storyId] });
      const prev = queryClient.getQueryData<StoryReply[]>(['story-replies', storyId]);

      const optimisticReply: StoryReply = {
        id: `optimistic-${Date.now()}`,
        story_id: storyId,
        user_id: 'optimistic',
        content,
        created_at: new Date().toISOString(),
        author: { name: tr("usestoryreplies_siz_5c7f89", "Siz"), avatar_url: null }
      };

      queryClient.setQueryData<StoryReply[]>(['story-replies', storyId], (old) => [...(old || []), optimisticReply]);
      return { prev };
    },
    onError: (err: any, vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(['story-replies', vars.storyId], ctx.prev);
      toast({ title: tr("usestoryreplies_xeta_bas_verdi_f22fba", "Xəta baş verdi"), description: err?.message, variant: 'destructive' });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['story-replies', variables.storyId] });
      // stories cache-də replies_count trigger vasitəsilə server-də dəyişib — invalidate ilə sinxronlaşdır
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    }
  });
};

export const useDeleteStoryReply = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ replyId }: {replyId: string;storyId: string;}) => {
      const { error } = await supabase.
      from('story_replies' as any).
      delete().
      eq('id', replyId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['story-replies', variables.storyId] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      toast({ title: tr('usestoryreplies_cavab_silindi', 'Cavab silindi') + ' 🗑️' });
    },
    onError: () => {
      toast({ title: tr("usestoryreplies_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });
};
