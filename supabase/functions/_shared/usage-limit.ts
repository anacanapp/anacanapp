// ============================================================
// usage-limit.ts — Server-side pulsuz-tier gündəlik limit yoxlaması.
//
// NİYƏ LAZIMDIR (audit tapıntısı): əvvəllər BÜTÜN gündəlik limit yoxlaması
// (ai_chat, cry_translator, poop_scanner, fairy_tale, horoscope, baby_insight)
// YALNIZ klient kodunda idi (useSubscription.ts checkAndConsume) — edge
// function-ların heç biri bunu server-side təkrar yoxlamırdı. İstənilən
// istifadəçi öz JWT-si ilə edge function URL-ini birbaşa çağıraraq
// (curl/Postman) limitsiz sayda bahalı Gemini/Vertex/Claude/Azure OpenAI
// sorğusu göndərə bilərdi. Bu modul HƏR bir AI edge function-un paid API-ni
// çağırmazdan ƏVVƏL çağırmalı olduğu tək, mərkəzi server-side qapıdır.
//
// Klient-tərəfi useSubscription.ts-dəki checkAndConsume ilə EYNİ məntiq və
// EYNİ cədvəllər (usage_tracking, app_settings.free_limits, subscriptions,
// profiles) istifadə olunur ki, iki tərəf arasında UYĞUNSUZLUQ olmasın (məs.
// istifadəçi UI-da "3/3 istifadə olunub" görüb, server yenə icazə versin).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

export type DailyFeature =
  | 'ai_chat' | 'cry_translator' | 'poop_scanner' | 'fairy_tale' | 'horoscope' | 'baby_insight';

const DAILY_LIMIT_KEYS: Record<DailyFeature, string> = {
  ai_chat: 'ai_chat_count_per_day',
  cry_translator: 'cry_translator_count_per_day',
  poop_scanner: 'poop_scanner_count_per_day',
  fairy_tale: 'fairy_tale_count_per_day',
  horoscope: 'horoscope_count_per_day',
  baby_insight: 'baby_insight_count_per_day',
};

const DEFAULT_LIMITS: Record<DailyFeature, number> = {
  ai_chat: 10,
  cry_translator: 3,
  poop_scanner: 3,
  fairy_tale: 3,
  horoscope: 2,
  baby_insight: 2,
};

type SupabaseAdmin = ReturnType<typeof createClient>;

function adminClient(): SupabaseAdmin {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function isPremiumUser(admin: SupabaseAdmin, userId: string): Promise<boolean> {
  const access = await admin.rpc('get_premium_access_v1', { p_user_id: userId });
  if (!access.error && access.data?.protocol === 'anacan-premium-access-v1') return access.data.own?.active === true || access.data.household?.active === true;
  if (access.error?.code !== 'PGRST202') return false;
  const now = new Date();

  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan_type, status, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  const subOk = !!sub &&
    (sub.plan_type === 'premium' || sub.plan_type === 'premium_plus') &&
    (sub.status === 'active' || sub.status === 'cancelled') &&
    (!sub.expires_at || new Date(sub.expires_at) > now);
  if (sub) return subOk;

  const { data: profile } = await admin
    .from('profiles')
    .select('is_premium, premium_until')
    .eq('user_id', userId)
    .maybeSingle();

  return !!profile?.is_premium && (!profile.premium_until || new Date(profile.premium_until) > now);
}

/**
 * Gündəlik limiti yoxla VƏ istifadə et (icazə varsa sayğacı bir vahid artırır).
 * Premium istifadəçilər üçün həmişə {allowed:true}.
 * Şəbəkə/DB xətasında "best effort" olaraq icazə verilir (istifadəçini
 * bloklamamaq üçün) — eyni fəlsəfə useSubscription.ts-dəki client versiyası ilə.
 */
export async function checkAndConsumeServerSide(
  userId: string,
  feature: DailyFeature
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const admin = adminClient();

  try {
    if (await isPremiumUser(admin, userId)) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    // Konfiqurasiya edilə bilən limit (admin panelindən) — tapılmasa fallback.
    let limit = DEFAULT_LIMITS[feature];
    try {
      const { data: setting } = await admin
        .from('app_settings')
        .select('value')
        .eq('key', 'free_limits')
        .maybeSingle();
      const configured = (setting?.value as any)?.[DAILY_LIMIT_KEYS[feature]];
      if (typeof configured === 'number' && configured >= 0) limit = configured;
    } catch { /* fallback dəyəri istifadə olunur */ }

    const today = new Date().toISOString().split('T')[0];
    const { data: row } = await admin
      .from('usage_tracking')
      .select('id, usage_count')
      .eq('user_id', userId)
      .eq('feature_type', feature)
      .eq('usage_date', today)
      .maybeSingle();

    const used = row?.usage_count || 0;
    if (used >= limit) return { allowed: false, remaining: 0, limit };

    if (row) {
      await admin.from('usage_tracking').update({ usage_count: used + 1 }).eq('id', row.id);
    } else {
      await admin.from('usage_tracking').upsert({
        user_id: userId,
        feature_type: feature,
        usage_date: today,
        usage_count: 1,
      }, { onConflict: 'user_id,feature_type,usage_date' });
    }

    return { allowed: true, remaining: Math.max(0, limit - used - 1), limit };
  } catch (e) {
    console.error('[usage-limit] checkAndConsumeServerSide failed (allowing by default):', e);
    return { allowed: true, remaining: 0, limit: DEFAULT_LIMITS[feature] };
  }
}

const DEFAULT_BABY_PHOTOSHOOT_COUNT = 3;

/**
 * baby_photoshoot fərqli məntiqdədir: GÜNDƏLİK deyil, ÖMÜRLÜK say limitidir
 * (baby_photos cədvəlindəki cəmi sətir sayı). Premium-da limitsiz.
 */
export async function checkBabyPhotoshootLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const admin = adminClient();
  try {
    if (await isPremiumUser(admin, userId)) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    let limit = DEFAULT_BABY_PHOTOSHOOT_COUNT;
    try {
      const { data: setting } = await admin
        .from('app_settings')
        .select('value')
        .eq('key', 'free_limits')
        .maybeSingle();
      const configured = (setting?.value as any)?.baby_photoshoot_count;
      if (typeof configured === 'number' && configured >= 0) limit = configured;
    } catch { /* fallback dəyəri istifadə olunur */ }

    const { count } = await admin
      .from('baby_photos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const used = count || 0;
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
  } catch (e) {
    console.error('[usage-limit] checkBabyPhotoshootLimit failed (allowing by default):', e);
    return { allowed: true, remaining: 0, limit: DEFAULT_BABY_PHOTOSHOOT_COUNT };
  }
}

/** Standart "limit aşıldı" cavabı — bütün AI funksiyalarında eyni format. */
export function limitExceededResponse(corsHeaders: Record<string, string>, limit: number) {
  return new Response(
    JSON.stringify({
      error: 'daily_limit_exceeded',
      message: `Daily free limit reached (${limit}/day). Upgrade to Premium for unlimited access.`,
    }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
