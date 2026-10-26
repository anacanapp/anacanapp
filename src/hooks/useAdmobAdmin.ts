import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { fetchAdmobOverview, fetchSourceAdmobSnapshot, restoreAdmobConfiguration, saveAdmobConfiguration,
  setSourceAdmobEmergency, synchronizeSourceAdmob } from '@/lib/ads/api';
import { mirrorStatus } from '@/lib/ads/continuity';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import type { AdsConfiguration } from '@/lib/ads/config';

export function useAdmobAdmin() {
  const { user, isAdmin } = useAuth();
  const client = useQueryClient();
  const backend = getBackendConfig();
  const query = useQuery({ queryKey: ['admin-admob', backend.url, user?.id], queryFn: fetchAdmobOverview,
    enabled: !!user && isAdmin && backend.azure, retry: false, staleTime: 0, refetchOnWindowFocus: false });
  const revision = query.data?.configuration.revision;
  const mirror = useQuery({ queryKey: ['admin-admob-mirror', backend.url, user?.id, revision],
    queryFn: () => fetchSourceAdmobSnapshot(revision), enabled: !!user && isAdmin && backend.azure && !!revision,
    retry: false, staleTime: 0, refetchInterval: 30_000 });
  const data = useMemo(() => query.data ? { ...query.data,
    continuity: mirrorStatus(mirror.isError ? null : mirror.data ?? null, query.data.configuration) } : undefined,
  [query.data, mirror.data, mirror.isError]);
  const updated = async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['admin-admob'] }), client.invalidateQueries({ queryKey: ['admob-configuration'] }),
      client.invalidateQueries({ queryKey: ['admin-admob-mirror'] })]);
  };
  const save = useMutation({ mutationFn: (config: AdsConfiguration) => saveAdmobConfiguration(config), onSuccess: updated });
  const restore = useMutation({ mutationFn: ({ revision, expected }: { revision: number; expected: number }) => restoreAdmobConfiguration(revision, expected), onSuccess: updated });
  const sync = useMutation({ mutationFn: (expected: number) => synchronizeSourceAdmob(expected), onSettled: () => {
    void client.invalidateQueries({ queryKey: ['admin-admob-mirror'] });
  } });
  return { ...query, data, save, restore, sync, mirrorLoading: mirror.isLoading };
}

export function useSourceAdmobControl() {
  const { user, isAdmin } = useAuth(), backend = getBackendConfig(), client = useQueryClient();
  const queryKey = ['admin-source-admob', backend.url, user?.id];
  const query = useQuery({ queryKey, queryFn: () => fetchSourceAdmobSnapshot(),
    enabled: !!user && isAdmin && !backend.azure, retry: false, staleTime: 0, refetchInterval: 30_000 });
  const emergency = useMutation({ mutationFn: setSourceAdmobEmergency,
    onSuccess: snapshot => { client.setQueryData(queryKey, snapshot); },
    onSettled: async () => {
      await Promise.all([client.invalidateQueries({ queryKey }), client.invalidateQueries({ queryKey: ['admob-configuration'] })]);
    } });
  return { ...query, emergency };
}
