// Shared helpers for notification run + send logging.
// Used by send-daily-notifications, send-flow-reminders, send-vitamin-reminders.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type RunStatus = 'running' | 'success' | 'error';

export async function startRunLog(
  supabase: SupabaseClient,
  function_name: string,
  triggered_by: string,
  baku_time?: string,
  active_slot?: string | null,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('notification_run_log')
      .insert({
        function_name,
        triggered_by,
        status: 'running',
        baku_time: baku_time ?? null,
        active_slot: active_slot ?? null,
      })
      .select('id')
      .single();
    if (error) {
      console.error('[notif-logging] startRunLog error:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error('[notif-logging] startRunLog ex:', e);
    return null;
  }
}

export async function finishRunLog(
  supabase: SupabaseClient,
  runId: string | null,
  patch: {
    status: RunStatus;
    sent_count?: number;
    failed_count?: number;
    skipped_count?: number;
    eligible_count?: number;
    reasons?: Record<string, number>;
    error_message?: string;
    payload?: unknown;
  },
) {
  if (!runId) return;
  try {
    await supabase.from('notification_run_log').update({
      ...patch,
      ended_at: new Date().toISOString(),
    }).eq('id', runId);
  } catch (e) {
    console.error('[notif-logging] finishRunLog ex:', e);
  }
}

export async function logFailedSend(
  supabase: SupabaseClient,
  args: {
    user_id: string;
    notification_type: string;
    source_type?: string | null;
    source_notification_id?: string | null;
    title: string;
    body: string;
    reason: string;
    error_code?: string | null;
  },
) {
  try {
    await supabase.from('notification_send_log').insert({
      user_id: args.user_id,
      title: args.title,
      body: args.body,
      status: 'failed',
      notification_type: args.notification_type,
      source_type: args.source_type ?? null,
      source_notification_id: args.source_notification_id ?? null,
      reason: args.reason,
      error_code: args.error_code ?? null,
    });
  } catch (e) {
    console.error('[notif-logging] logFailedSend ex:', e);
  }
}

export function bumpReason(reasons: Record<string, number>, key: string) {
  reasons[key] = (reasons[key] ?? 0) + 1;
}
