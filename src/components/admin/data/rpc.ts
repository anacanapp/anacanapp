import { supabase } from '@/integrations/supabase/client';

/** Sentinel returned when an optional admin RPC is not deployed yet (migration not applied). */
export const RPC_MISSING = Symbol('admin-rpc-missing');

interface RpcError { code?: string; message?: string; details?: string; hint?: string; status?: number }
type RpcBuilder = PromiseLike<{ data: unknown; error: RpcError | null; status?: number }> & { abortSignal?: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: RpcError | null; status?: number }> };

/** True for "function does not exist" answers from PostgREST/Postgres or a gateway 404. */
export const isMissingRpc = (error: RpcError | null | undefined, status?: number) =>
  !!error && (error.code === 'PGRST202' || error.code === '42883' || status === 404 || /could not find the function|does not exist/i.test(error.message ?? ''));

/** Thrown errors carry a short code so the UI can show a precise message. */
export class AdminDataError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}

/**
 * Calls an optional read-only admin RPC. Resolves `RPC_MISSING` when the function is not deployed so the
 * caller can run its fallback query; throws `AdminDataError` for real errors (permission, timeout, …).
 */
export async function optionalRpc<T>(name: string, args?: Record<string, unknown>, timeoutMs = 15_000): Promise<T | typeof RPC_MISSING> {
  const builder = (supabase.rpc as unknown as (fn: string, params?: Record<string, unknown>) => RpcBuilder)(name, args);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const request = controller && typeof builder.abortSignal === 'function' ? builder.abortSignal(controller.signal) : builder;
    const { data, error, status } = await request;
    if (error) {
      if (isMissingRpc(error, status)) return RPC_MISSING;
      throw new AdminDataError(error.message || 'admin_unavailable', error.code);
    }
    return data as T;
  } finally { if (timer) clearTimeout(timer); }
}

/** Throws on PostgREST errors; returns data/count. */
export function unwrap<T>(result: { data: T | null; error: { message?: string; code?: string } | null; count?: number | null }): { data: T; count: number } {
  if (result.error) throw new AdminDataError(result.error.message || 'admin_unavailable', result.error.code);
  return { data: (result.data ?? ([] as unknown as T)), count: result.count ?? 0 };
}

/** Escape user text for a PostgREST `or=(…ilike…)` filter. */
export const ilikeTerm = (text: string) => `*${text.trim().replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ')}*`;

/** Shared react-query options for admin reads: 60 s fresh, no retry storm, cached across revisits. */
export const ADMIN_QUERY = { staleTime: 60_000, gcTime: 10 * 60_000, retry: 1, refetchOnWindowFocus: false } as const;
