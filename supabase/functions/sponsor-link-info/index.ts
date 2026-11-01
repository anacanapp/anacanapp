// sponsor-link-info — public, read-only info for the anacan.az/p/<token> pay page ("someone else pays
// for Premium"). Returns only safe fields (the requester's first name, the kind, validity) so the payer
// knows who they are helping. No personal or health data. Only anacan.az may call it from a browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { WEBSITE_ORIGINS } from '../_shared/dodo.ts';

function headersFor(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && WEBSITE_ORIGINS.includes(origin) ? origin : WEBSITE_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = headersFor(origin);
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  if (origin && !WEBSITE_ORIGINS.includes(origin)) return reply(403, { error: 'origin_not_allowed' });

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 512) return reply(413, { error: 'payload_too_large' });
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'invalid_payload' });
  }
  const token = typeof body.token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(body.token) ? body.token : null;
  if (!token) return reply(400, { error: 'invalid_token' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await admin.rpc('premium_sponsor_link_info_v1', { p_token: token });
  if (error) return reply(500, { error: 'lookup_failed' });
  return reply(200, (data ?? { found: false }) as Record<string, unknown>);
});
