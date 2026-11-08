import { useEffect, useMemo } from 'react';
import type { Programme } from '@/data/parenting/types';
import { isoDay, type ParentingLocal } from '@/lib/parenting';
import { pf } from '@/lib/parenting-copy';
import { reminderSlots, slotsKey, syncParentingReminders } from '@/lib/parenting-reminders';

const LAST_KEY = 'anacan.parenting.reminders.v1';
const readLast = () => { try { return localStorage.getItem(LAST_KEY) || 'none'; } catch { return 'none'; } };
const writeLast = (k: string) => { try { localStorage.setItem(LAST_KEY, k); } catch { /* storage blocked */ } };

/**
 * Keeps this phone's Tərbiyə reminders in line with the state: schedules the running programme's daily reminder
 * and cancels it when the programme finishes or pauses, the preference is turned off, or the switch / content is
 * gone; free users only for the free programme days. `allowed` (switch on, content for the language) or
 * `isPremium` null = still unknown (settings or Premium loading, offline) → nothing changes. Only the programmes
 * are read, so the home card can pass its small tips + programmes chunk.
 */
export function useParentingReminders(o: {
  state: ParentingLocal;
  content: { programmes: Programme[] } | null;
  allowed: boolean | null;
  isPremium: boolean | null;
  partner?: boolean;
  now?: Date;
}) {
  const { state, content, allowed, isPremium, partner, now } = o;
  const slots = useMemo(() => {
    if (allowed === null) return null;
    if (!allowed) return [];
    if (isPremium === null) return null;
    if (!content) return null; // content still loading: keep what is scheduled
    const at = now ?? new Date();
    return reminderSlots({ state, programmes: content.programmes, allowed, isPremium, now: at, today: isoDay(at) });
  }, [state, content, allowed, isPremium, now]);
  const key = slots ? slotsKey(slots) : null;

  useEffect(() => {
    if (key === null || !slots) return;
    if (key === readLast()) return; // already scheduled exactly so (or nothing to cancel)
    writeLast(key);
    void syncParentingReminders(slots, (slot) => {
      const programme = content?.programmes.find((p) => p.id === slot.programmeId);
      const day = programme?.days[slot.dayIndex];
      return {
        title: pf('par_notif_title', { programme: programme?.title ?? '' }),
        body: pf('par_notif_body', { n: slot.dayIndex + 1, task: day?.title ?? '' }),
      };
    }, { partner });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key captures every change that matters
  }, [key]);
}
