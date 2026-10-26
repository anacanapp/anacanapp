import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import bcrypt from 'npm:bcryptjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function maskName(name?: string | null): string {
  if (!name) return 'İstifadəçi';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === 'string' ? body.token.trim() : '';
    const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

    if (!token || !pin) return jsonResponse({ status: 'error', error: 'missing_params' });

    const { data: red } = await admin
      .from('partner_redemptions')
      .select('id, venue_id, user_id, status, expires_at, verified_at')
      .eq('token', token)
      .maybeSingle();

    if (!red) return jsonResponse({ status: 'error', error: 'invalid_token' });

    if (red.status === 'verified') {
      return jsonResponse({ status: 'error', error: 'already_verified', verified_at: red.verified_at });
    }

    if (new Date(red.expires_at) < new Date()) {
      await admin.from('partner_redemptions').update({ status: 'expired' }).eq('id', red.id).eq('status', 'pending');
      return jsonResponse({ status: 'error', error: 'expired' });
    }

    const { data: venue } = await admin
      .from('partner_venues')
      .select('id, name, pin_hash, discount_label, logo_url')
      .eq('id', red.venue_id)
      .maybeSingle();

    if (!venue) return jsonResponse({ status: 'error', error: 'venue_missing' });

    if (!venue.pin_hash) {
      return jsonResponse({ status: 'error', error: 'pin_not_configured' });
    }

    const okPin = await bcrypt.compare(pin, venue.pin_hash);
    if (!okPin) {
      return jsonResponse({ status: 'error', error: 'invalid_pin' });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || null;

    const verifiedAt = new Date().toISOString();

    const { data: updatedRows, error: updErr } = await admin
      .from('partner_redemptions')
      .update({ status: 'verified', verified_at: verifiedAt, verified_ip: ip })
      .select('verified_at')
      .eq('id', red.id)
      .eq('status', 'pending');

    if (updErr) {
      return jsonResponse({ error: 'update_failed', details: updErr.message }, 500);
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('name, is_premium')
      .eq('user_id', red.user_id)
      .maybeSingle();

    return jsonResponse({
        status: 'verified',
        venue_name: venue.name,
        venue_logo_url: venue.logo_url,
        discount_label: venue.discount_label,
        user_name: maskName(profile?.name),
        is_premium: !!profile?.is_premium,
        verified_at: updatedRows?.[0]?.verified_at ?? verifiedAt,
      });
  } catch (e) {
    console.error('partner-verify-redemption failed', e);
    return jsonResponse({ error: 'internal', details: String(e) }, 500);
  }
});
