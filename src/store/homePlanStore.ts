// Home (redesign v3): device-local ticks for plan items that have no server table
// (walk, tummy time) and for the week checklist. Everything else on the plan is
// derived from server data (vitamins, water, kicks, mood).
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ManualPlanItem = 'walk' | 'tummy';

interface HomePlanState {
  /** date (yyyy-MM-dd) -> ticked manual items */
  manual: Record<string, ManualPlanItem[]>;
  /** pregnancy week -> ticked checklist indices */
  weekChecks: Record<number, number[]>;
  toggleManual: (date: string, item: ManualPlanItem) => void;
  toggleWeekCheck: (week: number, index: number) => void;
}

const MAX_DAYS = 14;

export const useHomePlanStore = create<HomePlanState>()(
  persist(
    (set) => ({
      manual: {},
      weekChecks: {},
      toggleManual: (date, item) => set((state) => {
        const current = state.manual[date] || [];
        const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
        // keep the map bounded: only the most recent days survive
        const days = Object.keys({ ...state.manual, [date]: next }).sort().slice(-MAX_DAYS);
        const manual: Record<string, ManualPlanItem[]> = {};
        for (const d of days) manual[d] = d === date ? next : state.manual[d];
        return { manual };
      }),
      toggleWeekCheck: (week, index) => set((state) => {
        const current = state.weekChecks[week] || [];
        return { weekChecks: { ...state.weekChecks, [week]: current.includes(index) ? current.filter((x) => x !== index) : [...current, index] } };
      }),
    }),
    { name: 'anacan-home-plan', version: 1 },
  ),
);
