// "Someone else pays for Premium" — the woman creates a shareable link; a spouse or family member pays
// for her Premium on anacan.az/p/<token> (Dodo Payments). On payment her account gets Premium (the
// webhook grants it to the link's requester), and a linked partner shares it via household entitlement.
// The payer never gets app access or sees any personal/health data.
import { supabase } from '@/integrations/supabase/client';

export type SponsorKind = 'partner' | 'gift';
export type SponsorRelation = 'spouse' | 'mother' | 'father' | 'sibling' | 'other';

// The pay page is served statically from the website root at /website/p/ and reads ?t=<token>.
export const SPONSOR_BASE = 'https://anacan.az/website/p/?t=';
export const sponsorUrl = (token: string) => `${SPONSOR_BASE}${token}`;

export interface SponsorLink { token: string; url: string; expiresAt: string; kind: SponsorKind }

/** Create (or reuse) a sponsor link for the current user. */
export async function createSponsorLink(kind: SponsorKind, relation: SponsorRelation | null, language: string): Promise<SponsorLink> {
  const { data, error } = await (supabase.rpc as any)('create_premium_sponsor_link_v1', {
    p_kind: kind, p_relation: relation, p_language: language,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.token) throw new Error(error?.message || 'sponsor_link_failed');
  return { token: row.token, url: sponsorUrl(row.token), expiresAt: row.expires_at, kind: row.kind };
}
