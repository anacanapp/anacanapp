import { supabase } from '@/integrations/supabase/client';
import { tr } from '@/lib/tr';
import { isAzurePairingBackend } from '@/integrations/supabase/backend-config';

export const isAzurePartnerPairingEnabled = isAzurePairingBackend;

const secureCodePattern = /^ANACAN-(?:[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}|[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8})$/;

export class PartnerLinkError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'PartnerLinkError';
  }
}

export function normalizeSecurePartnerCode(value: string): string {
  if (typeof value !== 'string' || value.length > 64) {
    throw new PartnerLinkError('INVALID_PARTNER_CODE');
  }
  const code = value.trim().toUpperCase();
  if (/^ANACAN-[A-Z0-9]{4}$/.test(code)) {
    throw new PartnerLinkError('PARTNER_CODE_EXPIRED');
  }
  if (!secureCodePattern.test(code)) throw new PartnerLinkError('INVALID_PARTNER_CODE');
  return code;
}

export async function linkPartnerByCode(value: string): Promise<void> {
  if (!isAzurePartnerPairingEnabled()) throw new PartnerLinkError('PAIRING_UNAVAILABLE');
  const code = normalizeSecurePartnerCode(value);
  const { data, error } = await supabase.rpc('link_partner_by_code', { p_partner_code: code });
  if (error) throw error;

  // Expected rejections are returned, not raised, so the server's attempt counter commits.
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.ok !== true) {
    const reason = data && typeof data === 'object' && !Array.isArray(data) && typeof data.error === 'string'
      ? data.error : 'PAIRING_FAILED';
    throw new PartnerLinkError(reason);
  }
}

export async function getPartnerCodeForSharing(currentCode: string): Promise<string> {
  if (!isAzurePartnerPairingEnabled()) return currentCode;
  const { data, error } = await supabase.rpc('ensure_secure_partner_code');
  if (error) throw error;
  // Never share the cached invitation if rotation failed or the server is not migrated.
  if (typeof data !== 'string' || !secureCodePattern.test(data)) {
    throw new PartnerLinkError('PAIRING_UNAVAILABLE');
  }
  return data;
}

export function getPartnerLinkErrorMessage(error: unknown): string {
  const value = error as { code?: string; message?: string } | null;
  const code = value?.code === 'P0001' ? value.message : value?.code;
  switch (code) {
    case 'PARTNER_CODE_EXPIRED':
      return tr('partner_pairing_old_invite', 'This invitation is out of date. Ask your partner to share a new code from their profile.');
    case 'INVALID_PARTNER_CODE':
      return tr('partner_pairing_invalid_invite', 'Check the invitation code or ask your partner to share a new one.');
    case 'PAIRING_SELF_LINK':
      return tr('partner_pairing_self', 'You cannot link your account to itself. Enter your partner\'s invitation code.');
    case 'PAIRING_CONFLICT':
      return tr('partner_pairing_conflict', 'An account already has a partner link. Unlink the existing relationship first. Inconsistent links require support.');
    case 'PAIRING_RATE_LIMITED':
      return tr('partner_pairing_rate_limit', 'Too many pairing attempts. Please wait 15 minutes before trying again.');
    case 'NOT_AUTHENTICATED':
      return tr('partner_pairing_sign_in', 'Confirm your email if required, then sign in and retry pairing.');
    case 'PAIRING_ACCOUNT_CHANGED':
      return tr('partner_pairing_account_changed', 'Sign in to the account you registered before retrying this invitation.');
    case 'PROFILE_NOT_READY':
      return tr('partner_pairing_profile_pending', 'Your profile is not ready yet. Retry pairing shortly; do not register again.');
    case 'PAIRING_RETRY':
    case '40001':
      return tr('partner_pairing_changed', 'The partner link changed during this request. Please try again.');
    case 'PAIRING_UNAVAILABLE':
    case '42501':
    case 'PGRST202':
      return tr('partner_pairing_unavailable', 'Secure partner linking is not available right now. Please try again later.');
    default:
      return tr('partner_pairing_failed', 'Partner linking failed. Check your connection and retry.');
  }
}
