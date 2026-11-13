// Premium lifecycle pushes (2026-11-13, 20261113150000_premium_lifecycle_pushes.sql). Never logs tokens or user ids.
//  * store_expiring: App Store / Google Play Premium with auto-renew off, ending in 24-72 h. One push per period end in
//    the user's app language (23 languages), 10:00-20:00 their local time. Opens the in-app Premium screen.
//  * web_renewal_failed / web_expired: anacan.az saved-card subscription (Azerbaijani only), next to the e-mail.
import { getFirebaseAccessToken, sendFCMv1 } from './fcm.ts';
import { CABINET_PAGE, STANDARD_PAGE } from './web-premium-subscription.ts';

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;
type Fcm = { accessToken: string; projectId: string };
type Copy = { title: string; body: string };

/** Store Premium ending soon with auto-renew off. Plain, short, no long dashes. */
export const STORE_EXPIRING: Record<string, Copy> = {
  az: { title: 'Premium tezliklə bitir', body: 'Avtomatik yenilənmə söndürülüb. Premium imkanlarını itirməmək üçün abunəliyi yenidən aktiv et.' },
  en: { title: 'Your Premium ends soon', body: 'Auto-renew is off. Turn your subscription back on to keep your Premium features.' },
  tr: { title: "Premium'un yakında bitiyor", body: 'Otomatik yenileme kapalı. Premium özelliklerini kaybetmemek için aboneliğini yeniden başlat.' },
  ru: { title: 'Premium скоро закончится', body: 'Автопродление отключено. Возобнови подписку, чтобы сохранить возможности Premium.' },
  de: { title: 'Dein Premium endet bald', body: 'Die automatische Verlängerung ist aus. Aktiviere dein Abo wieder, um deine Premium-Funktionen zu behalten.' },
  ar: { title: 'اشتراك Premium سينتهي قريبًا', body: 'التجديد التلقائي متوقف. يُرجى إعادة تفعيل الاشتراك للاحتفاظ بمزايا Premium.' },
  ka: { title: 'Premium მალე სრულდება', body: 'ავტომატური განახლება გამორთულია. Premium-ის ფუნქციების შესანარჩუნებლად ხელახლა ჩართე გამოწერა.' },
  kk: { title: 'Premium жақында аяқталады', body: 'Автоматты жаңарту өшірулі. Premium мүмкіндіктерін сақтау үшін жазылымды қайта қос.' },
  uz: { title: 'Premium tez orada tugaydi', body: 'Avtomatik yangilanish o‘chirilgan. Premium imkoniyatlarini saqlab qolish uchun obunani qayta yoq.' },
  zh: { title: '你的 Premium 即将到期', body: '自动续订已关闭。重新开启订阅，继续使用 Premium 功能。' },
  id: { title: 'Premium kamu segera berakhir', body: 'Perpanjangan otomatis nonaktif. Aktifkan lagi langgananmu agar fitur Premium tetap bisa dipakai.' },
  fr: { title: 'Ton Premium se termine bientôt', body: 'Le renouvellement automatique est désactivé. Réactive ton abonnement pour garder les fonctionnalités Premium.' },
  es: { title: 'Tu Premium termina pronto', body: 'La renovación automática está desactivada. Reactiva tu suscripción para conservar las funciones Premium.' },
  pt: { title: 'Seu Premium termina em breve', body: 'A renovação automática está desativada. Reative sua assinatura para manter os recursos Premium.' },
  vi: { title: 'Premium của bạn sắp hết hạn', body: 'Tự động gia hạn đã tắt. Hãy bật lại gói đăng ký để tiếp tục dùng các tính năng Premium.' },
  hi: { title: 'आपका Premium जल्द खत्म होने वाला है', body: 'ऑटो-रिन्यू बंद है। Premium सुविधाएं बनाए रखने के लिए सदस्यता फिर से चालू करें।' },
  ja: { title: 'Premiumがまもなく終了します', body: '自動更新がオフになっています。Premiumの機能を使い続けるには、サブスクリプションを再開してください。' },
  ko: { title: 'Premium이 곧 종료돼요', body: '자동 갱신이 꺼져 있어요. Premium 기능을 계속 쓰려면 구독을 다시 켜 주세요.' },
  pl: { title: 'Twoje Premium wkrótce się kończy', body: 'Automatyczne odnawianie jest wyłączone. Włącz subskrypcję ponownie, aby zachować funkcje Premium.' },
  nl: { title: 'Je Premium stopt binnenkort', body: 'Automatisch verlengen staat uit. Zet je abonnement weer aan om je Premium-functies te houden.' },
  sv: { title: 'Ditt Premium tar snart slut', body: 'Automatisk förnyelse är avstängd. Aktivera prenumerationen igen för att behålla Premium-funktionerna.' },
  ky: { title: 'Premium жакында бүтөт', body: 'Автоматтык жаңылоо өчүрүлгөн. Premium мүмкүнчүлүктөрүн сактап калуу үчүн жазылууну кайра күйгүз.' },
  et: { title: 'Sinu Premium lõpeb varsti', body: 'Automaatne pikendamine on välja lülitatud. Lülita tellimus uuesti sisse, et Premiumi funktsioonid alles jääksid.' },
};
export const storeExpiringCopy = (language: string | null | undefined): Copy =>
  STORE_EXPIRING[String(language || '').toLowerCase().split(/[-_]/)[0]] ?? STORE_EXPIRING.en;
export const STORE_EXPIRING_DEEPLINK = 'anacan://premium';

/** anacan.az saved-card subscription (Azerbaijani only, like its e-mails). */
export const WEB_RENEWAL_PUSH: Record<'web_renewal_failed' | 'web_expired', Copy & { link: string }> = {
  web_renewal_failed: { title: 'Premium ödənişi alınmadı', body: 'Kartından yenilənmə ödənişi alınmadı. Premium dayanmasın deyə kartını yenilə.',
    link: `${CABINET_PAGE}?utm_source=push&utm_medium=reminder&utm_campaign=renewal_failed` },
  web_expired: { title: 'Premium abunəliyin dayandı', body: 'Kartdan ödəniş alınmadığı üçün abunəlik dayandı. İstədiyin vaxt yenidən aktiv edə bilərsən.',
    link: `${STANDARD_PAGE}?utm_source=push&utm_medium=reminder&utm_campaign=web_expired` },
};

export async function fcmFromEnv(): Promise<Fcm | null> {
  const sa = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!sa) return null;
  try { return await getFirebaseAccessToken(sa); } catch { console.error('[premium-push] fcm auth failed'); return null; }
}

/** Sends one push to every device of a user (max 10); returns delivered count and notes provider codes. */
export async function pushToUser(admin: Admin, fcm: Fcm | null, userId: string, copy: Copy, data: Record<string, string>,
  codes: Record<string, number>): Promise<number> {
  const note = (code: string) => { codes[code] = (codes[code] ?? 0) + 1; };
  if (!fcm) { note('fcm_unavailable'); return 0; }
  const { data: tokens, error } = await admin.from('device_tokens').select('token').eq('user_id', userId);
  if (error) { note('token_read_failed'); return 0; }
  if (!tokens?.length) { note('no_device'); return 0; }
  let sent = 0;
  for (const t of tokens.slice(0, 10)) {
    const r = await sendFCMv1(fcm.accessToken, fcm.projectId, t.token, copy.title, copy.body, data);
    if (r.success) sent += 1;
    else note(String(r.errorCode || r.httpStatus || 'unknown'));
    if (r.unregistered) await admin.from('device_tokens').delete().eq('token', t.token);
  }
  return sent;
}

/** 15-minute timer: store Premium ending soon with auto-renew off. Returns counts only. */
export async function runStoreExpiringPushes(admin: Admin) {
  const summary = { due: 0, push: 0, errors: 0, push_issues: {} as Record<string, number> };
  const { data, error } = await admin.rpc('premium_store_expiring_due_v1', { p_limit: 100 });
  if (error) { summary.errors += 1; return summary; }
  const due: { push_id: string; user_id: string; language: string | null }[] = Array.isArray(data?.due) ? data.due : [];
  summary.due = due.length;
  if (!due.length) return summary;
  const fcm = await fcmFromEnv();
  if (!fcm) summary.push_issues.fcm_auth_failed = 1;
  for (const row of due) {
    try {
      const sent = await pushToUser(admin, fcm, row.user_id, storeExpiringCopy(row.language),
        { type: 'premium_expiring', deeplink: STORE_EXPIRING_DEEPLINK }, summary.push_issues);
      summary.push += sent;
      await admin.rpc('premium_lifecycle_push_sent_v1', { p_id: row.push_id, p_push: sent });
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}

/** Daily renewal run: one push per failed/expired charge, next to the e-mail. Never throws. */
export async function sendWebRenewalPush(admin: Admin, fcm: Fcm | null, userId: string, kind: 'web_renewal_failed' | 'web_expired',
  chargeId: string, codes: Record<string, number>): Promise<number> {
  try {
    const { data: claimId, error } = await admin.rpc('premium_web_push_claim_v1', { p_user: userId, p_kind: kind, p_ref: chargeId });
    if (error || !claimId) return 0;
    const copy = WEB_RENEWAL_PUSH[kind];
    const sent = await pushToUser(admin, fcm, userId, copy, { type: 'web_premium', deeplink: copy.link }, codes);
    await admin.rpc('premium_lifecycle_push_sent_v1', { p_id: claimId, p_push: sent });
    return sent;
  } catch {
    return 0;
  }
}
