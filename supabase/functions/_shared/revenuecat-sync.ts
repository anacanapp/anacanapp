// ============================================================
// Paylaşılan RevenueCat → subscriptions/profiles sinxron məntiqi.
//
// İKİ çağıran tərəfindən istifadə olunur:
//   1) sync-revenuecat-entitlement — klient tərəfindən tetiklenir (real
//      istifadəçi JWT-si tələb olunur), tətbiq açıq olanda (satın alma,
//      restore, app-open) işə düşür.
//   2) revenuecat-webhook — RevenueCat-ın öz serverindən BİRBAŞA gəlir,
//      tətbiqin açıq olmasından TAM MÜSTƏQİLDİR. Bu, sistemin YEGANƏ
//      "client bir şəkildə sinxronu tetiklemeyi bacarmadı" ssenarisinə qarşı
//      real qorunmasıdır (məs. satın almadan dərhal sonra tətbiq bağlansa,
//      şəbəkə kəsilsə, ya da sync sorğusu sadəcə uğursuz olsa) — RC hadisəni
//      Apple/Google-dan alan kimi öz tərəfindən bizə xəbər verir.
//
// Hər iki yol EYNİ məntiqdən keçir ki, "isPro necə hesablanır" qaydası
// TƏKCƏ BİR yerdə olsun (əvvəllər hər ikisində ayrı-ayrı kopyalanıb fərqli
// düşmək riski var idi).
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

export const ENTITLEMENT_ID = 'Anacan LLC Pro';

interface RCSubscription {
  refunded_at?: string | null;
  purchase_date?: string | null;
  expires_date: string | null;
  period_type?: 'normal' | 'trial' | 'intro';
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
}

interface RCSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, { expires_date: string | null; product_identifier: string }>;
    subscriptions?: Record<string, RCSubscription>;
  };
}

interface RCFetchResult {
  data: RCSubscriberResponse | null;
  // Diaqnostika üçün — DİQQƏT: heç vaxt açarın özünü daşımır, yalnız "niyə
  // uğursuz oldu" kateqoriyasını + RC-nin öz (generic) status/mətnini.
  debugReason?: 'no_secret_key' | 'rc_api_error';
  debugStatus?: number;
  debugDetail?: string;
}

export async function fetchRevenueCatSubscriber(appUserId: string): Promise<RCFetchResult> {
  const secretKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!secretKey) {
    console.error('[revenuecat-sync] REVENUECAT_SECRET_API_KEY not configured');
    return { data: null, debugReason: 'no_secret_key' };
  }
  const resp = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!resp.ok) {
    const bodyText = await resp.text();
    console.error('[revenuecat-sync] RC API error:', resp.status, bodyText);
    return { data: null, debugReason: 'rc_api_error', debugStatus: resp.status, debugDetail: bodyText.slice(0, 300) };
  }
  return { data: await resp.json() };
}

export interface SyncResult {
  ok: boolean;
  reason?: 'no_secret_key' | 'rc_api_error' | 'db_write_failed';
  rcStatus?: number;
  rcDetail?: string;
  isPro?: boolean;
  planType?: string;
  status?: string;
  expiresAt?: string | null;
  productId?: string | null;
  willRenew?: boolean;
  periodType?: string | null;
  isTrial?: boolean;
}

/**
 * RC-nin öz REST API-sindən userId üçün HƏQİQİ entitlement vəziyyətini çəkir
 * və subscriptions/profiles cədvəllərinə yazır. userId ADƏTƏN Supabase
 * auth.users.id-dir (RevenueCat-a `identifyUser(user.id)` ilə eyni dəyər
 * ötürülür — bax src/lib/revenuecat.ts) — yəni RC-nin app_user_id-si ilə
 * bizim user_id sütunumuz üst-üstə düşür.
 */
export async function syncEntitlementForUser(userId: string): Promise<SyncResult> {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const rcResult = await fetchRevenueCatSubscriber(userId);
  if (!rcResult.data) {
    // RC əlçatan deyil (açar yoxdur / şəbəkə xətası) — mövcud DB vəziyyətinə
    // toxunmuruq (yanlış "expired" yazmaqdansa heç nə etməmək daha təhlükəsizdir).
    return { ok: false, reason: rcResult.debugReason, rcStatus: rcResult.debugStatus, rcDetail: rcResult.debugDetail };
  }
  const rc = rcResult.data;

  const entitlement = rc.subscriber?.entitlements?.[ENTITLEMENT_ID];
  const now = Date.now();
  const productId = entitlement?.product_identifier || null;
  const sub = productId ? rc.subscriber?.subscriptions?.[productId] : undefined;
  if (sub?.refunded_at != null && !Number.isFinite(Date.parse(sub.refunded_at)) || sub?.purchase_date != null && !Number.isFinite(Date.parse(sub.purchase_date))) return { ok: false, reason: 'rc_api_error' };
  const refunded = !!sub?.refunded_at && (!sub.purchase_date || Date.parse(sub.refunded_at) >= Date.parse(sub.purchase_date));
  const isPro = !!entitlement && !refunded && (!entitlement.expires_date || new Date(entitlement.expires_date).getTime() > now);
  const willRenew = isPro ? !sub?.unsubscribe_detected_at : false;
  const periodType = (sub?.period_type || null); // 'normal' | 'trial' | 'intro' | null
  const expiresAt = entitlement?.expires_date || null;

  const planType = productId?.includes('yearly') || productId?.includes('annual') || productId?.includes('lifetime')
    ? 'premium_plus'
    : 'premium';
  const status = !isPro ? 'expired' : willRenew === false ? 'cancelled' : 'active';

  const expiresAtIso = expiresAt
    ? new Date(expiresAt).toISOString()
    : (() => {
        // Real ödəniş amma expires_date yoxdur (məs. lifetime) — uzaq gələcək.
        const d = new Date();
        d.setFullYear(d.getFullYear() + 100);
        return d.toISOString();
      })();

  const isTrial = isPro && periodType === 'trial';

  // DÜZƏLİŞ: əvvəllər `started_at` HƏR sinxronizasiyada indiki vaxta
  // yenilənirdi (halbuki "abunəlik nə vaxt başladı" sabit qalmalıdır) və
  // `cancelled_at` heç saxlanılmırdı (Admin Premium səhifəsi üçün "kim NƏ
  // VAXT cancel edib" göstərmək mümkün deyildi). İndi mövcud sətir əvvəlcə
  // oxunur: `started_at` YALNIZ ilk dəfə yazılır, `cancelled_at` status
  // 'cancelled'-ə KEÇİDDƏ təyin olunur (yenidən aktivləşəndə təmizlənir).
  const { data: existingSub } = await admin
    .from('subscriptions')
    .select('status, started_at, cancelled_at')
    .eq('user_id', userId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const startedAt = (existingSub as any)?.started_at || nowIso;
  const cancelledAt =
    status === 'cancelled' && (existingSub as any)?.status !== 'cancelled'
      ? nowIso
      : status === 'active'
      ? null
      : (existingSub as any)?.cancelled_at ?? null;

  const { error: subError } = await admin.from('subscriptions').upsert({
    user_id: userId,
    plan_type: isPro ? planType : 'free',
    status,
    started_at: startedAt,
    expires_at: isPro ? expiresAtIso : null,
    is_trial: isTrial,
    cancelled_at: cancelledAt,
  }, { onConflict: 'user_id' });
  if (subError) return { ok: false, reason: 'db_write_failed' };

  const { error: profileError } = await admin.from('profiles').update({
    is_premium: isPro,
    premium_until: isPro ? expiresAtIso : null,
  }).eq('user_id', userId);
  if (profileError) return { ok: false, reason: 'db_write_failed' };

  // Referral: YALNIZ burada, RC-nin öz REST API-sindən müstəqil təsdiqləndikdən
  // sonra — klient artıq 'converted' göndərə bilmir (bax Duzelis33.sql).
  if (isPro && periodType === 'normal') {
    const { error: refError } = await admin.rpc('confirm_referral_conversion', {
      p_referred_user_id: userId,
    });
    if (refError) console.log('[revenuecat-sync] referral confirm skipped:', refError.message);
  }

  return {
    ok: true,
    isPro,
    planType: isPro ? planType : 'free',
    status,
    expiresAt: isPro ? expiresAtIso : null,
    productId,
    willRenew,
    periodType,
    isTrial,
  };
}
