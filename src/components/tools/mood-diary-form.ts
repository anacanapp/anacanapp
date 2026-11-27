import type { DailyLog, DailyLogPatch } from '@/hooks/useDailyLogs';

export interface MoodDiaryForm {
  mood: number | null;
  symptoms: string[];
  bleeding: string | null;
  notes: string;
}

export const emptyMoodDiaryForm = (): MoodDiaryForm => ({ mood: null, symptoms: [], bleeding: null, notes: '' });

/** The diary form for a saved day, so reopening the diary shows (and re-saving keeps) what was entered earlier. */
export function moodDiaryFormFromLog(log: Pick<DailyLog, 'mood' | 'symptoms' | 'bleeding' | 'notes'> | null): MoodDiaryForm {
  if (!log) return emptyMoodDiaryForm();
  return { mood: log.mood ?? null, symptoms: log.symptoms ?? [], bleeding: log.bleeding ?? null, notes: log.notes ?? '' };
}

/**
 * Only the fields the diary shows. Water, temperature, sleep (and bleeding when its card is hidden) are left out so
 * the upsert keeps what other screens saved for the day.
 */
export function moodDiaryPatch(form: MoodDiaryForm, logDate: string, showBleeding: boolean): DailyLogPatch {
  return {
    log_date: logDate,
    mood: form.mood,
    symptoms: form.symptoms,
    notes: form.notes.trim() ? form.notes : null,
    ...(showBleeding ? { bleeding: form.bleeding } : {}),
  };
}
