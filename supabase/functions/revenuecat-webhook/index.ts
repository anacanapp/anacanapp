// ============================================================
// revenuecat-webhook — RevenueCat-ın ÖZ SERVERİNDƏN gələn hadisə bildirişi.
//
// NİYƏ LAZIMDIR (sistemli düzəliş): əvvəllər Premium-un DB-yə yazılması
// TAMAMİLƏ client-in tetiklemesinden asılı idi (sync-revenuecat-entitlement,
// yalnız tətbiq açıq olanda, satın alma/restore/app-open zamanı çağırılırdı).
// Bunun HEÇ bir server-side "təhlükəsizlik toru" yox idi: satın almadan
// dərhal sonra tətbiq bağlansa, şəbəkə anlıq kəssə, ya da sync sorğusu
// hər hansı səbəbdən uğursuz olsa (RC-nin öz serverinin təzə alışı hələ
// "görməməsi" kimi adi eventual-consistency gecikməsi daxil) — DB HƏMİŞƏLİK
// köhnə/yanlış qalırdı, çünki heç nə onu düzəltmirdi. Bir müştəri məhz bu
// səbəbdən ödəyib Premium ala bilməyib şikayət etdi.
//
// Bu funksiya RevenueCat-ın Dashboard → Project Settings → Integrations →
// Webhooks bölməsində konfiqurasiya olunur — RC hər hadisədə (satın alma,
// yenilənmə, ləğv, bitmə və s.) Apple/Google-dan xəbəri ALAN KİMİ, tətbiqin
// açıq olub-olmamasından TAM MÜSTƏQİL, bura POST sorğusu göndərir. Beləliklə
// client-tərəfi sync uğursuz olsa belə, bir neçə saniyə/dəqiqə ərzində real
// vəziyyət hər halda buradan düzələcək.
//
// Konkret hadisə növünü (INITIAL_PURCHASE/RENEWAL/CANCELLATION/EXPIRATION/
// BILLING_ISSUE və s.) təhlil ETMİRİK — sadəcə hansı istifadəçiyə aid
// olduğunu (`event.app_user_id`) oxuyub, RC-nin REST API-sindən onun HAZIRKI
// tam vəziyyətini yenidən çəkirik (eyni `syncEntitlementForUser`,
// sync-revenuecat-entitlement ilə paylaşılır) — bu, bütün hadisə növlərini
// eyni, sadə və etibarlı yolla əhatə edir.
//
// Tələb olunan Supabase Edge Function Secret:
//   REVENUECAT_WEBHOOK_SECRET — özün seç (təsadüfi uzun sətir), RC Dashboard-da
//   webhook URL-i əlavə edərkən "Authorization header value" sahəsinə də EYNİ
//   dəyəri yaz. Bu, REVENUECAT_SECRET_API_KEY-dən TAMAMİLƏ FƏRQLİ bir sirdir
//   (o bizim RC-yə, bu isə RC-nin bizə sorğu göndərməsini təsdiqləmək üçündür).
//
// Auth: RC-nin göndərdiyi Authorization header REVENUECAT_WEBHOOK_SECRET-lə
// tam uyğun olmalıdır — əks halda kim olursa olsun saxta hadisə göndərib
// istənilən istifadəçiyə Premium "verə" bilməzdi.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const expectedSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    if (!expectedSecret) {
      console.error('[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET not configured');
      return json({ error: 'webhook_not_configured' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const provided = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (provided !== expectedSecret) {
      console.warn('[revenuecat-webhook] Unauthorized webhook attempt (secret mismatch)');
      return json({ error: 'unauthorized' }, 401);
    }

    const body = await req.json().catch(() => null);
    const appUserId: string | undefined = body?.event?.app_user_id;
    const eventType: string | undefined = body?.event?.type;
    // RC-nin ÖZ mağaza-tərəfi ləğv/bitmə səbəbi (UNSUBSCRIBE, BILLING_ERROR,
    // CUSTOMER_SUPPORT, PRICE_INCREASE, DEVELOPER_INITIATED, UNKNOWN) —
    // istifadəçinin tətbiq-daxili popup-da özü yazdığı səbəbdən (bax
    // useSubscriptionCancellation.ts, cancel_flow='in_app') TAMAMİLƏ AYRI,
    // tamamlayıcı bir siqnal (cancel_flow='store_reported'). Əvvəllər bu
    // dəyər HEÇ oxunmurdu, HEÇ saxlanılmırdı.
    const storeReason: string | undefined = body?.event?.cancel_reason || body?.event?.expiration_reason;

    if (!appUserId) {
      console.warn('[revenuecat-webhook] Missing event.app_user_id in payload:', JSON.stringify(body)?.slice(0, 300));
      // RC-yə 200 qaytarırıq ki, bu düzgün göndərilməyən hadisəni sonsuz
      // təkrarlamağa çalışmasın — real problem bizim tərəfdə deyil.
      return json({ ok: false, error: 'missing_app_user_id' }, 200);
    }

    console.log(`[revenuecat-webhook] Event "${eventType}" for app_user_id=${appUserId}`);
    const result = await syncEntitlementForUser(appUserId);

    if ((eventType === 'CANCELLATION' || eventType === 'EXPIRATION') && storeReason) {
      try {
        const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        await admin.from('subscription_cancellations').insert({
          user_id: appUserId,
          reason_code: `store_${storeReason.toLowerCase()}`,
          reason_text: null,
          plan_type: result.planType || null,
          was_trial: result.isTrial || false,
          cancel_flow: 'store_reported',
        });
      } catch (e) {
        console.error('[revenuecat-webhook] failed to log store-reported cancel reason:', e);
      }
    }

    if (!result.ok) {
      // RC-nin ÖZ API-si müvəqqəti əlçatan deyilsə (nadir hal — webhook
      // çağırışı elə RC-nin öz sistemindən gəlir) — 500 qaytarırıq ki, RC
      // öz retry siyasətinə uyğun sonra yenidən sınasın.
      console.error('[revenuecat-webhook] sync failed:', result.reason, result.rcStatus, result.rcDetail);
      return json({ ok: false, reason: result.reason }, 500);
    }

    console.log(`[revenuecat-webhook] Synced app_user_id=${appUserId} → isPro=${result.isPro}`);
    return json({ ok: true, isPro: result.isPro });
  } catch (err) {
    console.error('[revenuecat-webhook] error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
