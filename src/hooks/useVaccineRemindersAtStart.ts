/**
 * App-start refresh of vaccine reminders for ALL of the signed-in user's children (native only, at most once a
 * day per device, account and language). Reminders used to be (re)scheduled only when the vaccine calendar was
 * opened, for the selected child. This never asks for notification permission; it only schedules when the
 * permission is already granted and the per-device switch is on (see refreshAllVaccineReminders).
 */
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { todayKey } from '@/lib/local-date';
import type { ChildVaccination, VaccineScheduleRow } from '@/hooks/useVaccines';
import {
  markVaccineRefresh, refreshAllVaccineReminders, vaccineDueDate, vaccineRefreshDue, type ChildReminderPlan,
  type VaccineReminderResult } from '@/lib/vaccine-reminders';
import { regionalCountry, vaccineEligible, vaccineStatus } from '@/lib/vaccine-schedule';
import { vaccineReminderText } from '@/lib/vaccine-labels';

export interface ReminderChild {
  id: string; name: string; birth_date: string; gender: string;
  country_code?: string | null; vaccine_country_code?: string | null;
}
export interface VaccineRefreshDeps {
  loadChildren: (userId: string) => Promise<ReminderChild[]>;
  loadSchedule: (country: string, language: string) => Promise<VaccineScheduleRow[]>;
  loadLogs: (userId: string, childIds: string[]) => Promise<Pick<ChildVaccination, 'child_id' | 'vaccine_schedule_id' | 'administered_at' | 'is_skipped'>[]>;
}
export interface VaccineRefreshInput {
  userId: string; language: string; profileCountry?: string | null; storedCountry?: string | null; now?: Date;
}

/** Builds every child's plan exactly like the calendar does and hands it to refreshAllVaccineReminders. */
export async function runVaccineReminderRefresh(input: VaccineRefreshInput, deps: VaccineRefreshDeps): Promise<VaccineReminderResult> {
  const { userId, language, now = new Date() } = input;
  const children = await deps.loadChildren(userId);
  const countryOf = (c: ReminderChild) => regionalCountry(language, c.vaccine_country_code, input.profileCountry, input.storedCountry, c.country_code);
  const countries = Array.from(new Set(children.map(countryOf)));
  const schedules = new Map<string, VaccineScheduleRow[]>();
  for (const country of countries) schedules.set(country, await deps.loadSchedule(country, language));
  const logs = children.length ? await deps.loadLogs(userId, children.map((c) => c.id)) : [];

  const plans: ChildReminderPlan[] = children.map((child) => {
    const logMap = new Map(logs.filter((l) => l.child_id === child.id).map((l) => [l.vaccine_schedule_id, l]));
    const rows = (schedules.get(countryOf(child)) || []).filter((r) => {
      const log = logMap.get(r.id);
      return (r.vaccine.is_active || !!log) && vaccineEligible(r, child.birth_date, child.gender, log);
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      childId: child.id,
      doses: rows.map((r) => ({ id: r.id, status: vaccineStatus(r, child.birth_date, logMap, now), due: vaccineDueDate(r, child.birth_date, logMap) })),
      text: (slot) => vaccineReminderText(slot.kind, child.name, byId.get(slot.doseId), language),
    };
  });
  return refreshAllVaccineReminders(plans, now);
}

async function supabaseDeps(): Promise<VaccineRefreshDeps> {
  const [{ supabase }, { mapRowsTranslation }, { vaccineTiming }] = await Promise.all([
    import('@/integrations/supabase/client'), import('@/lib/tr'), import('@/lib/vaccine-schedule')]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables outside the generated types, as in useVaccines
  const db = supabase as any;
  return {
    loadChildren: async (userId) => {
      const { data, error } = await db.from('user_children')
        .select('id,name,birth_date,gender,country_code,vaccine_country_code')
        .eq('user_id', userId).eq('is_active', true).order('sort_order');
      if (error) throw error;
      return (data || []) as ReminderChild[];
    },
    // Same shape as useVaccineScheduleForCountry (kept small: names come from vaccine-labels).
    loadSchedule: async (country, language) => {
      const [{ data: vaccines, error: vErr }, { data: schedules, error: sErr }] = await Promise.all([
        db.from('vaccines').select('*').eq('country_code', country).order('sort_order'),
        db.from('vaccine_schedules').select('*').eq('country_code', country).order('recommended_age_days'),
      ]);
      if (vErr || sErr) throw vErr || sErr;
      type Row = Record<string, unknown> & { id: string };
      type Sched = VaccineScheduleRow & { vaccine_id: string };
      const vMap = new Map(mapRowsTranslation<Row>(vaccines || [], language, ['name', 'route']).map((v) => [v.id, v]));
      return (mapRowsTranslation<Row>(schedules || [], language, ['dose_label', 'age_label']) as unknown as Sched[])
        .filter((s) => vMap.has(s.vaccine_id)).map((s) => {
          const name = vaccineTiming(s)?.display_name?.[language];
          const vaccine = vMap.get(s.vaccine_id);
          return { ...s, vaccine: (name ? { ...vaccine, name } : vaccine) as unknown as VaccineScheduleRow['vaccine'] };
        });
    },
    loadLogs: async (userId, childIds) => {
      const { data, error } = await db.from('child_vaccinations')
        .select('child_id,vaccine_schedule_id,administered_at,is_skipped').eq('user_id', userId).in('child_id', childIds);
      if (error) throw error;
      return data || [];
    },
  };
}

const START_DELAY_MS = 5000; // after the first screens settle; this is background housekeeping

export function useVaccineRemindersAtStart(opts: {
  userId: string | null | undefined; ready: boolean; language: string;
  profileCountry?: string | null; storedCountry?: string | null;
}): void {
  const { userId, ready, language, profileCountry, storedCountry } = opts;
  useEffect(() => {
    if (!userId || !ready || !Capacitor.isNativePlatform()) return;
    const stamp = `${userId}:${todayKey()}:${language}`;
    if (!vaccineRefreshDue(stamp)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const deps = await supabaseDeps();
          if (cancelled) return;
          await runVaccineReminderRefresh({ userId, language, profileCountry, storedCountry }, deps);
          if (!cancelled) markVaccineRefresh(stamp);
        } catch { /* offline or not ready: the next start (or opening the calendar) retries */ }
      })();
    }, START_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [userId, ready, language, profileCountry, storedCountry]);
}
