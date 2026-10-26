import { createClient } from 'npm:@supabase/supabase-js@2';
import { getFirebaseAccessToken, sendFCMv1 } from '../_shared/fcm.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { requireNotificationCron } from '../_shared/notification-auth.ts';
import { startRunLog, finishRunLog, logFailedSend, bumpReason } from '../_shared/notif-logging.ts';
import { fetchAllPaged } from '../_shared/paginate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FlowReminder {
  id: string;
  user_id: string;
  reminder_type: string;
  days_before: number;
  time_of_day: string;
  is_enabled: boolean;
  title: string | null;
  message: string | null;
  title_en: string | null;
  message_en: string | null;
}

type ReminderTexts = Record<string, { title: (d: number) => string; body: (d: number) => string }>;

// Statik flow bildirişlərinin default mətnləri — 4 dildə (az/en/ru/tr).
const DEFAULTS: Record<string, ReminderTexts> = {
  az: {
    period_start: { title: () => 'Period yaxınlaşır 🔴', body: (d) => `Perioda ${d} gün qaldı!` },
    period_end: { title: () => 'Period bitdi ✅', body: () => 'Periodunuz sona çatdı!' },
    ovulation: { title: () => 'Ovulyasiya günü 🌸', body: (d) => `Ovulyasiyaya ${d} gün qaldı!` },
    fertile_start: { title: () => 'Məhsuldar günlər 💕', body: () => 'Məhsuldar günlər başlayır!' },
    fertile_end: { title: () => 'Məhsuldar günlər bitir 📅', body: () => 'Məhsuldar günlər sona çatır.' },
    pms: { title: () => 'PMS dövrü ⚡', body: () => 'PMS dövrü yaxınlaşır, özünüzə baxın!' },
    pill: { title: () => 'Həb vaxtı 💊', body: () => 'Gündəlik həbinizi qəbul etməyi unutmayın!' },
  },
  en: {
    period_start: { title: () => 'Period is coming 🔴', body: (d) => `${d} day(s) until your period!` },
    period_end: { title: () => 'Period ended ✅', body: () => 'Your period is over!' },
    ovulation: { title: () => 'Ovulation day 🌸', body: (d) => `${d} day(s) until ovulation!` },
    fertile_start: { title: () => 'Fertile window 💕', body: () => 'Your fertile window starts!' },
    fertile_end: { title: () => 'Fertile window ending 📅', body: () => 'Your fertile window is ending.' },
    pms: { title: () => 'PMS period ⚡', body: () => 'PMS is coming, take care of yourself!' },
    pill: { title: () => 'Pill time 💊', body: () => "Don't forget to take your daily pill!" },
  },
  ru: {
    period_start: { title: () => 'Менструация приближается 🔴', body: (d) => `До менструации ${d} дн.!` },
    period_end: { title: () => 'Менструация закончилась ✅', body: () => 'Ваша менструация завершилась!' },
    ovulation: { title: () => 'День овуляции 🌸', body: (d) => `До овуляции ${d} дн.!` },
    fertile_start: { title: () => 'Фертильные дни 💕', body: () => 'Начинаются фертильные дни!' },
    fertile_end: { title: () => 'Фертильные дни заканчиваются 📅', body: () => 'Фертильные дни подходят к концу.' },
    pms: { title: () => 'Период ПМС ⚡', body: () => 'Приближается ПМС — позаботьтесь о себе!' },
    pill: { title: () => 'Время таблетки 💊', body: () => 'Не забудьте принять ежедневную таблетку!' },
  },
  tr: {
    period_start: { title: () => 'Regl yaklaşıyor 🔴', body: (d) => `Regl dönemine ${d} gün kaldı!` },
    period_end: { title: () => 'Regl bitti ✅', body: () => 'Regl döneminiz sona erdi!' },
    ovulation: { title: () => 'Ovülasyon günü 🌸', body: (d) => `Ovülasyona ${d} gün kaldı!` },
    fertile_start: { title: () => 'Doğurgan günler 💕', body: () => 'Doğurgan günler başlıyor!' },
    fertile_end: { title: () => 'Doğurgan günler bitiyor 📅', body: () => 'Doğurgan günler sona eriyor.' },
    pms: { title: () => 'PMS dönemi ⚡', body: () => 'PMS dönemi yaklaşıyor, kendinize iyi bakın!' },
    pill: { title: () => 'Hap zamanı 💊', body: () => 'Günlük hapınızı almayı unutmayın!' },
  },
  kk: {
    period_start: { title: () => 'Етеккір жақындап қалды 🔴', body: (d) => `Етеккірге дейін ${d} күн қалды!` },
    period_end: { title: () => 'Етеккір аяқталды ✅', body: () => 'Етеккіріңіз аяқталды!' },
    ovulation: { title: () => 'Овуляция күні 🌸', body: (d) => `Овуляцияға дейін ${d} күн қалды!` },
    fertile_start: { title: () => 'Фертильді күндер 💕', body: () => 'Фертильді күндер басталады!' },
    fertile_end: { title: () => 'Фертильді күндер аяқталады 📅', body: () => 'Фертильді күндер аяқталып келеді.' },
    pms: { title: () => 'ПМС кезеңі ⚡', body: () => 'ПМС кезеңі жақындап қалды, өзіңізге күтім жасаңыз!' },
    pill: { title: () => 'Дәрі қабылдау уақыты 💊', body: () => 'Күнделікті дәріңізді қабылдауды ұмытпаңыз!' },
  },
  uz: {
    period_start: { title: () => 'Hayz yaqinlashmoqda 🔴', body: (d) => `Hayzgacha ${d} kun qoldi!` },
    period_end: { title: () => 'Hayz tugadi ✅', body: () => 'Hayz davringiz yakunlandi!' },
    ovulation: { title: () => 'Ovulyatsiya kuni 🌸', body: (d) => `Ovulyatsiyagacha ${d} kun qoldi!` },
    fertile_start: { title: () => 'Fertil kunlar 💕', body: () => 'Fertil kunlar boshlanmoqda!' },
    fertile_end: { title: () => 'Fertil kunlar tugayapti 📅', body: () => 'Fertil kunlar yakunlanmoqda.' },
    pms: { title: () => 'PMS davri ⚡', body: () => 'PMS davri yaqinlashmoqda, oʻzingizga gʻamxoʻrlik qiling!' },
    pill: { title: () => 'Tabletka vaqti 💊', body: () => 'Kundalik tabletkangizni qabul qilishni unutmang!' },
  },
  ka: {
    period_start: { title: () => 'მენსტრუაცია ახლოვდება 🔴', body: (d) => `მენსტრუაციამდე ${d} დღე დარჩა!` },
    period_end: { title: () => 'მენსტრუაცია დასრულდა ✅', body: () => 'თქვენი მენსტრუაცია დასრულდა!' },
    ovulation: { title: () => 'ოვულაციის დღე 🌸', body: (d) => `ოვულაციამდე ${d} დღე დარჩა!` },
    fertile_start: { title: () => 'ფერტილური დღეები 💕', body: () => 'ფერტილური დღეები იწყება!' },
    fertile_end: { title: () => 'ფერტილური დღეები სრულდება 📅', body: () => 'ფერტილური დღეები სასრულს უახლოვდება.' },
    pms: { title: () => 'PMS პერიოდი ⚡', body: () => 'PMS პერიოდი ახლოვდება — მოუარეთ საკუთარ თავს!' },
    pill: { title: () => 'აბის დროა 💊', body: () => 'არ დაგავიწყდეთ ყოველდღიური აბის მიღება!' },
  },
  de: {
    period_start: { title: () => 'Die Periode rückt näher 🔴', body: (d) => `Noch ${d} Tag(e) bis zu deiner Periode!` },
    period_end: { title: () => 'Die Periode ist vorbei ✅', body: () => 'Deine Periode ist zu Ende!' },
    ovulation: { title: () => 'Tag des Eisprungs 🌸', body: (d) => `Noch ${d} Tag(e) bis zum Eisprung!` },
    fertile_start: { title: () => 'Fruchtbare Tage 💕', body: () => 'Deine fruchtbaren Tage beginnen!' },
    fertile_end: { title: () => 'Die fruchtbaren Tage enden 📅', body: () => 'Deine fruchtbaren Tage gehen zu Ende.' },
    pms: { title: () => 'PMS-Phase ⚡', body: () => 'Die PMS-Phase rückt näher – achte gut auf dich!' },
    pill: { title: () => 'Zeit für die Pille 💊', body: () => 'Vergiss nicht, deine tägliche Pille einzunehmen!' },
  },
  ar: {
    period_start: { title: () => 'الدورة الشهرية تقترب 🔴', body: (d) => `بقي ${d} أيام على الدورة الشهرية!` },
    period_end: { title: () => 'انتهت الدورة الشهرية ✅', body: () => 'انتهت دورتكِ الشهرية!' },
    ovulation: { title: () => 'يوم الإباضة 🌸', body: (d) => `بقي ${d} أيام على الإباضة!` },
    fertile_start: { title: () => 'أيام الخصوبة 💕', body: () => 'تبدأ أيام الخصوبة!' },
    fertile_end: { title: () => 'نهاية أيام الخصوبة 📅', body: () => 'توشك أيام الخصوبة على الانتهاء.' },
    pms: { title: () => 'فترة متلازمة ما قبل الدورة ⚡', body: () => 'تقترب فترة متلازمة ما قبل الدورة، فاعتني بنفسكِ!' },
    pill: { title: () => 'موعد الحبة 💊', body: () => 'لا تنسي تناول حبتكِ اليومية!' },
  },
};

function pickLang(value: string | null | undefined, valueEn: string | null | undefined, lang: string): string {
  // İstifadəçinin ÖZ yazdığı xatırlatma mətni: EN üçün _en sütunu, digər dillər üçün
  // yalnız custom AZ mətni varsa o göstərilir; boşdursa DEFAULTS (aşağıda) işə düşür.
  if (lang === 'en') return (valueEn && valueEn.trim()) ? valueEn : '';
  if (lang === 'ru' || lang === 'tr' || lang === 'kk' || lang === 'uz' || lang === 'ka' || lang === 'de' || lang === 'ar') return ''; // custom mətn tərcüməsizdir → localized default üstün tutulur
  return value || '';
}

interface UserProfile {
  user_id: string;
  life_stage: string;
  last_period_date: string | null;
  cycle_length: number | null;
  period_length: number | null;
}

interface DeviceToken {
  token: string;
  user_id: string;
  platform: string;
}

function parseBakuTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [rawHour = '0', rawMinute = '0'] = value.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function getCycleInfo(lastPeriodDate: string, cycleLength: number, periodLength: number) {
  const today = new Date();
  const lmp = new Date(lastPeriodDate);
  today.setHours(0, 0, 0, 0);
  lmp.setHours(0, 0, 0, 0);

  const daysSincePeriod = Math.floor((today.getTime() - lmp.getTime()) / (1000 * 60 * 60 * 24));
  const currentCycleDay = (daysSincePeriod % cycleLength) + 1;
  const cyclesPassed = Math.floor(daysSincePeriod / cycleLength);
  const nextPeriodDate = new Date(lmp);
  nextPeriodDate.setDate(nextPeriodDate.getDate() + (cyclesPassed + 1) * cycleLength);
  const daysUntilPeriod = Math.floor((nextPeriodDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const ovulationDate = new Date(nextPeriodDate);
  ovulationDate.setDate(ovulationDate.getDate() - 14);
  const daysUntilOvulation = Math.floor((ovulationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const fertileStart = new Date(ovulationDate);
  fertileStart.setDate(fertileStart.getDate() - 5);
  const daysUntilFertile = Math.floor((fertileStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isPeriodDay = currentCycleDay <= periodLength;
  const daysUntilPMS = daysUntilPeriod - 7;

  return { currentCycleDay, daysUntilPeriod, daysUntilOvulation, daysUntilFertile, daysUntilPMS, isPeriodDay, cycleLength };
}

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
    // Accept scheduled calls (cron secret / project key) OR admin user (manual trigger from admin panel)
    const cronErr = await requireNotificationCron(req, 'send-flow-reminders');
    let triggeredBy = 'cron';
    if (cronErr) {
      const adminCheck = await requireAdmin(req);
      if (adminCheck.error) return adminCheck.error;
      triggeredBy = 'admin';
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    runSupabase = supabase;

    const now = new Date();
    const bakuOffsetMs = 4 * 60 * 60 * 1000;
    const bakuNow = new Date(now.getTime() + bakuOffsetMs);
    const adjustedHour = bakuNow.getUTCHours();
    const bakuMinute = bakuNow.getUTCMinutes();
    const bakuTimeStr = `${String(adjustedHour).padStart(2, '0')}:${String(bakuMinute).padStart(2, '0')}`;
    const bakuMinutes = adjustedHour * 60 + bakuMinute;

    let body: { manual?: boolean; userId?: string } = {};
    try { body = await req.json(); } catch { /* No body */ }

    if (body.manual && body.userId) triggeredBy = 'admin-test';

    runId = await startRunLog(supabase, 'send-flow-reminders', triggeredBy, bakuTimeStr, body.manual ? 'manual' : null);

    if (!body.manual && (adjustedHour < 9 || adjustedHour >= 22)) {
      await finishRunLog(supabase, runId, { status: 'success', skipped_count: 1, reasons: { outside_hours: 1 } });
      return new Response(
        JSON.stringify({ message: 'Outside notification hours', skipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!saJson) {
      await finishRunLog(supabase, runId, { status: 'error', error_message: 'Firebase SA not configured' });
      return new Response(
        JSON.stringify({ error: 'Firebase service account not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { accessToken, projectId } = await getFirebaseAccessToken(saJson);

    // Bütün sorğular səhifələnir — PostgREST-in 1000 sətir limiti əks halda
    // istifadəçilərin çoxunu kənarda qoyurdu.
    const reminders = await fetchAllPaged<any>(() => {
      let q = supabase.from('flow_reminders').select('*').eq('is_enabled', true).order('user_id');
      if (body.userId) q = q.eq('user_id', body.userId);
      return q;
    });

    if (!reminders.length) {
      await finishRunLog(supabase, runId, { status: 'success', skipped_count: 1, reasons: { no_active_reminders: 1 } });
      return new Response(
        JSON.stringify({ message: 'No active flow reminders', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const profiles = await fetchAllPaged<UserProfile>(() => {
      let q = supabase
        .from('profiles').select('user_id, life_stage, last_period_date, cycle_length, period_length')
        .eq('life_stage', 'flow').order('user_id');
      if (body.userId) q = q.eq('user_id', body.userId);
      return q;
    });

    const tokens = await fetchAllPaged<DeviceToken>(() => {
      let q = supabase.from('device_tokens').select('token, user_id, platform').order('token');
      if (body.userId) q = q.eq('user_id', body.userId);
      return q;
    });

    if (!tokens.length) {
      await finishRunLog(supabase, runId, { status: 'success', skipped_count: 1, reasons: { no_device_tokens: 1 } });
      return new Response(
        JSON.stringify({ message: 'No device tokens', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user language preferences
    const prefs = await fetchAllPaged<any>(() => {
      let q = supabase.from('user_preferences').select('user_id, language').order('user_id');
      if (body.userId) q = q.eq('user_id', body.userId);
      return q;
    });
    console.log(`[send-flow-reminders] reminders=${reminders.length} profiles=${profiles.length} tokens=${tokens.length}`);
    const langByUser = new Map<string, string>();
    prefs?.forEach((p: any) => { langByUser.set(p.user_id, p.language || 'az'); });

    const profileMap = new Map<string, UserProfile>();
    profiles?.forEach((p: UserProfile) => { if (p.last_period_date) profileMap.set(p.user_id, p); });

    const tokensByUser = new Map<string, DeviceToken[]>();
    tokens.forEach((t: DeviceToken) => {
      if (!tokensByUser.has(t.user_id)) tokensByUser.set(t.user_id, []);
      tokensByUser.get(t.user_id)!.push(t);
    });

    let sentCount = 0;
    const results: Array<{ userId: string; type: string; success: boolean }> = [];

    for (const reminder of reminders as FlowReminder[]) {
      const profile = profileMap.get(reminder.user_id);
      if (!profile?.last_period_date) { skippedCount++; bumpReason(reasons, 'flow_no_lmp'); continue; }

      const cycleLength = profile.cycle_length || 28;
      const periodLength = profile.period_length || 5;
      const cycleInfo = getCycleInfo(profile.last_period_date, cycleLength, periodLength);

      const userLang = langByUser.get(reminder.user_id) || 'az';
      let shouldSend = false;
      let notificationTitle = pickLang(reminder.title, reminder.title_en, userLang);
      let notificationBody = pickLang(reminder.message, reminder.message_en, userLang);

      // İstifadəçi dilinə uyğun default mətnlər (az/en/ru/tr; naməlum dil → az)
      const langDefs = DEFAULTS[userLang] || DEFAULTS.az;
      const def = langDefs[reminder.reminder_type];

      switch (reminder.reminder_type) {
        case 'period_start':
          if (cycleInfo.daysUntilPeriod === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(reminder.days_before);
            notificationBody = notificationBody || def.body(reminder.days_before);
          }
          break;
        case 'period_end':
          if (cycleInfo.isPeriodDay && cycleInfo.currentCycleDay === periodLength) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'ovulation':
          if (cycleInfo.daysUntilOvulation === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(reminder.days_before);
            notificationBody = notificationBody || def.body(reminder.days_before);
          }
          break;
        case 'fertile_start':
          if (cycleInfo.daysUntilFertile === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'fertile_end':
          if (cycleInfo.daysUntilFertile === -(6 - reminder.days_before)) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'pms':
          if (cycleInfo.daysUntilPMS === reminder.days_before) {
            shouldSend = true;
            notificationTitle = notificationTitle || def.title(0);
            notificationBody = notificationBody || def.body(0);
          }
          break;
        case 'pill':
          shouldSend = true;
          notificationTitle = notificationTitle || def.title(0);
          notificationBody = notificationBody || def.body(0);
          break;
      }

      // For admin test: bypass shouldSend / time-of-day window.
      if (!shouldSend && !body.manual) { skippedCount++; bumpReason(reasons, `flow_off_schedule:${reminder.reminder_type}`); continue; }

      const reminderMinutes = parseBakuTimeToMinutes(reminder.time_of_day);
      if (!body.manual && (reminderMinutes === null || Math.abs(bakuMinutes - reminderMinutes) > 15)) {
        skippedCount++;
        bumpReason(reasons, 'flow_wrong_time_window');
        continue;
      }

      if (body.manual) {
        notificationTitle = notificationTitle || `[TEST] Flow • ${reminder.reminder_type}`;
        notificationBody = notificationBody || 'Test bildirişi (admin paneli)';
      }

      const userTokens = tokensByUser.get(reminder.user_id);
      if (!userTokens?.length) { skippedCount++; bumpReason(reasons, 'no_device_token'); continue; }

      let delivered = false;
      let lastErr: { code?: string; msg?: string } = {};
      for (const deviceToken of userTokens) {
        const result = await sendFCMv1(accessToken, projectId, deviceToken.token, notificationTitle, notificationBody, {
          type: 'flow_reminder', reminder_type: reminder.reminder_type,
        });

        if (result.success) {
          sentCount++;
          delivered = true;
          results.push({ userId: reminder.user_id, type: reminder.reminder_type, success: true });

          await supabase.from('notification_send_log').insert({
            user_id: reminder.user_id, title: notificationTitle, body: notificationBody, status: 'sent',
            notification_type: 'flow_reminder', source_type: 'flow_reminder', source_notification_id: reminder.id,
          });

          break;
        } else {
          lastErr = { code: result.errorCode, msg: result.error };
          if (result.unregistered) {
            console.log(`[send-flow-reminders] Removing dead token (code=${result.errorCode}): ...${deviceToken.token.slice(-12)}`);
            await supabase.from('device_tokens').delete().eq('token', deviceToken.token);
          }
        }
      }
      if (!delivered) {
        failedCount++;
        bumpReason(reasons, `fcm:${lastErr.code || 'unknown'}`);
        await logFailedSend(supabase, {
          user_id: reminder.user_id,
          notification_type: 'flow_reminder',
          source_type: 'flow_reminder',
          source_notification_id: reminder.id,
          title: notificationTitle,
          body: notificationBody,
          reason: lastErr.msg || 'FCM send failed',
          error_code: lastErr.code,
        });
      }
    }

    console.log(`Flow reminders sent: ${sentCount}`);

    await finishRunLog(supabase, runId, {
      status: 'success',
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
      eligible_count: reminders.length,
      reasons,
    });

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failedCount, skipped: skippedCount, reasons, totalReminders: reminders.length, results: results.slice(0, 10) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error in send-flow-reminders:', err);
    if (runSupabase && runId) {
      await finishRunLog(runSupabase, runId, { status: 'error', error_message: err instanceof Error ? err.message : String(err) });
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
