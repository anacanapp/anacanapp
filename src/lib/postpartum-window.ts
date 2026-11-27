/**
 * Early postpartum window: the first 6 weeks (0-41 days) after birth. Pre-eclampsia can start or worsen in this
 * period, so pregnancy blood pressure alerts (≥140/90 warning, ≥160/110 urgent) still apply (ACOG / NHS).
 * Days are counted on local calendar days; a date-only "YYYY-MM-DD" is read as a local day, not UTC.
 */
export const POSTPARTUM_ALERT_DAYS = 42;

const toLocalDay = (value: Date | string): Date | null => {
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

/** Days since the YOUNGEST valid birth date (not in the future), or null when none. */
export function daysSinceYoungestBirth(births: Array<Date | string | null | undefined>, now: Date = new Date()): number | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let best: number | null = null;
  for (const b of births) {
    if (!b) continue;
    const day = toLocalDay(b);
    if (!day) continue;
    const days = Math.round((today.getTime() - day.getTime()) / 86_400_000);
    if (days < 0) continue;
    if (best === null || days < best) best = days;
  }
  return best;
}

/** True when the youngest baby is under 6 weeks (42 days) old. */
export function isEarlyPostpartum(births: Array<Date | string | null | undefined>, now: Date = new Date()): boolean {
  const days = daysSinceYoungestBirth(births, now);
  return days !== null && days < POSTPARTUM_ALERT_DAYS;
}
