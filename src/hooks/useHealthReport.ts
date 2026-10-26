import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchAllReportRows, getReportRange, rehydrateReportSnapshot, type HealthReportSnapshot, type ReportPeriod,
  type ReportWeight, type ReportDailyLog, type ReportExercise, type ReportBp, type ReportFetal, type ReportBabyLog, type ReportPeriodDay,
} from '@/lib/health-report-data';

export function useHealthReport(period: ReportPeriod = '1month', childId: string | null = null, lifeStage = 'flow') {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery({
    queryKey: ['health-report-v2', userId, period, childId, lifeStage],
    enabled: !!userId,
    staleTime: 0,
    retry: 1,
    select: rehydrateReportSnapshot,
    queryFn: async ({ signal }): Promise<HealthReportSnapshot> => {
      const range = getReportRange(period);
      const rows = <T,>(table: string, dateColumn: string, fields: string, dateOnly = false, baby = false) =>
        fetchAllReportRows<T>((from, to) => {
          let query = (supabase as any).from(table).select(fields).eq('user_id', userId)
            .lte(dateColumn, dateOnly ? range.endDay : range.end.toISOString())
            .order(dateColumn, { ascending: true }).order('id', { ascending: true });
          if (baby) query = query.eq('child_id', childId);
          if (range.start) {
            const start = dateOnly ? range.startDay : range.start.toISOString();
            query = baby ? query.or(`start_time.gte.${start},end_time.gte.${start}`) : query.gte(dateColumn, start);
          }
          return query.range(from, to).abortSignal(signal);
        });

      const [weights, daily, exercises, bloodPressure, fetal, periodDays, baby] = await Promise.all([
        // The database column is entry_date, not recorded_at.
        rows<ReportWeight>('weight_entries', 'entry_date', 'id,entry_date,weight', true),
        rows<ReportDailyLog>('daily_logs', 'log_date', 'id,log_date,water_intake,mood,sleep_hours', true),
        rows<ReportExercise>('exercise_logs', 'completed_at', 'id,completed_at,duration_minutes'),
        rows<ReportBp>('blood_pressure_logs', 'measured_at', 'id,measured_at,systolic,diastolic,pulse'),
        lifeStage === 'bump' ? rows<ReportFetal>('fetal_growth_scans', 'scan_date', 'id,baby_label,scan_date,efw_grams', true) : [],
        lifeStage === 'flow' ? rows<ReportPeriodDay>('period_day_logs', 'log_date', 'id,log_date,flow_intensity', true) : [],
        lifeStage === 'mommy' && childId ? rows<ReportBabyLog>('baby_logs', 'start_time', 'id,log_type,start_time,end_time,feed_type,diaper_type,amount_ml,notes', false, true) : [],
      ]);
      return { range, weights, daily, exercises, bloodPressure, fetal, periodDays, baby };
    },
  });
}
