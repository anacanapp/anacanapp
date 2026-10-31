// email-verification — 6-digit e-mail code for new e-mail/password sign-ups (Duzelis74).
// Auth sign-up is auto-confirmed, so this is the only proof that the person owns the e-mail. The code is stored
// as a salted hash, expires in 15 minutes, allows 5 attempts and is sent through Customer.io's transactional API
// (EU) with open/click tracking off and message retention disabled. A verified e-mail also attaches Premium bought
// on anacan.az (Dodo) to this account. Never log codes, e-mail addresses or API keys.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { requireUser } from '../_shared/auth.ts';
import { EMAIL_VERIFICATION_COPY } from '../_shared/email-verification-copy.ts';
import { syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

const CODE_TTL_MS = 15 * 60_000;
const COOLDOWN_MS = 60_000;
const WINDOW_MS = 60 * 60_000;
const MAX_SENDS_PER_WINDOW = 5;
const MAX_ATTEMPTS = 5;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function newCode(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(value).padStart(6, '0');
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function message(language: string, code: string) {
  const copy = EMAIL_VERIFICATION_COPY[language] ?? EMAIL_VERIFICATION_COPY.en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const subject = copy.subject.replace('{code}', code);
  const html = `<!doctype html><html lang="${language}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff4f1;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#333">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(copy.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4f1;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:#ffffff;border-radius:20px;padding:32px 28px">
<tr><td style="font-size:20px;font-weight:800;color:#ff5a5f;padding-bottom:18px">Anacan</td></tr>
<tr><td style="font-size:18px;font-weight:800;padding-bottom:8px">${escapeHtml(copy.heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#555;padding-bottom:20px">${escapeHtml(copy.intro)}</td></tr>
<tr><td align="center" style="padding-bottom:20px"><div style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:8px;color:#333;background:#ffe7e1;border-radius:14px;padding:14px 22px" dir="ltr">${code}</div></td></tr>
<tr><td style="font-size:14px;line-height:1.55;color:#555;padding-bottom:10px">${escapeHtml(copy.expires)}</td></tr>
<tr><td style="font-size:13px;line-height:1.55;color:#888;padding-bottom:22px">${escapeHtml(copy.ignore)}</td></tr>
<tr><td style="font-size:12px;color:#aaa;border-top:1px solid #f1e6e2;padding-top:16px">${escapeHtml(copy.footer)} · anacan.az</td></tr>
</table></td></tr></table></body></html>`;
  const text = `${copy.heading}\n\n${copy.intro}\n\n${code}\n\n${copy.expires}\n${copy.ignore}\n\n${copy.footer} · https://anacan.az`;
  return { subject, html, text };
}

async function sendEmail(userId: string, to: string, language: string, code: string): Promise<boolean> {
  const key = Deno.env.get('CUSTOMERIO_APP_API_KEY');
  const from = Deno.env.get('EMAIL_VERIFICATION_FROM');
  if (!key || !from) return false;
  const host = Deno.env.get('CUSTOMERIO_REGION') === 'us' ? 'https://api.customer.io' : 'https://api-eu.customer.io';
  const { subject, html, text } = message(language, code);
  const response = await fetch(`${host}/v1/send/email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to, from, subject, body: html, plaintext_body: text,
      identifiers: { id: userId },
      // A one-time code is transactional: deliver even to marketing-unsubscribed people, keep no copy, no tracking.
      send_to_unsubscribed: true, tracked: false, disable_message_retention: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) console.error('[email-verification] send failed:', response.status);
  return response.ok;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const userId = auth.user.id;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { error: 'invalid_payload' }); }
  const action = body.action;
  const language = typeof body.language === 'string' && EMAIL_VERIFICATION_COPY[body.language] ? body.language : 'en';

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(userId);
  const email = (account?.user?.email || '').trim().toLowerCase();
  if (accountError || !email) return json(400, { error: 'no_email' });

  const { data: row } = await admin.from('email_verifications').select('*').eq('user_id', userId).maybeSingle();
  const current = row && row.email === email ? row : null;
  if (current?.verified_at) return json(200, { verified: true });
  const now = Date.now();

  if (action === 'send') {
    if (current?.last_sent_at && now - Date.parse(current.last_sent_at) < COOLDOWN_MS) {
      return json(429, { error: 'rate_limited', retry_in: Math.ceil((COOLDOWN_MS - (now - Date.parse(current.last_sent_at))) / 1000) });
    }
    const windowStart = current?.window_started_at && now - Date.parse(current.window_started_at) < WINDOW_MS ? current.window_started_at : new Date(now).toISOString();
    const sends = windowStart === current?.window_started_at ? (current?.sends_in_window ?? 0) : 0;
    if (sends >= MAX_SENDS_PER_WINDOW) return json(429, { error: 'rate_limited', retry_in: Math.ceil((WINDOW_MS - (now - Date.parse(windowStart))) / 1000) });
    const code = newCode();
    const { error } = await admin.from('email_verifications').upsert({
      user_id: userId, email, code_hash: await sha256(`${userId}:${code}`),
      code_expires_at: new Date(now + CODE_TTL_MS).toISOString(), attempts: 0,
      sends_in_window: sends + 1, window_started_at: windowStart, last_sent_at: new Date(now).toISOString(),
      verified_at: null, updated_at: new Date(now).toISOString(),
    }, { onConflict: 'user_id' });
    if (error) return json(500, { error: 'store_failed' });
    if (!(await sendEmail(userId, email, language, code))) return json(502, { error: 'send_failed' });
    return json(200, { sent: true, retry_in: COOLDOWN_MS / 1000 });
  }

  if (action === 'confirm') {
    const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '') : '';
    if (code.length !== 6) return json(400, { error: 'wrong_code' });
    if (!current?.code_hash || !current.code_expires_at) return json(400, { error: 'expired' });
    if (Date.parse(current.code_expires_at) < now) return json(400, { error: 'expired' });
    if (current.attempts >= MAX_ATTEMPTS) return json(400, { error: 'too_many' });
    const ok = equal(await sha256(`${userId}:${code}`), current.code_hash);
    if (!ok) {
      await admin.from('email_verifications').update({ attempts: current.attempts + 1, updated_at: new Date(now).toISOString() }).eq('user_id', userId);
      return json(400, { error: current.attempts + 1 >= MAX_ATTEMPTS ? 'too_many' : 'wrong_code' });
    }
    const { error } = await admin.from('email_verifications').update({
      verified_at: new Date(now).toISOString(), code_hash: null, code_expires_at: null, attempts: 0, updated_at: new Date(now).toISOString(),
    }).eq('user_id', userId);
    if (error) return json(500, { error: 'store_failed' });
    // Premium bought on anacan.az with this e-mail attaches now (the sync links and merges it).
    let premium = false;
    try { premium = !!(await syncEntitlementForUser(userId)).isPro; } catch { /* the next app-open sync retries */ }
    return json(200, { verified: true, premium });
  }

  return json(400, { error: 'invalid_action' });
});
