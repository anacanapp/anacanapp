import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { parseRecap, type RecapData, type RecapResult } from '@/lib/recap/types';

// anacan_recap_v1 is newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const RECAP_YEAR = 2026;
export const RECAP_ROOT = 'anacan-recap';

/**
 * The person's year in review. `recap` is set only when the server says `available: true`
 * (admins any time; everyone from the configured start date) — entry points render nothing otherwise.
 */
export function useRecap(year = RECAP_YEAR): { recap: RecapData | null; result: RecapResult | null; isLoading: boolean; isError: boolean } {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const query = useQuery({
    queryKey: [RECAP_ROOT, getBackendConfig().url, uid, year],
    enabled: !!uid,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async (): Promise<RecapResult> => {
      const { data, error } = await db.rpc('anacan_recap_v1', { p_year: year });
      if (error) {
        // Not deployed on this backend → simply hidden.
        if (/anacan_recap_v1|PGRST202|42883/.test(`${error.code ?? ''} ${error.message ?? ''}`)) return { available: false, reason: 'missing', opens_at: null };
        throw error;
      }
      return parseRecap(data);
    },
  });
  const result = uid ? query.data ?? null : null;
  return { recap: result?.available ? result : null, result, isLoading: !!uid && query.isLoading, isError: query.isError };
}
