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
    const text = await req.text(); if (text.length > 2048) return json({ error: 'invalid_campaign_request' }, 400);
    let input: any; try { input = JSON.parse(text); } catch { return json({ error: 'invalid_campaign_request' }, 400); }
    // Manual push to ONE account (admin test / support), optionally opening an in-app link.
    if (input?.contract === 'anacan-admin-direct-v1') return await direct(input, json);
    if (text.length > 1024) return json({ error: 'invalid_campaign_request' }, 400);
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
    // Optional in-app link (anacan://…), validated and hash-bound by admin_notification_claim_v1; the app opens it on tap.
    const deeplink = typeof claimed.data.deeplink === 'string' && /^(?:(?:anacan|com\.atlasoon\.anacan):\/\/|https:\/\/(?:www\.|app\.)?anacan\.az\/)[A-Za-z0-9/_?=&.%#-]{0,180}$/.test(claimed.data.deeplink) ? claimed.data.deeplink : null;
    const receipts: Array<{ id: string; state: string; code: string }> = [];
    for (let offset = 0; offset < items.length; offset += 8) {
      await Promise.all(items.slice(offset, offset + 8).map(async (item: any) => {
        try {
          const response = await fetch(`https://fcm.googleapis.com/v1/projects/${provider.projectId}/messages:send`, {
            method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
            headers: { Authorization: `Bearer ${provider.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { token: item.token, notification: { title, body },
              data: { type: 'bulk', notification_id: input.notificationId, ...(deeplink ? { deeplink } : {}) },
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

const LINK = /^(?:(?:anacan|com\.atlasoon\.anacan):\/\/|https:\/\/(?:www\.|app\.)?anacan\.az\/)[A-Za-z0-9/_?=&.%#-]{0,180}$/;
async function direct(input: any, json: (value: unknown, status?: number) => Response): Promise<Response> {
  const keys = Object.keys(input).sort().join(',');
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const deeplink = typeof input.deeplink === 'string' && input.deeplink.trim() ? input.deeplink.trim() : null;
  if (!['body,contract,email,title', 'body,contract,deeplink,email,title'].includes(keys) || !/^[^\s@]{1,64}@[^\s@]{1,189}$/.test(email)
    || title.length < 1 || title.length > 120 || body.length < 1 || body.length > 500 || (deeplink && !LINK.test(deeplink))) return json({ error: 'invalid_direct_push' }, 400);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile } = await admin.from('profiles').select('user_id').ilike('email', email).limit(2);
  if (!profile || profile.length !== 1) return json({ error: 'direct_user_not_found' }, 404);
  const userId = profile[0].user_id;
  const { data: prefs } = await admin.from('user_preferences').select('push_enabled,sound_enabled').eq('user_id', userId).maybeSingle();
  if (prefs?.push_enabled === false) return json({ error: 'direct_user_opted_out' }, 409);
  const { data: tokens } = await admin.from('device_tokens').select('id,token').eq('user_id', userId).limit(10);
  if (!tokens?.length) return json({ error: 'direct_no_device' }, 404);
  const account = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!account) return json({ error: 'push_provider_not_configured' }, 503);
  const provider = await getFirebaseAccessToken(account);
  if (provider.projectId !== 'anacan-mobile') return json({ error: 'push_provider_mismatch' }, 503);
  const sound = prefs?.sound_enabled !== false;
  let sent = 0, failed = 0;
  for (const item of tokens) {
    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${provider.projectId}/messages:send`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${provider.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: item.token, notification: { title, body },
          data: { type: 'admin_direct', ...(deeplink ? { deeplink } : {}) },
          android: { priority: 'HIGH', notification: sound ? { sound: 'default' } : {} },
          apns: { headers: { 'apns-priority': '10', 'apns-push-type': 'alert' }, payload: { aps: { alert: { title, body }, ...(sound ? { sound: 'default' } : {}) } } },
        } }),
      });
      if (response.ok) sent++;
      else {
        failed++;
        const error = await response.json().catch(() => ({}));
        const code = error?.error?.details?.find((value: any) => value.errorCode)?.errorCode || '';
        if (code === 'UNREGISTERED') await admin.from('device_tokens').delete().eq('id', item.id).eq('user_id', userId).eq('token', item.token);
      }
    } catch { failed++; }
  }
  return json({ ok: true, contract: 'anacan-admin-direct-v1', devices: tokens.length, sent, failed });
}
