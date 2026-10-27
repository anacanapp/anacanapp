// Feeding and sleep actions shared by the Baby tracker tool and the baby home widgets, so both
// write exactly the same baby_logs rows and use the same running timers.
import { useState } from 'react';
import { useBabyLogs } from '@/hooks/useBabyLogs';
import { useChildren } from '@/hooks/useChildren';
import { useAchievements } from '@/hooks/useAchievements';
import { useToast } from '@/hooks/use-toast';
import { useTimerStore } from '@/store/timerStore';
import { hapticFeedback } from '@/lib/native';
import { bc } from '@/lib/babycare-i18n';
import { formatClockSeconds } from '@/lib/baby-logs-range';

export const FEEDING_PRO_AFTER = 9;
export const FORMULA_PRESETS_ML = [30, 60, 90, 120, 150, 180] as const;

/** `onSaved` runs after every successful write (e.g. refresh a range query). */
export function useBabyCareActions({ onSaved, feedingsToday = 0 }: { onSaved?: () => void; feedingsToday?: number } = {}) {
  const { addLog } = useBabyLogs();
  const { selectedChild, hasMultipleChildren } = useChildren();
  const { unlockAchievement } = useAchievements();
  const { toast } = useToast();
  const activeTimers = useTimerStore((s) => s.activeTimers);
  const startTimer = useTimerStore((s) => s.startTimer);
  const stopTimer = useTimerStore((s) => s.stopTimer);
  const [busy, setBusy] = useState(false);

  const childId = selectedChild?.id;
  const childName = hasMultipleChildren ? selectedChild?.name : undefined;
  const timerFor = (pred: (t: typeof activeTimers[number]) => boolean) =>
    activeTimers.find((t) => (t.childId ?? undefined) === (childId ?? undefined) && pred(t));
  const leftTimer = timerFor((t) => t.type === 'feeding' && t.feedType === 'left');
  const rightTimer = timerFor((t) => t.type === 'feeding' && t.feedType === 'right');
  const sleepTimer = timerFor((t) => t.type === 'sleep');

  const saveError = () => { toast({ title: bc('babytracker_save_error'), variant: 'destructive' }); };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  const toggleBreast = (side: 'left' | 'right') => run(async () => {
    void hapticFeedback.medium();
    const timer = side === 'left' ? leftTimer : rightTimer;
    if (!timer) { startTimer('feeding', side, undefined, childId, childName); return; }
    const result = stopTimer(timer.id);
    if (!result) return;
    const end = new Date();
    const { error } = await addLog({
      log_type: 'feeding', feed_type: side === 'left' ? 'breast_left' : 'breast_right',
      start_time: new Date(end.getTime() - result.durationSeconds * 1000).toISOString(), end_time: end.toISOString(),
    });
    if (error) return saveError();
    onSaved?.();
    toast({ title: side === 'left' ? bc('babytracker_left_done') : bc('babytracker_right_done'), description: `${bc('babytracker_duration')}: ${formatClockSeconds(result.durationSeconds)}` });
    if (feedingsToday >= FEEDING_PRO_AFTER) void unlockAchievement('feeding_pro', 'mommy');
  });

  /** Returns false when the amount is invalid (nothing is saved). */
  const saveFormula = async (amountMl: number) => {
    const amount = Math.round(amountMl);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000) { toast({ title: bc('babytracker_ml_invalid'), variant: 'destructive' }); return false; }
    let ok = false;
    await run(async () => {
      void hapticFeedback.light();
      const { error } = await addLog({ log_type: 'feeding', feed_type: 'formula', notes: `${amount} ml` });
      if (error) return saveError();
      ok = true;
      onSaved?.();
      toast({ title: `${bc('babytracker_formula')} ${amount} ml ${bc('babytracker_saved')}` });
    });
    return ok;
  };

  const saveSolid = async (food: string) => {
    const name = food.trim().slice(0, 80);
    if (!name) return false;
    let ok = false;
    await run(async () => {
      void hapticFeedback.light();
      const { error } = await addLog({ log_type: 'feeding', feed_type: 'solid', notes: name });
      if (error) return saveError();
      ok = true;
      onSaved?.();
      toast({ title: `${name} ${bc('babytracker_saved')}` });
    });
    return ok;
  };

  const toggleSleep = () => run(async () => {
    void hapticFeedback.medium();
    if (!sleepTimer) {
      startTimer('sleep', undefined, undefined, childId, childName);
      toast({ title: bc('babytracker_sleep_started'), description: bc('babytracker_tap_to_stop') });
      return;
    }
    const result = stopTimer(sleepTimer.id);
    if (!result) return;
    const end = new Date();
    const { error } = await addLog({ log_type: 'sleep', start_time: new Date(end.getTime() - result.durationSeconds * 1000).toISOString(), end_time: end.toISOString() });
    if (error) return saveError();
    onSaved?.();
    toast({ title: bc('babytracker_sleep_ended'), description: `${bc('babytracker_slept')}: ${formatClockSeconds(result.durationSeconds)}` });
  });

  return { busy, run, saveError, childId, childName, leftTimer, rightTimer, sleepTimer, toggleBreast, saveFormula, saveSolid, toggleSleep };
}
