import { useState, useEffect, useCallback } from 'react';
import { getPregnancyDay, getPregnancyWeek, getDayInWeek, getTrimester, getDaysUntilDue } from '@/lib/pregnancy-utils';

interface UsePregnancyDayNavigationProps {
  lastPeriodDate: Date | string | null;
  dueDate?: Date | string | null;
}

interface NavigationState {
  selectedDay: number;
  actualCurrentDay: number;
  selectedWeek: number;
  selectedDayInWeek: number;
  selectedTrimester: 1 | 2 | 3;
  daysUntilDueFromSelected: number;
  isViewingCurrentDay: boolean;
}

export function usePregnancyDayNavigation({ lastPeriodDate, dueDate }: UsePregnancyDayNavigationProps) {
  // Calculate actual current day
  const actualCurrentDay = getPregnancyDay(lastPeriodDate);
  
  // State for selected day (starts at current day, resets on mount)
  const [selectedDay, setSelectedDay] = useState<number>(actualCurrentDay);

  // Reset to current day on mount (handles app refresh/reopen)
  useEffect(() => {
    setSelectedDay(actualCurrentDay);
  }, [actualCurrentDay]);

  // Calculate derived values based on selected day
  const getNavigationState = useCallback((): NavigationState => {
    // Calculate week and day for selected day
    // Selected day is 1-indexed (day 1 = first day)
    const dayIndex = selectedDay - 1; // 0-indexed for calculations
    const selectedWeek = Math.floor(dayIndex / 7);
    const selectedDayInWeek = dayIndex % 7;
    const selectedTrimester = getTrimester(selectedWeek);
    
    // Calculate days until due from selected day
    const totalDays = 280;
    const daysUntilDueFromSelected = Math.max(0, totalDays - selectedDay);

    return {
      selectedDay,
      actualCurrentDay,
      selectedWeek,
      selectedDayInWeek,
      selectedTrimester,
      daysUntilDueFromSelected,
      isViewingCurrentDay: selectedDay === actualCurrentDay,
    };
  }, [selectedDay, actualCurrentDay]);

  const navigateToDay = useCallback((day: number) => {
    const clampedDay = Math.max(1, Math.min(280, day));
    setSelectedDay(clampedDay);
  }, []);

  const resetToCurrentDay = useCallback(() => {
    setSelectedDay(actualCurrentDay);
  }, [actualCurrentDay]);

  return {
    ...getNavigationState(),
    navigateToDay,
    resetToCurrentDay,
    setSelectedDay,
  };
}
