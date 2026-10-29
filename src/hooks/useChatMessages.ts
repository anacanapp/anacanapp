import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { getPublicProfileCards } from '@/lib/public-profile-cards';
import { chatTable, discardChatAttachment, notifyChatMessage, reactionColumn, resolveChatMedia, type ChatAttachment, type ChatKind, type ChatMessage, type ChatReaction } from '@/lib/chat';
import { useAuth } from './useAuth';

const PAGE_SIZE = 60;
export function useChatMessages(kind: ChatKind, target: string) {
  const { user } = useAuth(), client = useQueryClient(), actor = user?.id;
  const backend = getBackendConfig().url;
  const scope = [backend, actor, kind, target] as const;
  const key = ['chat-messages-v2', ...scope];
  const query = useInfiniteQuery({
    queryKey: key, enabled: !!actor && !!target, initialPageParam: null as { at: string; id: string } | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await (supabase as any).rpc('chat_messages_v2', {
        p_kind: kind, p_target: target, p_before_at: pageParam?.at ?? null, p_before_id: pageParam?.id ?? null, p_limit: PAGE_SIZE,
      });
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    getNextPageParam: page => page.length === PAGE_SIZE ? { at: page[page.length - 1].created_at, id: page[page.length - 1].id } : undefined,
  });
  const messages = useMemo(() => {
    const rows = new Map<string, ChatMessage>();
    for (const page of query.data?.pages || []) for (const message of page) rows.set(message.id, message);
    return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  }, [query.data]);
  const ids = messages.map(message => message.id);
  const replyIds = [...new Set(messages.map(message => message.reply_to_id).filter((id): id is string => !!id && !ids.includes(id)))];
  const repliesQuery = useQuery({ queryKey: ['chat-replies-v2', ...scope, replyIds], enabled: !!actor && replyIds.length > 0,
    queryFn: async () => {
      const rows: ChatMessage[] = [];
      for (let start = 0; start < replyIds.length; start += 80) {
        const { data, error } = await (supabase as any).from(chatTable(kind)).select('*').in('id', replyIds.slice(start, start + 80));
        if (error) throw error;
        rows.push(...(data || []));
      }
      return rows;
    } });
  const allMessages = useMemo(() => new Map([...messages, ...(repliesQuery.data || [])].map(message => [message.id, message])), [messages, repliesQuery.data]);
  const authorIds = [...new Set([...allMessages.values()].map(message => message.sender_id))];
  const authorsQuery = useQuery({ queryKey: ['chat-authors-v2', backend, actor, authorIds], enabled: !!actor && authorIds.length > 0,
    queryFn: () => getPublicProfileCards(authorIds), staleTime: 30000 });
  const mediaMessages = messages.filter(message => message.media_path || message.media_url || ['image', 'audio', 'video'].includes(message.message_type));
  const mediaKey = ['chat-media-v3', ...scope, mediaMessages.map(message => [message.id, message.media_path, message.media_url, message.content])];
  const mediaQuery = useQuery({ queryKey: mediaKey,
    enabled: !!actor && mediaMessages.length > 0, staleTime: 0, gcTime: 0,
    refetchInterval: 240000, refetchIntervalInBackground: false,
    queryFn: async () => {
      const result: Record<string, string | null> = {};
      let failures = 0;
      for (let start = 0; start < mediaMessages.length; start += 8) await Promise.all(mediaMessages.slice(start, start + 8).map(async message => {
        try { result[message.id] = await resolveChatMedia(message); } catch { result[message.id] = null; failures++; }
      }));
      if (failures === mediaMessages.length) throw new Error('CHAT_MEDIA_SIGNING_FAILED');
      return result;
    } });
  const renewMedia = async (message: ChatMessage) => {
    const url = await resolveChatMedia(message);
    if (url) client.setQueryData<Record<string, string | null>>(mediaKey, previous => ({ ...previous, [message.id]: url }));
    return url;
  };
  const reactionsQuery = useQuery({ queryKey: ['chat-reactions-v2', ...scope, ids], enabled: !!actor && ids.length > 0,
    queryFn: async () => {
      const rows: ChatReaction[] = [];
      for (let start = 0; start < ids.length; start += 80) {
        const { data, error } = await (supabase as any).from('chat_message_reactions').select('*').in(reactionColumn(kind), ids.slice(start, start + 80));
        if (error) throw error;
        rows.push(...(data || []));
      }
      return rows;
    } });
  const send = useMutation({ mutationFn: async (input: { id: string; text: string; attachment?: ChatAttachment | null; replyTo?: string | null }) => {
    if (!actor) throw new Error('CHAT_ACCOUNT_CHANGED');
    const { data, error } = await (supabase as any).rpc('chat_send_message_v2', {
      p_actor: actor, p_id: input.id, p_kind: kind, p_target: target, p_content: input.text,
      p_type: input.attachment?.type ?? 'text', p_media_path: input.attachment?.path ?? null,
      p_media_mime: input.attachment?.mime ?? null, p_reply_to: input.replyTo ?? null, p_duration_ms: input.attachment?.durationMs ?? null,
    });
    if (error) throw error;
    void notifyChatMessage(kind, target, data as ChatMessage).catch(() => {});
    return data as ChatMessage;
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: key }); void client.invalidateQueries({ queryKey: ['chat-groups-v3'] }); } });
  const remove = useMutation({ mutationFn: async (message: string) => {
    // Private chats: the sender deletes for both sides (same server contract as groups).
    const { data, error } = kind === 'group'
      ? await (supabase as any).rpc('chat_delete_group_message_v3', { p_actor: actor, p_group: target, p_message: message })
      : await (supabase as any).rpc('chat_delete_message_v1', { p_actor: actor, p_kind: kind, p_target: target, p_message: message });
    if (error) throw error;
    if (data?.media_path) await discardChatAttachment(data.media_path);
  }, onSuccess: () => { void client.invalidateQueries({ queryKey: key }); void client.invalidateQueries({ queryKey: ['chat-groups-v3'] }); } });
  const react = useMutation({ mutationFn: async ({ message, emoji }: { message: string; emoji: string | null }) => {
    const { error } = await (supabase as any).rpc('chat_set_reaction_v2', { p_actor: actor, p_kind: kind, p_message: message, p_emoji: emoji });
    if (error) throw error;
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['chat-reactions-v2', ...scope] }) });

  // Latest values for effects that should not resubscribe on every render.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const loadedIdsRef = useRef<Set<string>>(new Set());
  loadedIdsRef.current = useMemo(() => new Set(allMessages.keys()), [allMessages]);
  const lastMarkedRef = useRef<string | null>(null);
  const newestId = messages.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    if (!actor || !target || !newestId) return;
    // Only mark read when the newest loaded message changes (not on every
    // refetch / reaction / media re-render), and only once per newest id.
    const markKey = `${backend}:${actor}:${kind}:${target}:${newestId}`;
    const markRead = () => {
      if (document.visibilityState === 'hidden' || lastMarkedRef.current === markKey) return;
      const unread = messagesRef.current.filter(message => kind === 'group' || message.receiver_id === actor && !message.is_read).map(message => message.id).slice(-100);
      if (!unread.length) return;
      lastMarkedRef.current = markKey;
      void (supabase as any).rpc('chat_mark_read_v2', { p_actor: actor, p_kind: kind, p_target: target, p_ids: unread })
        .then(({ error }: { error: unknown }) => {
          if (error) { if (lastMarkedRef.current === markKey) lastMarkedRef.current = null; return; }
          void client.invalidateQueries({ queryKey: ['chat-groups-v3'] });
        }).catch(() => { if (lastMarkedRef.current === markKey) lastMarkedRef.current = null; });
    };
    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [actor, target, kind, backend, newestId, client]);
  useEffect(() => {
    if (!actor || !target) return;
    const channel = supabase.channel(`chat-v2:${kind}:${target}:${crypto.randomUUID()}`);
    const refresh = () => { void client.invalidateQueries({ queryKey: key }); };
    if (kind === 'group') channel.on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', filter: `group_id=eq.${target}` }, refresh);
    else for (const field of ['sender_id', 'receiver_id']) channel.on('postgres_changes', { event: '*', schema: 'public', table: chatTable(kind), filter: `${field}=eq.${actor}` }, refresh);
    // chat_message_reactions has no usable filter for this conversation, so
    // drop events for messages that are not loaded here and throttle the
    // invalidation (leading + trailing, >= 2s).
    const column = reactionColumn(kind);
    let lastRun = 0, trailing: ReturnType<typeof setTimeout> | null = null;
    const invalidateReactions = () => { lastRun = Date.now(); void client.invalidateQueries({ queryKey: ['chat-reactions-v2', ...scope] }); };
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'chat_message_reactions' }, (payload: any) => {
      const row = (payload?.new && Object.keys(payload.new).length ? payload.new : payload?.old) as Record<string, unknown> | undefined;
      const messageId = row?.[column];
      if (row && column in row) {
        if (typeof messageId !== 'string' || !loadedIdsRef.current.has(messageId)) return;
      }
      const wait = 2000 - (Date.now() - lastRun);
      if (wait <= 0) { invalidateReactions(); return; }
      if (!trailing) trailing = setTimeout(() => { trailing = null; invalidateReactions(); }, wait);
    }).subscribe();
    return () => { if (trailing) clearTimeout(trailing); trailing = null; void supabase.removeChannel(channel); };
  }, [actor, target, kind, backend, client]);
  return { messages, allMessages, authors: authorsQuery.data || {}, media: mediaQuery.data || {}, renewMedia,
    reactions: reactionsQuery.data || [], actor, loading: query.isPending, error: query.error,
    refetch: query.refetch, loadOlder: query.fetchNextPage, hasOlder: query.hasNextPage, loadingOlder: query.isFetchingNextPage,
    send: send.mutateAsync, sending: send.isPending, react: react.mutateAsync, reacting: react.isPending,
    remove: remove.mutateAsync, removing: remove.isPending };
}
