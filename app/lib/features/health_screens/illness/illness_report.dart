// Ported from: src/components/illness/illness-report.ts
//
// Doctor summary of one illness episode, rendered by the shared PDF report.
import '../../../domain/js_compat.dart';
import '../common/feature_text.dart';
import '../common/health_format.dart';
import '../doctor_report/pdf_report.dart';
import 'illness.dart';

DateTime _d(String iso) => jsParseDate(iso) ?? DateTime.fromMillisecondsSinceEpoch(0);

DoctorReportData buildIllnessReport(
  FeatureText t,
  IllnessEpisode episode,
  List<IllnessEntry> entries, {
  required String childName,
  required String language,
  required String locale,
  required String userName,
  TempUnit unit = 'C',
}) {
  String when(String iso) => fmtDayMonthShortTime(_d(iso), language);
  final chronological = [...entries]..sort((a, b) => a.at.compareTo(b.at));
  final temps = chronological.where((e) => e.kind == 'temp').toList();
  final meds = chronological.where((e) => e.kind == 'med').toList();
  final symptoms = chronological.where((e) => e.kind == 'symptom').toList();
  String who(IllnessEntry e) => e.by == 'mother' ? t.s('by_mother') : e.by == 'partner' ? t.s('by_partner') : '-';
  final maxTemp = temps.fold<double>(0, (m, e) => (e.tempC ?? 0) > m ? (e.tempC ?? 0) : m);
  final start = fmtDayMonthYearLong(_d(episode.startedAt), language);
  final end = episode.endedAt != null && episode.endedAt!.isNotEmpty ? fmtDayMonthYearLong(_d(episode.endedAt!), language) : null;
  final headers = t.sub('report_headers');
  final tables = t.sub('report_tables');
  final rows = t.sub('report_rows');
  final historyTables = <ReportTable>[
    if (temps.isNotEmpty)
      ReportTable(
        title: tables.s('temps'),
        headers: [headers.s('time'), headers.s('value'), headers.s('method')],
        rows: [
          for (final e in temps)
            [when(e.at), e.tempC == null ? '-' : formatTemp(e.tempC!, unit, locale), e.tempMethod != null ? (t.at('methods', e.tempMethod!) ?? '') : '-'],
        ],
      ),
    if (meds.isNotEmpty)
      ReportTable(
        title: tables.s('meds'),
        headers: [headers.s('time'), headers.s('med'), headers.s('dose'), headers.s('by')],
        rows: [
          for (final e in meds)
            [
              when(e.at),
              e.medName ?? '',
              '${e.dose ?? ''}${e.intervalHours != null && e.intervalHours != 0 ? ' / ${jsNumberToString(e.intervalHours!)}h' : ''}',
              who(e),
            ],
        ],
      ),
    if (symptoms.isNotEmpty)
      ReportTable(
        title: tables.s('symptoms'),
        headers: [headers.s('time'), headers.s('symptoms'), headers.s('note')],
        rows: [
          for (final e in symptoms) [when(e.at), (e.symptoms ?? const []).map((s) => t.at('symptoms', s) ?? s).join(', '), e.note ?? ''],
        ],
      ),
  ];
  return DoctorReportData(
    userName: userName,
    stageTitle: t.s('report_pdf_title'),
    periodLabel: end != null ? '$start - $end' : start,
    stageRows: [
      ReportRow(rows.s('child'), childName.isEmpty ? '-' : childName),
      ReportRow(rows.s('illness'), t.at('kinds', episode.kind) ?? episode.kind),
      ReportRow(rows.s('started'), when(episode.startedAt)),
      ReportRow(rows.s('max_temp'), maxTemp != 0 ? formatTemp(maxTemp, unit, locale) : '-'),
      ReportRow(rows.s('status'), end != null ? '${t.s('ended')} · $end' : t.s('active')),
    ],
    trends: const [],
    historyTables: historyTables,
    coverage: ReportCoverage(records: entries.length, recordedDays: {for (final e in entries) e.at.length >= 10 ? e.at.substring(0, 10) : e.at}.length),
    notes: '${t.s('no_dose_calc')} ${t.s('disclaimer')}',
  );
}
