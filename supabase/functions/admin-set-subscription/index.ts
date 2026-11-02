// ============================================================
// admin-set-subscription — Admin panelinden istifadeci Premium/plan
// statusunu deyismek ucun YEGANE icaze verilen yol.
//
// NIYE LAZIMDIR: `Duzelis33.sql` (bax orada tam izahat) `subscriptions`
// cedvelinden INSERT/UPDATE-i `authenticated` rolundan tamamile REVOKE etdi
// (fraud-qorunma tedbiri kimi - istifadeci ozune sonsuz Premium vermesin
// deye). Bu, GRANT seviyyesinde bir REVOKE-dur - RLS-in "Admins can manage
// subscriptions" FOR ALL policy-si belke ferqli bir sey desin, Postgres
// hemin policy-ni yoxlamamisdan evvel GRANT-i yoxlayir ve admin ucun de
// birbasa table write-i blok edir. Nectice: AdminPremiumConfig.tsx-in
// "Istifadeciler" tab-inda "Premium ver/legv et" duymesi seliqe ile
// "Uğurlu" toast-i gosterirdi, amma HEC BIR setir deyismirdi - persistent,
// gorunmeyen data-uygunsuzluğu.
//
// Bu funksiya service-role client ile (GRANT revoke-undan tesirlenmir)
// admin tesdiqinden sonra eyni emeliyyati yerine yetirir - audit-lenebilen,
// yalniz-admin bir yoldan.
//
// Auth: real admin istifadecisi teleb olunur (requireAdmin).
// Body: { targetUserId: string, planType: 'free'|'premium'|'premium_plus',
//         status?: 'active'|'cancelled'|'expired', expiresAt?: ISO string | null }
// expiresAt: premium expiry; null/absent = lifetime. Always written, so an older expires_at
// can never keep a fresh grant inactive.
// Cavab: { success: true, subscription: {...} }
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VALID_PLANS = new Set(['free', 'premium', 'premium_plus']);
const VALID_STATUSES = new Set(['active', 'cancelled', 'expired']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const admin = await requireAdmin(req);
    if (admin.error) return admin.error;

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.targetUserId;
    const planType: string | undefined = body.planType;
    const status: string = body.status || 'active';

    if (!targetUserId || typeof targetUserId !== 'string') {
      return json({ error: 'targetUserId tələb olunur' }, 400);
    }
    if (!planType || !VALID_PLANS.has(planType)) {
      return json({ error: 'Etibarsız plan tipi' }, 400);
    }
    if (!VALID_STATUSES.has(status)) {
      return json({ error: 'Etibarsız status' }, 400);
    }

    let expiresAt: string | null = null;
    if (body.expiresAt !== undefined && body.expiresAt !== null) {
      const parsed = typeof body.expiresAt === 'string' ? Date.parse(body.expiresAt) : Number.NaN;
      if (!Number.isFinite(parsed)) {
        return json({ error: 'Etibarsız müddət' }, 400);
      }
      expiresAt = new Date(parsed).toISOString();
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const isPremium = planType === 'premium' || planType === 'premium_plus';
    if (isPremium && expiresAt !== null && Date.parse(expiresAt) <= Date.now()) {
      return json({ error: 'Müddət keçmiş tarix ola bilməz' }, 400);
    }
    const storedExpiresAt = isPremium ? expiresAt : null;

    // Upsert subscriptions row (unique on user_id). This row is the entitlement source of truth:
    // a profile flag alone never grants access.
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: targetUserId,
          plan_type: planType,
          status,
          expires_at: storedExpiresAt,
          is_trial: false,
          ...(status === 'active' ? { cancelled_at: null } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (subError) {
      console.error('[admin-set-subscription] subscriptions upsert error:', subError);
      return json({ error: 'Abunəlik yenilənə bilmədi', detail: subError.message }, 500);
    }

    // Keep profiles.is_premium in sync (many screens still read this flag).
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_premium: isPremium, premium_until: storedExpiresAt })
      .eq('user_id', targetUserId);

    if (profileError) {
      console.error('[admin-set-subscription] profiles update error:', profileError);
      return json({ error: 'Profil yenilənə bilmədi', detail: profileError.message }, 500);
    }

    return json({ success: true, subscription });
  } catch (err) {
    console.error('[admin-set-subscription] error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
