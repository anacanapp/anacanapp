import { tr } from '@/lib/tr';
import { addMonths, differenceInCalendarDays, isValid, parseISO } from 'date-fns';
/**
 * Centralized pregnancy & baby age calculation utilities
 * All pregnancy-related date calculations should use these functions
 * to ensure consistency across the entire platform.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const toLocalCalendarDate = (value: Date | string) =>
  startOfDay(typeof value === 'string' ? parseISO(value) : value);

/** Day-of-life/content index. Completed days/months remain zero-based ages. */
export const getBabyDayNumber = (elapsedDays: number): number =>
  Number.isFinite(elapsedDays) && elapsedDays >= 0 ? Math.floor(elapsedDays) + 1 : 0;

/**
 * Calculate baby age using real calendar months (not 30-day approximation).
 * Returns exact months and remaining days based on actual calendar.
 */
export const getRealCalendarAge = (birthDate: Date | string | null): {
  months: number;
  days: number;
  totalDays: number;
  dayNumber: number;
  years: number;
  remainingMonths: number;
  displayText: string;
} => {
  const empty = { months: 0, days: 0, totalDays: 0, dayNumber: 0, years: 0, remainingMonths: 0, displayText: '' };
  if (!birthDate) return empty;

  const birth = toLocalCalendarDate(birthDate);
  if (!isValid(birth)) return empty;
  const now = startOfDay(new Date());

  // Calendar days ignore 23/25-hour DST days. Always anchor months to the
  // original birthday so Jan 31 -> Feb 28 does not drift subsequent months.
  const totalDays = differenceInCalendarDays(now, birth);
  const dayNumber = getBabyDayNumber(totalDays);
  let months = Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth());
  if (months > 0 && addMonths(birth, months) > now) months--;
  const days = differenceInCalendarDays(now, addMonths(birth, months));
  
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  
  let displayText = '';
  if (totalDays < 0) {
    displayText = '';
  } else if (totalDays === 0) {
    displayText = tr('pregnancy_utils_first_day', '1-ci gün');
  } else if (years > 0) {
    displayText = `${years} ${tr('pregnancy_utils_year','yaş')}${remainingMonths > 0 ? ` ${remainingMonths} ${tr('pregnancy_utils_month','ay')}` : ''}`;
  } else if (months > 0) {
    displayText = `${months} ${tr('pregnancy_utils_month','ay')} ${days} ${tr('pregnancy_utils_day','gün')}`;
  } else {
    displayText = `${totalDays} ${tr('pregnancy_utils_day','gün')}`;
  }
  
  return { months, days, totalDays, dayNumber, years, remainingMonths, displayText };
};

// ─── Premature (vaxtından əvvəl doğulmuş) körpə dəstəyi ────────────────────
// WHO tərifi: gestasiya < 37 həftə (259 gün) = premature.
// Korreksiya olunmuş yaş = due_date-dən bu günə keçən müddət (yəni xronoloji
// yaş − erkənlik müddəti). Standart praktika: korreksiya YALNIZ premature
// körpələrə və YALNIZ 24 ay korreksiya yaşına qədər tətbiq olunur; peyvəndlər
// isə HƏMİŞƏ xronoloji yaşla gedir.
export const PREMATURE_GESTATION_LIMIT_DAYS = 259; // 37 həftə
export const CORRECTION_MAX_MONTHS = 24;
// Ağlabatan gestasiya pəncərəsi: 20–44 həftə. Bundan kənar due_date çox
// güman ki, səhv daxil edilib — korreksiya tətbiq etmirik.
const MIN_PLAUSIBLE_GESTATION_DAYS = 140;
const MAX_PLAUSIBLE_GESTATION_DAYS = 310;

export interface PrematurityInfo {
  /** due_date mövcuddur və ağlabatandır */
  isKnown: boolean;
  isPremature: boolean;
  gestationalDaysAtBirth: number | null;
  gestationalWeeksAtBirth: number | null;
  /** həftədən qalan günlər (məs. "34 həftə + 3 gün") */
  gestationalExtraDays: number | null;
  /** due_date − birth_date (gün). Premature deyilsə 0. */
  correctionDays: number;
  /** premature + korreksiya yaşı hələ 24 aydan azdır → UI korreksiya göstərməlidir */
  correctionApplies: boolean;
  /** Korreksiya olunmuş yaş (due_date-dən hesablanır, 0-a clamp olunur) */
  corrected: ReturnType<typeof getRealCalendarAge> | null;
}

export const getPrematurityInfo = (
  birthDate: Date | string | null,
  dueDate: Date | string | null | undefined
): PrematurityInfo => {
  const none: PrematurityInfo = {
    isKnown: false, isPremature: false,
    gestationalDaysAtBirth: null, gestationalWeeksAtBirth: null, gestationalExtraDays: null,
    correctionDays: 0, correctionApplies: false, corrected: null,
  };
  if (!birthDate || !dueDate) return none;

  const birth = toLocalCalendarDate(birthDate);
  const due = toLocalCalendarDate(dueDate);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(due.getTime())) return none;

  const daysBeforeDue = differenceInCalendarDays(due, birth);
  const gestationalDaysAtBirth = PREGNANCY_DURATION_DAYS - daysBeforeDue;
  if (
    gestationalDaysAtBirth < MIN_PLAUSIBLE_GESTATION_DAYS ||
    gestationalDaysAtBirth > MAX_PLAUSIBLE_GESTATION_DAYS
  ) return none;

  const isPremature = gestationalDaysAtBirth < PREMATURE_GESTATION_LIMIT_DAYS;
  const gestationalWeeksAtBirth = Math.floor(gestationalDaysAtBirth / 7);
  const gestationalExtraDays = gestationalDaysAtBirth % 7;

  if (!isPremature) {
    return {
      isKnown: true, isPremature: false,
      gestationalDaysAtBirth, gestationalWeeksAtBirth, gestationalExtraDays,
      correctionDays: 0, correctionApplies: false, corrected: null,
    };
  }

  // Korreksiya olunmuş yaş = due_date-dən keçən müddət
  let corrected = getRealCalendarAge(due);
  if (corrected.totalDays < 0) {
    // Körpə hələ orijinal termin tarixinə çatmayıb — 0-a clamp
    corrected = {
      months: 0, days: 0, totalDays: 0, dayNumber: 1, years: 0, remainingMonths: 0,
      displayText: `0 ${tr('pregnancy_utils_day', 'gün')}`,
    };
  }
  const correctionApplies = corrected.months < CORRECTION_MAX_MONTHS;

  return {
    isKnown: true, isPremature: true,
    gestationalDaysAtBirth, gestationalWeeksAtBirth, gestationalExtraDays,
    correctionDays: daysBeforeDue, correctionApplies, corrected,
  };
};

const PREGNANCY_DURATION_DAYS = 280; // Standard pregnancy duration from LMP

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get effective due date.
 * Platform rule: if LMP exists, it is the single source of truth (LMP + 280 days).
 * Only fall back to an explicit due date when LMP is missing.
 */
export const getEffectiveDueDate = (
  lastPeriodDate: Date | string | null,
  explicitDueDate?: Date | string | null
): Date | null => {
  if (lastPeriodDate) return calculateDueDate(lastPeriodDate);
  if (explicitDueDate) return startOfDay(new Date(explicitDueDate));
  return null;
};

/**
 * Calculate pregnancy day (1-280) from Last Menstrual Period date
 * Day 1 is the first day of LMP
 */
export const getPregnancyDay = (lastPeriodDate: Date | string | null): number => {
  if (!lastPeriodDate) return 0;
  
  const lmp = new Date(lastPeriodDate);
  const today = new Date();
  
  // Reset time to start of day for accurate day calculation
  lmp.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const daysSinceLMP = Math.floor((today.getTime() - lmp.getTime()) / MS_PER_DAY);
  
  // Pregnancy day is 1-indexed (day 1 = first day of LMP)
  // Clamp between 1 and 280
  return Math.max(1, Math.min(PREGNANCY_DURATION_DAYS, daysSinceLMP + 1));
};

/**
 * Calculate pregnancy week (0-40) from Last Menstrual Period date
 */
export const getPregnancyWeek = (lastPeriodDate: Date | string | null): number => {
  if (!lastPeriodDate) return 0;
  
  const lmp = new Date(lastPeriodDate);
  const today = new Date();
  
  lmp.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const daysSinceLMP = Math.floor((today.getTime() - lmp.getTime()) / MS_PER_DAY);
  
  return Math.max(0, Math.min(40, Math.floor(daysSinceLMP / 7)));
};

/**
 * Hamiləlik həftəsini İSTƏNİLƏN tarixdə hesablayır (bugün deyil) — LMP-dən həmin
 * tarixə qədər neçə gün keçib. Fetal Growth Tracker-də USM tarixinə görə həftə
 * göstərmək üçün (yuxarıdakı getPregnancyWeek həmişə BUGÜNKÜ tarixi istifadə edir).
 */
export const getPregnancyWeekAtDate = (
  lastPeriodDate: Date | string | null,
  atDate: Date | string
): number => {
  if (!lastPeriodDate) return 0;

  const lmp = startOfDay(new Date(lastPeriodDate));
  const target = startOfDay(new Date(atDate));

  const daysSinceLMP = Math.floor((target.getTime() - lmp.getTime()) / MS_PER_DAY);

  return Math.max(0, Math.min(42, Math.floor(daysSinceLMP / 7)));
};

/**
 * Calculate day within current week (0-6, where 0 = first day of week)
 */
export const getDayInWeek = (lastPeriodDate: Date | string | null): number => {
  if (!lastPeriodDate) return 0;
  
  const lmp = new Date(lastPeriodDate);
  const today = new Date();
  
  lmp.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const daysSinceLMP = Math.floor((today.getTime() - lmp.getTime()) / MS_PER_DAY);
  
  return daysSinceLMP % 7;
};

/**
 * Calculate days remaining until due date
 */
export const getDaysUntilDue = (
  lastPeriodDate: Date | string | null, 
  dueDate?: Date | string | null
): number => {
  const today = startOfDay(new Date());
  const effectiveDueDate = getEffectiveDueDate(lastPeriodDate, dueDate);
  if (!effectiveDueDate) return 0;

  const daysLeft = Math.ceil((effectiveDueDate.getTime() - today.getTime()) / MS_PER_DAY);
  return Math.max(0, daysLeft);
};

/**
 * Calculate due date from Last Menstrual Period
 */
export const calculateDueDate = (lastPeriodDate: Date | string | null): Date | null => {
  if (!lastPeriodDate) return null;
  
  const lmp = new Date(lastPeriodDate);
  lmp.setHours(0, 0, 0, 0);
  
  return new Date(lmp.getTime() + PREGNANCY_DURATION_DAYS * MS_PER_DAY);
};

/**
 * Calculate LMP from due date (reverse calculation)
 * Due Date - 280 days = LMP
 */
export const calculateLMPFromDueDate = (dueDate: Date | string | null): Date | null => {
  if (!dueDate) return null;
  
  const dd = new Date(dueDate);
  dd.setHours(0, 0, 0, 0);
  
  return new Date(dd.getTime() - PREGNANCY_DURATION_DAYS * MS_PER_DAY);
};

/**
 * Get trimester (1, 2, or 3) from pregnancy week
 */
export const getTrimester = (weekNumber: number): 1 | 2 | 3 => {
  if (weekNumber < 13) return 1;
  if (weekNumber < 27) return 2;
  return 3;
};

/**
 * Calculate days elapsed in pregnancy (0-280)
 */
export const getDaysElapsed = (lastPeriodDate: Date | string | null): number => {
  if (!lastPeriodDate) return 0;
  
  const lmp = new Date(lastPeriodDate);
  const today = new Date();
  
  lmp.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const daysSinceLMP = Math.floor((today.getTime() - lmp.getTime()) / MS_PER_DAY);
  
  return Math.max(0, Math.min(PREGNANCY_DURATION_DAYS, daysSinceLMP));
};

/**
 * Calculate progress percentage (0-100) through pregnancy
 */
export const getPregnancyProgress = (lastPeriodDate: Date | string | null): number => {
  const daysElapsed = getDaysElapsed(lastPeriodDate);
  return Math.min(100, (daysElapsed / PREGNANCY_DURATION_DAYS) * 100);
};

/**
 * Get formatted week and day string (e.g., \"3 həftə 5 gün\")
 */
export const getWeekDayString = (lastPeriodDate: Date | string | null): string => {
  const week = getPregnancyWeek(lastPeriodDate);
  const day = getDayInWeek(lastPeriodDate);
  
  return `${week} ${tr('pregnancy_utils_week','həftə')} ${day} ${tr('pregnancy_utils_day','gün')}`;
};

/**
 * Get all pregnancy data in one call
 */
export const getFullPregnancyData = (
  lastPeriodDate: Date | string | null,
  explicitDueDate?: Date | string | null
) => {
  const pregnancyDay = getPregnancyDay(lastPeriodDate);
  const pregnancyWeek = getPregnancyWeek(lastPeriodDate);
  const dayInWeek = getDayInWeek(lastPeriodDate);
  const daysUntilDue = getDaysUntilDue(lastPeriodDate, explicitDueDate);
  const daysElapsed = getDaysElapsed(lastPeriodDate);
  const progressPercent = getPregnancyProgress(lastPeriodDate);
  const trimester = getTrimester(pregnancyWeek);
  const dueDate = getEffectiveDueDate(lastPeriodDate, explicitDueDate);
  
  return {
    pregnancyDay,
    pregnancyWeek,
    dayInWeek,
    daysUntilDue,
    daysElapsed,
    progressPercent,
    trimester,
    dueDate,
    totalDays: PREGNANCY_DURATION_DAYS,
  };
};
