// Ported from: src/hooks/useHealthReport.ts, src/hooks/useDoctorReportExtras.ts
//
// Read-only loads for the doctor report: the trackers' own tables (same columns and owner filter as their
// screens), every page (fetchAllReportRows), never from their stateful hooks. Vaccines come from the vaccine
// tool's queries in the screen.
import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../domain/js_compat.dart';
import '../common/health_ports.dart';
import 'doctor_report_extras.dart';
import 'health_report_data.dart';

/// `(period, childId, lifeStage)`.
typedef ReportArgs = ({ReportPeriod period, String? childId, String lifeStage});

/// `useHealthReport(period, childId, lifeStage)`.
final healthReportQuery = queryProviderFamily<HealthReportSnapshot, ReportArgs>((ref, args) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(healthScreensBackendProvider);
  return QueryOptions(
    queryKey: ['health-report-v2', userId, args.period, args.childId, args.lifeStage],
    enabled: userId != null,
    staleTime: Duration.zero,
    retry: retryTimes(1),
    codec: QueryCodecs.model((HealthReportSnapshot s) => s.toJson(), rehydrateReportSnapshot),
    queryFn: (_) async {
      final range = getReportRange(args.period);
      Future<List<ReportRowMap>> rows(String table, String dateColumn, String fields, {bool dateOnly = false, bool baby = false}) {
        final start = range.start == null ? null : (dateOnly ? range.startDay : jsToIsoString(range.start!));
        return fetchAllReportRows((from, to) => backend.reportPage(
              ReportPageRequest(
                table: table,
                fields: fields,
                userId: userId!,
                orderColumn: dateColumn,
                childId: baby ? args.childId : null,
                lte: dateOnly ? range.endDay : jsToIsoString(range.end),
                gte: baby ? null : start,
                orFilter: baby && start != null ? 'start_time.gte.$start,end_time.gte.$start' : null,
              ),
              from,
              to,
            ));
      }

      Future<List<ReportRowMap>> none() async => const [];
      final results = await Future.wait([
        // The database column is entry_date, not recorded_at.
        rows('weight_entries', 'entry_date', 'id,entry_date,weight', dateOnly: true),
        rows('daily_logs', 'log_date', 'id,log_date,water_intake,mood,sleep_hours', dateOnly: true),
        rows('exercise_logs', 'completed_at', 'id,completed_at,duration_minutes'),
        rows('blood_pressure_logs', 'measured_at', 'id,measured_at,systolic,diastolic,pulse'),
        args.lifeStage == 'bump' ? rows('fetal_growth_scans', 'scan_date', 'id,baby_label,scan_date,efw_grams', dateOnly: true) : none(),
        args.lifeStage == 'flow' ? rows('period_day_logs', 'log_date', 'id,log_date,flow_intensity', dateOnly: true) : none(),
        args.lifeStage == 'mommy' && args.childId != null
            ? rows('baby_logs', 'start_time', 'id,log_type,start_time,end_time,feed_type,diaper_type,amount_ml,notes', baby: true)
            : none(),
      ]);
      return HealthReportSnapshot(
        range: range,
        weights: results[0],
        daily: results[1],
        exercises: results[2],
        bloodPressure: results[3],
        fetal: results[4],
        periodDays: results[5],
        baby: results[6],
      );
    },
  );
}, name: 'healthReportQuery');

/// `useDoctorReportExtras(period, childId, lifeStage)` (vaccines are added by the screen).
final doctorReportExtrasQuery = queryProviderFamily<DoctorReportExtras, ReportArgs>((ref, args) {
  final userId = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(healthScreensBackendProvider);
  return QueryOptions(
    queryKey: ['doctor-report-extras-v1', userId, args.period, args.childId, args.lifeStage],
    enabled: userId != null,
    staleTime: Duration.zero,
    retry: retryTimes(1),
    meta: const {'persist': false},
    queryFn: (_) async {
      // One day of slack on each side; the report builders apply the exact period.
      final range = getReportRange(args.period);
      final startIso = range.start == null ? null : jsToIsoString(DateTime.fromMillisecondsSinceEpoch(range.start!.millisecondsSinceEpoch - 86400000));
      final endIso = jsToIsoString(DateTime.fromMillisecondsSinceEpoch(range.end.millisecondsSinceEpoch + 86400000));
      Future<List<ReportRowMap>> rows(String table, String fields, String column, {bool child = false, bool bounded = true}) =>
          fetchAllReportRows((from, to) => backend.reportPage(
                ReportPageRequest(
                  table: table,
                  fields: fields,
                  userId: userId!,
                  orderColumn: column,
                  childId: child ? args.childId : null,
                  lte: bounded ? endIso : null,
                  gte: bounded ? startIso : null,
                ),
                from,
                to,
              ));
      Future<List<ReportRowMap>> none() async => const [];
      final bump = args.lifeStage == 'bump';
      final r = await Future.wait([
        bump ? rows('blood_sugar_logs', 'id,reading_value,reading_type,meal_context,logged_at,created_at', 'created_at') : none(),
        bump ? rows('kick_sessions', 'id,kick_count,duration_seconds,session_date,created_at', 'created_at') : none(),
        bump ? rows('contractions', 'id,start_time,duration_seconds,interval_seconds', 'start_time') : none(),
        // The latest screening is shown even when it is older than the period, so EPDS is not date-bounded.
        bump || args.lifeStage == 'mommy' ? rows('epds_assessments', 'id,total_score,risk_level,completed_at,answers', 'completed_at', bounded: false) : none(),
        args.lifeStage == 'mommy' && args.childId != null
            ? rows('baby_growth', 'id,entry_date,weight_kg,height_cm,head_cm', 'entry_date', child: true, bounded: false)
            : none(),
      ]);
      return DoctorReportExtras(bloodSugar: r[0], kicks: r[1], contractions: r[2], epds: r[3], growth: r[4]);
    },
  );
}, name: 'doctorReportExtrasQuery');
