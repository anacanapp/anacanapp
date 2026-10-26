/** anacan-brand-ads-v3 targeting and audience buckets. Mirrors
 * brand_ads_targeting_matches_v1 / brand_ads_audience_facts_v1 in
 * supabase/migrations/20261022120000_brand_ads_v3.sql; the server is authoritative. */
export const AUDIENCE_TIERS = ['free', 'premium'] as const;
export const LIFE_STAGES = ['flow', 'bump', 'mommy', 'partner'] as const;
export const NATIVE_TEMPLATES = ['classic', 'spotlight', 'split', 'minimal', 'offer', 'expert'] as const;
export const AUDIENCE_DIMENSIONS = ['placement', 'platform', 'language', 'country', 'tier', 'stage', 'trimester', 'week_bucket', 'child_age_bucket'] as const;
export const K_ANONYMITY = 20;
export const MAX_CHILD_AGE_DAYS = 2190;
export type AudienceTier = typeof AUDIENCE_TIERS[number];
export type LifeStage = typeof LIFE_STAGES[number];
export type NativeTemplate = typeof NATIVE_TEMPLATES[number];
export type AudienceDimension = typeof AUDIENCE_DIMENSIONS[number];

export interface BrandTargeting {
  audience_tiers?: AudienceTier[] | null;
  target_life_stages?: string[] | null;
  target_languages?: string[] | null;
  target_countries?: string[] | null;
  target_pregnancy_week_min?: number | null;
  target_pregnancy_week_max?: number | null;
  target_pregnancy_weeks?: number[] | null;
  target_child_age_min_days?: number | null;
  target_child_age_max_days?: number | null;
  is_premium_only?: boolean | null;
}
export interface AudienceFacts { stage: string; week: number | null; child_days: number | null; country: string; tier: AudienceTier }

const DAY = 86400000;
const utcDay = (value: Date | string) => {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : value;
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY);
};

/** Same convention as getPregnancyWeek: LMP first, else due date − 280 days; floor(days/7), 0–40. */
export function pregnancyWeek(lastPeriod: string | null | undefined, dueDate: string | null | undefined, today: Date = new Date()): number | null {
  const lmp = lastPeriod ? utcDay(lastPeriod) : dueDate ? utcDay(dueDate) - 280 : null;
  if (lmp === null || !Number.isFinite(lmp)) return null;
  const days = utcDay(today) - lmp;
  return days < 0 ? null : Math.max(0, Math.min(40, Math.floor(days / 7)));
}
export function childAgeDays(birthDate: string | null | undefined, today: Date = new Date()): number | null {
  if (!birthDate) return null;
  const days = utcDay(today) - utcDay(birthDate);
  return Number.isFinite(days) && days >= 0 ? days : null;
}
export const trimesterOf = (week: number | null) => week === null ? null : week < 14 ? '1' : week < 28 ? '2' : '3';
export function weekBucket(week: number | null): string | null {
  if (week === null) return null;
  if (week <= 4) return '1-4';
  const start = Math.floor((week - 1) / 4) * 4 + 1;
  return `${start}-${Math.min(42, start + 3)}`;
}
export function childAgeBucket(days: number | null): string | null {
  if (days === null) return null;
  return days < 91 ? '0-3m' : days < 183 ? '3-6m' : days < 365 ? '6-12m' : days < 730 ? '12-24m' : days < 1095 ? '24-36m' : '36m+';
}
/** Months are entered in the portal; the server stores days (1 month = 30.4375 days). */
export const monthsToDays = (months: number) => Math.round(months * 30.4375);
export const daysToMonths = (days: number) => Math.round(days / 30.4375 * 10) / 10;

export function effectiveTiers(targeting: BrandTargeting, branded: boolean): AudienceTier[] {
  if (targeting.audience_tiers?.length) return targeting.audience_tiers;
  if (branded) return ['free'];
  return targeting.is_premium_only ? ['premium'] : ['free', 'premium'];
}

export function matchesBrandTargeting(targeting: BrandTargeting, facts: AudienceFacts, language: string, branded: boolean): boolean {
  if (!effectiveTiers(targeting, branded).includes(facts.tier)) return false;
  const listed = (values: string[] | null | undefined, value: string) => !values?.length || values.includes(value);
  if (!listed(targeting.target_life_stages, facts.stage) || !listed(targeting.target_languages, language) || !listed(targeting.target_countries, facts.country)) return false;
  const { target_pregnancy_week_min: min, target_pregnancy_week_max: max, target_pregnancy_weeks: weeks,
    target_child_age_min_days: childMin, target_child_age_max_days: childMax } = targeting;
  const hasWeek = min != null || max != null || !!weeks?.length, hasChild = childMin != null || childMax != null;
  if (!hasWeek && !hasChild) return true;
  const week = facts.week, days = facts.child_days;
  const weekOk = hasWeek && week !== null && (min == null || week >= min) && (max == null || week <= max) && (!weeks?.length || weeks.includes(week));
  const childOk = hasChild && days !== null && (childMin == null || days >= childMin) && (childMax == null || days <= childMax);
  // Pregnancy and child windows are alternatives (e.g. week 34–40 OR newborn 0–90 days).
  return weekOk || childOk;
}

export type TargetingError = 'tiers' | 'week_range' | 'week_list' | 'child_range';
/** Portal-side validation; ad_creative_payload_v1 repeats every check on the server. */
export function targetingErrors(targeting: BrandTargeting): TargetingError[] {
  const errors: TargetingError[] = [];
  const int = (value: number | null | undefined, low: number, high: number) => value == null || Number.isInteger(value) && value >= low && value <= high;
  if (!targeting.audience_tiers?.length || targeting.audience_tiers.some(tier => !AUDIENCE_TIERS.includes(tier))) errors.push('tiers');
  const { target_pregnancy_week_min: min, target_pregnancy_week_max: max } = targeting;
  if (!int(min, 1, 42) || !int(max, 1, 42) || min != null && max != null && min > max) errors.push('week_range');
  if (targeting.target_pregnancy_weeks?.some(week => !int(week, 1, 42))) errors.push('week_list');
  const { target_child_age_min_days: childMin, target_child_age_max_days: childMax } = targeting;
  if (!int(childMin, 0, MAX_CHILD_AGE_DAYS) || !int(childMax, 0, MAX_CHILD_AGE_DAYS) || childMin != null && childMax != null && childMin > childMax) errors.push('child_range');
  return errors;
}

/** "5, 8-10, 12" → [5, 8, 9, 10, 12]; invalid tokens are reported, not silently dropped. */
export function parseWeekList(input: string): { weeks: number[]; invalid: boolean } {
  const weeks = new Set<number>(); let invalid = false;
  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d{1,2})-(\d{1,2})$/.exec(token), single = /^\d{1,2}$/.test(token) ? Number(token) : null;
    const [from, to] = range ? [Number(range[1]), Number(range[2])] : [single, single];
    if (from === null || to === null || from < 1 || to > 42 || from > to) { invalid = true; continue; }
    for (let week = from; week <= to; week++) weeks.add(week);
  }
  return { weeks: [...weeks].sort((a, b) => a - b), invalid };
}

export interface AudienceRow { bucket: string; reach: number; impressions: number; clicks: number; other?: boolean }
/** Client mirror of the server's k-anonymity rule: buckets under k distinct people are
 * merged into "other"; a single hidden bucket also hides the smallest visible one so it
 * cannot be derived by subtraction; "other" itself is dropped when still under k. */
export function suppressAudience(rows: AudienceRow[], k = K_ANONYMITY): AudienceRow[] {
  const ranked = rows.filter(row => !row.other).sort((a, b) => a.reach - b.reach || a.bucket.localeCompare(b.bucket));
  const hidden = new Set(ranked.filter(row => row.reach < k));
  if (hidden.size === 1) { const smallestVisible = ranked.find(row => !hidden.has(row)); if (smallestVisible) hidden.add(smallestVisible); }
  const visible = ranked.filter(row => !hidden.has(row)).sort((a, b) => b.impressions - a.impressions || a.bucket.localeCompare(b.bucket));
  const merged = [...hidden, ...rows.filter(row => row.other)];
  if (!merged.length) return visible;
  // Reach of merged buckets is an upper bound when people span buckets; the server recounts distinct people.
  const other = merged.reduce((sum, row) => ({ ...sum, reach: sum.reach + row.reach, impressions: sum.impressions + row.impressions, clicks: sum.clicks + row.clicks }),
    { bucket: 'other', reach: 0, impressions: 0, clicks: 0, other: true } as AudienceRow);
  return other.reach >= k ? [...visible, other] : visible;
}
