import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const url = new URL(req.url);
    let token = url.searchParams.get('token');
    if (!token && (req.method === 'POST')) {
      const body = await req.json().catch(() => ({}));
      token = body?.token;
    }
    if (!token) {
      return new Response(JSON.stringify({ error: 'token_required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: red } = await admin
      .from('partner_redemptions')
      .select('status, expires_at, verified_at, venue_id, user_id')
      .eq('token', token)
      .maybeSingle();
    if (!red) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let status = red.status;
    if (status === 'pending' && new Date(red.expires_at) < new Date()) {
      status = 'expired';
    }

    const { data: venue } = await admin
      .from('partner_venues')
      .select('name, logo_url, discount_label')
      .eq('id', red.venue_id)
      .maybeSingle();

    const { data: profile } = await admin
      .from('profiles')
      .select('name, is_premium')
      .eq('user_id', red.user_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        status,
        expires_at: red.expires_at,
        verified_at: red.verified_at,
        venue_name: venue?.name,
        venue_logo_url: venue?.logo_url,
        discount_label: venue?.discount_label,
        user_name: profile?.name ? (profile.name.split(/\s+/)[0] + ' ' + ((profile.name.split(/\s+/)[1]?.[0] || '').toUpperCase()) + '.') : 'İstifadəçi',
        is_premium: !!profile?.is_premium,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: 'internal', details: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
