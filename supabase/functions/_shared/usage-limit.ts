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

/** Default IANA zone when a caller sends none; the RPC validates and also falls back to this. */
const DEFAULT_TIME_ZONE = 'Asia/Baku';

/**
 * Local calendar day (YYYY-MM-DD) in the given IANA zone, mirroring public._anacan_local_day: the free
 * daily limits reset at the user's local midnight, not UTC midnight (04:00 in Baku). An unknown / empty
 * zone falls back to Asia/Baku. Only used by the legacy table fallback below; the RPC computes its own day.
 */
function localDayKey(timeZone: string = DEFAULT_TIME_ZONE): string {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  try { return fmt(timeZone || DEFAULT_TIME_ZONE); } catch { return fmt(DEFAULT_TIME_ZONE); }
}

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
  feature: DailyFeature,
  timeZone: string = DEFAULT_TIME_ZONE
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const admin = adminClient();

  try {
    if (await isPremiumUser(admin, userId)) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }

    // Atomic, local-day gate (public.usage_consume_srv_v1 -> usage_consume_v1 logic): one
    // INSERT .. ON CONFLICT .. WHERE usage_count < limit, so parallel calls never overshoot and the
    // day is the user's local calendar day, not UTC (Baku reset at local midnight, not 04:00).
    const viaRpc = await consumeViaRpc(admin, userId, feature, timeZone);
    if (viaRpc) {
      return { allowed: viaRpc.allowed, remaining: Math.max(0, viaRpc.limit - viaRpc.used), limit: viaRpc.limit };
    }

    // Fallback for an old DB without the RPC (or a feature it does not know yet): the legacy
    // read-then-update, now on the local-day row, so deploy order never breaks the gate.
    const limit = await resolveDailyLimit(admin, feature);
    const today = localDayKey(timeZone);
    const { data: row } = await admin
      .from('usage_tracking')
      .select('id, usage_count')
      .eq('user_id', userId)
      .eq('feature_type', counterKey(feature))
      .eq('usage_date', today)
      .maybeSingle();

    const used = row?.usage_count || 0;
    if (used >= limit) return { allowed: false, remaining: 0, limit };

    if (row) {
      await admin.from('usage_tracking').update({ usage_count: used + 1 }).eq('id', row.id);
    } else {
      await admin.from('usage_tracking').upsert({
        user_id: userId,
        feature_type: counterKey(feature),
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

/** app_settings.value is jsonb, but the admin panel stores it as a JSON string; the app parses both. */
function settingObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed : null; } catch { return null; } }
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

/** Limit for a feature: admin-configured value from app_settings, else the default. */
async function resolveDailyLimit(admin: SupabaseAdmin, feature: DailyFeature): Promise<number> {
  let limit = DEFAULT_LIMITS[feature];
  try {
    const { data: setting } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', 'free_limits')
      .maybeSingle();
    const configured = (settingObject(setting?.value) as any)?.[DAILY_LIMIT_KEYS[feature]];
    if (typeof configured === 'number' && configured >= 0) limit = configured;
  } catch { /* fallback dəyəri istifadə olunur */ }
  return limit;
}

/**
 * The app increments usage_tracking(feature) itself before it calls these AI functions (ai_chat,
 * cry_translator, poop_scanner, horoscope). Counting the server's own successful answers in the same
 * row made every message count twice (limit 3 => 1 answer). The server therefore keeps its own row
 * `<feature>_srv` for those features; the app's row and UI stay as they are. fairy_tale and
 * baby_insight are only read by the app, so the server row is the single counter there.
 */
const SERVER_COUNTER: Partial<Record<DailyFeature, string>> = {
  ai_chat: 'ai_chat_srv',
  cry_translator: 'cry_translator_srv',
  poop_scanner: 'poop_scanner_srv',
  horoscope: 'horoscope_srv',
};
const counterKey = (feature: DailyFeature): string => SERVER_COUNTER[feature] ?? feature;

/**
 * Atomic, local-day consume via public.usage_consume_srv_v1 (round-3 migration 20261125190000, feature keys
 * extended + service-role entrypoint added in 20261126130000). The server calls with the service-role key, so
 * it cannot use auth.uid(); the _srv variant takes the user id explicitly. Returns null when the RPC is missing
 * or rejects the feature (DB not migrated yet) so the caller falls back to the legacy table path and deploy
 * order never breaks the gate. The feature key is counterKey(feature): the server's own `<feature>_srv` row for
 * the four features the app also counts, the plain row for fairy_tale / baby_insight (see SERVER_COUNTER).
 */
async function consumeViaRpc(
  admin: SupabaseAdmin,
  userId: string,
  feature: DailyFeature,
  timeZone: string
): Promise<{ allowed: boolean; used: number; limit: number } | null> {
  try {
    const { data, error } = await admin.rpc('usage_consume_srv_v1', {
      p_user_id: userId,
      p_feature: counterKey(feature),
      p_time_zone: timeZone || DEFAULT_TIME_ZONE,
    });
    if (error || !data || typeof data !== 'object') {
      if (error) console.error('[usage-limit] usage_consume_srv_v1 fallback:', error.message || error);
      return null;
    }
    const d = data as { allowed?: unknown; used?: unknown; limit?: unknown };
    if (typeof d.allowed !== 'boolean') return null;
    const limit = Number.isFinite(Number(d.limit)) ? Number(d.limit) : DEFAULT_LIMITS[feature];
    const used = Number(d.used) || 0;
    return { allowed: d.allowed, used, limit };
  } catch (e) {
    console.error('[usage-limit] usage_consume_srv_v1 fallback (threw):', e);
    return null;
  }
}

async function readDailyUsage(
  admin: SupabaseAdmin,
  userId: string,
  feature: DailyFeature,
  timeZone: string = DEFAULT_TIME_ZONE
): Promise<{ id: string | null; used: number }> {
  const today = localDayKey(timeZone);
  const { data: row } = await admin
    .from('usage_tracking')
    .select('id, usage_count')
    .eq('user_id', userId)
    .eq('feature_type', counterKey(feature))
    .eq('usage_date', today)
    .maybeSingle();
  return { id: row?.id ?? null, used: row?.usage_count || 0 };
}

/**
 * Read-only daily check with the same limit rules as checkAndConsumeServerSide, but it does
 * NOT increment. Pair it with recordDailyUsage() once the paid provider has answered, so a
 * failed or rejected attempt never uses up the daily quota.
 */
export async function checkDailyLimit(
  userId: string,
  feature: DailyFeature,
  timeZone: string = DEFAULT_TIME_ZONE
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const admin = adminClient();
  try {
    if (await isPremiumUser(admin, userId)) {
      return { allowed: true, remaining: Infinity, limit: Infinity };
    }
    const limit = await resolveDailyLimit(admin, feature);
    const { used } = await readDailyUsage(admin, userId, feature, timeZone);
    return { allowed: used < limit, remaining: Math.max(0, limit - used), limit };
  } catch (e) {
    console.error('[usage-limit] checkDailyLimit failed (allowing by default):', e);
    return { allowed: true, remaining: 0, limit: DEFAULT_LIMITS[feature] };
  }
}

/** Records one successful use for today. Call only for free users (limit is finite). */
export async function recordDailyUsage(userId: string, feature: DailyFeature, timeZone: string = DEFAULT_TIME_ZONE): Promise<void> {
  const admin = adminClient();
  // Atomic, local-day increment, bounded by the limit so parallel answers never overshoot the counter.
  const viaRpc = await consumeViaRpc(admin, userId, feature, timeZone);
  if (viaRpc) return;
  // Fallback for an old DB without the RPC: the legacy read-then-update, now on the local-day row.
  const today = localDayKey(timeZone);
  const { id, used } = await readDailyUsage(admin, userId, feature, timeZone);
  if (id) {
    await admin.from('usage_tracking').update({ usage_count: used + 1 }).eq('id', id);
  } else {
    await admin.from('usage_tracking').upsert({
      user_id: userId,
      feature_type: counterKey(feature),
      usage_date: today,
      usage_count: 1,
    }, { onConflict: 'user_id,feature_type,usage_date' });
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
      const configured = (settingObject(setting?.value) as any)?.baby_photoshoot_count;
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
