import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { fetchAllReportRows, getReportRange, type ReportPeriod } from '@/lib/health-report-data';
import type { DoctorReportExtras, ReportBloodSugar, ReportContraction, ReportEpds, ReportGrowth, ReportKickSession } from '@/lib/doctor-report-extras';

/**
 * Read-only loads for the doctor report's clinical sections. Reads the trackers' own tables
 * (same columns and owner filter as their screens) without using their stateful hooks.
 * Vaccines come from useVaccineScheduleForCountry/useChildVaccinations in the screen.
 */
export function useDoctorReportExtras(period: ReportPeriod, childId: string | null, lifeStage: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  return useQuery({
    queryKey: ['doctor-report-extras-v1', userId, period, childId, lifeStage],
    enabled: !!userId,
    staleTime: 0,
    retry: 1,
    queryFn: async ({ signal }): Promise<Omit<DoctorReportExtras, 'vaccines'>> => {
      // One day of slack on each side; the report builders apply the exact period.
      const range = getReportRange(period);
      const startIso = range.start ? new Date(range.start.getTime() - 86400000).toISOString() : null;
      const endIso = new Date(range.end.getTime() + 86400000).toISOString();
      const rows = <T,>(table: string, fields: string, column: string, opts: { child?: boolean; bounded?: boolean } = {}) =>
        fetchAllReportRows<T>((from, to) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic table name, same pattern as useHealthReport
          let query = (supabase as any).from(table).select(fields).eq('user_id', userId);
          if (opts.child) query = query.eq('child_id', childId);
          if (opts.bounded !== false) {
            query = query.lte(column, endIso);
            if (startIso) query = query.gte(column, startIso);
          }
          return query.order(column, { ascending: true }).order('id', { ascending: true }).range(from, to).abortSignal(signal);
        });
      const bump = lifeStage === 'bump';
      const [bloodSugar, kicks, contractions, epds, growth] = await Promise.all([
        bump ? rows<ReportBloodSugar>('blood_sugar_logs', 'id,reading_value,reading_type,meal_context,logged_at,created_at', 'created_at') : [],
        bump ? rows<ReportKickSession>('kick_sessions', 'id,kick_count,duration_seconds,session_date,created_at', 'created_at') : [],
        bump ? rows<ReportContraction>('contractions', 'id,start_time,duration_seconds,interval_seconds', 'start_time') : [],
        // The latest screening is shown even when it is older than the period, so EPDS is not date-bounded.
        bump || lifeStage === 'mommy' ? rows<ReportEpds>('epds_assessments', 'id,total_score,risk_level,completed_at,answers', 'completed_at', { bounded: false }) : [],
        lifeStage === 'mommy' && childId ? rows<ReportGrowth>('baby_growth', 'id,entry_date,weight_kg,height_cm,head_cm', 'entry_date', { child: true, bounded: false }) : [],
      ]);
      return { bloodSugar, kicks, contractions, epds, growth };
    },
  });
}
