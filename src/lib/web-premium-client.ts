import { supabase } from '@/integrations/supabase/client';

/** anacan.az subscription cabinet (cards, cancel, resume) for Premium bought on the website (Epoint). */
export const WEB_PREMIUM_CABINET_URL = 'https://anacan.az/website/premium/hesab/index.html';

export interface WebPremiumState {
  active: boolean;
  /** 'web_subscription' (renewing Epoint), 'web_pass', 'store', 'promotional' or null. */
  source: string | null;
  renews: boolean;
  expiresAt: string | null;
  plan: string | null;
}

const TIMEOUT_MS = 10_000;
interface WebPremiumReply { ok?: boolean; error?: string; premium?: { active?: unknown; source?: unknown; renews?: unknown; expires_at?: unknown; plan?: unknown } }
type CallResult = { data: WebPremiumReply | null; error: unknown };
async function call(action: 'status' | 'cancel' | 'resume'): Promise<CallResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      supabase.functions.invoke('web-premium', { body: { action } }) as Promise<CallResult>,
      new Promise<CallResult>(resolve => { timer = setTimeout(() => resolve({ data: null, error: new Error('timeout') }), TIMEOUT_MS); }),
    ]);
  } catch (error) {
    return { data: null, error };
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Current Premium source as the web-premium function sees it (signed-in user session). null when unreadable. */
export async function fetchWebPremiumState(): Promise<WebPremiumState | null> {
  const { data, error } = await call('status');
  const premium = !error && data?.ok === true ? data.premium : null;
  if (!premium || typeof premium.active !== 'boolean') return null;
  return { active: premium.active, source: typeof premium.source === 'string' ? premium.source : null, renews: premium.renews === true,
    expiresAt: typeof premium.expires_at === 'string' ? premium.expires_at : null, plan: typeof premium.plan === 'string' ? premium.plan : null };
}

/**
 * Stop ('cancel') or restart ('resume') renewals of the anacan.az subscription. Premium stays until the paid
 * period ends. 'refused' = the server does not accept this action from the app; the caller opens the cabinet.
 */
export async function setWebPremiumRenewal(action: 'cancel' | 'resume'): Promise<'ok' | 'refused' | 'failed'> {
  const { data, error } = await call(action);
  if (!error && data?.ok === true) return 'ok';
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  if (status === 403 || data?.error === 'origin_not_allowed') return 'refused';
  return 'failed';
}

export function openWebPremiumCabinet(): void {
  window.open(WEB_PREMIUM_CABINET_URL, '_system');
}
