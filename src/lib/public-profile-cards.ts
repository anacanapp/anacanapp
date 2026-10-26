import { supabase } from "@/integrations/supabase/client";

export type PublicProfileCard = {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  badge_type: string | null;
  life_stage?: string | null;
  is_premium?: boolean | null;
  is_verified?: boolean | null;
  verified_until?: string | null;
  created_at?: string;
  can_share_links?: boolean;
};

// Older deployed schemas omit these verification columns. Other lookup
// failures must not become successful, cacheable responses with missing names.
const CORE_FIELDS = "user_id, name, avatar_url, badge_type, life_stage, is_premium, created_at";
const SELECT_FIELDS = `${CORE_FIELDS}, is_verified, verified_until`;

async function readEffectiveCards(userIds: string[]): Promise<PublicProfileCard[] | null> {
  const { data, error } = await (supabase as any).rpc('get_public_community_profiles_v2', { p_user_ids: userIds });
  if (error?.code === 'PGRST202') return null;
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('COMMUNITY_PROFILE_RESPONSE_INVALID');
  return data;
}

function isMissingVerificationColumn(error: { code?: string; message?: string; details?: string }) {
  return (error.code === "42703" || error.code === "PGRST204") &&
    /\b(is_verified|verified_until)\b/i.test(`${error.message ?? ""} ${error.details ?? ""}`);
}

export async function getPublicProfileCard(userId: string): Promise<PublicProfileCard | null> {
  if (!userId) return null;

  const effective = await readEffectiveCards([userId]);
  if (effective !== null) return effective.find(card => card.user_id === userId) ?? null;

  let { data, error } = await (supabase as any)
    .from("public_profile_cards")
    .select(SELECT_FIELDS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error && isMissingVerificationColumn(error)) {
    const fallback = await (supabase as any)
      .from("public_profile_cards")
      .select(CORE_FIELDS)
      .eq("user_id", userId)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("Public profile fetch error:", error.code || "UNKNOWN");
    throw error;
  }

  return (data ?? null) as PublicProfileCard | null;
}

export async function getPublicProfileCards(userIds: string[]): Promise<Record<string, PublicProfileCard>> {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  if (uniqueIds.length > 100) {
    const parts: Record<string, PublicProfileCard>[] = [];
    for (let offset = 0; offset < uniqueIds.length; offset += 100) parts.push(await getPublicProfileCards(uniqueIds.slice(offset, offset + 100)));
    return Object.assign({}, ...parts);
  }
  const effective = await readEffectiveCards(uniqueIds);
  if (effective !== null) return Object.fromEntries(effective.map(card => [card.user_id, card]));

  let { data, error } = await (supabase as any)
    .from("public_profile_cards")
    .select(SELECT_FIELDS)
    .in("user_id", uniqueIds);

  if (error && isMissingVerificationColumn(error)) {
    const fallback = await (supabase as any)
      .from("public_profile_cards")
      .select(CORE_FIELDS)
      .in("user_id", uniqueIds);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("Public profiles bulk fetch error:", error.code || "UNKNOWN");
    throw error;
  }

  const map: Record<string, PublicProfileCard> = {};
  for (const row of (data || []) as PublicProfileCard[]) {
    map[row.user_id] = row;
  }
  return map;
}

export async function searchPublicProfileCards(term: string, limit = 5): Promise<PublicProfileCard[]> {
  const t = term?.trim();
  if (!t) return [];

  const { data, error } = await (supabase as any)
    .from("public_profile_cards")
    .select("user_id, name, avatar_url")
    .ilike("name", `%${t}%`)
    .limit(limit);

  if (error) {
    console.error("Public profile search error:", error);
    return [];
  }

  return (data || []) as PublicProfileCard[];
}
