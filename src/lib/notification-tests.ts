// Admin "test send" for the daily / cycle / vitamin notification jobs.
//
// On Google these senders run only as scheduled job images, not as callable functions. An admin
// queues a test with request_notification_test(kind); the 5-minute notification run executes the
// real job in single-user test mode for that admin (never a broadcast) and stores the job's counts
// in notification_test_requests.result.
import { supabase } from '@/integrations/supabase/client';

export type NotificationTestKind = 'daily' | 'flow' | 'vitamin';
export type NotificationTestStatus = 'pending' | 'running' | 'done' | 'error' | 'expired';

export interface NotificationTestResult {
  job?: string;
  exitCode?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  eligible?: number | null;
  reasons?: Record<string, number> | null;
  error?: string | null;
  log?: string;
}

export interface NotificationTestRow {
  id: string;
  kind: NotificationTestKind;
  status: NotificationTestStatus;
  result: NotificationTestResult | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

// The table and RPC are newer than the generated types.
interface UntypedClient {
  rpc(fn: 'request_notification_test', args: { p_kind: NotificationTestKind }): PromiseLike<{ data: string | null; error: { message: string } | null }>;
  from(table: 'notification_test_requests'): {
    select(cols: string): { eq(col: 'id', id: string): { maybeSingle(): PromiseLike<{ data: NotificationTestRow | null; error: { message: string } | null }> } };
  };
}
const db = supabase as unknown as UntypedClient;

/** Legacy function names used by the admin cards → test kind. */
export const KIND_BY_FUNCTION: Record<string, NotificationTestKind> = {
  'send-daily-notifications': 'daily',
  'send-flow-reminders': 'flow',
  'send-vitamin-reminders': 'vitamin',
};

export const isFinished = (status: NotificationTestStatus) => status === 'done' || status === 'error' || status === 'expired';

export async function requestNotificationTest(kind: NotificationTestKind): Promise<string> {
  const { data, error } = await db.rpc('request_notification_test', { p_kind: kind });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('NOTIFICATION_TEST_NO_ID');
  return data;
}

/**
 * Polls one request until the job has run it (the run starts every 5 minutes) or the wait
 * times out; calls onUpdate on every status change.
 */
export async function waitForNotificationTest(
  id: string,
  { onUpdate, intervalMs = 5000, timeoutMs = 7 * 60_000, signal }: { onUpdate?: (row: NotificationTestRow) => void; intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<NotificationTestRow | null> {
  const deadline = Date.now() + timeoutMs;
  let last: NotificationTestStatus | null = null;
  while (!signal?.aborted) {
    const { data, error } = await db.from('notification_test_requests').select('id, kind, status, result, created_at, started_at, finished_at').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (data && data.status !== last) { last = data.status; onUpdate?.(data); }
    if (data && isFinished(data.status)) return data;
    if (Date.now() + intervalMs > deadline) return data;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

/** One request + wait, for buttons: resolves with the finished row (or the last seen one). */
export async function runNotificationTest(kind: NotificationTestKind, onUpdate?: (row: NotificationTestRow) => void) {
  const id = await requestNotificationTest(kind);
  return waitForNotificationTest(id, { onUpdate });
}

/** Short Azerbaijani status line for admin toasts. */
export function describeNotificationTest(row: NotificationTestRow | null): { tone: 'success' | 'warning' | 'error' | 'info'; text: string } {
  if (!row) return { tone: 'warning', text: 'Test nəticəsi gözlənilən vaxtda gəlmədi. Bir az sonra yenidən yoxlayın.' };
  if (row.status === 'pending') return { tone: 'info', text: 'Növbədədir: test 5 dəqiqə ərzində işə düşəcək.' };
  if (row.status === 'running') return { tone: 'info', text: 'Test işləyir…' };
  if (row.status === 'expired') return { tone: 'warning', text: 'Test 30 dəqiqə ərzində işə düşmədi və ləğv olundu.' };
  const r = row.result || {};
  if (row.status === 'error') return { tone: 'error', text: `Test xətası: ${r.error || 'naməlum'}` };
  const reasons = r.reasons && Object.keys(r.reasons).length ? ` (${Object.entries(r.reasons).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
  return (r.sent ?? 0) > 0
    ? { tone: 'success', text: `${r.sent} push sizin cihazınıza göndərildi.` }
    : { tone: 'warning', text: `0 push göndərildi${reasons}.` };
}
