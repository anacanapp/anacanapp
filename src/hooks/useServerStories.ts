import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseServerStories, readStoriesCache, writeStoriesCache, type ServerStories } from '@/lib/server-stories';

/**
 * Stories added from Admin → Story-lər (get_app_stories_v1), validated and merged with the bundled ones by the caller.
 * The last good answer is kept on the device: offline or on error the cached list is used, and an empty cache simply
 * means "bundled stories only".
 */
export function useServerStories(language: string, enabled: boolean): ServerStories | null {
  const { data } = useQuery({
    queryKey: ['app-stories', language],
    enabled,
    select: parseServerStories,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    initialData: () => readStoriesCache(language),
    initialDataUpdatedAt: 0,
    queryFn: async (): Promise<unknown[]> => {
      const { data: rows, error } = await supabase.rpc('get_app_stories_v1' as never, { p_language: language } as never);
      if (error) {
        const cached = readStoriesCache(language);
        if (cached) return cached;
        throw error;
      }
      const list = Array.isArray(rows) ? (rows as unknown[]) : [];
      writeStoriesCache(language, list);
      return list;
    },
  });
  return enabled && data ? data : null;
}
