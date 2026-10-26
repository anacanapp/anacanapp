import { supabase } from '@/integrations/supabase/client';

/**
 * !!! DEPRECATED / ARTIQ ÇAĞIRILMIR (Duzelis33 təhlükəsizlik düzəlişi) !!!
 *
 * Əvvəllər bu funksiya klientin öz RevenueCat SDK nəticəsinə əsasən
 * 'converted' statusunu birbaşa bildirirdi — istənilən istifadəçi bunu əl ilə
 * çağırıb, real ödəniş olmadan dostuna +7 gün premium "hədiyyə" edə bilərdi
 * (referral fraud). İndi 'converted' keçidi YALNIZ server-side
 * sync-revenuecat-entitlement edge function tərəfindən, RevenueCat-ın öz
 * REST API-sindən müstəqil təsdiqləndikdən sonra baş verir (bax
 * useInAppPurchase.ts syncWithDatabase() + supabase/functions/
 * sync-revenuecat-entitlement/index.ts). update_my_referral_status RPC-si
 * artıq 'converted' qəbul etmir (bax Duzelis33.sql) — bu funksiya heç yerdən
 * çağırılmır, saxlanılıb ki, tarixçə/kontekst itməsin.
 *
 * ---- Köhnə sənədləşmə (arxiv) ----
 * Referral status sinxronu — dəvət OLUNAN istifadəçinin klientindən.
 *
 * RevenueCat entitlement periodType:
 *   'TRIAL' / 'INTRO' → status 'trial'
 *   'NORMAL'          → status 'converted' → dəvət edənə +7 gün (server 1 dəfə verir)
 *
 * İdempotentdir; 'converted' bir dəfə uğurla sinxronlaşandan sonra
 * localStorage bayrağı ilə təkrar RPC çağırışları dayandırılır.
 */

const SYNCED_KEY = 'anacan_referral_converted_synced';

export async function syncReferralStatusFromEntitlement(periodType: string | null | undefined, isPro: boolean): Promise<void> {
  if (!isPro || !periodType) return;

  try {
    if (localStorage.getItem(SYNCED_KEY) === '1') return; // artıq konversiya sinxronlanıb
  } catch {/* boş */}

  const state = periodType === 'NORMAL' ? 'converted' : 'trial';

  try {
    const { data, error } = await (supabase.rpc as any)('update_my_referral_status', { p_state: state });
    if (error) return; // migrasiya yoxdur / referral yoxdur — səssiz

    const res = data as any;
    if (state === 'converted' && res?.success) {
      try {localStorage.setItem(SYNCED_KEY, '1');} catch {/* boş */}
    }
  } catch {
    // şəbəkə xətası — növbəti açılışda yenidən cəhd olunacaq
  }
}
