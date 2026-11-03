import { supabase } from '@/integrations/supabase/client';

/**
 * Postpartum recovery (Duzelis75): the mother's own daily check-ins in postpartum_checkins (RLS: own
 * rows only, never shared) and the birth type on her profile. Warning signs are evaluated on the
 * device so an urgent sign is shown immediately, even offline.
 */

export type BirthType = 'vaginal' | 'cesarean';
export type StitchState = 'fine' | 'sore' | 'red' | 'none';
export const FLAGS = ['heavy_bleeding', 'fever', 'wound', 'leg', 'chest', 'headache', 'smell', 'breast', 'harm', 'sad'] as const;
export type RecoveryFlag = typeof FLAGS[number];
/** Signs that need emergency help now; the others need a doctor today. */
export const URGENT_FLAGS: RecoveryFlag[] = ['heavy_bleeding', 'chest', 'headache', 'leg', 'harm'];

export interface Checkin {
  day: string;
  bleeding: number | null;
  pain: number | null;
  stitches: StitchState | null;
  mood: number | null;
  flags: RecoveryFlag[];
  kegel_sessions: number;
}

export const PROGRAM_WEEKS = 6;
/** The mommy home shows the recovery card only in the first 8 weeks after birth. */
export const HOME_CARD_WEEKS = 8;
export const KEGEL_DAILY_GOAL = 3;

export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Week after birth, 1-based (days 0–6 → week 1). Null without a birth date or before birth. */
export function weekAfterBirth(birthDate: string | null | undefined, now = new Date()): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const birth = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today.getTime() - birth.getTime()) / 86400_000);
  if (days < 0) return null;
  return Math.floor(days / 7) + 1;
}

/** The 6-week check-up date (birth + 42 days). */
export function checkupDate(birthDate: string): Date {
  const [y, m, d] = birthDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d + 42);
}

export interface KegelLevel { level: 0 | 1 | 2; hold: number; rest: number; reps: number }
/** Gentle start in weeks 1–2, then longer holds. */
export function kegelLevel(week: number | null): KegelLevel {
  if (!week || week <= 2) return { level: 0, hold: 3, rest: 6, reps: 8 };
  if (week <= 4) return { level: 1, hold: 5, rest: 5, reps: 10 };
  return { level: 2, hold: 8, rest: 8, reps: 10 };
}
export const kegelMinutes = (l: KegelLevel) => Math.max(1, Math.round(l.reps * (l.hold + l.rest) / 60));

export type FlagSeverity = 'urgent' | 'doctor' | null;
export function flagSeverity(flags: RecoveryFlag[], bleeding: number | null): FlagSeverity {
  if (flags.some((f) => URGENT_FLAGS.includes(f))) return 'urgent';
  if (flags.length > 0 || bleeding === 3) return 'doctor';
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables/RPCs newer than the generated types
const db = supabase as unknown as { from: (table: string) => any };

export async function listCheckins(userId: string, days = 14): Promise<Checkin[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const { data, error } = await db.from('postpartum_checkins')
    .select('day, bleeding, pain, stitches, mood, flags, kegel_sessions')
    .eq('user_id', userId).gte('day', isoDay(since)).order('day', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Checkin[];
}

export async function saveCheckin(userId: string, checkin: Partial<Checkin> & { day: string }): Promise<void> {
  const { error } = await db.from('postpartum_checkins')
    .upsert({ user_id: userId, ...checkin, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
  if (error) throw error;
}

export async function saveBirthType(userId: string, birthType: BirthType): Promise<void> {
  const { error } = await db.from('profiles').update({ birth_type: birthType }).eq('user_id', userId);
  if (error) throw error;
}
