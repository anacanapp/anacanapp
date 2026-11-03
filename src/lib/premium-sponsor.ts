// "Someone else pays for Premium" — the woman creates a shareable link; a spouse or family member pays
// for her Premium on anacan.az/p/<token> (Dodo Payments). On payment her account gets Premium (the
// webhook grants it to the link's requester), and a linked partner shares it via household entitlement.
// The payer never gets app access or sees any personal/health data.
import { supabase } from '@/integrations/supabase/client';

export type SponsorKind = 'partner' | 'gift';
export type SponsorRelation = 'spouse' | 'mother' | 'father' | 'sibling' | 'other';

// The pay page opens in the requester's own language: anacan.az/<lang>/p/?t=<token>.
const SPONSOR_LANGS = ['az', 'en', 'tr', 'ru', 'kk', 'uz', 'ka', 'de', 'ar', 'zh', 'id', 'fr', 'es', 'pt', 'vi', 'hi', 'ja', 'ko', 'pl', 'nl', 'sv', 'ky', 'et'];
export const sponsorLang = (language: string) => (SPONSOR_LANGS.includes(language) ? language : 'az');
export const sponsorUrl = (token: string, language = 'az') => `https://anacan.az/${sponsorLang(language)}/p/?t=${token}`;

export interface SponsorLink { token: string; url: string; expiresAt: string; kind: SponsorKind }

/** Create (or reuse) a sponsor link for the current user. */
export async function createSponsorLink(kind: SponsorKind, relation: SponsorRelation | null, language: string): Promise<SponsorLink> {
  const { data, error } = await (supabase.rpc as any)('create_premium_sponsor_link_v1', {
    p_kind: kind, p_relation: relation, p_language: language,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row?.token) throw new Error(error?.message || 'sponsor_link_failed');
  return { token: row.token, url: sponsorUrl(row.token, language), expiresAt: row.expires_at, kind: row.kind };
}
