// Node.js port of supabase/functions/send-vitamin-reminders/index.ts
// Azure Container Apps Job olaraq işə salınır (HTTP auth/CORS lazım deyil —
// Job-un özü etibarlı trigger-dir). Biznes-məntiq (vaxt pəncərəsi, dedup,
// dil seçimi, FCM göndərmə) ƏSL Deno versiyası ilə DAVRANIŞ baxımından
// EYNİDİR, yalnız supabase-js/PostgREST əvəzinə birbaşa Postgres SQL-i var.
import { getFirebaseAccessToken, sendFCMv1 } from './shared/fcm.mjs';
import { startRunLog, finishRunLog, logFailedSend, bumpReason } from './shared/notif-logging.mjs';
import { query, closePool } from './shared/db.mjs';
import { runAppointmentReminders } from './send-appointment-reminders.mjs';
import { vitaminSlices } from './vitamin-window.mjs';
import { runNotificationTests } from './run-notification-tests.mjs';
import { sliceKey, sliceAlreadySent } from './vitamin-guard.mjs';

const TEST_USER_ID = process.env.TEST_USER_ID || null; // debug: yalnız bu istifadəçi üçün, vaxt pəncərəsi keçilir
const SKIP_DEDUP = process.env.SKIP_DEDUP === 'true';
const manual = !!TEST_USER_ID;

async function main() {
  let runId = null;
  const reasons = {};
  let failedCount = 0;
  let skippedCount = 0;

  try {
    const triggeredBy = manual ? 'admin-test' : 'cron';

    const now = new Date();
    const bakuOffsetMs = 4 * 60 * 60 * 1000;
    const bakuNow = new Date(now.getTime() + bakuOffsetMs);
    const bakuTimeStr = `${String(bakuNow.getUTCHours()).padStart(2, '0')}:${String(bakuNow.getUTCMinutes()).padStart(2, '0')}`;

    // Each 5-minute run handles its own slice of schedule times (see vitamin-window.mjs).
    const slices = vitaminSlices(now);
    const slice = sliceKey(slices);
    runId = await startRunLog('send-vitamin-reminders', triggeredBy, bakuTimeStr, manual ? 'manual' : slice);
    console.log(`Checking vitamin reminders for ${slices.map((w) => `${w.from}-${w.to} (day ${w.dow})`).join(', ')}`);

    // A slice is sent once: a manual start between ticks or a retried timer skips it (vitamin-guard.mjs).
    if (!manual && await sliceAlreadySent({ query, key: slice, runId })) {
      console.log(`Slice ${slice} already sent by an earlier run; skipping`);
      bumpReason(reasons, 'slice_already_sent');
      await finishRunLog(runId, { status: 'success', skipped_count: 1, reasons });
      return;
    }

    let schedules = [];
    if (manual) {
      schedules = (await query(
        `SELECT * FROM user_vitamin_schedules WHERE is_active = true AND notification_enabled = true AND user_id = $1`,
        [TEST_USER_ID]
      )).map((row) => ({ ...row, _date: slices[0].date }));
    } else {
      for (const w of slices) {
        const rows = await query(
          `SELECT * FROM user_vitamin_schedules
           WHERE is_active = true AND notification_enabled = true
             AND scheduled_time >= $1::time AND scheduled_time < $2::time
             AND days_of_week @> ARRAY[$3]::int[]`,
          [w.from, w.to, w.dow]
        );
        schedules.push(...rows.map((row) => ({ ...row, _date: w.date })));
      }
    }

    if (!schedules.length) {
      console.log('No vitamin reminders to send');
      bumpReason(reasons, manual ? 'no_active_schedule_for_user' : 'no_schedules_in_window');
      await finishRunLog(runId, { status: 'success', skipped_count: 1, reasons });
      return;
    }

    console.log(`Found ${schedules.length} vitamin reminders to process`);

    let pendingSchedules = schedules;
    if (!SKIP_DEDUP) {
      const takenScheduleIds = new Set();
      for (const date of new Set(schedules.map((s) => s._date))) {
        const scheduleIds = schedules.filter((s) => s._date === date).map((s) => s.id);
        const takenLogs = await query(
          `SELECT schedule_id FROM vitamin_intake_logs WHERE schedule_id = ANY($1::uuid[]) AND log_date = $2`,
          [scheduleIds, date]
        );
        takenLogs.forEach((l) => takenScheduleIds.add(`${date}|${l.schedule_id}`));
      }
      pendingSchedules = schedules.filter((s) => !takenScheduleIds.has(`${s._date}|${s.id}`));
      const taken = schedules.length - pendingSchedules.length;
      if (taken > 0) { skippedCount += taken; reasons['already_taken'] = taken; }
    }

    if (!pendingSchedules.length) {
      console.log('All vitamins already taken');
      await finishRunLog(runId, { status: 'success', skipped_count: skippedCount, reasons });
      return;
    }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
      console.log('FIREBASE_SERVICE_ACCOUNT_JSON not configured');
      await finishRunLog(runId, { status: 'error', error_message: 'FCM not configured' });
      return;
    }

    const { accessToken, projectId } = await getFirebaseAccessToken(saJson);

    let sentCount = 0;

    const userSchedules = {};
    for (const s of pendingSchedules) {
      (userSchedules[s.user_id] ??= []).push(s);
    }

    const userIds = Object.keys(userSchedules);
    const prefs = await query(`SELECT user_id, language FROM user_preferences WHERE user_id = ANY($1::uuid[])`, [userIds]);
    const langByUser = new Map();
    prefs.forEach((p) => langByUser.set(p.user_id, p.language || 'az'));

    for (const [userId, userVitamins] of Object.entries(userSchedules)) {
      const tokens = await query(`SELECT token, platform FROM device_tokens WHERE user_id = $1`, [userId]);

      if (!tokens.length) { skippedCount++; bumpReason(reasons, 'no_device_token'); continue; }

      const userLang = langByUser.get(userId) || 'az';
      const isEn = userLang === 'en', isRu = userLang === 'ru', isTr = userLang === 'tr';
      const isKk = userLang === 'kk', isUz = userLang === 'uz', isKa = userLang === 'ka';
      const isDe = userLang === 'de', isAr = userLang === 'ar';
      const vitaminNames = userVitamins.map((v) => `${v.icon_emoji} ${v.vitamin_name}`).join(', ');

      const title = manual
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

      if (!manual) {
        try {
          await query(
            `INSERT INTO notifications (user_id, title, message, notification_type, is_read) VALUES ($1, $2, $3, 'vitamin_reminder', false)`,
            [userId, title, bodyText]
          );
        } catch (e) {
          console.error('Error storing notification:', e.message);
        }
      }

      let delivered = false;
      let lastErr = {};
      for (const { token } of tokens) {
        const result = await sendFCMv1(accessToken, projectId, token, title, bodyText, {
          type: 'vitamin_reminder',
          screen: 'vitamin-tracker',
        });

        if (result.success) {
          sentCount++;
          delivered = true;
          await query(
            `INSERT INTO notification_send_log (user_id, title, body, status, notification_type, source_type, source_notification_id)
             VALUES ($1, $2, $3, 'sent', 'vitamin_reminder', 'vitamin_reminder', $4)`,
            [userId, title, bodyText, userVitamins[0]?.id ?? null]
          );
          break;
        } else {
          lastErr = { code: result.errorCode, msg: result.error };
          if (result.unregistered) {
            await query(`DELETE FROM device_tokens WHERE token = $1`, [token]);
          }
        }
      }
      if (!delivered) {
        failedCount++;
        bumpReason(reasons, `fcm:${lastErr.code || 'unknown'}`);
        await logFailedSend({
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

    await finishRunLog(runId, {
      status: 'success',
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      eligible_count: Object.keys(userSchedules).length,
      reasons,
    });
  } catch (err) {
    console.error('Error in send-vitamin-reminders:', err);
    if (runId) {
      await finishRunLog(runId, { status: 'error', error_message: err instanceof Error ? err.message : String(err) });
    }
    process.exitCode = 1;
  } finally {
    // Appointment reminders share this run (and its timer); an admin vitamin test skips them.
    if (!manual) {
      try {
        await runAppointmentReminders({ query, getFirebaseAccessToken, sendFCMv1, startRunLog, finishRunLog, logFailedSend, bumpReason });
      } catch (err) {
        console.error('Error in appointment reminders:', err);
        process.exitCode = 1;
      }
      // Admin test sends queued from the admin panel (each targets only the requesting admin).
      try {
        await runNotificationTests({ query });
      } catch (err) {
        console.error('Error in notification tests:', err);
        process.exitCode = 1;
      }
    }
    await closePool();
  }
}

main();
