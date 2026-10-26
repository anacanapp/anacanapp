import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from './useAuth';
import type { CommunityGroup } from './useCommunity';
import { useUserStore } from '@/store/userStore';
import { normalizeAppLanguage } from '@/lib/app-languages';

export type GroupAction = 'join' | 'accept_invite' | 'decline_invite' | 'cancel_request' | 'invite' | 'approve' | 'reject'
  | 'leave' | 'remove' | 'block' | 'unblock' | 'promote' | 'demote' | 'transfer' | 'delete';
export type GroupAccess = 'invited' | 'requested' | 'blocked' | 'removed' | 'closed' | null;
export interface ChatGroup extends CommunityGroup {
  discovery_language?: string | null;
  created_by: string | null; chat_visibility: 'public' | 'private'; chat_posting_policy: 'members' | 'admins' | null;
  is_member: boolean; member_role: string | null; is_owner: boolean; can_manage: boolean;
  access_state: GroupAccess; pending_count: number; unread_count: number;
  last_message_at: string | null; last_message: string | null; last_message_type: string | null;
}
export interface ChatMember { user_id: string; name: string | null; avatar_url: string | null; role: string; joined_at: string; state: 'member' | 'invited' | 'requested' | 'blocked' }

export function useChatGroups(groupId?: string, scope: 'all' | 'mine' | 'public' | 'private' = 'all', search = '', languageFiltered = !groupId) {
  const { user } = useAuth(), client = useQueryClient(), actor = user?.id, backend = getBackendConfig().url;
  const language = normalizeAppLanguage(useUserStore(state => state.language));
  const query = useQuery({ queryKey: ['chat-groups-v3', backend, actor, scope, groupId ?? null, search, languageFiltered ? language : null], enabled: !!actor,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(languageFiltered ? 'chat_groups_v4' : 'chat_groups_v3', {
        p_scope: scope, p_group: groupId ?? null, p_search: search, ...(languageFiltered ? { p_language: language } : {}),
      });
      if (error) throw error;
      return ((data || []) as ChatGroup[]).filter(group => !languageFiltered || group.discovery_language === language);
    }, staleTime: 10000, refetchInterval: groupId ? 10000 : 30000, refetchIntervalInBackground: false });
  const group = query.data?.find(item => item.id === groupId);
  const members = useQuery({ queryKey: ['chat-members-v3', backend, actor, groupId], enabled: !!actor && !!groupId && group?.is_member === true,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('chat_group_people_v3', { p_group: groupId });
      if (error) throw error; return (data || []) as ChatMember[];
    } });
  const invalidate = () => Promise.all([
    client.invalidateQueries({ queryKey: ['chat-groups-v3'] }), client.invalidateQueries({ queryKey: ['chat-members-v3'] }),
    client.invalidateQueries({ queryKey: ['chat-messages-v2'] }), client.invalidateQueries({ queryKey: ['chat-group-cards-v3'] }),
    client.invalidateQueries({ queryKey: ['community-groups'] }), client.invalidateQueries({ queryKey: ['user-memberships'] }),
  ]);
  const create = useMutation({ mutationFn: async ({ id, name, people, visibility = 'private', description = '' }:
    { id: string; name: string; people: string[]; visibility?: 'public' | 'private'; description?: string }) => {
    const { data, error } = await (supabase as any).rpc('chat_create_group_v4', { p_language: language, p_actor: actor, p_id: id, p_name: name,
      p_visibility: visibility, p_members: people, p_description: description });
    if (error) throw error; return data as string;
  }, onSuccess: invalidate });
  const manage = useMutation({ mutationFn: async ({ group, action, people = [] }: { group: string; action: GroupAction; people?: string[] }) => {
    const { data, error } = await (supabase as any).rpc('chat_group_action_v3', { p_actor: actor, p_group: group, p_action: action, p_users: people });
    if (error) throw error; return data as { state: string };
  }, onSuccess: invalidate });
  const update = useMutation({ mutationFn: async (input: { group: string; name: string; description: string; visibility: 'public' | 'private'; posting: 'members' | 'admins' }) => {
    const { error } = await (supabase as any).rpc('chat_update_group_v3', { p_actor: actor, p_group: input.group, p_name: input.name,
      p_description: input.description, p_visibility: input.visibility, p_posting_policy: input.posting });
    if (error) throw error;
  }, onSuccess: invalidate });
  useEffect(() => {
    if (!actor) return;
    const refresh = () => { void invalidate(); };
    const invalidateGroups = () => { void client.invalidateQueries({ queryKey: ['chat-groups-v3', backend, actor] }); };
    // Inbox mode listens to every group_messages change app-wide, so throttle
    // the list invalidation (leading + trailing, >= 5s). An open group keeps
    // its filtered listener and refreshes immediately.
    let lastRun = 0, trailing: ReturnType<typeof setTimeout> | null = null;
    const throttledGroups = () => {
      const wait = 5000 - (Date.now() - lastRun);
      if (wait <= 0) { lastRun = Date.now(); invalidateGroups(); return; }
      if (!trailing) trailing = setTimeout(() => { trailing = null; lastRun = Date.now(); invalidateGroups(); }, wait);
    };
    const onGroupMessage = groupId ? invalidateGroups : throttledGroups;
    const channel = supabase.channel(`chat-groups-v3:${actor}:${scope}:${groupId || 'inbox'}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_memberships', filter: `user_id=eq.${actor}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chat_access', filter: `user_id=eq.${actor}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chat_access', filter: `owner_id=eq.${actor}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_messages', ...(groupId ? { filter: `group_id=eq.${groupId}` } : {}) }, onGroupMessage);
    if (groupId) channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_groups', filter: `id=eq.${groupId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_memberships', filter: `group_id=eq.${groupId}` }, refresh);
    channel.subscribe(); return () => { if (trailing) clearTimeout(trailing); trailing = null; void supabase.removeChannel(channel); };
  }, [actor, backend, scope, groupId, client, language]);
  return { groups: query.data || [], group, loading: query.isPending, error: query.error, refetch: query.refetch,
    members: members.data || [], membersLoading: members.isPending, membersError: members.error,
    create: create.mutateAsync, creating: create.isPending, manage: manage.mutateAsync, managing: manage.isPending,
    update: update.mutateAsync, updating: update.isPending };
}
