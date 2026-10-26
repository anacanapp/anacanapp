import { createClient } from 'npm:@supabase/supabase-js@2';
import { getFirebaseAccessToken, sendFCMv1 } from '../_shared/fcm.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { requireNotificationCron } from '../_shared/notification-auth.ts';
import { startRunLog, finishRunLog, logFailedSend, bumpReason } from '../_shared/notif-logging.ts';
import { fetchAllPaged } from '../_shared/paginate.ts';
import { getNotificationDate, getBabyDayNumber, indexMommyNotifications, selectMommyNotifications, renderMommyNotificationText } from '../_shared/mommy-calendar.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'X-Anacan-Notification-Runtime',
  'X-Anacan-Notification-Runtime': 'source-calendar-v1',
  'X-Anacan-Notification-Delivery': 'source-scheduled-v2',
};

interface UserForNotification {
  user_id: string;
  life_stage: string;
  role: string;
  due_date: string | null;
  last_period_date: string | null;
  daily_push_enabled: boolean;
  language: string;
}

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  title_en: string | null;
  body_en: string | null;
  title_ru?: string | null;
  body_ru?: string | null;
  title_tr?: string | null;
  body_tr?: string | null;
  target_audience: string;
  priority: number;
}

interface DayNotification {
  id: string;
  day_number: number;
  title: string;
  body: string;
  title_en: string | null;
  body_en: string | null;
  title_ru?: string | null;
  body_ru?: string | null;
  title_tr?: string | null;
  body_tr?: string | null;
  emoji: string;
  send_time: string;
  is_active: boolean;
  calendar_months?: number | null;
  calendar_day_offset?: number | null;
}

/** İstifadəçi dilinə uyğun sütunu qaytarır: field_{en|ru|tr|kk|uz|ka|de} → (kk/uz/ka→ru, de→en körpüsü) → base (AZ). */
function pickLang(row: Record<string, unknown>, field: string, lang: string): string {
  if (lang && lang !== 'az') {
    const localized = row[`${field}_${lang}`];
    if (typeof localized === 'string' && localized.trim()) return localized;
    if (lang === 'kk' || lang === 'uz' || lang === 'ka') {
      const ru = row[`${field}_ru`];
      if (typeof ru === 'string' && ru.trim()) return ru;
    }
    if (lang === 'de' || lang === 'ar') {
      const en = row[`${field}_en`];
      if (typeof en === 'string' && en.trim()) return en;
    }
  }
  const base = row[field];
  return typeof base === 'string' ? base : '';
}

interface DeviceToken {
  token: string;
  user_id: string;
  platform: string;
}

interface DailyRunSlot {
  runAt: string;
  contentTimes: string[];
}

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

function normalizeTimeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const [rawHour = '0', rawMinute = '0'] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function toMinutes(value: string): number {
  const normalized = normalizeTimeLabel(value);
  if (!normalized) return -1;
  const [hour, minute] = normalized.split(':').map(Number);
  return hour * 60 + minute;
}

function normalizeSourceTypeForDedup(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith('scheduled:') ? 'scheduled' : value;
}

// Each slot maps 1:1 to a cron run. Content times are matched EXACTLY (no ±30min spillover)
// so that e.g. 15:00 content does not get sent on the 15:30 run.
const DAILY_RUN_SLOTS: DailyRunSlot[] = [
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  // Credential-free metadata only: checking the deployed compatibility version
  // must not load user rows, request FCM credentials or send a notification.
  if (req.method === 'GET' && new URL(req.url).searchParams.get('capabilities') === 'source-calendar-v1') {
    return new Response(JSON.stringify({ schema: 'anacan-source-notification-runtime-v1', calendarRuleVersion: 1, sendsNotifications: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  let runId: string | null = null;
  let runSupabase: any = null;
  const reasons: Record<string, number> = {};
  let skippedCount = 0;
  let failedCount = 0;

  try {
    // Auth: cron secret OR service-role/anon Bearer (used by pg_cron) OR admin user.
    const cronErr = await requireNotificationCron(req, 'send-daily-notifications');
    if (cronErr) {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const isCronBearer = token && (token === serviceKey || token === anonKey);
      if (!isCronBearer) {
        const adminCheck = await requireAdmin(req);
        if (adminCheck.error) return adminCheck.error;
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    runSupabase = supabase;

    // Calculate current Baku time (UTC+4)
    const now = new Date();
    const bakuOffsetMs = 4 * 60 * 60 * 1000;
    const bakuNow = new Date(now.getTime() + bakuOffsetMs);
    const currentHour = bakuNow.getUTCHours();
    const currentMinute = bakuNow.getUTCMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    let body: { manual?: boolean; userId?: string; skipDedup?: boolean; slot?: string; offset?: number } = {};
    try { body = await req.json(); } catch { /* No body */ }

    // İstifadəçi sayı artdıqca bir çağırışda hamısını emal etmək worker limitini
    // aşır (WORKER_RESOURCE_LIMIT). Ona görə hər çağırış yalnız bir parça emal
    // edir və qalan hissə üçün özünü yenidən çağırır.
    const CHUNK_SIZE = 200;
    const chunkOffset = Number(body.offset ?? 0) || 0;

    const triggeredBy = body.manual ? (body.userId ? 'admin-test' : 'admin') : 'cron';

    if (!body.manual && (currentHour < 9 || currentHour >= 22)) {
      runId = await startRunLog(supabase, 'send-daily-notifications', triggeredBy, currentTimeStr, null);
      await finishRunLog(supabase, runId, { status: 'success', sent_count: 0, skipped_count: 1, reasons: { outside_hours: 1 } });
      return new Response(
        JSON.stringify({ message: 'Outside notification hours', skipped: true, currentTime: currentTimeStr }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestedSlot = body.manual ? normalizeTimeLabel(body.slot) : null;

    // Match the current cron run to the nearest expected Baku delivery slot.
    // Each run can cover both exact-hour and legacy half-hour content times.
    const currentMinutes = currentHour * 60 + currentMinute;
    const matchingSlot = requestedSlot
      ? DAILY_RUN_SLOTS.find((slot) => slot.runAt === requestedSlot) ?? null
      : DAILY_RUN_SLOTS
        .map((slot) => ({ slot, diff: Math.abs(currentMinutes - toMinutes(slot.runAt)) }))
        .filter(({ diff }) => diff <= 40)
        .sort((a, b) => a.diff - b.diff)[0]?.slot ?? null;

    if (body.manual && requestedSlot && !matchingSlot) {
      runId = await startRunLog(supabase, 'send-daily-notifications', triggeredBy, currentTimeStr, requestedSlot);
      await finishRunLog(supabase, runId, { status: 'success', sent_count: 0, skipped_count: 1, reasons: { invalid_slot: 1 } });
      return new Response(
        JSON.stringify({ message: `Invalid notification slot: ${requestedSlot}`, skipped: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Manual slot triggers resend only that slot; manual without slot keeps the existing all-pending admin behavior.
    const activeSendTime = body.manual && !requestedSlot ? null : matchingSlot?.runAt ?? null;
    const activeContentTimes = body.manual && !requestedSlot
      ? null
      : new Set((matchingSlot?.contentTimes ?? []).map((value) => normalizeTimeLabel(value)).filter(Boolean) as string[]);

    runId = await startRunLog(supabase, 'send-daily-notifications', triggeredBy, currentTimeStr, activeSendTime || (body.manual ? 'manual' : null));

    if (!body.manual && !matchingSlot) {
      await finishRunLog(supabase, runId, { status: 'success', sent_count: 0, skipped_count: 1, reasons: { no_slot_match: 1 } });
      return new Response(
        JSON.stringify({ message: `Not a notification time slot. Current: ${currentTimeStr}`, skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Firebase access token
    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
      await finishRunLog(supabase, runId, { status: 'error', error_message: 'Firebase service account not configured' });
      return new Response(
        JSON.stringify({ error: 'Firebase service account not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[send-daily-notifications] Started. bakuTime=${currentTimeStr} activeSlot=${activeSendTime || 'manual'} manual=${!!body.manual}`);

    const { accessToken, projectId } = await getFirebaseAccessToken(saJson);
    console.log(`[send-daily-notifications] Got Firebase access token, project=${projectId}`);

     // Get active scheduled notifications
    const { data: scheduledNotifications } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    // Get day-based notifications and normalize send_time in code so both 09:00 and 09:30 style values work.
    // IMPORTANT: Supabase default limit is 1000 rows. mommy_day_notifications has 4380+ rows,
    // so we MUST paginate to load ALL of them — otherwise day-specific notifs disappear.
    async function fetchAllRows<T>(tableName: string): Promise<T[]> {
      const pageSize = 1000;
      const all: T[] = [];
      let from = 0;
      // Loop until we get a short page
      // Safety cap: 50 pages = 50,000 rows
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('is_active', true)
          .range(from, from + pageSize - 1);
        if (error) {
          console.error(`[send-daily-notifications] fetchAllRows(${tableName}) error:`, error.message);
          break;
        }
        if (!data || data.length === 0) break;
        all.push(...(data as T[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    }

    const pregnancyNotifications = await fetchAllRows<DayNotification>('pregnancy_day_notifications');
    console.log(`[send-daily-notifications] Loaded ${pregnancyNotifications.length} pregnancy_day rows`);

    const pregnancyNotifsByDay = new Map<number, DayNotification[]>();
    pregnancyNotifications.forEach((n: DayNotification) => {
      const normalizedTime = normalizeTimeLabel(n.send_time);
      if (activeContentTimes && (!normalizedTime || !activeContentTimes.has(normalizedTime))) return;
      const existing = pregnancyNotifsByDay.get(n.day_number) || [];
      existing.push(n);
      pregnancyNotifsByDay.set(n.day_number, existing);
    });

    const mommyNotifications = await fetchAllRows<DayNotification>('mommy_day_notifications');
    console.log(`[send-daily-notifications] Loaded ${mommyNotifications.length} mommy_day rows`);

    const mommyIndex = indexMommyNotifications(mommyNotifications.filter((n: DayNotification) => {
      const normalizedTime = normalizeTimeLabel(n.send_time);
      return !activeContentTimes || !!normalizedTime && activeContentTimes.has(normalizedTime);
    }));
    const notificationDate = getNotificationDate(now);


    // Page the profile population, including disabled users, so every offset is
    // stable. Fetch only this chunk's private rows instead of the whole database
    // and its high-volume event send log on every recursive invocation.
    let profileQuery = supabase.from('profiles').select('user_id, life_stage, role, due_date, last_period_date').order('user_id');
    if (body.userId) profileQuery = profileQuery.eq('user_id', body.userId);
    const { data: profiles, error: profileError } = await profileQuery.range(chunkOffset, chunkOffset + CHUNK_SIZE - 1);
    if (profileError) throw new Error('notification_profiles_unavailable');
    const userIds = (profiles || []).map((profile: any) => profile.user_id);
    if (!userIds.length) {
      await finishRunLog(supabase, runId, { status: 'success', eligible_count: 0, sent_count: 0 });
      return new Response(JSON.stringify({ success: true, sent: 0, eligible: 0, complete: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const children = await fetchAllPaged<any>(() => {
      let q = supabase.from('user_children').select('user_id, birth_date').eq('is_active', true)
        .in('user_id', userIds).order('birth_date', { ascending: false });
      return q;
    });

    const preferences = await fetchAllPaged<any>(() => {
      let q = supabase.from('user_preferences').select('user_id, push_enabled, daily_push_enabled, language').in('user_id', userIds).order('user_id');
      return q;
    });

    const tokens = await fetchAllPaged<DeviceToken>(() => {
      let q = supabase.from('device_tokens').select('token, user_id, platform').in('user_id', userIds).order('token');
      return q;
    });

    console.log(`[send-daily-notifications] loaded profiles=${profiles.length} tokens=${tokens.length} prefs=${preferences.length}`);

    // Get today's already sent notifications to prevent duplicates — use Baku-local day boundary.
    // bakuNow is already shifted by +4h, so its UTC midnight === Baku midnight in the original UTC clock.
    const bakuMidnight = new Date(bakuNow);
    bakuMidnight.setUTCHours(0, 0, 0, 0);
    // Convert back to real UTC instant by subtracting the +4h shift we added earlier.
    const todayStart = new Date(bakuMidnight.getTime() - bakuOffsetMs);

    const todaySentLogs = await fetchAllPaged<any>(() => {
      let q = supabase
        .from('notification_send_log')
        .select('user_id, source_type, source_notification_id')
        .gte('sent_at', todayStart.toISOString())
        .in('user_id', userIds)
        .in('source_type', ['scheduled', 'pregnancy_day', 'mommy_day', ...DAILY_RUN_SLOTS.map(slot => `scheduled:${slot.runAt}`)])
        .eq('status', 'sent')
        .order('sent_at');
      if (body.userId) q = q.eq('user_id', body.userId);
      return q;
    });

    // Build a set of "userId:sourceType:sourceNotifId" for dedup.
    // skipDedup=true (test mode) → empty set, so resend is allowed.
    const alreadySent = new Set<string>();
    if (!body.skipDedup) {
      todaySentLogs?.forEach((log: any) => {
        const sourceType = normalizeSourceTypeForDedup(log.source_type);
        if (sourceType && log.source_notification_id) {
          alreadySent.add(`${log.user_id}:${sourceType}:${log.source_notification_id}`);
        }
      });
    }

    // Build user map
    const userMap = new Map<string, UserForNotification>();
    profiles?.forEach((p: any) => {
      userMap.set(p.user_id, {
        user_id: p.user_id, life_stage: p.life_stage || 'flow', role: p.role || 'user',
        due_date: p.due_date, last_period_date: p.last_period_date,
        daily_push_enabled: true,
        language: 'az',
      });
    });

    preferences?.forEach((pref: any) => {
      const user = userMap.get(pref.user_id);
      if (user) {
        user.daily_push_enabled = pref.push_enabled !== false && pref.daily_push_enabled !== false;
        if (pref.language) user.language = pref.language;
      }
    });

    const calculatePregnancyDay = (lastPeriodDate: string | null): number | null => {
      if (!lastPeriodDate) return null;
      const lmp = new Date(lastPeriodDate);
      const today = new Date();
      lmp.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return (diffDays >= 1 && diffDays <= 280) ? diffDays : null;
    };

    const allEligibleUsers = Array.from(userMap.values()).filter(user => user.daily_push_enabled);
    const eligibleUsers = allEligibleUsers;
    const hasMoreUsers = !body.userId && profiles.length === CHUNK_SIZE;

    console.log(`Eligible users: ${allEligibleUsers.length} | this chunk: ${eligibleUsers.length} (offset ${chunkOffset})`);

    let sentCount = 0;
    const results: Array<{ userId: string; success: boolean; type?: string; day?: number; error?: string }> = [];

    const processUser = async (user: UserForNotification) => {
      const userTokens = tokens.filter((t: DeviceToken) => t.user_id === user.user_id);
      if (!userTokens.length) { skippedCount++; bumpReason(reasons, 'no_device_token'); return; }

      const notificationsToSend: Array<{ title: string; body: string; id: string; type: string; sourceType?: string; day?: number }> = [];

      if (user.life_stage === 'bump' && user.last_period_date) {
        const pregnancyDay = calculatePregnancyDay(user.last_period_date);
        if (pregnancyDay !== null) {
          const dayNotifications = pregnancyNotifsByDay.get(pregnancyDay) || [];
          for (const dn of dayNotifications) {
            const dedupKey = `${user.user_id}:pregnancy_day:${dn.id}`;
            if (!alreadySent.has(dedupKey)) {
              const localizedTitle = pickLang(dn as unknown as Record<string, unknown>, 'title', user.language);
              const localizedBody = pickLang(dn as unknown as Record<string, unknown>, 'body', user.language);
              notificationsToSend.push({
                id: dn.id,
                title: `${dn.emoji || ''} ${localizedTitle}`.trim(),
                body: localizedBody, type: 'pregnancy_day', day: pregnancyDay,
              });
            }
          }
        }
      }

      if (user.life_stage === 'mommy') {
        const userChildren = children?.filter((c: any) => c.user_id === user.user_id) || [];
        if (userChildren.length > 0 && userChildren[0].birth_date) {
          const birthDate = String(userChildren[0].birth_date).slice(0, 10);
          const childAgeDays = getBabyDayNumber(birthDate, notificationDate);
          if (childAgeDays !== null) {
            const dayNotifications = selectMommyNotifications(mommyIndex, birthDate, notificationDate) as DayNotification[];
            for (const dn of dayNotifications) {
              const dedupKey = `${user.user_id}:mommy_day:${dn.id}`;
              if (!alreadySent.has(dedupKey)) {
                const localizedTitle = renderMommyNotificationText(pickLang(dn as unknown as Record<string, unknown>, 'title', user.language), dn, birthDate);
                const localizedBody = renderMommyNotificationText(pickLang(dn as unknown as Record<string, unknown>, 'body', user.language), dn, birthDate);
                notificationsToSend.push({
                  id: dn.id,
                  title: `${dn.emoji || ''} ${localizedTitle}`.trim(),
                  body: localizedBody, type: 'mommy_day', day: childAgeDays,
                });
              }
            }
          }
        }
      }

      if (notificationsToSend.length === 0 && scheduledNotifications?.length) {
        const rawMatches = (scheduledNotifications || []).filter((n: ScheduledNotification) => {
          if (n.target_audience === 'all') return true;
          if (n.target_audience === user.life_stage) return true;
          if (n.target_audience === 'partner' && user.role === 'partner') return true;
          return false;
        });
        // MƏRHƏLƏ PRİORİTETİ: istifadəçinin öz mərhələsinə (mommy/bump/flow)
        // ünvanlanan şablonlar 'all'-dan ƏVVƏL gəlir — əks halda 'all' kimi
        // yazılmış hamiləlik-məzmunlu statik push Ana modulundakı istifadəçiyə
        // düşə bilirdi ("Ana modulundayam, hamilə bildirişi gəlir" şikayəti).
        const matches = [
          ...rawMatches.filter((n: ScheduledNotification) => n.target_audience === user.life_stage),
          ...rawMatches.filter((n: ScheduledNotification) => n.target_audience !== user.life_stage),
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
            const localizedTitle = pickLang(match as unknown as Record<string, unknown>, 'title', user.language);
            const localizedBody = pickLang(match as unknown as Record<string, unknown>, 'body', user.language);
            notificationsToSend.push({ id: match.id, title: localizedTitle, body: localizedBody, type: 'scheduled', sourceType: scheduledSourceType });
          }
        }
      }

      for (const notif of notificationsToSend) {
        let delivered = false;
        let lastErr: { code?: string; msg?: string } = {};
        for (const deviceToken of userTokens) {
          const result = await sendFCMv1(accessToken, projectId, deviceToken.token, notif.title, notif.body, {
            type: notif.type, notification_id: notif.id,
          });

          if (result.success) {
            sentCount++;
            delivered = true;
            results.push({ userId: user.user_id, success: true, type: notif.type, day: notif.day });
            alreadySent.add(`${user.user_id}:${normalizeSourceTypeForDedup(notif.sourceType ?? notif.type)}:${notif.id}`);
            await supabase.from('notification_send_log').insert({
              user_id: user.user_id,
              notification_id: notif.type === 'scheduled' ? notif.id : null,
              title: notif.title, body: notif.body, status: 'sent',
              source_type: notif.sourceType ?? notif.type, source_notification_id: notif.id,
              notification_type: notif.type,
            });
            break;
          } else {
            lastErr = { code: result.errorCode, msg: result.error };
            results.push({ userId: user.user_id, success: false, error: result.error });
            // Only delete tokens that FCM definitively flags as dead.
            if (result.unregistered) {
              console.log(`[send-daily-notifications] Removing dead token (code=${result.errorCode}): ...${deviceToken.token.slice(-12)}`);
              await supabase.from('device_tokens').delete().eq('token', deviceToken.token);
            }
          }
        }
        if (!delivered) {
          failedCount++;
          bumpReason(reasons, `fcm:${lastErr.code || 'unknown'}`);
          await logFailedSend(supabase, {
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
        // Categorise why this user got nothing
        if (user.life_stage === 'bump' && !user.last_period_date) bumpReason(reasons, 'bump_no_lmp');
        else if (user.life_stage === 'mommy' && !children?.some((c: any) => c.user_id === user.user_id)) bumpReason(reasons, 'mommy_no_children');
        else bumpReason(reasons, 'no_matching_content');
      }
    };

    // Parallel batches of 25 users for speed
    const concurrency = 25;
    for (let i = 0; i < eligibleUsers.length; i += concurrency) {
      const batch = eligibleUsers.slice(i, i + concurrency);
      await Promise.all(batch.map(processUser));
      console.log(`[send-daily-notifications] Processed ${Math.min(i + concurrency, eligibleUsers.length)}/${eligibleUsers.length}, sent so far: ${sentCount}`);
    }

    // Update last_push_sent_at for users who got notifications
    const sentUserIds = [...new Set(results.filter(r => r.success).map(r => r.userId))];
    for (const userId of sentUserIds) {
      await supabase.from('user_preferences').upsert({
        user_id: userId, last_push_sent_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    }

    console.log(`Daily notifications sent: ${sentCount}`);

    // Növbəti parçanı işə sal (fire-and-forget) — bütün istifadəçilər əhatə olunsun.
    if (hasMoreUsers) {
      const nextBody = { ...body, offset: chunkOffset + CHUNK_SIZE, manual: body.manual ?? false, slot: activeSendTime ?? body.slot };
      const nextUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-daily-notifications`;
      console.log(`[send-daily-notifications] scheduling next chunk offset=${nextBody.offset}`);
      const continueChunk = async () => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        for (const name of ['Authorization', 'apikey', 'x-cron-secret']) {
          const value = req.headers.get(name); if (value) headers[name] = value;
        }
        const response = await fetch(nextUrl, {
          method: 'POST',
          headers, redirect: 'error', signal: AbortSignal.timeout(15000),
          body: JSON.stringify(nextBody),
        });
        const accepted = response.ok; await response.body?.cancel();
        if (!accepted) throw new Error('notification_continuation_rejected');
      };
      const continuation = continueChunk().catch(async () => {
        await finishRunLog(supabase, runId, { status: 'error', sent_count: sentCount, failed_count: failedCount,
          reasons: { ...reasons, continuation_failed: 1 }, error_message: 'notification_continuation_failed' });
        console.error('[send-daily-notifications] continuation_failed');
      });
      if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(continuation);
      else await continuation;
    }

    await finishRunLog(supabase, runId, {
      status: 'success',
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      eligible_count: eligibleUsers.length,
      reasons,
    });

    return new Response(
      JSON.stringify({
        success: true, sent: sentCount, eligible: eligibleUsers.length,
        failed: failedCount, skipped: skippedCount, reasons,
        currentTime: currentTimeStr, activeSlot: activeSendTime || 'manual',
        pregnancyDaysAvailable: pregnancyNotifsByDay.size,
        mommyDaysAvailable: mommyIndex.daily.size,
        results: results.slice(0, 20),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in send-daily-notifications:', err);
    if (runSupabase && runId) {
      await finishRunLog(runSupabase, runId, {
        status: 'error',
        sent_count: 0,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
