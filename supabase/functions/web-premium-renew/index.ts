// web-premium-renew — daily timer (and, with {"mode":"nudge"}, the 15-minute abandoned-checkout reminder) for the anacan.az web subscriptions (POST, header x-cron-secret = CRON_SECRET).
// 1. Housekeeping: cancelled subscriptions whose period ended expire; abandoned checkouts and card registrations close.
// 2. Every subscription whose next_charge_at has come (one day before the period ends; failed renewals 24 h later),
//    that is active / past_due and not cancelled, is charged on its saved card with Epoint execute-pay
//    (order_id = a new web_premium_charges row) and confirmed with get-status. Success extends the period and the
//    entitlement (web_subscriptions + entitlement sync) and earns QayğıCash; a failure is retried after 24 h, three
//    attempts in all, then the subscription expires (Premium ends at current_period_end).
// Idempotent per (subscription, period): a charge left pending by an interrupted run is checked with get-status
// before anything is charged again. Answers counts only; never logs card ids, e-mails or amounts per user.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { epointConfig } from '../_shared/epoint.ts';
import { syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';
import { sendWebPremiumEmail } from '../_shared/web-premium-email.ts';
import { checkReminderPush, runCheckoutNudges } from '../_shared/web-premium-nudge.ts';
import { runBookCheckoutNudges } from '../_shared/book-nudge.ts';
import { fcmFromEnv, runStoreExpiringPushes, sendWebRenewalPush } from '../_shared/premium-lifecycle-push.ts';
import { applyChargeResult, executeRenewal, isPlan } from '../_shared/web-premium-subscription.ts';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });

/** Only the timer's secret header is accepted here (not the public anon key, unlike the notification jobs). */
function authorized(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET') ?? '';
  const got = req.headers.get('x-cron-secret') ?? '';
  if (expected.length < 16 || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!authorized(req)) return json(401, { error: 'unauthorized' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } });
  // 15-minute timer: only the abandoned-checkout reminder (e-mail + push), no charging.
  const body = await req.json().catch(() => ({}));
  if (body && body.mode === 'push-check') {
    // Diagnostics only: validate_only FCM requests, nothing is delivered.
    return json(200, { mode: 'push-check', ...(await checkReminderPush(admin)) });
  }
  if (body && body.mode === 'nudge') {
    const nudges = await runCheckoutNudges(admin);
    // 2026-11-13: the same timer also reminds abandoned PDF book checkouts (push only, ~1 hour later).
    const books = await runBookCheckoutNudges(admin).catch(() => ({ due: 0, push: 0, errors: 1, push_issues: {} }));
    // 2026-11-13: App Store / Google Play Premium ending soon with auto-renew off (23 languages, user local daytime).
    const store_expiring = await runStoreExpiringPushes(admin).catch(() => ({ due: 0, push: 0, errors: 1, push_issues: {} }));
    console.log('[web-premium-renew] nudge', JSON.stringify({ ...nudges, books, store_expiring }));
    return json(200, { mode: 'nudge', ...nudges, books, store_expiring });
  }
  const config = await epointConfig(admin);
  if (!config.merchantLive) return json(503, { error: 'payment_merchant_not_live' });

  const summary = { due: 0, paid: 0, failed: 0, expired: 0, pending: 0, skipped: 0, errors: 0, pushes: 0, housekeeping: null as unknown };
  const { data: housekeeping, error: houseError } = await admin.rpc('web_premium_housekeeping_v1');
  summary.housekeeping = houseError ? 'error' : housekeeping;

  const { data: due, error } = await admin.rpc('web_premium_renewals_due_v1', { p_limit: 200 });
  if (error) return json(503, { error: 'database_unavailable', ...summary });
  const ids: string[] = (Array.isArray(due) ? due : []).map((row: unknown) => typeof row === 'string' ? row : (row as Record<string, string>)?.web_premium_renewals_due_v1).filter(Boolean);
  summary.due = ids.length;
  const deadline = Date.now() + 100_000;
  let fcm: Awaited<ReturnType<typeof fcmFromEnv>> | undefined;
  const pushIssues: Record<string, number> = {};
  const users = new Map<string, string | null>();
  const emailOf = async (userId: string) => {
    if (!users.has(userId)) {
      const { data } = await admin.auth.admin.getUserById(userId).catch(() => ({ data: null }));
      users.set(userId, data?.user?.email ?? null);
    }
    return users.get(userId) ?? null;
  };

  for (const id of ids) {
    if (Date.now() > deadline) { summary.skipped += 1; continue; }
    try {
      const { data: claim, error: claimError } = await admin.rpc('web_premium_renewal_claim_v1', { p_subscription: id });
      if (claimError || !claim) { summary.errors += 1; continue; }
      if (claim.due !== true) { summary.skipped += 1; continue; }
      const plan = isPlan(claim.plan) ? claim.plan : 'monthly';
      let outcome;
      if (claim.resumed === true) {
        // An earlier run sent (or tried to send) this charge: Epoint's status decides; never charge it twice.
        outcome = await applyChargeResult(admin, config, claim.charge_id, {});
        if (outcome.result === 'pending' && Date.now() - Date.parse(claim.created_at) > 6 * 3600_000) {
          const { data } = await admin.rpc('web_premium_charge_failed_v1', { p_charge: claim.charge_id, p_error: 'not_completed' });
          outcome = { result: 'failed' as const, detail: data };
        }
      } else if (!claim.card_id) {
        const { data } = await admin.rpc('web_premium_charge_failed_v1', { p_charge: claim.charge_id, p_error: 'no_active_card' });
        outcome = { result: 'failed' as const, detail: data };
      } else {
        outcome = await executeRenewal(admin, config, { charge_id: claim.charge_id, amount: Number(claim.amount), plan, card_id: claim.card_id });
      }

      const userId = claim.user_id as string;
      if (outcome.result === 'paid' || outcome.result === 'duplicate') {
        summary.paid += 1;
        const sync = await syncEntitlementForUser(userId);
        if (!sync.ok) console.error('[web-premium-renew] entitlement sync failed:', sync.reason);
        if (outcome.result === 'paid') {
          await sendWebPremiumEmail('receipt', { userId, to: await emailOf(userId), plan, amount: Number(claim.amount), periodEnd: outcome.detail?.period_end as string });
        }
      } else if (outcome.result === 'failed') {
        const expired = outcome.detail?.outcome === 'expired';
        if (expired) summary.expired += 1; else summary.failed += 1;
        const sync = await syncEntitlementForUser(userId);
        if (!sync.ok) console.error('[web-premium-renew] entitlement sync failed:', sync.reason);
        if (outcome.detail?.outcome === 'retry' || expired) {
          await sendWebPremiumEmail(expired ? 'expired' : 'renewal_failed', { userId, to: await emailOf(userId), plan,
            amount: Number(claim.amount), periodEnd: outcome.detail?.period_end as string });
          // 2026-11-13: one push per failed/expired charge next to the e-mail.
          if (fcm === undefined) fcm = await fcmFromEnv();
          summary.pushes += await sendWebRenewalPush(admin, fcm, userId, expired ? 'web_expired' : 'web_renewal_failed',
            String(claim.charge_id), pushIssues);
        }
      } else {
        summary.pending += 1;
      }
    } catch (e) {
      summary.errors += 1;
      console.error('[web-premium-renew] subscription failed:', e instanceof Error ? e.message.slice(0, 80) : 'unknown');
    }
  }
  console.log('[web-premium-renew]', JSON.stringify(summary));
  return json(200, { ...summary, push_issues: pushIssues });
});
