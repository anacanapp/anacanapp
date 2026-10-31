// dodo-webhook — Dodo Payments events for web Premium. The Standard Webhooks signature is verified on
// the raw body; each webhook-id is applied once; the subscription is re-read from the Dodo API (event
// order does not matter), stored, linked to an account with a Google/Apple-verified matching email, and
// the shared entitlement sync merges it into subscriptions/profiles.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { dodoConfig, dodoRequest, verifyStandardWebhook, type DodoSubscription } from '../_shared/dodo.ts';
import { syncEntitlementForUser } from '../_shared/revenuecat-sync.ts';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const config = dodoConfig();
  if (!config.ready || !config.webhookKey) return json(503, { error: 'payments_unavailable' });
  const raw = await req.text();
  if (raw.length > 256_000) return json(413, { error: 'payload_too_large' });
  if (!(await verifyStandardWebhook(raw, req.headers, config.webhookKey))) return json(401, { error: 'invalid_signature' });

  let event: { type?: string; data?: Record<string, any> };
  try { event = JSON.parse(raw); } catch { return json(400, { error: 'invalid_payload' }); }
  const type = String(event.type || '');
  const data = event.data || {};
  const subscriptionId: string | null = typeof data.subscription_id === 'string' ? data.subscription_id : null;
  const webhookId = req.headers.get('webhook-id')!;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: seen } = await admin.from('web_payment_webhooks').select('webhook_id').eq('webhook_id', webhookId).maybeSingle();
  if (seen) return json(200, { received: true, duplicate: true });

  if (subscriptionId && (type.startsWith('subscription.') || type === 'payment.succeeded')) {
    let sub: DodoSubscription;
    try {
      sub = await dodoRequest<DodoSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
    } catch (e) {
      // Not recorded: Dodo retries the delivery.
      console.error('[dodo-webhook] subscription fetch failed:', e instanceof Error ? e.message : 'unknown');
      return json(502, { error: 'subscription_unavailable' });
    }
    const plan = sub.product_id === config.products.yearly ? 'yearly' : sub.product_id === config.products.monthly ? 'monthly' : null;
    const email = (sub.customer?.email || '').trim().toLowerCase();
    if (!plan || !email) {
      console.error('[dodo-webhook] unknown product or missing email for', subscriptionId);
    } else {
      const checkoutId = sub.metadata?.anacan_checkout && /^[0-9a-f-]{36}$/i.test(sub.metadata.anacan_checkout) ? sub.metadata.anacan_checkout : null;
      const { error } = await admin.from('web_subscriptions').upsert({
        provider_subscription_id: sub.subscription_id,
        provider_customer_id: sub.customer?.customer_id || null,
        checkout_id: checkoutId,
        email,
        product_id: sub.product_id,
        plan,
        status: sub.status,
        current_period_end: sub.next_billing_date || null,
        cancel_at_period_end: !!sub.cancel_at_next_billing_date,
        test_mode: config.testMode,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'provider_subscription_id' });
      if (error) {
        console.error('[dodo-webhook] store failed');
        return json(500, { error: 'store_failed' });
      }
      const { data: userId } = await admin.rpc('web_subscription_link_email_v1', { p_subscription_id: sub.subscription_id });
      if (typeof userId === 'string' && userId) {
        const result = await syncEntitlementForUser(userId);
        if (!result.ok) console.error('[dodo-webhook] entitlement sync failed:', result.reason);
      }
    }
  }

  await admin.from('web_payment_webhooks').insert({ webhook_id: webhookId, event_type: type.slice(0, 80), object_id: subscriptionId || data.payment_id || null });
  return json(200, { received: true });
});
