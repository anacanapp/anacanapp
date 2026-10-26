// Detaches partner links for users whose Premium subscription has expired,
// and sends a push notification to BOTH the woman and her partner.
// Designed to be called daily by pg_cron.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { getFirebaseAccessToken, sendFCMv1 } from '../_shared/fcm.ts';
import { requireNotificationCron } from '../_shared/notification-auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const cronErr = await requireNotificationCron(req, 'expire-partner-links');
  if (cronErr) return cronErr;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const nowIso = new Date().toISOString();
  const detached: Array<{ womanUserId: string; partnerUserId: string | null }> = [];

  // 1. Find women whose subscription has expired but who still have a linked_partner_id
  const { data: expiredSubs, error: subErr } = await supabase
    .from('subscriptions')
    .select('user_id, plan_type, status, expires_at')
    .or(`status.eq.expired,and(status.eq.cancelled,expires_at.lt.${nowIso})`);

  if (subErr) {
    return new Response(JSON.stringify({ error: subErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Also pick up free-plan users who somehow still have a linked partner (defensive)
  for (const sub of expiredSubs ?? []) {
    // Get the woman's profile
    const { data: womanProfile } = await supabase
      .from('profiles')
      .select('id, user_id, linked_partner_id, is_premium')
      .eq('user_id', sub.user_id)
      .maybeSingle();

    if (!womanProfile?.linked_partner_id) continue;
    if (womanProfile.is_premium) continue; // still premium via profile flag — skip

    // Get the partner profile that the woman is linked to
    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('id, user_id, is_premium')
      .eq('id', womanProfile.linked_partner_id)
      .maybeSingle();

    // Household premium: if the PARTNER holds an active premium, keep the link
    if (partnerProfile?.user_id) {
      if (partnerProfile.is_premium) continue;
      const { data: partnerSub } = await supabase
        .from('subscriptions')
        .select('plan_type, status, expires_at')
        .eq('user_id', partnerProfile.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const partnerPremium =
        partnerSub &&
        (partnerSub.plan_type === 'premium' || partnerSub.plan_type === 'premium_plus') &&
        (partnerSub.status === 'active' ||
          (partnerSub.status === 'cancelled' && partnerSub.expires_at && new Date(partnerSub.expires_at) > new Date()));
      if (partnerPremium) continue;
    }

    // Detach both sides
    await supabase
      .from('profiles')
      .update({ linked_partner_id: null })
      .eq('id', womanProfile.id);

    if (partnerProfile?.id) {
      await supabase
        .from('profiles')
        .update({ linked_partner_id: null })
        .eq('id', partnerProfile.id);
    }

    detached.push({
      womanUserId: womanProfile.user_id,
      partnerUserId: partnerProfile?.user_id ?? null,
    });
  }

  // 2. Send push notification to both sides (localized per user's language)
  const saJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  let pushSent = 0;

  const TEXTS: Record<string, { title: string; inApp: string; push: string }> = {
    az: {
      title: 'Premium müddəti bitdi',
      inApp: 'Premium abunəliyiniz başa çatdı və partnyor bağlantısı dayandırıldı. Yenidən aktivləşdirmək üçün Premium-u uzadın.',
      push: 'Partnyor bağlantınız dayandırıldı. Premium-u uzadın və yenidən qoşulun.',
    },
    en: {
      title: 'Premium has expired',
      inApp: 'Your Premium subscription has ended and the partner link has been paused. Renew Premium to reactivate it.',
      push: 'Your partner link has been paused. Renew Premium to reconnect.',
    },
    ru: {
      title: 'Срок Premium истёк',
      inApp: 'Ваша подписка Premium закончилась, и связь с партнёром приостановлена. Продлите Premium, чтобы возобновить её.',
      push: 'Связь с партнёром приостановлена. Продлите Premium и подключитесь снова.',
    },
    tr: {
      title: 'Premium süresi doldu',
      inApp: 'Premium aboneliğiniz sona erdi ve partner bağlantısı durduruldu. Yeniden etkinleştirmek için Premium\'u uzatın.',
      push: 'Partner bağlantınız durduruldu. Premium\'u uzatın ve yeniden bağlanın.',
    },
    kk: {
      title: 'Premium мерзімі аяқталды',
      inApp: 'Premium жазылымыңыз аяқталды және серіктеспен байланыс тоқтатылды. Қайта белсендіру үшін Premium мерзімін ұзартыңыз.',
      push: 'Серіктеспен байланысыңыз тоқтатылды. Premium мерзімін ұзартып, қайта қосылыңыз.',
    },
    uz: {
      title: 'Premium muddati tugadi',
      inApp: 'Premium obunangiz tugadi va hamkor bilan bogʻlanish toʻxtatildi. Qayta faollashtirish uchun Premium muddatini uzaytiring.',
      push: 'Hamkor bilan bogʻlanishingiz toʻxtatildi. Premium muddatini uzaytirib, qayta ulaning.',
    },
    ka: {
      title: 'Premium-ის ვადა ამოიწურა',
      inApp: 'თქვენი Premium გამოწერა დასრულდა და პარტნიორთან კავშირი შეჩერდა. ხელახლა გასააქტიურებლად განაახლეთ Premium.',
      push: 'პარტნიორთან კავშირი შეჩერდა. განაახლეთ Premium და ხელახლა დაუკავშირდით.',
    },
    de: {
      title: 'Premium ist abgelaufen',
      inApp: 'Dein Premium-Abo ist abgelaufen und die Verbindung zu deinem Partner wurde getrennt. Verlängere Premium, um sie wieder zu aktivieren.',
      push: 'Die Verbindung zu deinem Partner wurde getrennt. Verlängere Premium und verbinde dich erneut.',
    },
    ar: {
      title: 'انتهت مدة Premium',
      inApp: 'انتهى اشتراككِ في Premium وتوقف الاتصال بالشريك. مدّدي اشتراك Premium لإعادة تفعيله.',
      push: 'توقف اتصالكِ بالشريك. مدّدي اشتراك Premium وأعيدي الاتصال.',
    },
  };

  if (detached.length > 0) {
    // Pre-fetch language preferences for everyone we're notifying
    const allUserIds = detached
      .flatMap((p) => [p.womanUserId, p.partnerUserId])
      .filter(Boolean) as string[];
    const langByUser = new Map<string, string>();
    if (allUserIds.length > 0) {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('user_id, language')
        .in('user_id', allUserIds);
      prefs?.forEach((p: { user_id: string; language: string | null }) =>
        langByUser.set(p.user_id, p.language || 'az')
      );
    }

    let fcm: { accessToken: string; projectId: string } | null = null;
    if (saJson) {
      try {
        fcm = await getFirebaseAccessToken(saJson);
      } catch (e) {
        console.error('FCM auth error:', e);
      }
    }

    try {
      for (const pair of detached) {
        const userIds = [pair.womanUserId, pair.partnerUserId].filter(Boolean) as string[];

        for (const uid of userIds) {
          const texts = TEXTS[langByUser.get(uid) || 'az'] || TEXTS.az;

          // store in-app notification
          await supabase.from('notifications').insert({
            user_id: uid,
            title: texts.title,
            message: texts.inApp,
            notification_type: 'premium_expired',
            is_read: false,
          });

          if (!fcm) continue;

          const { data: tokens } = await supabase
            .from('device_tokens')
            .select('token')
            .eq('user_id', uid);

          for (const t of tokens ?? []) {
            const r = await sendFCMv1(
              fcm.accessToken,
              fcm.projectId,
              t.token,
              texts.title,
              texts.push,
              { type: 'premium_expired' }
            );
            if (r.success) pushSent++;
            if (r.unregistered) {
              await supabase.from('device_tokens').delete().eq('token', t.token);
            }
          }
        }
      }
    } catch (e) {
      console.error('FCM error:', e);
    }
  }

  return new Response(
    JSON.stringify({ detachedPairs: detached.length, pushSent }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
