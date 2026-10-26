import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { checkModerationAccess } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function randomToken(len = 40) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, len);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await adminAuth.auth.getUser(jwt);
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = userData.user.id;
    const moderationError = await checkModerationAccess(userId, 'partner-create-redemption');
    if (moderationError) return moderationError;

    const body = await req.json().catch(() => ({}));
    const venueId = body?.venue_id as string;
    if (!venueId || typeof venueId !== 'string') {
      return new Response(JSON.stringify({ error: 'venue_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Premium check
    // NOT: əvvəllər BURADA yalnız `profiles.is_premium` yoxlanılırdı, halbuki
    // klient tərəfi (useSubscription.ts -> isPremium = ownPremium ||
    // householdPremium) HƏM `subscriptions` cədvəlini, HƏM DƏ bağlı
    // partnyorun premium-unu (get_linked_partner_premium) hesaba qatır. Bu
    // uyğunsuzluq real bir 403-ə səbəb olurdu: yalnız subscriptions
    // cədvəlindən və ya partnyorunun premium-undan asılı olan istifadəçi
    // "Endirimi al" düyməsini aktiv görürdü, amma server bunu rədd edirdi.
    // İndi eyni məntiq server tərəfində tam təkrarlanır.
    const isPremiumFor = async (uid: string): Promise<boolean> => {
      const [{ data: profileRow }, { data: subRow }] = await Promise.all([
        admin.from('profiles').select('is_premium, premium_until').eq('user_id', uid).maybeSingle(),
        admin
          .from('subscriptions')
          .select('plan_type, status, expires_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const ownProfilePremium =
        !!profileRow?.is_premium && (!profileRow?.premium_until || new Date(profileRow.premium_until) > new Date());

      const ownSubPremium =
        !!subRow &&
        (subRow.plan_type === 'premium' || subRow.plan_type === 'premium_plus') &&
        (subRow.status === 'active' || subRow.status === 'cancelled') &&
        (!subRow.expires_at || new Date(subRow.expires_at) > new Date());

      return ownProfilePremium || ownSubPremium;
    };

    const { data: profile } = await admin
      .from('profiles')
      .select('name, linked_partner_id')
      .eq('user_id', userId)
      .maybeSingle();

    let isPremium = await isPremiumFor(userId);

    if (!isPremium && profile?.linked_partner_id) {
      const { data: partnerUserId } = await admin.rpc('get_linked_partner_user_id', { _user_id: userId });
      if (partnerUserId) {
        isPremium = await isPremiumFor(partnerUserId as string);
      }
    }

    if (!isPremium) {
      return new Response(JSON.stringify({ error: 'premium_required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch venue
    const { data: venue, error: venueErr } = await admin
      .from('partner_venues')
      .select('id, name, qr_ttl_seconds, is_active, discount_label')
      .eq('id', venueId)
      .maybeSingle();

    if (venueErr || !venue || !venue.is_active) {
      return new Response(JSON.stringify({ error: 'venue_not_found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // can_redeem check
    const { data: canData, error: canErr } = await admin.rpc('can_redeem_partner_venue', { _user_id: userId, _venue_id: venueId });
    if (canErr) {
      return new Response(JSON.stringify({ error: 'check_failed', details: canErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!canData?.allowed) {
      return new Response(JSON.stringify({ error: canData?.reason || 'not_allowed', next_available_at: canData?.next_available_at }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tok = randomToken(40);
    const expiresAt = new Date(Date.now() + venue.qr_ttl_seconds * 1000).toISOString();

    const { error: insErr } = await admin.from('partner_redemptions').insert({
      venue_id: venueId,
      user_id: userId,
      token: tok,
      status: 'pending',
      expires_at: expiresAt,
      client_meta: { ua: req.headers.get('user-agent') || null },
    });
    if (insErr) {
      return new Response(JSON.stringify({ error: 'insert_failed', details: insErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const origin = req.headers.get('origin') || 'https://app.anacan.az';
    return new Response(
      JSON.stringify({
        token: tok,
        verify_url: `${origin}/p/v/${tok}`,
        expires_at: expiresAt,
        ttl_seconds: venue.qr_ttl_seconds,
        venue_name: venue.name,
        discount_label: venue.discount_label,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'internal', details: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
