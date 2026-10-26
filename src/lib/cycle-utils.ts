// Cycle calculation utilities for accurate menstrual tracking

export interface CyclePhaseInfo {
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
  dayInCycle: number;
  dayInPhase: number;
  phaseDaysTotal: number;
  isPeriodDay: boolean;
  isFertileDay: boolean;
  isOvulationDay: boolean;
}

/**
 * Calculate cycle day from last period date
 * Handles cycles that span multiple months correctly
 */
export function getCycleDayForDate(
  date: Date,
  lastPeriodDate: Date,
  cycleLength: number
): number {
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const lastPeriodOnly = new Date(lastPeriodDate.getFullYear(), lastPeriodDate.getMonth(), lastPeriodDate.getDate());
  
  const daysDiff = Math.floor((dateOnly.getTime() - lastPeriodOnly.getTime()) / (1000 * 60 * 60 * 24));
  
  // Handle dates before the last period
  if (daysDiff < 0) {
    // Calculate how many cycles back
    const cyclesBack = Math.ceil(Math.abs(daysDiff) / cycleLength);
    const adjustedDiff = daysDiff + (cyclesBack * cycleLength);
    return adjustedDiff + 1;
  }
  
  // Handle current and future cycles
  const cycleDay = (daysDiff % cycleLength) + 1;
  return cycleDay;
}

/**
 * Get detailed phase information for a specific date
 */
export function getPhaseInfoForDate(
  date: Date,
  lastPeriodDate: Date,
  cycleLength: number,
  periodLength: number
): CyclePhaseInfo {
  const cycleDay = getCycleDayForDate(date, lastPeriodDate, cycleLength);
  
  // Calculate ovulation day (typically 14 days before next period)
  const ovulationDay = cycleLength - 14;
  
  // Fertile window: 5 days before ovulation to 1 day after
  const fertileStart = ovulationDay - 5;
  const fertileEnd = ovulationDay + 1;
  
  // Phase boundaries (dynamic based on user's cycle)
  const menstrualEnd = periodLength;
  const follicularEnd = ovulationDay - 1;
  const ovulationEnd = ovulationDay + 1;
  // Luteal phase is the rest
  
  let phase: CyclePhaseInfo['phase'];
  let dayInPhase: number;
  let phaseDaysTotal: number;
  
  if (cycleDay <= menstrualEnd) {
    phase = 'menstrual';
    dayInPhase = cycleDay;
    phaseDaysTotal = periodLength;
  } else if (cycleDay <= follicularEnd) {
    phase = 'follicular';
    dayInPhase = cycleDay - menstrualEnd;
    phaseDaysTotal = follicularEnd - menstrualEnd;
  } else if (cycleDay <= ovulationEnd) {
    phase = 'ovulation';
    dayInPhase = cycleDay - follicularEnd;
    phaseDaysTotal = 3; // Typically 2-3 days
  } else {
    phase = 'luteal';
    dayInPhase = cycleDay - ovulationEnd;
    phaseDaysTotal = cycleLength - ovulationEnd;
  }
  
  return {
    phase,
    dayInCycle: cycleDay,
    dayInPhase,
    phaseDaysTotal,
    isPeriodDay: cycleDay <= periodLength,
    isFertileDay: cycleDay >= fertileStart && cycleDay <= fertileEnd,
    isOvulationDay: cycleDay === ovulationDay || cycleDay === ovulationDay + 1,
  };
}

/**
 * Get the next period start date
 */
export function getNextPeriodDate(lastPeriodDate: Date, cycleLength: number): Date {
  const today = new Date();
  const lastPeriod = new Date(lastPeriodDate);
  
  // Calculate days since last period
  const daysSincePeriod = Math.floor(
    (today.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Calculate how many complete cycles have passed
  const cyclesPassed = Math.floor(daysSincePeriod / cycleLength);
  
  // Next period is at the start of the next cycle
  const nextPeriod = new Date(lastPeriod);
  nextPeriod.setDate(nextPeriod.getDate() + (cyclesPassed + 1) * cycleLength);
  
  return nextPeriod;
}

/**
 * Get fertile window dates
 */
export function getFertileWindow(
  lastPeriodDate: Date, 
  cycleLength: number
): { start: Date; end: Date; ovulationDate: Date } {
  const nextPeriod = getNextPeriodDate(lastPeriodDate, cycleLength);
  
  // Ovulation is typically 14 days before the next period
  const ovulationDate = new Date(nextPeriod);
  ovulationDate.setDate(ovulationDate.getDate() - 14);
  
  // Fertile window: 5 days before to 1 day after ovulation
  const fertileStart = new Date(ovulationDate);
  fertileStart.setDate(fertileStart.getDate() - 5);
  
  const fertileEnd = new Date(ovulationDate);
  fertileEnd.setDate(fertileEnd.getDate() + 1);
  
  return {
    start: fertileStart,
    end: fertileEnd,
    ovulationDate,
  };
}

/**
 * Calculate cycle statistics from history
 */
export function calculateCycleStats(cycles: { cycle_length: number | null; period_length: number | null }[]) {
  const validCycleLengths = cycles
    .filter(c => c.cycle_length && c.cycle_length >= 10 && c.cycle_length <= 50)
    .map(c => c.cycle_length!);
  
  const validPeriodLengths = cycles
    .filter(c => c.period_length && c.period_length >= 2 && c.period_length <= 10)
    .map(c => c.period_length!);
  
  const averageCycleLength = validCycleLengths.length > 0
    ? Math.round(validCycleLengths.reduce((a, b) => a + b, 0) / validCycleLengths.length)
    : 28;
  
  const averagePeriodLength = validPeriodLengths.length > 0
    ? Math.round(validPeriodLengths.reduce((a, b) => a + b, 0) / validPeriodLengths.length)
    : 5;
  
  const cycleVariation = validCycleLengths.length > 1
    ? Math.max(...validCycleLengths) - Math.min(...validCycleLengths)
    : 0;
  
  return {
    averageCycleLength,
    averagePeriodLength,
    cycleVariation,
    shortestCycle: validCycleLengths.length > 0 ? Math.min(...validCycleLengths) : 28,
    longestCycle: validCycleLengths.length > 0 ? Math.max(...validCycleLengths) : 28,
    cycleCount: validCycleLengths.length,
  };
}
