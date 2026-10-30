import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * Shared family tools of a mother and her mutually linked partner (Duzelis69):
 * night shift and birth plan. All access goes through SECURITY DEFINER RPCs.
 */

export type NightAssignee = 'mother' | 'partner';
export interface NightShift {
  shift_date: string;
  assignee: NightAssignee;
  is_done: boolean;
  wakeups: number | null;
  note: string | null;
  updated_by_me: boolean;
  updated_at: string;
}

// Keep the call on the client object: a detached supabase.rpc loses `this`.
const rpc = (name: string, args?: Record<string, unknown>): Promise<{ data: any; error: any }> => (supabase.rpc as any)(name, args);

export const isoDay = (date: Date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};
export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export function useNightShifts(from: Date, to: Date) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const range = [isoDay(from), isoDay(to)] as const;
  const key = ['night-shifts', user?.id, ...range];
  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<NightShift[]> => {
      const { data, error } = await rpc('night_shifts_v1', { p_from: range[0], p_to: range[1] });
      if (error) throw error;
      return (data || []) as NightShift[];
    },
  });
  const set = useMutation({
    mutationFn: async (input: { date: string; assignee: NightAssignee | null; isDone?: boolean; wakeups?: number | null; note?: string | null }) => {
      const { error } = await rpc('night_shift_set_v1', {
        p_date: input.date, p_assignee: input.assignee, p_is_done: input.isDone ?? false,
        p_wakeups: input.wakeups ?? null, p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['night-shifts', user?.id] }),
  });
  return { shifts: query.data || [], loading: query.isLoading, error: query.error, set };
}

export interface BirthPlan {
  place?: string;
  doctor?: string;
  companions?: string[];
  pain?: string;
  environment?: string[];
  after?: string[];
  cesarean?: string[];
  notes?: string;
}
interface BirthPlanState { plan: BirthPlan; updated_at: string | null; updated_by_me: boolean; is_mother: boolean }

export class BirthPlanChangedError extends Error {
  constructor() { super('BIRTH_PLAN_CHANGED'); this.name = 'BirthPlanChangedError'; }
}

export function useBirthPlan() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['birth-plan', user?.id];
  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    queryFn: async (): Promise<BirthPlanState> => {
      const { data, error } = await rpc('birth_plan_get_v1');
      if (error) throw error;
      return data as BirthPlanState;
    },
  });
  const save = useMutation({
    mutationFn: async (plan: BirthPlan) => {
      const { data, error } = await rpc('birth_plan_save_v1', { p_plan: plan, p_expected_updated_at: query.data?.updated_at ?? null });
      if (error) {
        if (error.code === '40001' || String(error.message).includes('BIRTH_PLAN_CHANGED')) throw new BirthPlanChangedError();
        throw error;
      }
      return data as string;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
  return { state: query.data, loading: query.isLoading, error: query.error, save };
}
