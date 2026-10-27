// Appointment reminders (push type `appointment_reminder`, opens the calendar screen).
// Runs inside the anacan-job-vitamin-reminders run, so no new timer is needed.
//
//   * day:  the day before the appointment, from 10:00 Baku time;
//   * soon: 2 hours before, only when the appointment has a time.
//
// A reminder is claimed with UPDATE … WHERE <marker> IS NULL RETURNING before it is sent, so
// overlapping runs never push it twice. A reminder whose moment had already passed when the
// appointment was created is skipped (the user just entered it). Editing the date, time or
// reminder switch clears the markers (trigger appointments_rearm_reminders).
import { notificationLanguage } from './shared/language.mjs';

const COPY = {
  az: { day: '📅 Sabah görüşünüz var', soon: '⏰ Görüş vaxtı: saat {time}' },
  en: { day: '📅 You have an appointment tomorrow', soon: '⏰ Appointment at {time}' },
  ru: { day: '📅 Завтра у вас приём', soon: '⏰ Приём в {time}' },
  tr: { day: '📅 Yarın randevunuz var', soon: '⏰ Randevu saati: {time}' },
  kk: { day: '📅 Ертең қабылдауыңыз бар', soon: '⏰ Қабылдау уақыты: {time}' },
  uz: { day: '📅 Ertaga uchrashuvingiz bor', soon: '⏰ Uchrashuv vaqti: {time}' },
  ka: { day: '📅 ხვალ ვიზიტი გაქვთ', soon: '⏰ ვიზიტის დრო: {time}' },
  de: { day: '📅 Morgen hast du einen Termin', soon: '⏰ Termin um {time}' },
  ar: { day: '📅 لديكِ موعد غدًا', soon: '⏰ موعدك الساعة {time}' },
  es: { day: '📅 Mañana tienes una cita', soon: '⏰ Cita a las {time}' },
  fr: { day: '📅 Vous avez un rendez-vous demain', soon: '⏰ Rendez-vous à {time}' },
  hi: { day: '📅 कल आपकी अपॉइंटमेंट है', soon: '⏰ अपॉइंटमेंट {time} बजे' },
  id: { day: '📅 Besok kamu ada janji temu', soon: '⏰ Janji temu pukul {time}' },
  ja: { day: '📅 明日は予定があります', soon: '⏰ {time}に予定があります' },
  ko: { day: '📅 내일 예약이 있어요', soon: '⏰ {time} 예약' },
  nl: { day: '📅 Morgen heb je een afspraak', soon: '⏰ Afspraak om {time}' },
  pl: { day: '📅 Jutro masz wizytę', soon: '⏰ Wizyta o {time}' },
  pt: { day: '📅 Amanhã você tem uma consulta', soon: '⏰ Consulta às {time}' },
  sv: { day: '📅 Du har en tid i morgon', soon: '⏰ Tid kl. {time}' },
  vi: { day: '📅 Ngày mai bạn có lịch hẹn', soon: '⏰ Lịch hẹn lúc {time}' },
  zh: { day: '📅 明天有预约', soon: '⏰ {time} 有预约' },
};

const hhmm = (time) => (typeof time === 'string' ? time.slice(0, 5) : '');

/** Push title and body for one claimed reminder, in the user's language. */
export function reminderMessage(kind, row, language) {
  const copy = COPY[notificationLanguage(language)];
  const time = hhmm(row.event_time);
  const title = kind === 'day' ? copy.day : copy.soon.replace('{time}', time);
  const name = String(row.title || '').trim().slice(0, 120);
  const body = kind === 'day' && time ? `${name} · ${time}` : name;
  return { title, body: body || title };
}

// Due rows, claimed atomically. Baku has no DST, so 'Asia/Baku' is a fixed UTC+4.
export const CLAIM_DAY = `
WITH baku AS (SELECT timezone('Asia/Baku', now()) AS t)
UPDATE appointments a SET reminder_day_sent_at = now()
  FROM baku
 WHERE a.reminder_enabled IS NOT FALSE
   AND a.reminder_day_sent_at IS NULL
   AND a.event_date = (baku.t)::date + 1
   AND (baku.t)::time >= time '10:00'
   AND timezone('Asia/Baku', a.created_at) < (baku.t)::date + time '10:00'
RETURNING a.id, a.user_id, a.title, a.event_date, a.event_time`;

export const CLAIM_SOON = `
WITH baku AS (SELECT timezone('Asia/Baku', now()) AS t)
UPDATE appointments a SET reminder_soon_sent_at = now()
  FROM baku
 WHERE a.reminder_enabled IS NOT FALSE
   AND a.reminder_soon_sent_at IS NULL
   AND a.event_time IS NOT NULL
   AND a.event_date BETWEEN (baku.t)::date AND (baku.t)::date + 1
   AND a.event_date + a.event_time > baku.t
   AND a.event_date + a.event_time - interval '2 hours' <= baku.t
   AND timezone('Asia/Baku', a.created_at) < a.event_date + a.event_time - interval '2 hours'
RETURNING a.id, a.user_id, a.title, a.event_date, a.event_time`;

/**
 * Sends due appointment reminders. `deps` carries the shared job helpers so the logic is
 * testable without a database or FCM.
 */
export async function runAppointmentReminders(deps) {
  const { query, getFirebaseAccessToken, sendFCMv1, startRunLog, finishRunLog, logFailedSend, bumpReason } = deps;
  const now = deps.now ? deps.now() : new Date();
  const baku = new Date(now.getTime() + 4 * 3600 * 1000);
  const bakuTime = `${String(baku.getUTCHours()).padStart(2, '0')}:${String(baku.getUTCMinutes()).padStart(2, '0')}`;
  const reasons = {};
  let sent = 0, failed = 0, skipped = 0;

  const claimed = [
    ...(await query(CLAIM_DAY)).map((row) => ({ kind: 'day', row })),
    ...(await query(CLAIM_SOON)).map((row) => ({ kind: 'soon', row })),
  ];
  if (!claimed.length) return { sent, failed, skipped, claimed: 0 };

  const runId = await startRunLog('send-appointment-reminders', 'cron', bakuTime, null);
  try {
    const userIds = [...new Set(claimed.map((c) => c.row.user_id))];
    const prefs = await query(`SELECT user_id, language, push_enabled FROM user_preferences WHERE user_id = ANY($1::uuid[])`, [userIds]);
    const tokens = await query(`SELECT user_id, token FROM device_tokens WHERE user_id = ANY($1::uuid[])`, [userIds]);
    const prefByUser = new Map(prefs.map((p) => [p.user_id, p]));
    const tokensByUser = new Map();
    for (const t of tokens) (tokensByUser.get(t.user_id) || tokensByUser.set(t.user_id, []).get(t.user_id)).push(t.token);

    let auth = null;
    const firebase = async () => {
      if (!auth) {
        const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (!saJson) throw new Error('FCM not configured');
        auth = await getFirebaseAccessToken(saJson);
      }
      return auth;
    };

    for (const { kind, row } of claimed) {
      const pref = prefByUser.get(row.user_id);
      if (pref?.push_enabled === false) { skipped++; bumpReason(reasons, 'push_disabled'); continue; }
      const userTokens = tokensByUser.get(row.user_id) || [];
      const { title, body } = reminderMessage(kind, row, pref?.language);

      try {
        await query(
          `INSERT INTO notifications (user_id, title, message, notification_type, is_read) VALUES ($1, $2, $3, 'appointment_reminder', false)`,
          [row.user_id, title, body],
        );
      } catch (e) {
        console.error('Error storing appointment notification:', e.message);
      }

      if (!userTokens.length) { skipped++; bumpReason(reasons, 'no_device_token'); continue; }

      const { accessToken, projectId } = await firebase();
      let delivered = false;
      let lastErr = {};
      for (const token of userTokens) {
        const result = await sendFCMv1(accessToken, projectId, token, title, body, {
          type: 'appointment_reminder',
          screen: 'calendar',
          appointment_id: String(row.id),
          reminder: kind,
        });
        if (result.success) {
          delivered = true;
        } else {
          lastErr = { code: result.errorCode, msg: result.error };
          if (result.unregistered) await query(`DELETE FROM device_tokens WHERE token = $1`, [token]);
        }
      }
      if (delivered) {
        sent++;
        await query(
          `INSERT INTO notification_send_log (user_id, title, body, status, notification_type, source_type, source_notification_id)
           VALUES ($1, $2, $3, 'sent', 'appointment_reminder', 'appointment_reminder', $4)`,
          [row.user_id, title, body, row.id],
        );
        continue;
      }
      failed++;
      bumpReason(reasons, `fcm:${lastErr.code || 'unknown'}`);
      await logFailedSend({
        user_id: row.user_id,
        notification_type: 'appointment_reminder',
        source_type: 'appointment_reminder',
        source_notification_id: row.id,
        title, body,
        reason: lastErr.msg || 'FCM send failed',
        error_code: lastErr.code,
      });
    }

    await finishRunLog(runId, { status: 'success', sent_count: sent, failed_count: failed, skipped_count: skipped, eligible_count: claimed.length, reasons });
  } catch (err) {
    await finishRunLog(runId, { status: 'error', error_message: err instanceof Error ? err.message : String(err) });
    throw err;
  }
  console.log(`Appointment reminders: ${claimed.length} due, ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped, claimed: claimed.length };
}
