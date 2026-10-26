import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useUserStore } from '@/store/userStore';
import { moderatorText } from '@/lib/moderator-i18n';
import { moderatorError, type ModeratorAccess, type ModerationStatus, type ModeratorPage, type ModeratorContent, type ModeratorKind } from '@/lib/moderator';

export function useModeratorAccess() {
  const { user, isModerator, isAdmin } = useAuth(), backend = getBackendConfig().url;
  return useQuery({ queryKey: ['moderator-access', backend, user?.id], enabled: !!user && !!(isModerator || isAdmin), meta: { persist: false }, staleTime: 15000, refetchInterval: 30000, retry: false,
    queryFn: async ({ signal }) => { const { data, error } = await (supabase as any).rpc('get_moderator_access_v1').abortSignal(signal); if (error) throw error; return data as ModeratorAccess; } });
}
export function useMyModerationStatus() {
  const { user } = useAuth(), backend = getBackendConfig().url;
  return useQuery({ queryKey: ['my-moderation-status', backend, user?.id], enabled: !!user, meta: { persist: false }, staleTime: 10000, refetchInterval: 15000, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc('get_my_moderation_status_v1', { p_actor: user?.id }).abortSignal(signal);
      if (error && ['PGRST202', '42883'].includes(error.code)) return null;
      if (error) throw error;
      if (data?.user_id !== user?.id) throw new Error('MODERATOR_ACCOUNT_CHANGED');
      return data as ModerationStatus;
    } });
}
export function useModeratorQuery<T = Record<string, any>>(view: string, filters: Record<string, unknown> = {}, page = 0, enabled = true) {
  const { user } = useAuth(), backend = getBackendConfig().url, access = useModeratorAccess();
  return useQuery({ queryKey: ['moderator-data', backend, user?.id, view, filters, page], enabled: enabled && access.data?.allowed === true,
    meta: { persist: false }, staleTime: 0, refetchInterval: 20000,
    queryFn: async ({ signal }) => {
      const { data, error } = await (supabase as any).rpc('moderator_query_v1', { p_view: view, p_filters: filters, p_limit: 25, p_offset: page * 25 }).abortSignal(signal);
      if (error) throw error; return data as ModeratorPage<T>;
    } });
}
export function useModeratorContent(kind: ModeratorKind | null, id: string | null) {
  const { user } = useAuth(), backend = getBackendConfig().url, access = useModeratorAccess();
  return useQuery({ queryKey: ['moderator-content', backend, user?.id, kind, id], enabled: !!id && !!kind && kind !== 'user' && access.data?.allowed === true,
    meta: { persist: false }, staleTime: 0,
    queryFn: async ({ signal }) => { const { data, error } = await (supabase as any).rpc('moderator_content_detail_v1', { p_kind: kind, p_id: id }).abortSignal(signal); if (error) throw error; return data as ModeratorContent | null; } });
}
export function useModeratorMutation(onDone?: (value: any) => void) {
  const client = useQueryClient(), { toast } = useToast(), language = useUserStore(state => state.language);
  return useMutation({
    mutationFn: async ({ rpc, args }: { rpc: string; args: Record<string, unknown> }) => { const { data, error } = await (supabase as any).rpc(rpc, args); if (error) throw error; return data; },
    onSuccess: data => {
      void client.invalidateQueries({ predicate: query => /^(moderator-|my-moderation|my-active-block|community-ad|community-feed|group-posts|single-post|post-comments|stories)/.test(String(query.queryKey[0])) });
      toast({ title: moderatorText('saved', language) }); onDone?.(data);
    },
    onError: error => toast({ title: moderatorError(error, language), variant: 'destructive' }),
  });
}
