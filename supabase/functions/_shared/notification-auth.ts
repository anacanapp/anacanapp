import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireCronSecret } from './auth.ts';

const SOURCE = 'https://tntbjulojatnrqmylorp.supabase.co';
const FUNCTIONS = ['send-daily-notifications', 'send-flow-reminders', 'send-vitamin-reminders', 'expire-partner-links'];

/** Existing Source pg_cron commands retain their exact key across Cloud's key
 * environment changes. SQL verifies its reviewed digest; JWT claims never grant
 * cron access. Only the service role may invoke that verification RPC. */
export async function requireNotificationCron(req: Request, functionName: string): Promise<Response | null> {
  const denied = requireCronSecret(req);
  if (!denied) return null;
  if (Deno.env.get('SUPABASE_URL') !== SOURCE || !FUNCTIONS.includes(functionName)) return denied;
  const bearer = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  const token = bearer || req.headers.get('apikey')?.trim();
  if (!token || token.length > 4096) return denied;
  try {
    const client = createClient(SOURCE, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const result = await client.rpc('verify_source_notification_cron_v2', { p_token: token, p_function: functionName })
      .abortSignal(AbortSignal.timeout(5000));
    return !result.error && result.data === true ? null : denied;
  } catch { return denied; }
}
