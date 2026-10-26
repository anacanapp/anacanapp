import { useState, useEffect, useCallback, useRef } from 'react';
import { tr } from '@/lib/chat-i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communityPostFilter, invalidateCommunityPosts, patchCommunityPost, restoreCommunityPostFields } from '@/lib/community-post-cache';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import type { PushEventData } from '@/lib/push';
import { useUserStore } from '@/store/userStore';
import { useAuth } from '@/hooks/useAuth';
import { detectLang, isFeedLang, FeedLang } from '@/lib/langDetect';
import { matchesFeedLanguage } from '@/hooks/useFeedLanguages';
import { normalizeAppLanguage } from '@/lib/app-languages';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { moderationText } from '@/lib/community-moderation-i18n';
import { moderationError, type AdReviewState } from '@/lib/community-moderation';
import { moderatorError } from '@/lib/moderator';

export interface CommunityGroup {
  id: string;
  name: string;
  description: string | null;
  group_type: string;
  cover_image_url: string | null;
  icon_emoji: string | null;
  is_active: boolean;
  is_auto_join: boolean;
  auto_join_criteria: Record<string, any> | null;
  member_count: number;
  created_at: string;
  discovery_language?: string | null;
}

export interface CommunityPost {
  id: string;
  group_id: string | null;
  user_id: string;
  content: string;
  media_urls: string[] | null;
  tagged_group_ids?: string[] | null;
  blog_post_id?: string | null;
  likes_count: number;
  comments_count: number;
  is_pinned: boolean;
  is_anonymous: boolean;
  /** Postun MƏZMUN dili (az/en/ru/tr) — UI dili deyil; tərcümə düyməsi buna baxır */
  language?: string | null;
  created_at: string;
  ad_moderation_state?: AdReviewState | null;
  ad_moderation_revision?: number | null;
  ad_moderated_at?: string | null;
  moderation_version?: number | null;
  moderation_removed_at?: string | null;
  moderation_reason?: string | null;
  moderation_action_id?: string | null;
  moderation_edited_at?: string | null;
  moderation_edited_by?: string | null;
  comments_locked?: boolean | null;
  author?: {
    name: string;
    avatar_url: string | null;
    badge_type?: string;
    is_premium?: boolean;
    can_share_links?: boolean;
    is_verified?: boolean | null;
    verified_until?: string | null;
    /** Hamilə/Ana/Flow — anonim postlarda HƏMİŞƏ null (aşağı enrichPosts()-a bax) */
    life_stage?: string | null;
  };
  is_liked?: boolean;
  is_saved?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  image_url?: string | null;
  likes_count: number;
  created_at: string;
  is_anonymous?: boolean;
  is_pinned?: boolean | null;
  moderation_version?: number | null;
  moderation_removed_at?: string | null;
  moderation_edited_at?: string | null;
  moderation_edited_by?: string | null;
  author?: {
    name: string;
    avatar_url: string | null;
    badge_type?: string;
    is_premium?: boolean;
    can_share_links?: boolean;
    is_verified?: boolean | null;
    verified_until?: string | null;
    life_stage?: string | null;
  };
  is_liked?: boolean;
}

export const useCommunityGroups = () => {
  const language = normalizeAppLanguage(useUserStore(state => state.language));
  const { user } = useAuth();
  return useQuery({
    queryKey: ['community-groups', language, user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).
      from('community_groups').
      select('*').
      eq('is_active', true).
      eq('discovery_language', language).
      order('group_type', { ascending: true }).
      order('name', { ascending: true });

      if (error) throw error;
      return ((data || []) as CommunityGroup[]).filter(group => group.discovery_language === language);
    }
  });
};

export const useUserMemberships = () => {
  return useQuery({
    queryKey: ['user-memberships'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase.
      from('group_memberships').
      select('group_id, role, joined_at').
      eq('user_id', user.id);

      if (error) throw error;
      return data;
    }
  });
};

export const useJoinGroup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any).rpc('chat_group_action_v3', { p_actor: user.id, p_group: groupId, p_action: 'join' });

      if (error) throw error;
      return data as { state: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['community-groups'] });
      queryClient.invalidateQueries({ queryKey: ['chat-groups-v3'] });
      toast({ title: data?.state === 'requested' ? tr('group_pending','Təsdiq gözləyir') : tr("usecommunity_qrupa_qosuldunuz_bea9e3", "Qrupa qoşuldunuz! 🎉") });
    },
    onError: () => {
      toast({ title: tr("usecommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });
};

export const useLeaveGroup = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await (supabase as any).rpc('chat_group_action_v3', { p_actor: user.id, p_group: groupId, p_action: 'leave' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['community-groups'] });
      toast({ title: tr("usecommunity_qrupdan_ayrildiniz_2ad166", "Qrupdan ayrıldınız") });
    }
  });
};

/** Postlara müəllif kartı + like statusu əlavə et (feed və backfill üçün ortaq) */
export const enrichPosts = async (posts: any[], userId?: string | null): Promise<CommunityPost[]> => {
  if (!posts?.length) return [];

  const [authorMap, { data: likeRows, error: likesError }, { data: bookmarks, error: bookmarksError }] = await Promise.all([
    getPublicProfileCards(posts.map((p: any) => p.user_id)),
    userId ? supabase.
    from('post_likes').
    select('post_id').
    eq('user_id', userId).
    in('post_id', posts.map((p: any) => p.id)) : { data: [], error: null },
    userId ? (supabase as any).from('community_post_bookmarks').select('post_id')
      .eq('user_id', userId).in('post_id', posts.map((p) => p.id)) : { data: [], error: null },
  ]);
  if (likesError) throw likesError;
  if (bookmarksError) throw bookmarksError;
  const likedSet = new Set<string>((likeRows || []).map((r: any) => r.post_id));
  const savedSet = new Set<string>((bookmarks || []).map((r: any) => r.post_id));

  return (posts || []).map((post: any) => {
    const isAnon = post.is_anonymous === true;
    const authorData = isAnon ? null : authorMap[post.user_id];

    return {
      ...post,
      is_anonymous: isAnon,
      author: isAnon ?
      { name: 'Anonim', avatar_url: null, badge_type: null, is_verified: false, verified_until: null } :
      authorData ?
      {
        name: authorData.name || tr("usecommunity_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
        avatar_url: authorData.avatar_url || null,
        badge_type: authorData.badge_type || null,
        is_premium: authorData.is_premium === true,
        can_share_links: authorData.can_share_links === true || ['admin', 'moderator'].includes(authorData.badge_type || ''),
        is_verified: authorData.is_verified || false,
        verified_until: authorData.verified_until || null,
        life_stage: authorData.life_stage || null
      } :
      { name: tr("usecommunity_istifadeci_b6bdd6", "İstifadəçi"), avatar_url: null, badge_type: null, is_verified: false, verified_until: null },
      is_liked: likedSet.has(post.id),
      is_saved: savedSet.has(post.id),
    };
  }) as CommunityPost[];
};

export const useGroupPosts = (groupId: string | null) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const uiLang = normalizeAppLanguage(useUserStore((s) => s.language));
  const queryClient = useQueryClient();
  const queryKey = ['group-posts', groupId, userId, uiLang] as const;
  // Hesab dəyişəndə kanal yenidən qurulmur; cari istifadəçi ref-dən oxunur
  const viewer = useRef(userId);
  viewer.current = userId;

  // Real-time: yeni/redaktə/silinmiş postlar gələn kimi feed-i yenilə —
  // əvvəllər BUNUN ƏVƏZİNƏ heç nə yox idi, ona görə yeni postlar/dəyişikliklər
  // yalnız tam ekran remount-unda (tab dəyişəndə) və ya 30san staleTime
  // keçəndə görünürdü ("hard refresh olmadan gəlmir" şikayətinin əsas səbəbi).
  useEffect(() => {
    if (groupId === undefined) return;

    // PERF: invalidasiya tənzimlənir (throttle) — əvvəllər HƏR event
    // (istənilən istifadəçinin like/şərh sayğacı update-i daxil) dərhal tam
    // refetch + enrich + bütün feed-in re-render-inə səbəb olurdu; aktiv
    // istifadə zamanı scroll əsnasında "donma" yaradan əsas amillərdən idi.
    // İlk event dərhal işlənir, ardıcıl partlayışlar 4 saniyəyə birləşdirilir.
    const MIN_INVALIDATE_INTERVAL = 4000;
    let lastInvalidatedAt = 0;
    let pendingTimer: number | null = null;

    const scheduleInvalidate = () => {
      const now = Date.now();
      const elapsed = now - lastInvalidatedAt;
      if (elapsed >= MIN_INVALIDATE_INTERVAL) {
        lastInvalidatedAt = now;
        queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      } else if (pendingTimer === null) {
        pendingTimer = window.setTimeout(() => {
          pendingTimer = null;
          lastInvalidatedAt = Date.now();
          queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
        }, MIN_INVALIDATE_INTERVAL - elapsed);
      }
    };

    const channel = supabase
      .channel(`community-posts-${groupId ?? 'global'}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_posts',
          // Qrup feedi üçün server-side filtr; qlobal feed üçün (group_id IS NULL)
          // Realtime "is.null" filtrini etibarlı dəstəkləmədiyinə görə client-side yoxlanılır.
          ...(groupId ? { filter: `group_id=eq.${groupId}` } : {})
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && !matchesFeedLanguage(payload.new as CommunityPost, uiLang)) return;
          if (!groupId) {
            const row: any = payload.new || payload.old;
            if (row?.group_id) return; // bu qlobal feed — qrup postlarını atla
            // Qlobal feed-də başqalarının hər yeni postu 150 postun yenidən çəkilməsinə
            // səbəb olmasın; onlar növbəti mount/staleTime ilə gəlir (canlı feed
            // useCommunityFeed-də "yeni paylaşım" göstəricisi ilə işləyir).
            if (payload.eventType === 'INSERT' && row?.user_id !== viewer.current) return;
          }
          scheduleInvalidate();
        }
      )
      .subscribe();
    return () => {
      if (pendingTimer !== null) window.clearTimeout(pendingTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, queryClient, uiLang]);

  return useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase.
      from('community_posts').
      select('*').
      eq('is_active', true).
      eq('language', uiLang).
      order('is_pinned', { ascending: false }).
      order('created_at', { ascending: false });

      if (groupId) {
        query = query.eq('group_id', groupId);
      } else {
        // Global posts in the selected language; existing RLS still applies.
        query = query.is('group_id', null);
      }

      // Sərhədsiz idi — cəmiyyət/paylaşım sayı vaxtla böyüdükcə bu sorğu
      // (hər feed açılışında!) getdikcə ağırlaşırdı. Son 150 paylaşım kifayət
      // qədər dolğun feed verir; tam "daha çox yüklə" pagination gələcək
      // təkmilləşdirmə kimi qeyd olunub.
      query = query.limit(150);

      const { data: posts, error } = await query;
      if (error) throw error;

      return enrichPosts((posts || []).filter(post => matchesFeedLanguage(post, uiLang)), userId);
    },
    enabled: groupId !== undefined && !authLoading
  });
};

/**
 * Bir dənə postu, ID-sinə görə, TƏK başına (üst feed sorğusundan asılı
 * olmadan) çəkir. Bildiriş klikindən "məhz həmin postu" açmaq üçün lazımdır —
 * `useGroupPosts` yalnız son 150 (dil/pin sırasına görə) postu gətirir və bu,
 * daha köhnə/başqa istifadəçinin postunu ehtiva etməyə bilər. RLS
 * ("Members can view group posts") burada da eyni şəkildə tətbiq olunur —
 * başqa ölkədən/qrup üzvü olmadığın postu açmaq cəhdi sadəcə boş nəticə verər.
 */
export const useSinglePost = (postId: string | null) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ['single-post', postId, userId],
    queryFn: async () => {
      const { data: post, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', postId as string)
        .maybeSingle();
      if (error) throw error;
      if (!post) return null;
      const [enriched] = await enrichPosts([post], userId);
      return enriched;
    },
    enabled: !!postId && !authLoading
  });
};

export const useCreatePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: account } = useAuth();
  const currentAccount = useRef(account?.id); currentAccount.current = account?.id;
  const request = useRef<{ key: string; id: string } | null>(null);

  return useMutation({
    mutationFn: async ({ groupId, content, mediaUrls, isAnonymous, language, autoLanguage, taggedGroupIds, blogPostId }: {groupId: string | null;content: string;mediaUrls?: string[];isAnonymous?: boolean;language?: FeedLang;autoLanguage?: boolean;taggedGroupIds?: string[];blogPostId?: string;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== currentAccount.current) throw new Error('COMMUNITY_ACTOR_MISMATCH');

      // Post dili = MƏZMUNUN dili (composer çipi > avtomatik aşkarlama > UI dili).
      // Əvvəllər UI dili yazılırdı — EN interfeysdə az yazan ananın postu az feedində görünmürdü.
      const uiLang = useUserStore.getState().language || 'az';
      const fallbackLang: FeedLang = isFeedLang(uiLang) ? uiLang : 'az';
      const postLanguage: FeedLang = language || detectLang(content, fallbackLang);

      const backend = getBackendConfig().url;
      const payload = { p_actor: user.id, p_content: content, p_language: postLanguage, p_group_id: groupId,
        p_media_urls: mediaUrls || [], p_is_anonymous: !!isAnonymous, p_tagged_group_ids: [...new Set(taggedGroupIds || [])].slice(0, 3), p_blog_post_id: blogPostId || null,
        p_auto_language: autoLanguage ?? !language };
      const key = JSON.stringify([backend, payload]);
      if (request.current?.key !== key) request.current = { key, id: crypto.randomUUID() };
      const requestId = request.current.id;
      const { data, error } = await (supabase as any).rpc('submit_community_post_v2', { ...payload, p_id: requestId });
      if (error) throw error;
      if (!data?.id || !['checking', 'review', 'approved', 'rejected'].includes(data.state)) throw new Error('MODERATION_INVALID_RESPONSE');
      return { ...data, actor: user.id, backend, requestId };
    },
    onSuccess: async (data) => {
      if (request.current?.id === data.requestId) request.current = null;
      await invalidateCommunityPosts(queryClient);
      await queryClient.invalidateQueries({ queryKey: ['community-ad-mine', data.backend, data.actor] });
      if (data.actor !== currentAccount.current) return;
      void import('@/lib/customerio').then(({ customerIo }) => customerIo.postCreated(data.actor, data.backend, data.requestId)).catch(() => {});
      const language = useUserStore.getState().language;
      const state = data.state as 'checking' | 'review' | 'approved' | 'rejected';
      toast({ title: moderationText(`${state}_title`, language), description: moderationText(`${state}_body`, language) });
    },
    onError: (error) => {
      toast({ title: moderationError(error, useUserStore.getState().language), variant: 'destructive' });
    }
  });
};

export const useEditPost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ postId, content, currentLanguage, expectedRevision }: {postId: string;content: string;currentLanguage?: string | null;expectedRevision?: number | null;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Redaktədə dili yenidən aşkarla (qeyri-müəyyəndirsə köhnə dil qalır).
      // Köhnəlmiş tərcümə keşini DB trigger özü silir (trg_purge_post_translations).
      const uiLang = useUserStore.getState().language || 'az';
      const fallbackLang: FeedLang = isFeedLang(currentLanguage) ? currentLanguage : isFeedLang(uiLang) ? uiLang : 'az';

      const { data, error } = await (supabase as any).rpc('edit_community_post_v1', {
        p_actor: user.id, p_post: postId, p_content: content, p_language: detectLang(content, fallbackLang), p_expected_revision: expectedRevision ?? null,
      });
      if (error) throw error;
      if (!data) throw new Error('MODERATION_REVIEW_CONFLICT');
      if (!['checking', 'review', 'approved', 'rejected'].includes(data.state)) throw new Error('MODERATION_REQUIRED');
      return data;
    },
    onSuccess: async (data) => {
      await invalidateCommunityPosts(queryClient);
      await queryClient.invalidateQueries({ queryKey: ['community-ad-mine'] });
      const state = data.state as 'checking' | 'review' | 'approved' | 'rejected';
      toast({ title: moderationText(`${state}_title`, useUserStore.getState().language) });
    },
    onError: (error) => {
      toast({ title: moderationError(error, useUserStore.getState().language), variant: 'destructive' });
    }
  });
};

export const useDeletePost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // DİQQƏT: sahiblik yoxlaması BURADA (.eq('user_id', ...)) YOX, RLS-də
      // edilir ("Users can delete own posts" + "Admins can manage all posts").
      // Əvvəllər .eq('user_id', user.id) var idi — admin başqasının postunu
      // silməyə çalışanda sorğu 0 sətir tapır, SƏSSİZCƏ heç nə silmirdi
      // (amma "silindi" toast-u çıxırdı). useDeleteComment-dəki eyni bug-ın
      // düzəlişi ilə eyni pattern.
      const { data, error } = await supabase.
      from('community_posts').
      delete().
      eq('id', postId).
      select('id');

      if (error) throw error;
      // RLS icazə verməyibsə 0 sətir silinir — bunu uğur kimi göstərmə
      if (!data || data.length === 0) throw new Error('Not permitted');
    },
    onSuccess: async () => {
      await invalidateCommunityPosts(queryClient);
      toast({ title: tr("usecommunity_post_silindi", 'Post silindi') + ' 🗑️' });
    },
    onError: () => {
      toast({ title: tr("usecommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });
};

/**
 * Post pin/unpin — YALNIZ admin RLS-də icazəlidir ("Admins can manage all
 * posts" FOR ALL policy, community_posts). Pinlənmiş post feed sorğusunda
 * artıq `.order('is_pinned', {ascending:false})` sayəsində avtomatik ən
 * üstdə görünür — VƏ filtr (dil/qrup) sıralamadan ƏVVƏL tətbiq olunduğu üçün
 * pin yalnız postun öz dilinin/qrupunun feed-i daxilində ən üstə çıxır.
 */
export const useTogglePinPost = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ postId, pin }: { postId: string; pin: boolean }) => {
      const { data: current, error: readError } = await (supabase as any).rpc('moderator_content_detail_v1', { p_kind: 'post', p_id: postId });
      if (readError) throw readError;
      if (!current) throw new Error('MODERATOR_CONTENT_UNAVAILABLE');
      const { error } = await (supabase as any).rpc('moderator_content_action_v1', { p_kind: 'post', p_id: postId, p_version: current.version,
        p_action: pin ? 'pin' : 'unpin', p_reason: 'other', p_content: null, p_note: '', p_request: crypto.randomUUID() });
      if (error) throw error;
    },
    onSuccess: async (_, { pin }) => {
      await invalidateCommunityPosts(queryClient);
      toast({
        title: pin ?
        tr("usecommunity_post_pinlendi", "📌 Post pinləndi") :
        tr("usecommunity_post_pini_goturuldu", "Post pindən çıxarıldı")
      });
    },
    onError: () => {
      toast({ title: tr("usecommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });
};

/**
 * Post like toggle — optimistic.
 *  - Ürək DƏRHAL dolur/boşalır (server cavabı gözlənilmir)
 *  - Push bildirişi arxa planda göndərilir (like-ı bloklamır)
 *  - Duplicate insert (sürətli double-tap, 23505) uğur sayılır, push təkrarlanmır
 *  - Xətada cache geri qaytarılır (rollback)
 *  - Feed invalidate EDİLMİR — tam refetch (N+1) hər like-da lazımsız yük idi
 */
export const useToggleLike = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  return useMutation({
    mutationFn: async ({ postId, isLiked }: {postId: string;isLiked: boolean;groupId: string | null;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== viewerId) throw new Error('Not authenticated');

      if (isLiked) {
        const { error } = await supabase.
        from('post_likes').
        delete().
        eq('post_id', postId).
        eq('user_id', user.id);
        if (error) throw error;
        return;
      }

      const { data: like, error } = await supabase.
      from('post_likes').
      insert({ post_id: postId, user_id: user.id }).
      select('id').
      single();

      if (error) {
        // 23505 = unikal açar (artıq bəyənilib) — double-tap yarışı, uğur say + push YOX
        if ((error as any).code === '23505') return;
        throw error;
      }

      // Push bildirişi ARXA PLANDA — istifadəçini gözlətmir
      void (async () => {
        try {
          const { data: post } = await supabase.from('community_posts').select('id, user_id, group_id').eq('id', postId).maybeSingle();
          if (post && post.user_id !== user.id) {
            const { data: profile } = await supabase.from('public_profile_cards').select('name').eq('user_id', user.id).maybeSingle();
            const likerName = profile?.name || tr("usecommunity_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i");
            const { invokeSendPush } = await import('@/lib/push');
            await invokeSendPush({
              userId: post.user_id,
              title: tr("usecommunity_yeni_beyenme_3fd88a", "Yeni bəyənmə ❤️"),
              body: `${likerName} ${tr("usecommunity_paylasiminizi_beyendi", "paylaşımınızı bəyəndi")}`,
              data: {
                type: 'community_like',
                context: 'community_post',
                postId: post.id,
                groupId: post.group_id,
                interactionId: like.id
              } satisfies PushEventData,
              kind: 'community_like'
            });
          }
        } catch (e) {console.error('Like notification error:', e);}
      })();
    },
    onMutate: async ({ postId, isLiked }) => {
      const filter = communityPostFilter(viewerId, true);
      await queryClient.cancelQueries(filter);
      const previous = queryClient.getQueriesData(filter);
      patchCommunityPost(queryClient, viewerId, postId, (p) => ({
        ...p,
        is_liked: !isLiked,
        likes_count: Math.max(0, (p.likes_count || 0) + (isLiked ? -1 : 1))
      }), true);

      return { previous, userId: viewerId };
    },
    onError: (_err, vars, ctx) => {
      if (ctx) restoreCommunityPostFields(queryClient, ctx.previous, vars.postId, ['is_liked', 'likes_count']);
    },
    onSettled: (_data, _error, _vars, ctx) => {
      queryClient.invalidateQueries({ queryKey: ['community-profile-stats', ctx?.userId] });
    },
  });
};

/**
 * Şərh like toggle — optimistic (postlarla eyni prinsip).
 * Əvvəllər CommentReply xam supabase + tam refetch edirdi.
 */
export const useToggleCommentLike = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, isLiked }: {commentId: string;isLiked: boolean;postId: string;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isLiked) {
        const { error } = await supabase.
        from('comment_likes').
        delete().
        eq('comment_id', commentId).
        eq('user_id', user.id);
        if (error) throw error;
        return;
      }

      const { data: like, error } = await supabase.
      from('comment_likes').
      insert({ comment_id: commentId, user_id: user.id }).
      select('id').
      single();
      if (error) {
        if ((error as any).code === '23505') return; // artıq like edilib — səssiz uğur, push YOX
        throw error;
      }

      // DÜZƏLİŞ: əvvəllər şərh like-ı üçün HEÇ bir push bildirişi göndərilmirdi
      // (post like-ı göndərirdi, şərh like-ı YOX — uyğunsuzluq). İndi post
      // like-ındakı eyni "arxa planda, DB-dən TƏZƏ oxu" nümunəsi ilə düzəldilib.
      void (async () => {
        try {
          const { data: comment } = await supabase.
          from('post_comments').select('id, user_id, content, post_id').eq('id', commentId).maybeSingle();
          if (comment && (comment as any).user_id !== user.id) {
            const { data: profile } = await supabase.
            from('public_profile_cards').select('name').eq('user_id', user.id).maybeSingle();
            const likerName = profile?.name || tr("usecommunity_istifadeci_b6bdd6", "İstifadəçi");
            const preview = ((comment as any).content || '').slice(0, 50);
            const { invokeSendPush } = await import('@/lib/push');
            await invokeSendPush({
              userId: (comment as any).user_id,
              title: tr("usecommunity_serhiniz_beyenildi", "Şərhiniz bəyənildi ❤️"),
              body: preview ? `${likerName}: ${preview}` : likerName,
              // postId: bildirişə klik edəndə MƏHZ bu postu (+ şərhi vurğulayaraq)
              // açmaq üçün lazımdır (bax SinglePostView.tsx, pushNav.ts).
              data: {
                type: 'comment_like',
                context: 'post_comment',
                commentId: (comment as any).id,
                postId: (comment as any).post_id,
                interactionId: like.id
              } satisfies PushEventData,
              kind: 'comment_like'
            });
          }
        } catch (e) {console.error('Comment like notification error:', e);}
      })();
    },
    onMutate: async ({ commentId, isLiked, postId }) => {
      await queryClient.cancelQueries({ queryKey: ['post-comments', postId] });
      const prev = queryClient.getQueryData(['post-comments', postId]);

      queryClient.setQueryData(['post-comments', postId], (old: any) =>
      Array.isArray(old) ?
      old.map((c: any) => c.id === commentId ?
      { ...c, is_liked: !isLiked, likes_count: Math.max(0, (c.likes_count || 0) + (isLiked ? -1 : 1)) } :
      c) :
      old
      );

      return { prev };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(['post-comments', vars.postId], ctx.prev);
    }
  });
};

/**
 * @param enabled Şərhlər panelinin AÇIQ olub-olmadığı (PostCard.showComments).
 *   Əvvəllər BU HOOK hər feed-də görünən post üçün QEYD-ŞƏRTSİZ çağırılırdı
 *   (150 posta qədər feed-də = 150 paralel sorğu, N+1 performans problemi) —
 *   indi yalnız istifadəçi "Şərhlər" panelini açanda sorğu/kanal yaranır.
 */
export const usePostComments = (postId: string, enabled: boolean = true) => {
  const queryClient = useQueryClient();
  const isEnabled = !!postId && enabled;

  // Real-time: yeni/redaktə/silinmiş şərhlər gələn kimi paneli yenilə —
  // əvvəllər post_comments üçün HEÇ bir realtime abunəlik yox idi, başqa
  // istifadəçinin şərhi yalnız tam remount/30san staleTime-da görünürdü.
  useEffect(() => {
    if (!isEnabled) return;
    const channel = supabase
      .channel(`post-comments-${postId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments', filter: `post_id=eq.${postId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['post-comments', postId] }); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isEnabled, postId, queryClient]);

  return useQuery({
    queryKey: ['post-comments', postId],
    enabled: isEnabled,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      let { data: comments, error } = await (supabase as any).rpc('community_comments_v2', { p_post: postId });
      if (error && ['PGRST202', '42883'].includes(error.code) && !getBackendConfig().azure) {
        const legacy = await supabase.from('post_comments').select('*').eq('post_id', postId).eq('is_active', true).order('created_at', { ascending: true });
        comments = legacy.data; error = legacy.error;
      }
      if (error) throw error;

      const authorMap = await getPublicProfileCards((comments || []).map((c: any) => c.user_id));

      // Şərh like-ları — TƏK batch sorğu (əvvəllər hər şərh üçün ayrıca — N+1)
      const likedSet = new Set<string>();
      if (user && comments && comments.length > 0) {
        const { data: likeRows } = await supabase.
        from('comment_likes').
        select('comment_id').
        eq('user_id', user.id).
        in('comment_id', comments.map((c: any) => c.id));
        (likeRows || []).forEach((r: any) => likedSet.add(r.comment_id));
      }

      const commentsWithDetails = (comments || []).map((comment: any) => {
        const authorData = authorMap[comment.user_id];
        const isAnon = comment.is_anonymous === true;
        return {
          ...comment,
          author: isAnon ?
          { name: 'Anonim', avatar_url: null, badge_type: null, is_verified: false, verified_until: null } :
          authorData ?
          {
            name: authorData.name || tr("usecommunity_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"),
            avatar_url: authorData.avatar_url || null,
            badge_type: authorData.badge_type || null,
            is_premium: authorData.is_premium === true,
            can_share_links: authorData.can_share_links === true || ['admin', 'moderator'].includes(authorData.badge_type || ''),
            is_verified: authorData.is_verified || false,
            verified_until: authorData.verified_until || null,
            life_stage: authorData.life_stage || null
          } :
          { name: tr("usecommunity_istifadeci_b6bdd6", "İstifadəçi"), avatar_url: null, badge_type: null, is_verified: false, verified_until: null },
          is_liked: likedSet.has(comment.id)
        };
      });

      return commentsWithDetails as PostComment[];
    }
  });
};
export const useCreateComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      postId,
      content,
      imageUrl,
      parentCommentId,
      commenterName,
      isAnonymous,
      expectedUserId,
    }: {postId: string;content: string;imageUrl?: string | null;parentCommentId?: string | null;postAuthorId?: string;commenterName?: string;isAnonymous?: boolean;expectedUserId?: string;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || (expectedUserId && user.id !== expectedUserId)) throw new Error('Not authenticated');

      const { data: insertedComment, error } = await supabase.
      from('post_comments').
      insert({
        post_id: postId,
        user_id: user.id,
        parent_comment_id: parentCommentId ?? null,
        content,
        image_url: imageUrl || null,
        is_anonymous: isAnonymous || false
      }).
      select('id, post_id, parent_comment_id').
      single();

      if (error) throw error;

      const preview = content.length > 50 ? `${content.slice(0, 50)}...` : content;
      const senderName = Array.from(isAnonymous ? tr("usecommunity_anonim", "Anonim") : commenterName?.trim() || tr("usecommunity_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i")).slice(0, 30).join('');

      // Resolve the recipient from persisted rows instead of trusting author
      // props, and bind the push to the exact comment inserted above.
      try {
        if (insertedComment.parent_comment_id) {
          const { data: parentComment } = await supabase.
          from('post_comments').select('user_id, post_id').eq('id', insertedComment.parent_comment_id).maybeSingle();
          const parentAuthorId = (parentComment as any)?.user_id;
          if (parentAuthorId && parentAuthorId !== user.id && (parentComment as any).post_id === insertedComment.post_id) {
            const { invokeSendPush } = await import('@/lib/push');
            await invokeSendPush({
              userId: parentAuthorId,
              title: `${senderName} ${tr('community_reply_notification', 'rəyinizə cavab yazdı')}`,
              body: preview,
              data: {
                type: 'community_reply',
                context: 'post_comment',
                commentId: insertedComment.parent_comment_id,
                postId: insertedComment.post_id,
                interactionId: insertedComment.id
              } satisfies PushEventData,
              kind: 'community_reply'
            });
          }
        } else {
          const { data: post } = await supabase.
          from('community_posts').select('user_id').eq('id', insertedComment.post_id).maybeSingle();
          if (post?.user_id && post.user_id !== user.id) {
            const { invokeSendPush } = await import('@/lib/push');
            await invokeSendPush({
              userId: post.user_id,
              title: tr("usecommunity_yeni_serh_25bb56", "Yeni \u015F\u0259rh \uD83D\uDCAC"),
              body: `${senderName}: ${preview}`,
              data: {
                type: 'community_comment',
                context: 'community_post',
                postId: insertedComment.post_id,
                interactionId: insertedComment.id
              } satisfies PushEventData,
              kind: 'community_comment'
            });
          }
        }
      } catch (e) {console.error('Comment notification error:', e);}
    },
    // Optimistic insert — əvvəllər BUNUN ƏVƏZİNƏ heç nə yox idi ("insert →
    // invalidate → şəbəkə round-trip gözlə") — buna görə öz şərhin bəzən
    // gecikirdi/heç görünmürdü. İndi dərhal (server cavabını gözləmədən)
    // panelə əlavə olunur; uğursuz olarsa onError geri qaytarır.
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['post-comments', vars.postId] });
      const prev = queryClient.getQueryData<PostComment[]>(['post-comments', vars.postId]);

      const optimisticComment: PostComment = {
        id: `optimistic-${Date.now()}`,
        post_id: vars.postId,
        user_id: 'optimistic',
        parent_comment_id: vars.parentCommentId ?? null,
        content: vars.content,
        image_url: vars.imageUrl || null,
        likes_count: 0,
        created_at: new Date().toISOString(),
        is_anonymous: vars.isAnonymous || false,
        author: vars.isAnonymous ?
        { name: 'Anonim', avatar_url: null, badge_type: null, is_verified: false, verified_until: null } :
        { name: vars.commenterName || tr("usecommunity_i_stifadeci_b6bdd6", "\u0130stifad\u0259\xE7i"), avatar_url: null, badge_type: null, is_verified: false, verified_until: null },
        is_liked: false
      };

      queryClient.setQueryData<PostComment[]>(
        ['post-comments', vars.postId],
        (old) => [...(old || []), optimisticComment]
      );

      return { prev };
    },
    onError: (err: any, vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(['post-comments', vars.postId], ctx.prev);
      toast({ title: tr("usecommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), description: err?.message === 'COMMENT_LINKS_STAFF_ONLY'
        ? tr('community_links_staff_only', 'Rəylərdə linki yalnız administrator və moderator paylaşa bilər.') : err?.message, variant: 'destructive' });
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['post-comments', variables.postId] }),
        invalidateCommunityPosts(queryClient),
      ]);
    }
  });
};

/**
 * Şərh/cavab redaktəsi — useEditPost ilə EYNİ nəzarət nümunəsi
 * (.eq('user_id', user.id) — yalnız öz şərhini dəyişə bilər, RLS bunu
 * artıq icazə verir, bax Duzelis41.sql). Mətn və/və ya şəkil dəyişə bilər;
 * imageUrl===null göndərilsə mövcud şəkil silinir (composer-də "x" düyməsi).
 */
export const useEditComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId, content, imageUrl }: {commentId: string;content: string;postId: string;imageUrl?: string | null;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updates: Record<string, any> = { content };
      if (imageUrl !== undefined) updates.image_url = imageUrl;

      const { error } = await supabase.
      from('post_comments').
      update(updates).
      eq('id', commentId).
      eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post-comments', variables.postId] });
      toast({ title: tr("usecommunity_serh_redakte_edildi", "Şərh redaktə edildi ✏️") });
    },
    onError: () => {
      toast({ title: tr("usecommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });
};

/**
 * Şərh/cavab silinməsi — DÜZƏLİŞ: əvvəllər CommentReply.tsx bunu xam
 * supabase çağırışı ilə edirdi və UI-da yalnız admin düyməsi göstərilirdi —
 * adi istifadəçi öz şərhini silə bilmirdi (RLS artıq icazə verirdi, sadəcə
 * kod yox idi).
 *
 * DİQQƏT: sahiblik yoxlaması BURADA (.eq('user_id', user.id)) YOX, RLS-də
 * edilir — çünki post_comments-də İKİ ayrı DELETE siyasəti var: "Users can
 * delete own comments" (auth.uid()=user_id) VƏ "Admins can manage all
 * comments" (FOR ALL). Əgər client sorğusuna .eq('user_id', user.id) əlavə
 * etsəydik, bu, admin başqasının şərhini silməyə çalışanda sətri (user_id
 * uyğun gəlmədiyi üçün) səssizcə TAPMAZDI — admin-in silmə hüququnu
 * (RLS icazə versə belə) qıraraq. RLS hər iki halı düzgün idarə edir.
 */
export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ commentId }: {commentId: string;postId: string;}) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.
      from('post_comments').
      delete().
      eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['post-comments', variables.postId] }),
        invalidateCommunityPosts(queryClient),
      ]);
      toast({ title: tr("commentreply_serh_silindi_59cfe5", "Şərh silindi") + ' 🗑️' });
    },
    onError: () => {
      toast({ title: tr("usecommunity_xeta_bas_verdi_f22fba", "Xəta baş verdi"), variant: 'destructive' });
    }
  });
};

export const useAutoJoinGroups = () => {
  // Messaging groups are joined explicitly; medical/life-stage categories no
  // longer create memberships as a side effect of changing a profile.
  const autoJoin = useCallback(async (_profile: {
    life_stage?: string;
    baby_birth_date?: string;
    baby_gender?: string;
    multiples_type?: string;
    due_date?: string;
  }) => {
    return;
  }, []);

  return { autoJoin };
}; 
