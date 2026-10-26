import { createClient } from 'npm:@supabase/supabase-js@2';
import { getFirebaseAccessToken } from '../_shared/fcm.ts';
import { requireAdmin } from '../_shared/auth.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Cache-Control': 'no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async (req: Request) => {
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const permission = await requireAdmin(req); if (permission.error) return permission.error;
    const text = await req.text(); if (text.length > 1024) return json({ error: 'invalid_campaign_request' }, 400);
    let input: any; try { input = JSON.parse(text); } catch { return json({ error: 'invalid_campaign_request' }, 400); }
    // Old client/global notifications cannot accidentally enter the new sender.
    if (input?.contract !== 'anacan-admin-campaign-v1' || !uuid.test(input.notificationId || '')
      || Object.keys(input).sort().join(',') !== 'contract,notificationId') return json({ error: 'segmented_campaign_required' }, 409);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const contract = await admin.rpc('get_admin_console_contract_v1');
    if (contract.error || contract.data?.segmentedCampaigns !== true) return json({ error: 'admin_runtime_required' }, 503);
    const account = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!account) return json({ error: 'push_provider_not_configured' }, 503);
    // Obtain provider credentials before reserving deliveries; auth failure sends none.
    const provider = await getFirebaseAccessToken(account);
    if (provider.projectId !== 'anacan-mobile') return json({ error: 'push_provider_mismatch' }, 503);
    const claimId = crypto.randomUUID();
    const claimed = await admin.rpc('admin_notification_claim_v1', { p_id: input.notificationId, p_claim: claimId, p_limit: 40 });
    if (claimed.error || !Array.isArray(claimed.data?.items)) return json({ error: 'campaign_claim_failed' }, 409);
    const { items, title, body } = claimed.data;
    const receipts: Array<{ id: string; state: string; code: string }> = [];
    for (let offset = 0; offset < items.length; offset += 8) {
      await Promise.all(items.slice(offset, offset + 8).map(async (item: any) => {
        try {
          const response = await fetch(`https://fcm.googleapis.com/v1/projects/${provider.projectId}/messages:send`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
            headers: { Authorization: `Bearer ${provider.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { token: item.token, notification: { title, body },
              data: { type: 'bulk', notification_id: input.notificationId },
              android: { priority: 'HIGH', notification: item.sound ? { sound: 'default' } : {} },
              apns: { headers: { 'apns-priority': '10', 'apns-push-type': 'alert' }, payload: { aps: { alert: { title, body }, ...(item.sound ? { sound: 'default' } : {}) } } },
            } }),
          });
          if (response.ok) { receipts.push({ id: item.id, state: 'sent', code: '' }); return; }
          const error = await response.json().catch(() => ({}));
          const code = error?.error?.details?.find((value: any) => value.errorCode)?.errorCode || error?.error?.status || 'PROVIDER_REJECTED';
          const safe = /^[A-Z_]{1,80}$/.test(code) ? code : 'PROVIDER_REJECTED';
          receipts.push({ id: item.id, state: 'failed', code: safe });
          if (safe === 'UNREGISTERED') {
            // Compare both ID and token; never delete a token rotated in flight.
            await admin.from('device_tokens').delete().eq('id', item.tokenId).eq('user_id', item.userId).eq('token', item.token);
          }
        } catch {
          // Ambiguous provider outcome: never automatically resend and duplicate.
          receipts.push({ id: item.id, state: 'unknown', code: 'NETWORK_OUTCOME_UNKNOWN' });
        }
      }));
    }
    const finished = await admin.rpc('admin_notification_finish_v1', { p_id: input.notificationId, p_claim: claimId, p_results: receipts });
    if (finished.error) return json({ error: 'campaign_receipts_pending', campaignId: input.notificationId }, 503);
    return json({ ok: true, contract: 'anacan-admin-campaign-v1', campaign: finished.data });
  } catch { return json({ error: 'campaign_unavailable' }, 503); }
});
