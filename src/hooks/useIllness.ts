import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  addEntry, closeEpisode, deleteEntry, deleteEpisode, listEntries, listEpisodes, startEpisode,
  type IllnessKind, type NewIllnessEntry } from
'@/lib/illness';

/** Illness journal of the family (mother + linked partner), Duzelis75. */
export function useIllnessEpisodes(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['illness-episodes', user?.id],
    queryFn: listEpisodes,
    enabled: !!user?.id && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true
  });
}

export function useIllnessEntries(episodeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['illness-entries', user?.id, episodeId],
    queryFn: () => listEntries(episodeId!),
    enabled: !!user?.id && !!episodeId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000
  });
}

export function useIllnessActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['illness-episodes'] });
    void qc.invalidateQueries({ queryKey: ['illness-entries'] });
  };
  return {
    start: useMutation({ mutationFn: (v: { kind: IllnessKind; childId: string | null; childName: string | null }) => startEpisode(v.kind, v.childId, v.childName), onSuccess: refresh }),
    close: useMutation({ mutationFn: (v: { id: string; ended: boolean }) => closeEpisode(v.id, v.ended), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: string) => deleteEpisode(id), onSuccess: refresh }),
    add: useMutation({ mutationFn: (v: { episodeId: string; entry: NewIllnessEntry }) => addEntry(v.episodeId, v.entry), onSuccess: refresh }),
    removeEntry: useMutation({ mutationFn: (id: string) => deleteEntry(id), onSuccess: refresh })
  };
}
