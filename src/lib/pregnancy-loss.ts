import { supabase } from '@/integrations/supabase/client';
import { cancelBabyChatNotifications } from '@/lib/baby-chat-notifications';
import { sendPartnerMessage } from '@/lib/chat';

/**
 * Pregnancy loss: the server switches the mother's own 'bump' profile to 'flow' without cycle dates and
 * turns the recovery mode on (Duzelis72, pregnancy_loss_begin_v1). Nothing is deleted.
 */
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

/** Local calendar date as yyyy-mm-dd (no UTC shift). */
export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export async function beginPregnancyLoss(options: {
  date: string;
  sharePartner: boolean;
  userId: string;
  linkedPartnerProfileId: string | null | undefined;
  partnerMessage: string;
}): Promise<void> {
  const { error } = await rpc('pregnancy_loss_begin_v1', { p_date: options.date, p_share_partner: options.sharePartner });
  if (error) throw error;
  // The baby's daily notifications are scheduled on the device: stop them right away.
  await cancelBabyChatNotifications().catch(() => {});
  if (options.sharePartner && options.linkedPartnerProfileId) {
    try {
      const { data } = await supabase.from('profiles').select('user_id').eq('id', options.linkedPartnerProfileId).maybeSingle();
      if (data?.user_id) await sendPartnerMessage(options.userId, data.user_id, options.partnerMessage);
    } catch { /* the partner still sees the guide on their home screen */ }
  }
}

/** Ends the recovery mode. `trackCycle` starts the cycle from the loss date when no period date is known. */
export async function endPregnancyLossRecovery(trackCycle: boolean): Promise<void> {
  const { error } = await rpc('pregnancy_loss_end_v1', { p_track_cycle: trackCycle });
  if (error) throw error;
}

// ── A private letter, kept only on this device ──────────────────────────────────
const letterKey = (userId: string) => `anacan_loss_letter_v1:${userId}`;

export function loadLossLetter(userId: string): string {
  try { return localStorage.getItem(letterKey(userId)) || ''; } catch { return ''; }
}

export function saveLossLetter(userId: string, text: string): boolean {
  try {
    if (text.trim()) localStorage.setItem(letterKey(userId), text.slice(0, 5000));
    else localStorage.removeItem(letterKey(userId));
    return true;
  } catch { return false; }
}

// ── The weekly self-care checklist, per user and week, on this device ───────────────
const todoKey = (userId: string) => `anacan_loss_todo_v1:${userId}`;

export function loadLossTodos(userId: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(localStorage.getItem(todoKey(userId)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function saveLossTodos(userId: string, todos: Record<string, boolean>) {
  try { localStorage.setItem(todoKey(userId), JSON.stringify(todos)); } catch { /* storage blocked */ }
}
