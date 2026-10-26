import { createClient } from 'npm:@supabase/supabase-js@2';
import { getFirebaseAccessToken, sendFCMv1 } from '../_shared/fcm.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { requireNotificationCron } from '../_shared/notification-auth.ts';
import { startRunLog, finishRunLog, logFailedSend, bumpReason } from '../_shared/notif-logging.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let runId: string | null = null;
  let runSupabase: any = null;
  const reasons: Record<string, number> = {};
  let failedCount = 0;
  let skippedCount = 0;

  try {
    let body: { manual?: boolean; userId?: string; skipDedup?: boolean } = {};
    try { body = await req.json(); } catch { /* No body */ }

    // Auth: cron secret OR admin user for manual test
    let triggeredBy = 'cron';
    const cronErr = await requireNotificationCron(req, 'send-vitamin-reminders');
    if (cronErr) {
      const adminCheck = await requireAdmin(req);
      if (adminCheck.error) return adminCheck.error;
      triggeredBy = body.manual && body.userId ? 'admin-test' : 'admin';
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    runSupabase = supabase;

    // Get current Baku time (UTC+4)
    const now = new Date();
    const bakuOffsetMs = 4 * 60 * 60 * 1000;
    const bakuNow = new Date(now.getTime() + bakuOffsetMs);
    const targetTime = new Date(bakuNow.getTime() + 5 * 60 * 1000);
    const targetHour = targetTime.getUTCHours().toString().padStart(2, '0');
    const targetMinute = targetTime.getUTCMinutes().toString().padStart(2, '0');
    const bakuTimeStr = `${String(bakuNow.getUTCHours()).padStart(2, '0')}:${String(bakuNow.getUTCMinutes()).padStart(2, '0')}`;

    runId = await startRunLog(supabase, 'send-vitamin-reminders', triggeredBy, bakuTimeStr, body.manual ? 'manual' : null);

    // Also check +/- 1 minute for cron tolerance
    const targetTimeMinus = new Date(targetTime.getTime() - 60 * 1000);
    const targetTimePlus = new Date(targetTime.getTime() + 60 * 1000);
    const timeMin = `${targetTimeMinus.getUTCHours().toString().padStart(2, '0')}:${targetTimeMinus.getUTCMinutes().toString().padStart(2, '0')}:00`;
    const timeMax = `${targetTimePlus.getUTCHours().toString().padStart(2, '0')}:${targetTimePlus.getUTCMinutes().toString().padStart(2, '0')}:00`;

    const currentDayOfWeek = bakuNow.getUTCDay();

    console.log(`Checking vitamin reminders for time range ${timeMin}-${timeMax}, day: ${currentDayOfWeek}`);

    // For admin test mode: skip time/day filters, just look at user's schedules
    let schedQuery = supabase
      .from('user_vitamin_schedules')
      .select('*')
      .eq('is_active', true)
      .eq('notification_enabled', true);

    if (body.manual) {
      if (body.userId) schedQuery = schedQuery.eq('user_id', body.userId);
    } else {
      schedQuery = schedQuery
        .gte('scheduled_time', timeMin)
        .lte('scheduled_time', timeMax)
        .contains('days_of_week', [currentDayOfWeek]);
    }

    const { data: schedules, error: schedError } = await schedQuery;

    if (schedError) {
      console.error('Error fetching schedules:', schedError);
      throw schedError;
    }

    if (!schedules?.length) {
      console.log('No vitamin reminders to send');
      const reason = body.manual ? 'no_active_schedule_for_user' : 'no_schedules_in_window';
      bumpReason(reasons, reason);
      await finishRunLog(supabase, runId, { status: 'success', skipped_count: 1, reasons });
      return new Response(
        JSON.stringify({ message: 'No reminders', sent: 0, reasons }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${schedules.length} vitamin reminders to process`);

    // Skip "already taken" dedup in admin test mode
    let pendingSchedules = schedules;
    if (!body.skipDedup) {
      const today = bakuNow.toISOString().split('T')[0];
      const scheduleIds = schedules.map((s: any) => s.id);
      const { data: takenLogs } = await supabase
        .from('vitamin_intake_logs')
        .select('schedule_id')
        .in('schedule_id', scheduleIds)
        .eq('log_date', today);
      const takenScheduleIds = new Set(takenLogs?.map((l: any) => l.schedule_id) || []);
      pendingSchedules = schedules.filter((s: any) => !takenScheduleIds.has(s.id));
      const taken = schedules.length - pendingSchedules.length;
      if (taken > 0) { skippedCount += taken; reasons['already_taken'] = taken; }
    }

    if (!pendingSchedules.length) {
      console.log('All vitamins already taken');
      await finishRunLog(supabase, runId, { status: 'success', skipped_count: skippedCount, reasons });
      return new Response(
        JSON.stringify({ message: 'All taken', sent: 0, reasons }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
      console.log('FIREBASE_SERVICE_ACCOUNT_JSON not configured');
      await finishRunLog(supabase, runId, { status: 'error', error_message: 'FCM not configured' });
      return new Response(
        JSON.stringify({ message: 'FCM not configured', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessToken, projectId } = await getFirebaseAccessToken(saJson);

    let sentCount = 0;

    // Group by user
    const userSchedules: Record<string, any[]> = {};
    for (const s of pendingSchedules) {
      (userSchedules[s.user_id] ||= []).push(s);
    }

    // Pre-fetch language preferences for involved users
    const userIds = Object.keys(userSchedules);
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, language')
      .in('user_id', userIds);
    const langByUser = new Map<string, string>();
    prefs?.forEach((p: any) => langByUser.set(p.user_id, p.language || 'az'));

    for (const [userId, userVitamins] of Object.entries(userSchedules)) {
      const { data: tokens } = await supabase
        .from('device_tokens')
        .select('token, platform')
        .eq('user_id', userId);

      if (!tokens?.length) { skippedCount++; bumpReason(reasons, 'no_device_token'); continue; }

      const userLang = langByUser.get(userId) || 'az';
      const isEn = userLang === 'en';
      const isRu = userLang === 'ru';
      const isTr = userLang === 'tr';
      const isKk = userLang === 'kk';
      const isUz = userLang === 'uz';
      const isKa = userLang === 'ka';
      const isDe = userLang === 'de';
      const isAr = userLang === 'ar';
      const vitaminNames = userVitamins.map((v: any) => `${v.icon_emoji} ${v.vitamin_name}`).join(', ');
      
      const title = body.manual
        ? (isEn ? '[TEST] 💊 Vitamin reminder' : isRu ? '[TEST] 💊 Напоминание о витаминах' : isTr ? '[TEST] 💊 Vitamin hatırlatıcısı' : isKk ? '[TEST] 💊 Дәрумен туралы хабарлама' : isUz ? '[TEST] 💊 Vitamin eslatmasi' : isKa ? '[TEST] 💊 ვიტამინების შეხსენება' : isDe ? '[TEST] 💊 Vitamin-Erinnerung' : isAr ? '[TEST] 💊 إشعار الفيتامينات' : '[TEST] 💊 Vitamin bildirişi')
        : (isEn ? '💊 Time to take your vitamins!' : isRu ? '💊 Время принимать витамины!' : isTr ? '💊 Vitaminlerinizi alma zamanı!' : isKk ? '💊 Дәрумен қабылдайтын уақыт келді!' : isUz ? '💊 Vitaminlarni qabul qilish vaqti!' : isKa ? '💊 ვიტამინების მიღების დროა!' : isDe ? '💊 Zeit für deine Vitamine!' : isAr ? '💊 حان وقت تناول الفيتامينات!' : '💊 Vitamin qəbulu vaxtıdır!');
      
      const bodyText = userVitamins.length === 1
        ? (isEn ? `Time to take ${userVitamins[0].vitamin_name}`
         : isRu ? `Время принимать ${userVitamins[0].vitamin_name}`
         : isTr ? `${userVitamins[0].vitamin_name} alma zamanı`
         : isKk ? `${userVitamins[0].vitamin_name} қабылдайтын уақыт келді`
         : isUz ? `${userVitamins[0].vitamin_name} qabul qilish vaqti keldi`
         : isKa ? `${userVitamins[0].vitamin_name} — მიღების დროა`
         : isDe ? `Es ist Zeit, ${userVitamins[0].vitamin_name} einzunehmen`
         : isAr ? `حان وقت تناول ${userVitamins[0].vitamin_name}`
         : `${userVitamins[0].vitamin_name} qəbul etmə vaxtıdır`)
        : (isEn ? `Time to take ${userVitamins.length} vitamins: ${vitaminNames}`
         : isRu ? `Время принимать ${userVitamins.length} витаминов: ${vitaminNames}`
         : isTr ? `${userVitamins.length} vitamin alma zamanı: ${vitaminNames}`
         : isKk ? `${userVitamins.length} дәрумен қабылдайтын уақыт келді: ${vitaminNames}`
         : isUz ? `${userVitamins.length} ta vitamin qabul qilish vaqti keldi: ${vitaminNames}`
         : isKa ? `${userVitamins.length} ვიტამინის მიღების დროა: ${vitaminNames}`
         : isDe ? `Es ist Zeit, ${userVitamins.length} Vitamine einzunehmen: ${vitaminNames}`
         : isAr ? `حان وقت تناول ${userVitamins.length} من الفيتامينات: ${vitaminNames}`
         : `${userVitamins.length} vitamin qəbul etmə vaxtıdır: ${vitaminNames}`);

      // Store notification in DB (skip for test to avoid pollution)
      if (!body.manual) {
        try {
          await supabase.from('notifications').insert({
            user_id: userId,
            title,
            message: bodyText,
            notification_type: 'vitamin_reminder',
            is_read: false,
          });
        } catch (e) {
          console.error('Error storing notification:', e);
        }
      }

      let delivered = false;
      let lastErr: { code?: string; msg?: string } = {};
      for (const { token } of tokens) {
        const result = await sendFCMv1(accessToken, projectId, token, title, bodyText, {
          type: 'vitamin_reminder',
          screen: 'vitamin-tracker',
        });

        if (result.success) {
          sentCount++;
          delivered = true;
          await supabase.from('notification_send_log').insert({
            user_id: userId, title, body: bodyText, status: 'sent',
            notification_type: 'vitamin_reminder', source_type: 'vitamin_reminder',
            source_notification_id: userVitamins[0]?.id ?? null,
          });
          break;
        } else {
          lastErr = { code: result.errorCode, msg: result.error };
          if (result.unregistered) {
            await supabase.from('device_tokens').delete().eq('token', token);
          }
        }
      }
      if (!delivered) {
        failedCount++;
        bumpReason(reasons, `fcm:${lastErr.code || 'unknown'}`);
        await logFailedSend(supabase, {
          user_id: userId,
          notification_type: 'vitamin_reminder',
          source_type: 'vitamin_reminder',
          source_notification_id: userVitamins[0]?.id ?? null,
          title, body: bodyText,
          reason: lastErr.msg || 'FCM send failed',
          error_code: lastErr.code,
        });
      }
    }

    console.log(`Vitamin reminders sent: ${sentCount} success, ${failedCount} failed`);

    await finishRunLog(supabase, runId, {
      status: 'success',
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      eligible_count: Object.keys(userSchedules).length,
      reasons,
    });

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount, skipped: skippedCount, reasons }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in send-vitamin-reminders:', err);
    if (runSupabase && runId) {
      await finishRunLog(runSupabase, runId, { status: 'error', error_message: err instanceof Error ? err.message : String(err) });
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
