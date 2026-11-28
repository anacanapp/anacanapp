// Ported from: src/lib/doctor-report.ts
//
// The doctor report's content (DoctorReportData) from the tracker snapshot and the clinical extras.
import '../../../core/i18n/tr.dart';
import '../../../domain/health/blood_pressure.dart' show classifyBp;
import '../../../domain/js_compat.dart';
import 'doctor_report_extras.dart';
import 'health_report_data.dart';
import 'pdf_report.dart';

export 'doctor_report_extras.dart' show reportDate;

DoctorReportData buildDoctorReportData(
  HealthReportSnapshot snapshot, {
  required String userName,
  required String stageTitle,
  required String stage,
  required String periodLabel,
  required List<ReportRow> stageRows,
  required String notes,

  /// Tracker data for the clinical sections; each section appears only for its life stage and when it has data.
  DoctorReportExtras? extras,
  ReportChild? child,
  bool? includeEpds,
  DateTime? today,
  String? language,
  DateTime? generatedAt,
}) {
  final lang = language ?? currentLanguage();
  String number(num? value, [int digits = 1]) => reportNumber(value, lang, digits);
  String recorded(int count) => tr('report_recorded_days', '{n} qeydli gün').replaceFirst('{n}', '$count');
  String minutes(num? value) => value == null
      ? '—'
      : '${(jsRoundInt(value) / 60).floor()} ${tr('report_hours', 'saat')} ${jsRoundInt(value) % 60} ${tr('report_minutes', 'dəq')}';

  final coverage = reportCoverage(snapshot);
  final range = snapshot.range;
  final water = meanRecorded(snapshot.daily.map((l) => l['water_intake']));
  final mood = meanRecorded(snapshot.daily.map((l) {
    final m = l['mood'];
    return m is num && m >= 1 && m <= 5 ? m : null;
  }));
  final sleep = meanRecorded(snapshot.daily.map((l) => l['sleep_hours']));
  final validWeights = [
    for (final row in snapshot.weights)
      if (finiteMeasurement(row['weight']) != null) (row: row, value: finiteMeasurement(row['weight'])!),
  ];
  final latestWeight = validWeights.isEmpty ? null : validWeights.last.value;
  final delta = validWeights.length > 1 ? latestWeight! - validWeights.first.value : null;
  final kg = tr('report_kg', 'kq');
  final trends = <ReportTrend>[
    ReportTrend(
      label: tr('report_latest_weight', 'Son çəki'),
      value: latestWeight == null ? '—' : '${number(latestWeight)} $kg',
      trend: delta == null
          ? tr('report_measurements', '{n} ölçmə').replaceFirst('{n}', '${validWeights.length}')
          : '${delta > 0 ? '+' : ''}${number(delta)} $kg',
    ),
    ReportTrend(
      label: tr('report_water_average', 'Su, qeydli günlərdə orta'),
      value: water.value == null ? '—' : '${number(water.value)} ${tr('report_glasses_day', 'stəkan/gün')}',
      trend: recorded(water.count),
    ),
    ReportTrend(
      label: tr('report_mood_average', 'Əhval, özünüqiymətləndirmə'),
      value: mood.value == null ? '—' : '${number(mood.value)} / 5',
      trend: recorded(mood.count),
    ),
    ReportTrend(
      label: tr('report_maternal_sleep', 'Ana yuxusu, orta'),
      value: sleep.value == null ? '—' : '${number(sleep.value)} ${tr('report_hours_day', 'saat/gün')}',
      trend: recorded(sleep.count),
    ),
    ReportTrend(
      label: tr('report_exercise', 'Məşq qeydləri'),
      value: '${snapshot.exercises.length}',
      trend: snapshot.exercises.isNotEmpty
          ? minutes(snapshot.exercises.fold<double>(0, (total, log) => total + (finiteMeasurement(log['duration_minutes']) ?? 0)))
          : '—',
    ),
  ];
  final summary = summarizeBabyCare(snapshot.baby, range);
  final babyCareRows = snapshot.baby.isEmpty
      ? const <ReportRow>[]
      : [
          ReportRow(tr('report_baby_sleep', 'Körpənin yuxusu, qeydli günlərdə orta'), '${minutes(summary.sleepAverage)} · ${recorded(summary.sleepDays)}'),
          ReportRow(tr('report_baby_feeding', 'Qidalanma qeydləri, orta/gün'), '${number(summary.feedingAverage)} · ${recorded(summary.feedingDays)}'),
          ReportRow(tr('pdf_bc_breast', 'Ana südü (cəmi)'), '${summary.breast}'),
          ReportRow(tr('pdf_bc_formula', 'Süd əvəzedicisi (cəmi)'), '${summary.formula}'),
          ReportRow(tr('report_formula_ml', 'Qeyd edilmiş formula miqdarı'), summary.formulaAmounts != 0 ? '${number(summary.formulaMl, 0)} ml' : '—'),
          ReportRow(tr('pdf_bc_solid', 'Əlavə qida (cəmi)'), '${summary.solid}'),
          ReportRow(tr('report_baby_diapers', 'Bez qeydləri, orta/gün'), '${number(summary.diaperAverage)} · ${recorded(summary.diaperDays)}'),
          ReportRow(tr('report_diaper_types', 'Nəm / çirkli / qarışıq bez'), '${summary.wet} / ${summary.dirty} / ${summary.mixed}'),
          if (summary.unknownDiapers != 0) ReportRow(tr('report_unknown_diapers', 'Növü göstərilməyən bez qeydləri'), '${summary.unknownDiapers}'),
        ];
  final flowLabels = <String, String>{
    'none': tr('report_flow_none', 'Axın yoxdur'),
    'spotting': tr('report_flow_spotting', 'Ləkələnmə'),
    'light': tr('report_flow_light', 'Az'),
    'medium': tr('report_flow_medium', 'Orta'),
    'heavy': tr('report_flow_heavy', 'Güclü'),
    'unspecified': tr('report_flow_unspecified', 'Axın var, intensivlik qeyd edilməyib'),
  };
  String flowLabel(Object? v) {
    final key = v is String && v.isNotEmpty ? v : 'unspecified';
    return flowLabels[key] ?? (v is String && v.isNotEmpty ? v : '—');
  }

  return DoctorReportData(
    userName: userName,
    stageTitle: stageTitle,
    periodLabel: periodLabel,
    generatedAt: generatedAt ?? DomainClock.now(),
    dateRangeLabel: range.start != null
        ? '${reportDate(range.start!)} — ${reportDate(range.end)}'
        : tr('report_all_dates', 'Mövcud bütün qeydlər · {date} tarixinədək').replaceFirst('{date}', reportDate(range.end)),
    coverage: ReportCoverage(records: coverage.total, recordedDays: coverage.recordedDays),
    stageRows: stageRows,
    trends: trends,
    notes: notes,
    weightSeries: [for (final w in validWeights) ReportWeightPoint(date: reportDate('${w.row['entry_date']}'), weight: w.value)],
    bpRows: [
      for (final log in snapshot.bloodPressure)
        ReportBpRow(
          date: reportDate('${log['measured_at']}', true),
          reading: '${log['systolic']}/${log['diastolic']}',
          pulse: log['pulse'] == null ? '—' : '${log['pulse']}',
          category: classifyBp((log['systolic'] as num?) ?? 0, (log['diastolic'] as num?) ?? 0, stage == 'bump', tr: tr).label,
        ),
    ],
    babyCareRows: babyCareRows,
    sections: extras != null
        ? buildClinicalSections(extras, stage: stage, range: range, child: child, includeEpds: includeEpds, today: today, language: lang)
        : const [],
    historyTables: [
      ReportTable(
        title: tr('report_fetal_history', 'USM / fetal böyümə qeydləri'),
        headers: [tr('pdf_date', 'Tarix'), tr('report_baby_label', 'Körpə'), tr('report_efw_grams', 'Təxmini çəki (q)')],
        rows: [
          for (final log in snapshot.fetal) [reportDate('${log['scan_date']}'), '${log['baby_label'] ?? ''}', number(finiteMeasurement(log['efw_grams']), 0)],
        ],
        widths: const [1.2, 0.6, 1.2],
      ),
      ReportTable(
        title: tr('report_period_history', 'Gündəlik axın qeydləri'),
        headers: [tr('pdf_date', 'Tarix'), tr('report_flow', 'Axın')],
        rows: [for (final log in snapshot.periodDays) [reportDate('${log['log_date']}'), flowLabel(log['flow_intensity'])]],
        widths: const [1, 2],
      ),
    ],
  );
}
