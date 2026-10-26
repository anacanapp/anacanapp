// ============================================================
// sync-revenuecat-entitlement — KLİENT tərəfindən tetiklenen sinxron yolu
// (satın alma, restore, app-open zamanı). Real məntiq (RC-dən çəkmə +
// subscriptions/profiles-a yazma) `_shared/revenuecat-sync.ts`-dədir və
// `revenuecat-webhook` (RC-nin öz serverindən gələn, client-dən müstəqil
// yol) ilə PAYLAŞILIR — bax o faylın başındakı izahat.
//
// NİYƏ LAZIMDIR: əvvəllər klient (useInAppPurchase.ts) öz RevenueCat SDK
// nəticəsinə əsasən BİRBAŞA `subscriptions`/`profiles` cədvəllərinə yazırdı.
// RLS bunu icazə verirdi (auth.uid()=user_id yoxlaması ilə) — yəni istənilən
// istifadəçi öz sessiyası ilə eyni upsert-i əl ilə çağırıb, HEÇ BİR real
// ödəniş olmadan özünə sonsuz Premium Plus verə bilərdi.
//
// Tələb olunan Supabase Edge Function Secret:
//   REVENUECAT_SECRET_API_KEY — RC Dashboard → Project Settings → API Keys →
//   "Secret API keys" bölməsindən (sk_... ilə başlayır, V1 versiyası seçilməli).
//
// Auth: real istifadəçi tələb olunur (requireUser).
// Cavab: { isPro, planType, status, expiresAt, productId, willRenew }
// ============================================================
import { requireUser } from '../_shared/auth.ts';
import { syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const auth = await requireUser(req, 'sync-revenuecat-entitlement');
    if (auth.error) return auth.error;

    const result = await syncEntitlementForUser(auth.user.id);
    if (!result.ok) {
      return json({
        error: 'revenuecat_unavailable',
        reason: result.reason,
        rcStatus: result.rcStatus,
        rcDetail: result.rcDetail,
      }, 503);
    }

    return json({
      isPro: result.isPro,
      planType: result.planType,
      status: result.status,
      expiresAt: result.expiresAt,
      productId: result.productId,
      willRenew: result.willRenew,
      periodType: result.periodType,
    });
  } catch (err) {
    console.error('[sync-revenuecat-entitlement] error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
