// Node.js port of supabase/functions/send-daily-notifications/index.ts
//
// FƏRQLƏR (əsl Deno versiyası ilə müqayisədə):
//  - CHUNK_SIZE/offset/self-recursion MƏNTIQI ÇIXARILIB: bu, Supabase Edge
//    Function-un WORKER_RESOURCE_LIMIT-i üçün lazım idi. Azure Container Apps
//    Job tam konteynerdir (CPU/RAM/timeout məhdudiyyəti qat-qat yüksəkdir),
//    ona görə BÜTÜN eligible istifadəçilər BİR run-da emal olunur.
//  - HTTP/CORS/auth (requireCronSecret/requireAdmin) YOXDUR — Job-un özü
//    etibarlı trigger-dir, xarici sorğu qəbul etmir.
//  - Slot-eşləşdirmə MƏNTIQI EYNİDİR (DAILY_RUN_SLOTS + ən yaxın uyğunluq,
//    ±40 dəq tolerantlıq) — hər Container Apps Job öz cron cədvəli ilə
//    tetiklənir, hansı slot-a uyğun gəldiyini bu məntiq özü müəyyən edir.
import { getFirebaseAccessToken as firebaseToken, sendFCMv1 as firebaseSend } from './shared/fcm.mjs';
import { startRunLog as runStart, finishRunLog as runFinish, logFailedSend as sendFailure, bumpReason } from './shared/notif-logging.mjs';
import { query as databaseQuery, closePool as databaseClose } from './shared/db.mjs';
import { getBabyDayNumber, getNotificationDate, indexMommyNotifications, selectMommyNotifications, renderMommyNotificationText } from './shared/mommy-calendar.mjs';
import { notificationLanguage, notificationCopy } from './shared/language.mjs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Sending to every user at once made thousands of phones open the app in the same
// minute (08:00 UTC 504/500 bursts). Users are ordered into stable hash groups and
// the run is paced across this window; it must stay below run-job.py's 1100 s timeout.
const DEFAULT_SPREAD_SECONDS = 600;
const MAX_SPREAD_SECONDS = 900;

export function spreadSeconds(value) {
  if (value === undefined || value === '') return DEFAULT_SPREAD_SECONDS;
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? Math.min(seconds, MAX_SPREAD_SECONDS) : DEFAULT_SPREAD_SECONDS;
}

// The same user lands in the same part of the window every day.
export function spreadOrder(users) {
  const key = (user) => createHash('sha256').update(String(user.user_id)).digest('hex');
  return users.map((user) => ({ user, key: key(user) })).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map(({ user }) => user);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeTimeLabel(value) {
  if (!value) return null;
  const [rawHour = '0', rawMinute = '0'] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toMinutes(value) {
  const normalized = normalizeTimeLabel(value);
  if (!normalized) return -1;
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
}

function normalizeSourceTypeForDedup(value) {
  if (!value) return null;
  return value.startsWith('scheduled:') ? 'scheduled' : value;
}

// Each slot maps 1:1 to a cron run. Content times are matched EXACTLY (no ±30min spillover).
const DAILY_RUN_SLOTS = [
  { runAt: '09:00', contentTimes: ['09:00'] },
  { runAt: '10:00', contentTimes: ['10:00'] },
  { runAt: '12:00', contentTimes: ['12:00'] },
  { runAt: '14:00', contentTimes: ['14:00'] },
  { runAt: '14:30', contentTimes: ['14:30'] },
  { runAt: '15:00', contentTimes: ['15:00'] },
  { runAt: '15:30', contentTimes: ['15:30'] },
  { runAt: '19:00', contentTimes: ['19:00'] },
  { runAt: '19:30', contentTimes: ['19:30'] },
];

function calculatePregnancyDay(lastPeriodDate, now = new Date()) {
  if (!lastPeriodDate) return null;
  const lmp = new Date(lastPeriodDate);
  const today = new Date(now);
  lmp.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return (diffDays >= 1 && diffDays <= 280) ? diffDays : null;
}

export async function runDailyNotifications(env = process.env, dependencies = {}) {
  const { query: database = databaseQuery, closePool: close = databaseClose, getFirebaseAccessToken: getToken = firebaseToken,
    sendFCMv1: send = firebaseSend, startRunLog: start = runStart, finishRunLog: finish = runFinish,
    logFailedSend: failed = sendFailure, now: clock = () => new Date(), sleep = wait, elapsedMs = () => performance.now() } = dependencies;
  const query = database, closePool = close, getFirebaseAccessToken = getToken, sendFCMv1 = send;
  const startRunLog = start, finishRunLog = finish, logFailedSend = failed;
  const TEST_USER_ID = env.TEST_USER_ID || null, SKIP_DEDUP = env.SKIP_DEDUP === 'true', manual = !!TEST_USER_ID;
  const fetchAllRows = table => query(`SELECT * FROM ${table} WHERE is_active = true`);
  let runId = null;
  const reasons = {};
  let skippedCount = 0;
  let failedCount = 0;

  try {
    const triggeredBy = manual ? 'admin-test' : 'cron';

    const now = clock();
    const notificationDate = getNotificationDate(now);
    const bakuOffsetMs = 4 * 60 * 60 * 1000;
    const bakuNow = new Date(now.getTime() + bakuOffsetMs);
    const currentHour = bakuNow.getUTCHours();
    const currentMinute = bakuNow.getUTCMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    if (!manual && (currentHour < 9 || currentHour >= 22)) {
      runId = await startRunLog('send-daily-notifications', triggeredBy, currentTimeStr, null);
      await finishRunLog(runId, { status: 'success', sent_count: 0, skipped_count: 1, reasons: { outside_hours: 1 } });
      console.log(`Outside notification hours (${currentTimeStr})`);
      return;
    }

    const currentMinutes = currentHour * 60 + currentMinute;
    const matchingSlot = DAILY_RUN_SLOTS
      .map((slot) => ({ slot, diff: Math.abs(currentMinutes - toMinutes(slot.runAt)) }))
      .filter(({ diff }) => diff <= 40)
      .sort((a, b) => a.diff - b.diff)[0]?.slot ?? null;

    const activeSendTime = manual ? null : matchingSlot?.runAt ?? null;
    const activeContentTimes = manual
      ? null
      : new Set((matchingSlot?.contentTimes ?? []).map((v) => normalizeTimeLabel(v)).filter(Boolean));

    runId = await startRunLog('send-daily-notifications', triggeredBy, currentTimeStr, activeSendTime || (manual ? 'manual' : null));

    if (!manual && !matchingSlot) {
      await finishRunLog(runId, { status: 'success', sent_count: 0, skipped_count: 1, reasons: { no_slot_match: 1 } });
      console.log(`Not a notification time slot. Current: ${currentTimeStr}`);
      return;
    }

    const saJson = env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!saJson) {
      await finishRunLog(runId, { status: 'error', error_message: 'Firebase service account not configured' });
      return;
    }

    console.log(`[send-daily-notifications] Started. bakuTime=${currentTimeStr} activeSlot=${activeSendTime || 'manual'} manual=${manual}`);

    const { accessToken, projectId } = await getFirebaseAccessToken(saJson);
    console.log(`[send-daily-notifications] Got Firebase access token, project=${projectId}`);

    const scheduledNotifications = await query(
      `SELECT * FROM scheduled_notifications WHERE is_active = true ORDER BY priority ASC, created_at ASC`
    );

    const pregnancyNotifications = await fetchAllRows('pregnancy_day_notifications');
    console.log(`[send-daily-notifications] Loaded ${pregnancyNotifications.length} pregnancy_day rows`);

    const pregnancyNotifsByDay = new Map();
    pregnancyNotifications.forEach((n) => {
      const normalizedTime = normalizeTimeLabel(n.send_time);
      if (activeContentTimes && (!normalizedTime || !activeContentTimes.has(normalizedTime))) return;
      const existing = pregnancyNotifsByDay.get(n.day_number) || [];
      existing.push(n);
      pregnancyNotifsByDay.set(n.day_number, existing);
    });

    const mommyNotifications = await fetchAllRows('mommy_day_notifications');
    console.log(`[send-daily-notifications] Loaded ${mommyNotifications.length} mommy_day rows`);

    const mommyNotificationIndex = indexMommyNotifications(mommyNotifications.filter((n) => {
      const normalizedTime = normalizeTimeLabel(n.send_time);
      return !activeContentTimes || (normalizedTime && activeContentTimes.has(normalizedTime));
    }));

    const profiles = manual
      ? await query(`SELECT user_id, life_stage, role, due_date, last_period_date FROM profiles WHERE user_id = $1`, [TEST_USER_ID])
      // Pregnancy loss recovery (Duzelis72): no daily content for her, nor for her linked partner.
      : await query(`SELECT p.user_id, p.life_stage, p.role, p.due_date, p.last_period_date FROM profiles p
          WHERE NOT p.loss_recovery_active
            AND NOT EXISTS (SELECT 1 FROM profiles w WHERE w.id = p.linked_partner_id AND w.loss_recovery_active)`);

    const children = manual
      ? await query(`SELECT user_id, birth_date::text AS birth_date FROM user_children WHERE user_id = $1 AND is_active = true ORDER BY birth_date DESC`, [TEST_USER_ID])
      : await query(`SELECT user_id, birth_date::text AS birth_date FROM user_children WHERE is_active = true ORDER BY birth_date DESC`);

    const preferences = manual
      ? await query(`SELECT user_id, push_enabled, daily_push_enabled, language FROM user_preferences WHERE user_id = $1`, [TEST_USER_ID])
      : await query(`SELECT user_id, push_enabled, daily_push_enabled, language FROM user_preferences`);

    const tokens = manual
      ? await query(`SELECT token, user_id, platform FROM device_tokens WHERE user_id = $1`, [TEST_USER_ID])
      : await query(`SELECT token, user_id, platform FROM device_tokens`);

    console.log(`[send-daily-notifications] loaded profiles=${profiles.length} tokens=${tokens.length} prefs=${preferences.length}`);

    if (!tokens.length) {
      await finishRunLog(runId, { status: 'success', sent_count: 0, skipped_count: 1, reasons: { no_device_token: 1 } });
      console.log('No device tokens');
      return;
    }

    const bakuMidnight = new Date(bakuNow);
    bakuMidnight.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(bakuMidnight.getTime() - bakuOffsetMs);

    const todaySentLogs = manual
      ? await query(
          `SELECT user_id, source_type, source_notification_id FROM notification_send_log
           WHERE sent_at >= $1 AND status = 'sent' AND user_id = $2 ORDER BY sent_at`,
          [todayStart.toISOString(), TEST_USER_ID]
        )
      : await query(
          `SELECT user_id, source_type, source_notification_id FROM notification_send_log
           WHERE sent_at >= $1 AND status = 'sent' ORDER BY sent_at`,
          [todayStart.toISOString()]
        );

    const alreadySent = new Set();
    if (!SKIP_DEDUP) {
      todaySentLogs.forEach((log) => {
        const sourceType = normalizeSourceTypeForDedup(log.source_type);
        if (sourceType && log.source_notification_id) {
          alreadySent.add(`${log.user_id}:${sourceType}:${log.source_notification_id}`);
        }
      });
    }

    const userMap = new Map();
    profiles.forEach((p) => {
      userMap.set(p.user_id, {
        user_id: p.user_id, life_stage: p.life_stage || 'flow', role: p.role || 'user',
        due_date: p.due_date, last_period_date: p.last_period_date,
        daily_push_enabled: true,
        language: 'az',
      });
    });

    preferences.forEach((pref) => {
      const user = userMap.get(pref.user_id);
      if (user) {
        user.daily_push_enabled = pref.push_enabled !== false && pref.daily_push_enabled !== false;
        user.language = notificationLanguage(pref.language);
      }
    });

    const eligibleUsers = Array.from(userMap.values()).filter((user) => user.daily_push_enabled);
    console.log(`Eligible users: ${eligibleUsers.length}`);

    let sentCount = 0;
    const results = [];

    const processUser = async (user) => {
      const userTokens = tokens.filter((t) => t.user_id === user.user_id);
      if (!userTokens.length) { skippedCount++; bumpReason(reasons, 'no_device_token'); return; }

      const notificationsToSend = [];

      if (user.life_stage === 'bump' && user.last_period_date) {
        const pregnancyDay = calculatePregnancyDay(user.last_period_date, now);
        if (pregnancyDay !== null) {
          const dayNotifications = pregnancyNotifsByDay.get(pregnancyDay) || [];
          for (const dn of dayNotifications) {
            const dedupKey = `${user.user_id}:pregnancy_day:${dn.id}`;
            if (!alreadySent.has(dedupKey)) {
              notificationsToSend.push({
                id: dn.id, template: dn, type: 'pregnancy_day', day: pregnancyDay,
              });
            }
          }
        }
      }

      if (user.life_stage === 'mommy') {
        const userChildren = children.filter((c) => c.user_id === user.user_id) || [];
        if (userChildren.length > 0 && userChildren[0].birth_date) {
          const birthDate = userChildren[0].birth_date;
          const childAgeDays = getBabyDayNumber(birthDate, notificationDate);
          if (childAgeDays !== null) {
            const dayNotifications = selectMommyNotifications(mommyNotificationIndex, birthDate, notificationDate);
            for (const dn of dayNotifications) {
              const dedupKey = `${user.user_id}:mommy_day:${dn.id}`;
              if (!alreadySent.has(dedupKey)) {
                notificationsToSend.push({
                  id: dn.id, template: dn, birthDate, type: 'mommy_day', day: childAgeDays,
                });
              }
            }
          }
        }
      }

      if (notificationsToSend.length === 0 && scheduledNotifications.length) {
        const rawMatches = scheduledNotifications.filter((n) => {
          if (n.target_audience === 'all') return true;
          if (n.target_audience === user.life_stage) return true;
          if (n.target_audience === 'partner' && user.role === 'partner') return true;
          return false;
        });
        const matches = [
          ...rawMatches.filter((n) => n.target_audience === user.life_stage),
          ...rawMatches.filter((n) => n.target_audience !== user.life_stage),
        ];
        const slotIndex = activeSendTime ? Math.max(DAILY_RUN_SLOTS.findIndex((slot) => slot.runAt === activeSendTime), 0) : 0;
        const scheduledSourceType = 'scheduled';
        const rotatedMatches = matches.length
          ? matches.map((_, index) => matches[(slotIndex + index) % matches.length])
          : [];
        const match = rotatedMatches.find((candidate) => {
          const dedupKey = `${user.user_id}:${scheduledSourceType}:${candidate.id}`;
          return !alreadySent.has(dedupKey);
        }) ?? null;
        if (match) {
          const dedupKey = `${user.user_id}:${scheduledSourceType}:${match.id}`;
          if (!alreadySent.has(dedupKey)) {
            notificationsToSend.push({ id: match.id, template: match, type: 'scheduled', sourceType: scheduledSourceType });
          }
        }
      }

      for (const notif of notificationsToSend) {
        // Runs can last minutes. A language change must take effect before the
        // next send, rather than using the population snapshot from run start.
        const current = (await query('SELECT language,push_enabled,daily_push_enabled FROM user_preferences WHERE user_id=$1', [user.user_id]))[0];
        if (current?.push_enabled === false || current?.daily_push_enabled === false) { skippedCount++; bumpReason(reasons, 'preference_disabled_before_send'); continue; }
        const locale = notificationLanguage(current?.language);
        const template = notif.template;
        const localized = template && notificationCopy(template, locale);
        if (!localized) { skippedCount++; bumpReason(reasons, 'missing_requested_language'); continue; }
        const title = notif.type === 'mommy_day' ? renderMommyNotificationText(localized.title, template, notif.birthDate) : localized.title;
        notif.title = `${template.emoji || ''} ${title}`.trim();
        notif.body = notif.type === 'mommy_day'
          ? renderMommyNotificationText(localized.body, template, notif.birthDate)
          : localized.body;
        let delivered = false;
        let lastErr = {};
        for (const deviceToken of userTokens) {
          const result = await sendFCMv1(accessToken, projectId, deviceToken.token, notif.title, notif.body, {
            type: notif.type, notification_id: notif.id,
          });

          if (result.success) {
            sentCount++;
            delivered = true;
            results.push({ userId: user.user_id, success: true, type: notif.type, day: notif.day });
            alreadySent.add(`${user.user_id}:${normalizeSourceTypeForDedup(notif.sourceType ?? notif.type)}:${notif.id}`);
            await query(
              `INSERT INTO notification_send_log (user_id, notification_id, title, body, status, source_type, source_notification_id, notification_type)
               VALUES ($1, $2, $3, $4, 'sent', $5, $6, $7)`,
              [
                user.user_id,
                notif.type === 'scheduled' ? notif.id : null,
                notif.title, notif.body,
                notif.sourceType ?? notif.type, notif.id, notif.type,
              ]
            );
            break;
          } else {
            lastErr = { code: result.errorCode, msg: result.error };
            results.push({ userId: user.user_id, success: false, error: result.error });
            if (result.unregistered) {
              console.log(`[send-daily-notifications] Removing dead token (code=${result.errorCode}): ...${deviceToken.token.slice(-12)}`);
              await query(`DELETE FROM device_tokens WHERE token = $1`, [deviceToken.token]);
            }
          }
        }
        if (!delivered) {
          failedCount++;
          bumpReason(reasons, `fcm:${lastErr.code || 'unknown'}`);
          await logFailedSend({
            user_id: user.user_id,
            notification_type: notif.type,
            source_type: notif.sourceType ?? notif.type,
            source_notification_id: notif.id,
            title: notif.title,
            body: notif.body,
            reason: lastErr.msg || 'FCM send failed',
            error_code: lastErr.code,
          });
        }
      }

      if (notificationsToSend.length === 0) {
        skippedCount++;
        if (user.life_stage === 'bump' && !user.last_period_date) bumpReason(reasons, 'bump_no_lmp');
        else if (user.life_stage === 'mommy' && !children.some((c) => c.user_id === user.user_id)) bumpReason(reasons, 'mommy_no_children');
        else bumpReason(reasons, 'no_matching_content');
      }
    };

    const concurrency = 25;
    const spreadMs = manual ? 0 : spreadSeconds(env.DAILY_PUSH_SPREAD_SECONDS) * 1000;
    const orderedUsers = spreadMs ? spreadOrder(eligibleUsers) : eligibleUsers;
    const pacingStart = elapsedMs();
    console.log(`[send-daily-notifications] spreadSeconds=${spreadMs / 1000}`);
    for (let i = 0; i < orderedUsers.length; i += concurrency) {
      // Batch i starts no earlier than its share of the window; a slow run never waits.
      const due = pacingStart + (spreadMs * i) / orderedUsers.length - elapsedMs();
      if (due > 0) await sleep(due);
      const batch = orderedUsers.slice(i, i + concurrency);
      await Promise.all(batch.map(processUser));
      console.log(`[send-daily-notifications] Processed ${Math.min(i + concurrency, eligibleUsers.length)}/${eligibleUsers.length}, sent so far: ${sentCount}`);
    }

    // Bulk upsert (min-lərlə ardıcıl sorğu əvəzinə TƏK sorğu — birbaşa Postgres
    // girişimiz olduğu üçün bunu ediyoruz, PostgREST-də bu mümkün deyildi).
    const sentUserIds = [...new Set(results.filter((r) => r.success).map((r) => r.userId))];
    if (sentUserIds.length) {
      await query(
        `INSERT INTO user_preferences (user_id, last_push_sent_at)
         SELECT unnest($1::uuid[]), now()
         ON CONFLICT (user_id) DO UPDATE SET last_push_sent_at = EXCLUDED.last_push_sent_at`,
        [sentUserIds]
      );
    }

    console.log(`Daily notifications sent: ${sentCount}`);

    await finishRunLog(runId, {
      status: 'success',
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      eligible_count: eligibleUsers.length,
      reasons,
    });
  } catch (err) {
    console.error('Error in send-daily-notifications:', err);
    if (runId) {
      await finishRunLog(runId, { status: 'error', error_message: err instanceof Error ? err.message : String(err) });
    }
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runDailyNotifications();
