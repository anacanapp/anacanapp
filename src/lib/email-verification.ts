import { supabase } from '@/integrations/supabase/client';

/**
 * E-mail verification for new e-mail/password accounts (Duzelis74, function email-verification).
 * The server decides whether a code is required; any failure to ask is treated as "not required" so a network
 * problem never locks a person out of the app.
 */
/** `answered` is false when the server could not be asked (then nothing should be remembered). */
export interface EmailVerificationState { required: boolean; verified: boolean; email: string | null; answered: boolean }

export async function fetchEmailVerificationState(): Promise<EmailVerificationState> {
  try {
    const { data, error } = await (supabase.rpc as any)('email_verification_state_v1');
    if (error || !data || typeof data !== 'object') return { required: false, verified: false, email: null, answered: false };
    return { required: data.required === true, verified: data.verified === true, email: typeof data.email === 'string' ? data.email : null, answered: true };
  } catch {
    return { required: false, verified: false, email: null, answered: false };
  }
}

export type VerificationError = 'wrong_code' | 'expired' | 'too_many' | 'rate_limited' | 'send_failed';
export interface VerificationResult { ok: boolean; error?: VerificationError; retryIn?: number; premium?: boolean }

async function call(body: Record<string, unknown>): Promise<VerificationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('email-verification', { body });
    let payload: any = data;
    if (error) {
      try { payload = await (error as any).context?.json?.(); } catch { payload = null; }
    }
    if (payload?.verified === true || payload?.sent === true) return { ok: true, retryIn: payload.retry_in, premium: payload.premium === true };
    const known: VerificationError[] = ['wrong_code', 'expired', 'too_many', 'rate_limited'];
    return { ok: false, error: known.includes(payload?.error) ? payload.error : 'send_failed', retryIn: payload?.retry_in };
  } catch {
    return { ok: false, error: 'send_failed' };
  }
}

export const sendVerificationCode = (language: string) => call({ action: 'send', language });
export const confirmVerificationCode = (code: string, language: string) => call({ action: 'confirm', code, language });
