// Abandoned PDF book checkout reminder: ONE push (FCM) about an hour after a buyer left the Epoint bank page without
// paying. Claimed by book_checkout_nudges_due_v1 (20261113130000_book_checkout_nudge.sql); called from
// web-premium-renew {"mode":"nudge"} by the existing 15-minute timer. The cart stays on the phone and the push opens
// the book store. Never logs tokens or user ids.
import { getFirebaseAccessToken, sendFCMv1 } from './fcm.ts';

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export const BOOK_NUDGE_DEEPLINK = 'anacan://books';

/** Plain, short Azerbaijani copy (the store is AZ only; no long dashes). */
export function bookNudgeCopy(books: number) {
  return {
    title: 'Səbətin səni gözləyir',
    body: books > 1
      ? `Seçdiyin ${books} kitab hələ səbətdədir. Ödənişi bir dəqiqəyə tamamla, PDF-lər dərhal səndə olsun.`
      : 'Seçdiyin kitab hələ səbətdədir. Ödənişi bir dəqiqəyə tamamla, PDF dərhal səndə olsun.',
  };
}

/** Claims due reminders and sends them. Returns counts only. */
export async function runBookCheckoutNudges(admin: Admin, fcmIn?: { accessToken: string; projectId: string } | null) {
  const summary = { due: 0, push: 0, errors: 0, push_issues: {} as Record<string, number> };
  const note = (code: string) => { summary.push_issues[code] = (summary.push_issues[code] ?? 0) + 1; };
  const { data, error } = await admin.rpc('book_checkout_nudges_due_v1', { p_limit: 50 });
  if (error) { summary.errors += 1; return summary; }
  const due: { nudge_id: string; user_id: string; books: number | null }[] = Array.isArray(data?.due) ? data.due : [];
  summary.due = due.length;
  if (!due.length) return summary;

  let fcm = fcmIn ?? null;
  if (!fcm) {
    const sa = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (sa) { try { fcm = await getFirebaseAccessToken(sa); } catch { console.error('[book-nudge] fcm auth failed'); note('fcm_auth_failed'); } }
  }

  for (const row of due) {
    try {
      const copy = bookNudgeCopy(Number(row.books) || 1);
      let sent = 0;
      if (!fcm) note('fcm_unavailable');
      else {
        const { data: tokens, error: tokenError } = await admin.from('device_tokens').select('token').eq('user_id', row.user_id);
        if (tokenError) note('token_read_failed');
        else if (!tokens?.length) note('no_device');
        for (const t of (tokens ?? []).slice(0, 10)) {
          const r = await sendFCMv1(fcm.accessToken, fcm.projectId, t.token, copy.title, copy.body,
            { type: 'book_checkout', deeplink: BOOK_NUDGE_DEEPLINK });
          if (r.success) sent += 1;
          else { note(String(r.errorCode || r.httpStatus || 'unknown')); console.error('[book-nudge] push failed:', r.errorCode ?? r.httpStatus ?? 'unknown'); }
          if (r.unregistered) await admin.from('device_tokens').delete().eq('token', t.token);
        }
      }
      summary.push += sent;
      await admin.rpc('book_checkout_nudge_sent_v1', { p_nudge: row.nudge_id, p_push: sent });
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}
