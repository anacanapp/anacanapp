import { useCallback } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBackendConfig } from '@/integrations/supabase/backend-config';
import { useAuth } from '@/hooks/useAuth';
import { parseHistory, parseWallet, QC_DISABLED, type QcHistoryItem, type QcWallet, type QcWalletResult } from '@/lib/qaygicash';

// The QayğıCash RPCs are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const QC_WALLET_ROOT = 'qaygicash-wallet';
export const QC_HISTORY_ROOT = 'qaygicash-history';

/** Refetches the wallet and history everywhere (after an order, a refund screen, Premium with bonus). */
export function invalidateQaygiCash(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ predicate: ({ queryKey }) => queryKey[0] === QC_WALLET_ROOT || queryKey[0] === QC_HISTORY_ROOT });
}

/**
 * The person's bonus wallet. `enabled` is false when the programme is not available
 * (signed out, another country, control group, or the server does not have it): show nothing then.
 */
export function useQaygiCashWallet(): { wallet: QcWallet | null; enabled: boolean; isLoading: boolean; isError: boolean; refetch: () => void } {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const query = useQuery({
    queryKey: [QC_WALLET_ROOT, getBackendConfig().url, uid],
    enabled: !!uid,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async (): Promise<QcWalletResult> => {
      const { data, error } = await db.rpc('qaygicash_wallet_v1');
      if (error) {
        // Not deployed on this backend yet → the programme simply stays hidden.
        if (/qaygicash_wallet_v1|PGRST202|42883/.test(`${error.code ?? ''} ${error.message ?? ''}`)) return QC_DISABLED;
        throw error;
      }
      return parseWallet(data);
    },
  });
  const data = uid ? query.data : undefined;
  const wallet = data?.enabled ? data : null;
  return { wallet, enabled: !!wallet, isLoading: !!uid && query.isLoading, isError: query.isError, refetch: () => { void query.refetch(); } };
}

export function useQaygiCashHistory(enabled = true): { items: QcHistoryItem[]; isLoading: boolean; isError: boolean } {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const query = useQuery({
    queryKey: [QC_HISTORY_ROOT, getBackendConfig().url, uid],
    enabled: !!uid && enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<QcHistoryItem[]> => {
      const { data, error } = await db.rpc('qaygicash_history_v1', { p_limit: 60 });
      if (error) throw error;
      return parseHistory(data);
    },
  });
  return { items: query.data ?? [], isLoading: query.isLoading && !!uid && enabled, isError: query.isError };
}

/** Wallet + history for the wallet screen, with a refresh for after orders. */
export function useQaygiCash(options: { history?: boolean } = {}) {
  const client = useQueryClient();
  const wallet = useQaygiCashWallet();
  const history = useQaygiCashHistory(wallet.enabled && options.history !== false);
  const refresh = useCallback(() => invalidateQaygiCash(client), [client]);
  return { ...wallet, history: history.items, historyLoading: history.isLoading, historyError: history.isError, refresh };
}
