// In-app feedback (1–5 stars + reasons + text) sent to the team as a support ticket (category
// "app_feedback", visible in Admin → Support). It never links to the App Store / Play Store for any
// rating: the store prompt is the separate AppRatingPrompt, so there is no review gating here.
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const LOW_REASONS = ['crash', 'bug', 'slow', 'missing', 'content', 'ads', 'price', 'hard', 'other'] as const;
export const HIGH_REASONS = ['tracking', 'content', 'ai', 'community', 'partner', 'design', 'other'] as const;

const K = { sent: 'anacan.feedback.sentAt', dismissed: 'anacan.feedback.dismissedAt' } as const;
const DAY = 86_400_000;
const read = (k: string) => {try {return Number(localStorage.getItem(k)) || null;} catch {return null;}};
const write = (k: string) => {try {localStorage.setItem(k, String(Date.now()));} catch {/* optional */}};

/** Ask on its own (once) from day 14, never twice within 90 days, never after a recent store request. */
export function feedbackPromptDue(o: { now: number; firstUseAt: number | null; sessions: number; sentAt: number | null; dismissedAt: number | null; lastStoreRequestAt: number | null; lossRecovery: boolean }): boolean {
  if (o.lossRecovery || !o.firstUseAt || o.sessions < 5) return false;
  if (o.now - o.firstUseAt < 14 * DAY) return false;
  if (o.sentAt) return false;
  if (o.dismissedAt && o.now - o.dismissedAt < 90 * DAY) return false;
  if (o.lastStoreRequestAt && o.now - o.lastStoreRequestAt < 7 * DAY) return false;
  return true;
}

const FIRST_OPEN_KEY = 'anacan.review.firstOpenAt';
/** Remember the first app open on this device (kept from earlier builds when present). */
export function noteFirstOpen(): void {
  try {if (!localStorage.getItem(FIRST_OPEN_KEY)) localStorage.setItem(FIRST_OPEN_KEY, String(Date.now()));} catch {/* optional */}
}

export function shouldAutoPromptFeedback(o: { accountCreatedAt?: string | null; lossRecovery?: boolean }): boolean {
  const firstOpen = read(FIRST_OPEN_KEY);
  const created = o.accountCreatedAt ? Date.parse(o.accountCreatedAt) : NaN;
  const firstUseAt = [firstOpen, Number.isNaN(created) ? null : created].filter((x): x is number => !!x);
  // Sessions are counted by the store rating prompt (useAppRating).
  const sessions = (() => {try {return Number(localStorage.getItem('anacan_app_usage_count')) || 0;} catch {return 0;}})();
  return feedbackPromptDue({
    now: Date.now(), firstUseAt: firstUseAt.length ? Math.min(...firstUseAt) : null, sessions,
    sentAt: read(K.sent), dismissedAt: read(K.dismissed), lastStoreRequestAt: null,
    lossRecovery: !!o.lossRecovery
  });
}

export const markFeedbackDismissed = () => write(K.dismissed);

export async function sendAppFeedback(o: { userId: string; rating: number; reasons: string[]; message: string; subject: string; lifeStage?: string | null; language?: string }): Promise<void> {
  let version = '';
  try {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      version = `${info.version} (${info.build})`;
    }
  } catch {/* optional */}
  const stars = '★'.repeat(o.rating) + '☆'.repeat(5 - o.rating);
  const lines = [
    `${stars} (${o.rating}/5)`,
    o.reasons.length ? `Reasons: ${o.reasons.join(', ')}` : '',
    o.message.trim() ? `\n${o.message.trim()}` : '',
    `\n— ${Capacitor.getPlatform()}${version ? ` ${version}` : ''} · ${o.lifeStage ?? ''} · ${o.language ?? ''}`
  ].filter(Boolean);
  const { error } = await supabase.from('support_tickets').insert({
    user_id: o.userId,
    subject: `${o.subject} ${o.rating}★`.slice(0, 200),
    message: lines.join('\n').slice(0, 4000),
    category: 'app_feedback',
    priority: o.rating <= 2 ? 'high' : o.rating === 3 ? 'normal' : 'low',
    status: 'open'
  });
  if (error) throw error;
  write(K.sent);
}
