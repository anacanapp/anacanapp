import { createClient } from 'npm:@supabase/supabase-js@2';
import { getFirebaseAccessToken, sendFCMv1 } from '../_shared/fcm.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { fetchAllPaged } from '../_shared/paginate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeviceToken {
  token: string;
  user_id: string;
  platform: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin-only: bulk push to all users.
    const adminCheck = await requireAdmin(req);
    if (adminCheck.error) return adminCheck.error;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { notificationId } = await req.json();

    if (!notificationId) {
      return new Response(
        JSON.stringify({ error: 'notificationId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
      return new Response(
        JSON.stringify({ error: 'Firebase service account not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessToken, projectId } = await getFirebaseAccessToken(saJson);

    const { data: notification, error: notifError } = await supabase
      .from('bulk_push_notifications').select('*').eq('id', notificationId).single();

    if (notifError || !notification) {
      return new Response(
        JSON.stringify({ error: 'Notification not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.from('bulk_push_notifications').update({ status: 'sending' }).eq('id', notificationId);

    const profiles = await fetchAllPaged<any>(() => {
      let q = supabase.from('profiles').select('user_id, life_stage, role').order('user_id');
      if (notification.target_audience !== 'all') {
        // QEYD (bug düzəlişi): 'partner' profiles.role-da HEÇ VAXT olmur — bu, life_stage dəyəridir.
        q = q.eq('life_stage', notification.target_audience);
      }
      return q;
    });

    if (!profiles.length) {
      await supabase.from('bulk_push_notifications').update({
        status: 'sent', sent_at: new Date().toISOString(), total_sent: 0, total_failed: 0,
      }).eq('id', notificationId);
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: 'No matching users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userIds = profiles.map((p: any) => p.user_id);
    // Bütün device_token-lar səhifələnərək yüklənir (1000 limitini keçmək üçün).
    const userIdSet = new Set<string>(userIds);
    const allTokens = await fetchAllPaged<DeviceToken>(() =>
      supabase.from('device_tokens').select('token, user_id, platform').order('token')
    );
    const tokens = allTokens.filter((t) => userIdSet.has(t.user_id));

    if (!tokens?.length) {
      await supabase.from('bulk_push_notifications').update({
        status: 'sent', sent_at: new Date().toISOString(), total_sent: 0, total_failed: 0,
      }).eq('id', notificationId);
      return new Response(
        JSON.stringify({ sent: 0, failed: 0, message: 'No device tokens found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending bulk push to ${tokens.length} devices via FCM v1`);

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    const batchSize = 100;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const promises = batch.map(async (deviceToken: DeviceToken) => {
        const result = await sendFCMv1(accessToken, projectId, deviceToken.token, notification.title, notification.body, {
          type: 'bulk', notification_id: notificationId,
        });

        if (result.success) {
          sentCount++;
          await supabase.from('notification_send_log').insert({
            user_id: deviceToken.user_id, notification_id: null,
            title: notification.title, body: notification.body, status: 'sent',
          });
        } else {
          failedCount++;
          // Log first 5 errors for debugging
          if (errors.length < 5) {
            errors.push(`${deviceToken.platform}|${deviceToken.token.slice(-8)}|code=${result.errorCode || '?'}|${result.error}`);
          }
          // Only delete tokens that FCM definitively reports as dead.
          if (result.unregistered) {
            await supabase.from('device_tokens').delete().eq('token', deviceToken.token);
          }
        }
      });
      await Promise.all(promises);
    }

    if (errors.length > 0) {
      console.error('FCM errors sample:', JSON.stringify(errors));
    }
    await supabase.from('bulk_push_notifications').update({
      status: 'sent', sent_at: new Date().toISOString(), total_sent: sentCount, total_failed: failedCount,
    }).eq('id', notificationId);

    console.log(`Bulk push complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount, total: tokens.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in send-bulk-push:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
