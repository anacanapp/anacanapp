import { syncEntitlementForUser, syncRevenueCatTransfer } from '../_shared/revenuecat-sync.ts';
import { qaygicashFromStoreEvent } from '../_shared/qaygicash.ts';

const userEvents = new Set([
  'INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE',
  'CANCELLATION', 'UNCANCELLATION', 'BILLING_ISSUE', 'EXPIRATION',
  'SUBSCRIPTION_PAUSED', 'SUBSCRIPTION_EXTENDED', 'TEMPORARY_ENTITLEMENT_GRANT', 'REFUND_REVERSED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Allow': 'POST' },
  });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
    const apiKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const backendUrl = Deno.env.get('SUPABASE_URL');
    if (!secret || secret.length < 32 || secret.length > 4096 || secret !== secret.trim()
      || /[\x00-\x1f\x7f,]/.test(secret) || secret === serviceKey || secret === apiKey
      || secret === Deno.env.get('SUPABASE_ANON_KEY') || /^sb_(publishable|secret)_/.test(secret)
      || !apiKey?.trim() || !serviceKey?.trim() || !backendUrl?.trim()) {
      return json({ ok: false, error: 'webhook_not_configured' }, 503);
    }

    // Match the Azure router's custom-secret contract, not a user/project JWT.
    // Authenticate before parsing any body or calling the entitlement helper.
    const provided = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (!provided || provided.length > 4096 || /[\x00-\x1f\x7f,]/.test(provided)) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(secret));
    if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(provided))) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    if (req.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ ok: false, error: 'unsupported_content_type' }, 415);
    }
    const reader = req.body?.getReader();
    if (!reader) return json({ ok: false, error: 'invalid_webhook_body' }, 400);
    let body: unknown;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      let text = '';
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 32_768) {
          await reader.cancel().catch(() => {});
          return json({ ok: false, error: 'webhook_body_too_large' }, 413);
        }
        text += decoder.decode(value, { stream: true });
      }
      body = JSON.parse(text + decoder.decode());
    } catch { return json({ ok: false, error: 'invalid_webhook_body' }, 400); }
    finally { reader.releaseLock(); }

    if (!isRecord(body) || !isRecord(body.event) || typeof body.event.type !== 'string') {
      return json({ ok: false, error: 'invalid_webhook_event' }, 400);
    }
    const event = body.event;
    if (typeof event.id !== 'string' || !event.id.trim() || event.id.length > 128 || /[\x00-\x1f\x7f]/.test(event.id)) {
      return json({ ok: false, error: 'invalid_event_id' }, 400);
    }
    // Authenticated TEST events validate delivery only; they cannot grant access.
    if (event.type === 'TEST') return json({ ok: true, test: true });
    const allowedApps = (Deno.env.get('REVENUECAT_ALLOWED_APP_IDS') || '').split(',').filter(Boolean);
    if (allowedApps.length && (event.type !== 'TRANSFER' || event.app_id !== undefined)
      && (typeof event.app_id !== 'string' || !allowedApps.includes(event.app_id))) {
      return json({ ok: false, error: 'unexpected_revenuecat_app' }, 400);
    }
    if (event.environment !== undefined && !['PRODUCTION', 'SANDBOX'].includes(event.environment as string)) {
      return json({ ok: false, error: 'invalid_store_environment' }, 400);
    }
    // Transfer both sides in ONE SQL transaction after all provider reads succeed.
    // Custom/unmigrated identities stay retryable/reconciliation-required.
    if (event.type === 'TRANSFER') {
      const result = await syncRevenueCatTransfer(event);
      if (!result.ok) return json({ ok: false, error: result.reason === 'transfer_requires_reconciliation'
        ? 'transfer_requires_reconciliation' : result.reason === 'unknown_product' ? 'product_mapping_required'
          : result.reason === 'sandbox_entitlement' ? 'sandbox_entitlement_unsupported' : 'entitlement_sync_unavailable' },
      ['transfer_requires_reconciliation', 'unknown_product', 'sandbox_entitlement'].includes(result.reason || '') ? 422 : 503);
      return json({ ok: true, transferredUsers: result.transferredUsers });
    }
    if (!userEvents.has(event.type as string)) return json({ ok: false, error: 'unsupported_event_type' }, 422);
    const userId = event.app_user_id;
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ ok: false, error: 'invalid_app_user_id' }, 400);
    }

    // The helper reads provider truth and commits the event ID and entitlement
    // together. A second cancellation insert here would defeat its deduplication.
    const result = await syncEntitlementForUser(userId, event);
    if (!result.ok) {
      if (result.reason === 'invalid_user' || result.reason === 'invalid_store_event') {
        return json({ ok: false, error: 'invalid_webhook_event' }, 400);
      }
      if (result.reason === 'sandbox_entitlement') {
        return json({ ok: false, error: 'sandbox_entitlement_unsupported' }, 422);
      }
      if (result.reason === 'unknown_product') return json({ ok: false, error: 'product_mapping_required' }, 422);
      return json({ ok: false, error: 'entitlement_sync_unavailable' }, 503);
    }
    if ((event.type === 'CANCELLATION' || event.type === 'EXPIRATION') && result.cancellationRecorded !== true) {
      return json({ ok: false, error: 'cancellation_sync_incomplete' }, 503);
    }
    // QayğıCash bonus for paid store Premium (idempotent per transaction; never fails the webhook).
    await qaygicashFromStoreEvent(event);
    return json({ ok: true, isPro: result.isPro });
  } catch {
    // Never return/log raw requests, provider/DB exceptions, identities or secrets.
    return json({ ok: false, error: 'webhook_internal_error' }, 503);
  }
});
