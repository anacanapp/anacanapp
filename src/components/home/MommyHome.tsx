import { useMemo } from 'react';
import { addDays, parseISO } from 'date-fns';
import { Ring } from '@/components/anacan/Ring';
import { Mascot } from '@/components/anacan/Mascot';
import { rd } from '@/lib/redesign-i18n';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { useVaccineScheduleForCountry, useChildVaccinations } from '@/hooks/useVaccines';
import { regionalCountry, vaccineEligible, vaccineStatus } from '@/lib/vaccine-schedule';
import type { UpcomingEvent } from '@/components/home/HomeParts';

/** "x min" / "x h" since an ISO time, or null when unknown. */
export function agoLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  return mins < 60 ? rd('m_minutes_ago', { n: mins }) : rd('m_hours_ago', { n: Math.floor(mins / 60) });
}

/** Compact "1:30" duration for small tiles. */
export function clockDuration(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

export function hoursMinutes(totalMinutes: number): string {
  return rd('m_hm', { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 });
}

/** Mommy hero: age ring (first year, then up to 3 years), companion art and today's feed/sleep stats. */
export function MommyHero({
  greeting, babyName, ageInDays, months, remainingDays, dayNumber, correctedText, lastFeedIso, sleepMinutes, onOpenDay,
}: {
  greeting: string; babyName: string; ageInDays: number; months: number; remainingDays: number; dayNumber: number;
  correctedText?: string | null; lastFeedIso?: string | null; sleepMinutes: number; onOpenDay?: () => void;
}) {
  const ringValue = months < 12 ? (ageInDays / 365) * 100 : (ageInDays / 1095) * 100;
  return (
    <section className="a3-hero" aria-label={babyName}>
      <div className="a3-hero-top">
        <span className="a3-chip ac">{greeting}</span>
        <span className="a3-chip a3-num">{rd('m_together', { n: dayNumber })}</span>
      </div>
      <div className="a3-hero-main">
        <button type="button" className="a3-ring-btn" onClick={onOpenDay} aria-label={babyName}>
          <Ring value={ringValue}>
            <b className="a3-num">{months}</b>
            <span>{rd('m_age', { d: remainingDays })}</span>
          </Ring>
        </button>
        <button type="button" className="a3-art" onClick={onOpenDay} aria-label={babyName}>
          <Mascot stage="mommy" pose="mode" width={120} bob />
        </button>
        <div className="a3-hero-txt">
          <p className="a3-hero-line"><em>{babyName}</em></p>
          {correctedText && <p className="a3-meta">{correctedText}</p>}
        </div>
      </div>
      <div className="a3-stats a3-num">
        <div><b>{agoLabel(lastFeedIso) ?? '—'}</b><span>{rd('m_last_feed')}</span></div>
        <div><b>{hoursMinutes(sleepMinutes)}</b><span>{rd('m_sleep_today')}</span></div>
        <div><b>{dayNumber}</b><span>{rd('today')}</span></div>
      </div>
    </section>
  );
}

/** Next due vaccines for the selected child from the national schedule, as "coming up" events. */
export function useVaccineEvents(
  child: { id: string; birth_date: string; gender?: string | null; vaccine_country_code?: string | null; country_code?: string | null } | null,
  onOpen?: () => void,
): UpcomingEvent[] {
  const { profile } = useAuth();
  const language = useUserStore((s) => s.language);
  const storedCountry = useUserStore((s) => s.countryCode);
  const country = child
    ? regionalCountry(language, child.vaccine_country_code, (profile as { country_code?: string } | null)?.country_code, storedCountry, child.country_code)
    : null;
  const { data: schedule = [] } = useVaccineScheduleForCountry(country);
  const { data: logs = [] } = useChildVaccinations(child?.id ?? null);

  return useMemo(() => {
    if (!child) return [];
    const logMap = new Map(logs.map((l) => [l.vaccine_schedule_id, l]));
    const birth = parseISO(child.birth_date);
    return schedule
      .filter((row) => vaccineEligible(row, child.birth_date, child.gender || '', logMap.get(row.id)))
      .filter((row) => !['done', 'skipped'].includes(vaccineStatus(row, child.birth_date, logMap as never)))
      .map((row) => ({
        date: addDays(birth, row.recommended_age_days),
        title: rd('ms_vaccine', { name: row.vaccine?.name || row.dose_label || row.dose_label_az }),
        sub: row.age_label || row.age_label_az,
        onTap: onOpen,
      }));
  }, [child, schedule, logs, onOpen]);
}
