// epoint-result — dedicated Epoint result URL for printable-book orders. The main merchant Result URL
// (epoint-payment?action=callback) also forwards book orders to the same handler, so either works.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { decodeData, epointConfig, verify } from '../_shared/epoint.ts';
import { applyBookPaymentResult } from '../_shared/book-result.ts';

const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const STATUS: Record<string, number> = { paid: 200, duplicate: 200, failed: 200, not_found: 404, not_confirmed: 409, grant_failed: 500 };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const config = await epointConfig(admin);
  if (!config.merchantLive) return reply(503, { error: 'payments_unavailable' });
  const raw = await req.text();
  if (raw.length > 32_000) return reply(413, { error: 'payload_too_large' });
  const form = new URLSearchParams(raw);
  const data = form.get('data') || '', signature = form.get('signature') || '';
  if (!data || !signature || !(await verify(data, signature, config.privateKey))) return reply(401, { error: 'invalid_signature' });
  const payload = decodeData(data);
  if (!payload) return reply(400, { error: 'invalid_payload' });
  const outcome = await applyBookPaymentResult(admin, config, payload);
  return reply(STATUS[outcome] ?? 500, { result: outcome });
});
