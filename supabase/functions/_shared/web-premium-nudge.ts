// Abandoned web checkout reminder: one e-mail (Customer.io transactional) + one push (FCM) to a buyer who opened the
// Epoint bank page and left without paying, while the campaign is open. Claimed by
// web_premium_checkout_nudges_due_v1 (20261108070000_web_premium_checkout_nudge.sql); called from web-premium-renew
// with {"mode":"nudge"} by a 15-minute timer. Never logs addresses, tokens or user ids.
import { getFirebaseAccessToken, sendFCMv1 } from './fcm.ts';
import { CAMPAIGN_PAGE } from './web-premium-subscription.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;
type Plan = 'monthly' | 'yearly';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

export function nudgeLink(channel: 'email' | 'push') {
  return `${CAMPAIGN_PAGE}?utm_source=${channel}&utm_medium=reminder&utm_campaign=checkout_nudge`;
}

/** "bu gün saat 23:59-da" when the offer ends today in Baku, otherwise "8 noyabr saat 23:59-da". */
export function endsText(endsAt: string | null | undefined, now = new Date()): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (!Number.isFinite(end.getTime())) return null;
  const tz = 'Asia/Baku';
  const dayOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('az-AZ', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(end);
  if (dayOf(end) === dayOf(now)) return `bu gün saat ${time}-da`;
  const date = new Intl.DateTimeFormat('az-AZ', { timeZone: tz, day: 'numeric', month: 'long' }).format(end);
  return `${date} saat ${time}-da`;
}

/** Plain, short copy (no dashes). */
export function nudgeCopy(plan: Plan, endsAt: string | null | undefined, now = new Date()) {
  const ends = endsText(endsAt, now);
  const planText = plan === 'yearly' ? 'illik' : 'aylıq';
  const endLine = ends ? `Endirimli qiymət ${ends} bitir.` : 'Endirimli qiymət hələ qüvvədədir.';
  return {
    subject: 'Premium ödənişin yarımçıq qaldı',
    heading: 'Ödənişi tamamlamaq istəyirsən?',
    body: `Anacan Premium (${planText} plan) üçün bank səhifəsini açmısan, amma ödəniş tamamlanmayıb. ${endLine}`,
    trust: 'Kart məlumatlarını bankın təhlükəsiz Epoint səhifəsində daxil edirsən. Abunəliyi istədiyin vaxt ləğv edə bilərsən.',
    help: 'Ödənişdə problem yarandısa, support@anacan.az ünvanına yaz, kömək edək.',
    cta: 'Ödənişi tamamla',
    pushTitle: 'Premium ödənişin yarımçıq qaldı',
    pushBody: ends ? `Endirim ${ends} bitir. Ödənişi bir dəqiqəyə tamamla.` : 'Endirimli qiymət hələ qüvvədədir. Ödənişi bir dəqiqəyə tamamla.',
  };
}

export function nudgeEmailHtml(copy: ReturnType<typeof nudgeCopy>, link: string) {
  return `<!doctype html><html lang="az"><body style="margin:0;background:#FFF7F3;font-family:Arial,sans-serif">
<table role="presentation" width="100%" style="background:#FFF7F3;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:500px;background:#fff;border-radius:20px;padding:28px">
<tr><td style="font:800 20px Arial,sans-serif;color:#FF5A5F;padding-bottom:14px">Anacan</td></tr>
<tr><td style="font:800 20px Arial,sans-serif;color:#333;padding-bottom:8px">${escapeHtml(copy.heading)}</td></tr>
<tr><td style="font:15px/1.55 Arial,sans-serif;color:#555;padding-bottom:20px">${escapeHtml(copy.body)}</td></tr>
<tr><td style="padding-bottom:18px"><a href="${link}" style="display:inline-block;background:#FF5A5F;color:#fff;text-decoration:none;font:700 15px Arial,sans-serif;padding:13px 24px;border-radius:999px">${escapeHtml(copy.cta)}</a></td></tr>
<tr><td style="font:13px/1.5 Arial,sans-serif;color:#777;padding-bottom:10px">${escapeHtml(copy.trust)}</td></tr>
<tr><td style="font:13px/1.5 Arial,sans-serif;color:#777;padding-bottom:16px">${escapeHtml(copy.help)}</td></tr>
<tr><td style="font:12px Arial,sans-serif;color:#aaa;border-top:1px solid #f1e6e2;padding-top:16px">Anacan · anacan.az</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendEmail(userId: string, to: string | null, copy: ReturnType<typeof nudgeCopy>): Promise<boolean> {
  const key = Deno.env.get('CUSTOMERIO_APP_API_KEY');
  const from = Deno.env.get('WEB_PREMIUM_EMAIL_FROM') || Deno.env.get('BOOKS_EMAIL_FROM') || Deno.env.get('EMAIL_VERIFICATION_FROM');
  if (!key || !from || !to || to.endsWith('@users.anacan.az')) return false;
  const link = nudgeLink('email');
  try {
    const host = Deno.env.get('CUSTOMERIO_REGION') === 'us' ? 'https://api.customer.io' : 'https://api-eu.customer.io';
    const response = await fetch(`${host}/v1/send/email`, {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, from, subject: copy.subject, body: nudgeEmailHtml(copy, link),
        plaintext_body: `${copy.heading}\n\n${copy.body}\n\n${copy.cta}: ${link}\n\n${copy.trust}\n${copy.help}`,
        identifiers: { id: userId }, send_to_unsubscribed: true, tracked: false }),
    });
    if (!response.ok) console.error('[web-premium-nudge] email failed:', response.status);
    return response.ok;
  } catch {
    console.error('[web-premium-nudge] email failed: network');
    return false;
  }
}

async function sendPush(admin: Admin, fcm: { accessToken: string; projectId: string } | null, userId: string, copy: ReturnType<typeof nudgeCopy>): Promise<number> {
  if (!fcm) return 0;
  const { data: tokens } = await admin.from('device_tokens').select('token').eq('user_id', userId);
  let sent = 0;
  for (const t of (tokens ?? []).slice(0, 10)) {
    const r = await sendFCMv1(fcm.accessToken, fcm.projectId, t.token, copy.pushTitle, copy.pushBody,
      { type: 'web_checkout', deeplink: nudgeLink('push') });
    if (r.success) sent += 1;
    // Log only the provider code (never the token) so a failed reminder push can be diagnosed.
    else console.error('[web-premium-nudge] push failed:', r.errorCode ?? r.httpStatus ?? 'unknown');
    if (r.unregistered) await admin.from('device_tokens').delete().eq('token', t.token);
  }
  return sent;
}

/** Claims due reminders and sends them. Returns counts only. */
export async function runCheckoutNudges(admin: Admin) {
  const summary = { campaign_active: false, due: 0, email: 0, push: 0, errors: 0 };
  const { data, error } = await admin.rpc('web_premium_checkout_nudges_due_v1', { p_limit: 50 });
  if (error) { summary.errors += 1; return summary; }
  summary.campaign_active = data?.campaign_active === true;
  const due: { nudge_id: string; user_id: string; plan: Plan }[] = Array.isArray(data?.due) ? data.due : [];
  summary.due = due.length;
  if (!due.length) return summary;

  let fcm: { accessToken: string; projectId: string } | null = null;
  const sa = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (sa) { try { fcm = await getFirebaseAccessToken(sa); } catch { console.error('[web-premium-nudge] fcm auth failed'); } }

  for (const row of due) {
    try {
      const copy = nudgeCopy(row.plan === 'yearly' ? 'yearly' : 'monthly', data?.ends_at ?? null);
      const { data: user } = await admin.auth.admin.getUserById(row.user_id).catch(() => ({ data: null }));
      const emailOk = await sendEmail(row.user_id, user?.user?.email ?? null, copy);
      const pushCount = await sendPush(admin, fcm, row.user_id, copy);
      if (emailOk) summary.email += 1;
      summary.push += pushCount;
      await admin.rpc('web_premium_checkout_nudge_sent_v1', { p_nudge: row.nudge_id, p_email: emailOk, p_push: pushCount });
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}
