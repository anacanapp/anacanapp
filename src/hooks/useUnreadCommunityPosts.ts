import { useCallback, useEffect } from 'react';
import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { normalizeAppLanguage } from '@/lib/app-languages';
import { matchesFeedLanguage } from './useFeedLanguages';
import type { RealtimeChannel } from '@supabase/supabase-js';

type PostMap = Record<string, boolean>;
type PostParams = { userId: string; postId: string; createdAt: string; postUserId?: string; language?: string };
type MarkerPost = { id: string; created_at: string; user_id: string; language: string; is_active: boolean; group_id: string | null };
const currentLanguage = () => normalizeAppLanguage(useUserStore.getState().language);
export const communityUnreadScope = (userId: string, language: string = currentLanguage()) =>
  JSON.stringify([getBackendConfig().url, userId, normalizeAppLanguage(language)]);

// Local seen markers are a cache over server-side community_post_reads; keep
// only the most recent ids (insertion order) so the map and its persisted JSON
// stay bounded. Markers carry no timestamps, so age-based pruning is not possible.
const MAX_SEEN_POST_IDS = 1000;
function capSeen(ids: PostMap): PostMap {
  const keys = Object.keys(ids);
  if (keys.length <= MAX_SEEN_POST_IDS) return ids;
  return Object.fromEntries(keys.slice(-MAX_SEEN_POST_IDS).map(id => [id, true]));
}
function readSeen(scope: string, userId: string): PostMap {
  try {
    // Old per-post markers are actual reads and remain valid. The former global
    // last-seen timestamp is not a read receipt for every newly selected language.
    const raw = localStorage.getItem(`community_seen_posts_v2:${scope}`) || localStorage.getItem(`community_seen_posts:${userId}`);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return capSeen(Object.fromEntries((Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []).map(id => [id, true])));
  } catch { return {}; }
}
function readLastSeen(scope: string): string | null {
  try { const value = localStorage.getItem(`community_seen_at_v2:${scope}`); return value && Number.isFinite(Date.parse(value)) ? value : null; }
  catch { return null; }
}
let pendingWrite: { scope: string; ids: PostMap } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
function flushSeen() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  if (!pendingWrite) return;
  try { localStorage.setItem(`community_seen_posts_v2:${pendingWrite.scope}`, JSON.stringify(Object.keys(pendingWrite.ids))); } catch { /* optional local cache */ }
  pendingWrite = null;
}
function writeSeen(scope: string, ids: PostMap) {
  if (pendingWrite && pendingWrite.scope !== scope) flushSeen();
  pendingWrite = { scope, ids };
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushSeen, 800);
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSeen);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSeen(); });
}

// Keep each UUID request below normal ingress request-line limits.
export async function readCommunityPostMarkers(userId: string, postIds: string[]): Promise<PostMap> {
  const batches: string[][] = [];
  for (let offset = 0; offset < postIds.length; offset += 100) batches.push(postIds.slice(offset, offset + 100));
  const results = await Promise.all(batches.map(async batch => {
    const { data, error } = await supabase.from('community_post_reads').select('post_id').eq('user_id', userId).in('post_id', batch);
    if (error) throw error;
    return data || [];
  }));
  return Object.fromEntries(results.flat().map(row => [row.post_id, true]));
}
async function readUnreadCandidates(userId: string, language: string, lastSeen: string | null): Promise<MarkerPost[]> {
  let query = supabase.from('community_posts').select('id,created_at,user_id,language,is_active,group_id')
    .eq('is_active', true).eq('language', language).is('group_id', null).neq('user_id', userId)
    .order('created_at', { ascending: false }).limit(500);
  if (lastSeen) query = query.gt('created_at', lastSeen);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).filter(post => matchesFeedLanguage(post, language) && post.is_active && !post.group_id && post.user_id !== userId) as MarkerPost[];
}
async function writeMarkers(userId: string, posts: MarkerPost[]) {
  for (let offset = 0; offset < posts.length; offset += 100) {
    const { error } = await supabase.from('community_post_reads').upsert(posts.slice(offset, offset + 100).map(post =>
      ({ user_id: userId, post_id: post.id, seen_at: new Date().toISOString() })), { onConflict: 'user_id,post_id' });
    if (error) throw error;
  }
}

let generation = 0;
let activeChannel: RealtimeChannel | null = null;
let channelScope: string | null = null;
let hydrationScope: string | null = null;
interface UnreadCommunityState {
  scope: string | null;
  initializedUserId: string | null;
  unreadCount: number;
  lastSeenAt: string | null;
  seenPostIds: PostMap;
  unreadPostIds: PostMap;
  hydrateForUser: (userId: string, language?: string) => Promise<void>;
  markPostSeen: (params: PostParams) => Promise<void>;
  markCommunitySeen: (userId: string, language?: string) => Promise<void>;
  registerNewPost: (params: PostParams) => void;
  reset: () => void;
}
export const unreadCommunityStore = create<UnreadCommunityState>((set, get) => ({
  scope: null, initializedUserId: null, unreadCount: 0, lastSeenAt: null, seenPostIds: {}, unreadPostIds: {},
  hydrateForUser: async (userId, inputLanguage = currentLanguage()) => {
    const language = normalizeAppLanguage(inputLanguage), scope = communityUnreadScope(userId, language), request = ++generation;
    if (get().scope !== scope) set({ scope, initializedUserId: null, unreadCount: 0, lastSeenAt: readLastSeen(scope), seenPostIds: readSeen(scope, userId), unreadPostIds: {} });
    const previouslyUnread = new Set(Object.keys(get().unreadPostIds));
    const lastSeenAt = get().lastSeenAt;
    const posts = await readUnreadCandidates(userId, language, lastSeenAt);
    const serverSeen = await readCommunityPostMarkers(userId, posts.map(post => post.id));
    if (request !== generation || get().scope !== scope) return;
    const seenPostIds = { ...readSeen(scope, userId), ...serverSeen, ...get().seenPostIds };
    const arriving = Object.keys(get().unreadPostIds).filter(id => !previouslyUnread.has(id));
    const unreadPostIds = { ...Object.fromEntries(arriving.map(id => [id, true])), ...Object.fromEntries(posts.filter(post => !seenPostIds[post.id]).map(post => [post.id, true])) };
    Object.keys(seenPostIds).forEach(id => { delete unreadPostIds[id]; });
    const boundedSeen = capSeen(seenPostIds);
    writeSeen(scope, boundedSeen);
    set({ initializedUserId: userId, lastSeenAt, seenPostIds: boundedSeen, unreadPostIds, unreadCount: Object.keys(unreadPostIds).length });
  },
  markPostSeen: async ({ userId, postId, postUserId, language = currentLanguage() }) => {
    const scope = communityUnreadScope(userId, language), state = get();
    if (postUserId === userId || state.scope !== scope || state.seenPostIds[postId]) return;
    const seenPostIds = capSeen({ ...state.seenPostIds, [postId]: true }), unreadPostIds = { ...state.unreadPostIds };
    delete unreadPostIds[postId];
    set({ seenPostIds, unreadPostIds, unreadCount: Object.keys(unreadPostIds).length });
    writeSeen(scope, seenPostIds);
    const { error } = await supabase.from('community_post_reads').upsert({ user_id: userId, post_id: postId, seen_at: new Date().toISOString() }, { onConflict: 'user_id,post_id' });
    if (error) console.warn('[community-unread] marker_failed');
  },
  markCommunitySeen: async (userId, inputLanguage = currentLanguage()) => {
    const language = normalizeAppLanguage(inputLanguage), scope = communityUnreadScope(userId, language);
    if (get().scope !== scope) return;
    const posts = await readUnreadCandidates(userId, language, get().lastSeenAt);
    await writeMarkers(userId, posts);
    if (get().scope !== scope) return;
    ++generation;
    const seenPostIds = { ...get().seenPostIds, ...Object.fromEntries(posts.map(post => [post.id, true])) };
    const latest = posts[0]?.created_at || get().lastSeenAt;
    const lastSeenAt = get().lastSeenAt && latest && get().lastSeenAt! > latest ? get().lastSeenAt : latest;
    const unreadPostIds = { ...get().unreadPostIds };
    Object.keys(seenPostIds).forEach(id => { delete unreadPostIds[id]; });
    const boundedSeen = capSeen(seenPostIds);
    set({ initializedUserId: userId, seenPostIds: boundedSeen, unreadPostIds, unreadCount: Object.keys(unreadPostIds).length, lastSeenAt });
    writeSeen(scope, boundedSeen);
    try { if (lastSeenAt) localStorage.setItem(`community_seen_at_v2:${scope}`, lastSeenAt); } catch { /* per-post server receipts remain authoritative */ }
    // No global user_preferences timestamp: marking RU read must not mark AZ read.
  },
  registerNewPost: ({ userId, postId, createdAt, postUserId, language = currentLanguage() }) => {
    const state = get();
    if (postUserId === userId || state.scope !== communityUnreadScope(userId, language) || state.seenPostIds[postId]
      || state.unreadPostIds[postId] || (state.lastSeenAt && Date.parse(createdAt) <= Date.parse(state.lastSeenAt))) return;
    const unreadPostIds = { ...state.unreadPostIds, [postId]: true };
    set({ unreadPostIds, unreadCount: Object.keys(unreadPostIds).length });
  },
  reset: () => {
    ++generation; flushSeen();
    if (activeChannel) void supabase.removeChannel(activeChannel);
    activeChannel = null; channelScope = null; hydrationScope = null;
    set({ scope: null, initializedUserId: null, unreadCount: 0, lastSeenAt: null, seenPostIds: {}, unreadPostIds: {} });
  },
}));

export function useUnreadCommunityPosts() {
  const { user } = useAuth(), userId = user?.id;
  const language = normalizeAppLanguage(useUserStore(state => state.language));
  const scope = userId ? communityUnreadScope(userId, language) : null;
  const storedScope = unreadCommunityStore(state => state.scope);
  const initializedUserId = unreadCommunityStore(state => state.initializedUserId);
  const rawCount = unreadCommunityStore(state => state.unreadCount);
  const rawLastSeen = unreadCommunityStore(state => state.lastSeenAt);
  const seenPostIds = unreadCommunityStore(state => state.seenPostIds);
  const unreadPostIds = unreadCommunityStore(state => state.unreadPostIds);
  useEffect(() => {
    if (!userId || !scope) { unreadCommunityStore.getState().reset(); return; }
    if ((storedScope !== scope || initializedUserId !== userId) && hydrationScope !== scope) {
      hydrationScope = scope;
      void unreadCommunityStore.getState().hydrateForUser(userId, language).catch(() => console.warn('[community-unread] hydration_failed'))
        .finally(() => { if (hydrationScope === scope) hydrationScope = null; });
    }
    if (channelScope !== scope) {
      if (activeChannel) void supabase.removeChannel(activeChannel);
      activeChannel = supabase.channel(`community-unread:${userId}:${language}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_posts', filter: `language=eq.${language}` }, event => {
          const post = event.new as MarkerPost;
          if (!matchesFeedLanguage(post, language) || post.group_id || post.is_active !== true) return;
          unreadCommunityStore.getState().registerNewPost({ userId, language, postId: post.id, createdAt: post.created_at, postUserId: post.user_id });
        }).subscribe();
      channelScope = scope;
    }
  }, [userId, scope, language, storedScope, initializedUserId]);
  const refresh = useCallback(async () => {
    if (userId) await unreadCommunityStore.getState().hydrateForUser(userId, language).catch(() => console.warn('[community-unread] hydration_failed'));
  }, [userId, language]);
  const markPostSeen = useCallback(async (postId: string, createdAt: string, postUserId?: string) => {
    if (userId) await unreadCommunityStore.getState().markPostSeen({ userId, language, postId, createdAt, postUserId });
  }, [userId, language]);
  const markCommunitySeen = useCallback(async () => {
    if (userId) await unreadCommunityStore.getState().markCommunitySeen(userId, language).catch(() => console.warn('[community-unread] mark_all_failed'));
  }, [userId, language]);
  const isUnreadPost = useCallback((postId: string, _createdAt: string, postUserId?: string) =>
    !!userId && userId !== postUserId && storedScope === scope && !!unreadPostIds[postId], [userId, storedScope, scope, unreadPostIds]);
  return { unreadCount: storedScope === scope ? rawCount : 0, lastSeenAt: storedScope === scope ? rawLastSeen : null,
    seenPostIds: storedScope === scope ? seenPostIds : {}, markPostSeen, markCommunitySeen, refresh, isUnreadPost };
}

export function usePostSeenFlag(postId: string) {
  const language = useUserStore(state => state.language);
  const { user } = useAuth();
  const scope = user ? communityUnreadScope(user.id, language) : null;
  return unreadCommunityStore(state => state.scope === scope && !!state.seenPostIds[postId]);
}
export function usePostUnreadFlag(userId: string | undefined, postId: string, _createdAt: string, postUserId?: string) {
  const language = useUserStore(state => state.language);
  const scope = userId ? communityUnreadScope(userId, language) : null;
  return unreadCommunityStore(state => !!userId && postUserId !== userId && state.scope === scope && !!state.unreadPostIds[postId]);
}
export const markPostSeenDirect = (userId: string, postId: string, createdAt: string, postUserId?: string) =>
  unreadCommunityStore.getState().markPostSeen({ userId, postId, createdAt, postUserId });
