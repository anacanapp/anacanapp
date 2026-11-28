// Ported from: src/lib/doctor-report-extras.test.ts (tr → Azerbaijani fallbacks, getLocaleTag → en-US: language 'en')
import 'package:anacan/domain/growth/who_growth.dart' show headCircumferencePercentile, percentile;
import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/health_screens/doctor_report/doctor_report.dart';
import 'package:anacan/features/health_screens/doctor_report/doctor_report_extras.dart';
import 'package:anacan/features/health_screens/doctor_report/health_report_data.dart';
import 'package:anacan/features/health_screens/doctor_report/pdf_report.dart';
import 'package:flutter_test/flutter_test.dart';

final DateTime now = DateTime(2026, 11, 8, 12, 0); // 08.11.2026 12:00 local
final ReportRange month = getReportRange('1month', now);
final ReportRange week = getReportRange('1week', now);
String local(int d, [int h = 9, int m = 0]) => jsToIsoString(DateTime(2026, 11, d, h, m));
const String en = 'en';

double _months(String a, String b) => (DateTime.parse('${a}T00:00:00Z').millisecondsSinceEpoch - DateTime.parse('${b}T00:00:00Z').millisecondsSinceEpoch) / (30.4375 * 86400000);

void main() {
  group('blood sugar', () {
    test('bands readings with the GDM targets (fasting <95, 1 h <140, 2 h <120, low <70)', () {
      expect(bloodSugarTargets, (low: 70, fasting: 95, after1h: 140, after2h: 120));
      expect(bloodSugarBand(94, 'fasting'), 'target');
      expect(bloodSugarBand(95, 'fasting'), 'above');
      expect(bloodSugarBand(139, 'after_meal_1h'), 'target');
      expect(bloodSugarBand(140, 'after_meal_1h'), 'above');
      expect(bloodSugarBand(119, 'after_meal'), 'target');
      expect(bloodSugarBand(120, 'after_meal'), 'above');
      expect(bloodSugarBand(141, 'random'), 'above');
      expect(bloodSugarBand(65, 'fasting'), 'low');
    });

    test('turns readings in the period into summary cards and a newest-first table', () {
      final section = buildBloodSugarSection([
        {'id': '1', 'reading_value': 90, 'reading_type': 'fasting', 'logged_at': local(6, 7), 'created_at': local(6, 7)},
        {'id': '2', 'reading_value': 150, 'reading_type': 'after_meal', 'logged_at': local(7, 14), 'created_at': local(7, 14)},
        {'id': '3', 'reading_value': 100, 'reading_type': 'fasting', 'logged_at': local(8, 7), 'created_at': local(8, 7)},
        {'id': 'old', 'reading_value': 300, 'reading_type': 'random', 'logged_at': '2026-01-01T09:00:00Z', 'created_at': '2026-01-01T09:00:00Z'},
      ], month, language: en)!;
      expect(section.id, 'blood_sugar');
      expect(section.rows, const [
        ReportRow('Ölçmələr', '3'),
        ReportRow('Hədəfdə olan ölçmələr', '1 / 3'),
        ReportRow('Aclıq qlükozası, orta', '95 mg/dL'),
        ReportRow('Digər ölçmələr, orta', '150 mg/dL'),
      ]);
      expect(section.note, contains('95 mg/dL'));
      expect(section.note, contains('140 mg/dL'));
      expect(section.note, contains('120 mg/dL'));
      expect(section.table!.rows, [
        ['08.11.2026 07:00', 'Aclıq', '100 (5.6)', 'Hədəfdən yuxarı'],
        ['07.11.2026 14:00', 'Yeməkdən 2 saat sonra', '150 (8.3)', 'Hədəfdən yuxarı'],
        ['06.11.2026 07:00', 'Aclıq', '90 (5)', 'Hədəfdə'],
      ]);
    });

    test('is omitted when there is no reading in the period', () {
      expect(buildBloodSugarSection(const [], month), isNull);
    });
  });

  group('kick counts', () {
    test('groups sessions by the local calendar day, newest first', () {
      final section = buildKickSection([
        // 00:30 local belongs to the 8th even though the server default session_date is the UTC day (7th in Baku).
        {'id': 'a', 'kick_count': 10, 'duration_seconds': 600, 'session_date': '2026-11-07', 'created_at': local(8, 0, 30)},
        {'id': 'b', 'kick_count': 12, 'duration_seconds': 900, 'session_date': '2026-11-08', 'created_at': local(8, 10)},
        {'id': 'c', 'kick_count': 8, 'duration_seconds': 1500, 'session_date': '2026-11-06', 'created_at': local(6, 20)},
      ], month, language: en)!;
      expect(section.rows, const [
        ReportRow('Sayma seansları', '3'),
        ReportRow('Qeydli günlər', '2'),
        ReportRow('Seans üzrə orta təpik', '10'),
        ReportRow('Seansın orta müddəti (dəq:san)', '16:40'),
      ]);
      expect(section.table!.rows, [
        ['08.11.2026', '2', '22', '25:00'],
        ['06.11.2026', '1', '8', '25:00'],
      ]);
    });

    test('limits the daily table to the recent days and says so', () {
      final sessions = [
        for (var n = 0; n < 10; n++) {'id': '$n', 'kick_count': 10, 'duration_seconds': 60, 'session_date': null, 'created_at': local(8 - n, 10)},
      ];
      final section = buildKickSection(sessions, month, maxDays: 7, language: en)!;
      expect(section.table!.rows, hasLength(7));
      expect(section.note, contains('7'));
    });
  });

  group('contractions', () {
    final rows = [
      {'id': '1', 'start_time': local(7, 22, 0), 'duration_seconds': 40, 'interval_seconds': null},
      {'id': '2', 'start_time': local(7, 22, 10), 'duration_seconds': 50, 'interval_seconds': 600},
      {'id': '3', 'start_time': local(7, 22, 18), 'duration_seconds': 60, 'interval_seconds': 480},
      {'id': '4', 'start_time': local(8, 6, 0), 'duration_seconds': 45, 'interval_seconds': 30000},
      {'id': '5', 'start_time': local(8, 6, 5), 'duration_seconds': 55, 'interval_seconds': 300},
    ];
    test('splits sessions on a pause longer than an hour and averages duration and start-to-start interval', () {
      final sessions = groupContractionSessions(rows, month);
      expect(sessions, hasLength(2));
      expect((sessions[0].count, sessions[0].avgDuration, sessions[0].avgInterval), (3, 50, 540));
      expect((sessions[1].count, sessions[1].avgDuration, sessions[1].avgInterval), (2, 50, 300));
    });

    test('lists recent sessions newest first', () {
      final section = buildContractionSection(rows, month)!;
      expect(section.rows, const [ReportRow('Qeyd edilmiş sancılar', '5'), ReportRow('Ölçmə seansları', '2')]);
      expect(section.table!.rows, [
        ['08.11.2026 06:00', '2', '0:50', '5:00'],
        ['07.11.2026 22:00', '3', '0:50', '9:00'],
      ]);
    });

    test('formats clock values', () {
      expect(clock(65), '1:05');
      expect(clock(null), '—');
    });
  });

  group('EPDS', () {
    test('uses the app score bands', () {
      expect(epdsBand(9), 'low');
      expect(epdsBand(10), 'possible');
      expect(epdsBand(12), 'possible');
      expect(epdsBand(13), 'probable');
    });

    test('shows date, score and band, and flags question 10 above 0 for the clinician', () {
      final section = buildEpdsSection([
        {'id': 'a', 'total_score': 14, 'risk_level': 'high', 'completed_at': local(5, 10), 'answers': {1: 2, 10: 1}},
        {'id': 'b', 'total_score': 6, 'risk_level': 'low', 'completed_at': local(1, 10), 'answers': {'1': 0, '10': 0}},
      ], month)!;
      expect(section.table!.rows, [
        ['05.11.2026', '14 / 30', 'Ehtimal olunan depressiya (13+)', '1 (!)'],
        ['01.11.2026', '6 / 30', 'Hədd altında (0-9)', '0'],
      ]);
      expect(section.flag, contains('10-cu sual'));
      expect(section.flag, contains('05.11.2026 (1/3)'));
      expect(section.flag, isNot(contains('01.11.2026')));
    });

    test('has no flag when question 10 is 0, and keeps the latest screening when none falls in the period', () {
      final section = buildEpdsSection([
        {'id': 'a', 'total_score': 11, 'completed_at': '2026-08-01T10:00:00Z', 'answers': {10: 0}},
      ], week)!;
      expect(section.flag, isNull);
      expect(section.table!.rows, hasLength(1));
      expect(section.table!.rows[0][2], 'Mümkün depressiya (10-12)');
    });
  });

  group('vaccines', () {
    const child = ReportChild(birthDate: '2026-05-01', gender: 'girl');
    final schedule = [
      {'id': 'bcg', 'dose_number': 1, 'recommended_age_days': 0, 'min_age_days': 0, 'max_age_days': 30, 'dose_label': '1', 'age_label': 'Doğuşda', 'vaccine': {'name': 'BCG', 'is_active': true}},
      {'id': 'hep2', 'dose_number': 2, 'recommended_age_days': 60, 'min_age_days': 60, 'max_age_days': 90, 'dose_label': '2', 'age_label': '2 ay', 'vaccine': {'name': 'HepB', 'is_active': true}},
      {'id': 'dtp3', 'dose_number': 3, 'recommended_age_days': 180, 'min_age_days': 180, 'max_age_days': 240, 'dose_label': '3', 'age_label': '6 ay', 'vaccine': {'name': 'DTP', 'is_active': true}},
      {'id': 'mmr', 'dose_number': 1, 'recommended_age_days': 365, 'min_age_days': 365, 'max_age_days': 450, 'dose_label': '1', 'age_label': '12 ay', 'vaccine': {'name': 'MMR', 'is_active': true}},
      {'id': 'retired', 'dose_number': 1, 'recommended_age_days': 30, 'min_age_days': 30, 'max_age_days': 40, 'vaccine': {'name': 'Old', 'is_active': false}},
    ];
    test('counts done, due and overdue and lists them with dates', () {
      final section = buildVaccineSection(schedule, [
        {'vaccine_schedule_id': 'bcg', 'administered_at': '2026-10-20', 'is_skipped': false},
      ], child, month, now)!;
      expect(section.rows, const [ReportRow('Vurulub', '1'), ReportRow('Vaxtı çatıb', '1'), ReportRow('Gecikib', '1')]);
      expect(section.table!.rows, [
        ['HepB', '2', 'Gecikib', '2 ay · 30.06.2026'],
        ['DTP', '3', 'Vaxtı çatıb', '6 ay · 28.10.2026'],
        ['BCG', '1', 'Vurulub', '20.10.2026'],
      ]);
    });

    test('keeps done doses outside the period in the count only', () {
      final section = buildVaccineSection(schedule, [
        {'vaccine_schedule_id': 'bcg', 'administered_at': '2026-05-02', 'is_skipped': false},
      ], child, week, now)!;
      expect(section.rows![0].value, '1');
      expect(section.table!.rows.any((row) => row[0] == 'BCG'), isFalse);
    });
  });

  group('growth', () {
    final entries = [
      {'id': '1', 'entry_date': '2026-09-01', 'weight_kg': 5.8, 'height_cm': 60, 'head_cm': 40},
      {'id': '2', 'entry_date': '2026-11-01', 'weight_kg': 7, 'height_cm': 64.5, 'head_cm': null},
    ];
    test('adds WHO weight and height percentiles from whoGrowth for the latest measurement', () {
      const child = ReportChild(birthDate: '2026-05-01', gender: 'boy');
      final section = buildGrowthSection(entries, child, month, language: en)!;
      final months = _months('2026-11-01', '2026-05-01');
      final wp = percentile('weight', 'boy', months, 7), hp = percentile('height', 'boy', months, 64.5);
      expect(section.rows, [ReportRow('Çəki persentili (ÜST)', 'P$wp · 7 kq'), ReportRow('Boy persentili (ÜST)', 'P$hp · 64.5 cm')]);
      expect(section.table!.rows, [
        ['01.11.2026', '6', '7 · P$wp', '64.5 · P$hp', '—'],
      ]);
    });

    test('falls back to the latest measurement and uses corrected age for a preterm baby', () {
      const preterm = ReportChild(birthDate: '2026-05-01', dueDate: '2026-06-26', gender: 'girl');
      final section = buildGrowthSection(entries.sublist(0, 1), preterm, week, language: en)!;
      final corrected = _months('2026-09-01', '2026-06-26');
      expect(section.table!.rows[0][1], jsNumberToString(jsRound(corrected * 10) / 10));
      expect(section.table!.rows[0][2], '5.8 · P${percentile('weight', 'girl', corrected, 5.8)}');
      expect(section.note, contains('korreksiya'));
    });

    test('adds the WHO head circumference percentile and covers ages up to 5 years', () {
      const child = ReportChild(birthDate: '2023-11-01', gender: 'girl');
      final section = buildGrowthSection([
        {'id': 'h', 'entry_date': '2026-11-01', 'weight_kg': 14, 'height_cm': 96, 'head_cm': 48.5},
      ], child, month, language: en)!;
      final months = _months('2026-11-01', '2023-11-01');
      final hcp = headCircumferencePercentile('girl', months, 48.5);
      expect(hcp, isNotNull);
      expect(section.rows!.map((r) => r.label), ['Çəki persentili (ÜST)', 'Boy persentili (ÜST)', 'Baş çevrəsi persentili (ÜST)']);
      expect(section.table!.rows[0][4], '48.5 · P$hcp');
      expect(section.note, contains('0-5'));
    });

    test('omits percentiles when the sex is not recorded', () {
      final section = buildGrowthSection(entries, const ReportChild(birthDate: '2026-05-01', gender: 'unknown'), month, language: en)!;
      expect(section.rows, isEmpty);
      expect(section.table!.rows[0][2], '7');
      expect(section.note, contains('Cinsiyyət'));
    });
  });

  group('stage selection', () {
    final extras = DoctorReportExtras(
      bloodSugar: [
        {'id': '1', 'reading_value': 90, 'reading_type': 'fasting', 'logged_at': local(8, 7), 'created_at': local(8, 7)},
      ],
      kicks: [
        {'id': 'k', 'kick_count': 10, 'duration_seconds': 600, 'session_date': '2026-11-08', 'created_at': local(8, 10)},
      ],
      contractions: const [],
      epds: [
        {'id': 'e', 'total_score': 5, 'completed_at': local(8, 10), 'answers': {10: 0}},
      ],
      growth: const [
        {'id': 'g', 'entry_date': '2026-11-01', 'weight_kg': 7, 'height_cm': 64, 'head_cm': null},
      ],
    );
    test('pregnancy shows sugar, kicks and EPDS but no child sections; empty contractions are omitted', () {
      expect(buildClinicalSections(extras, stage: 'bump', range: month).map((s) => s.id), ['blood_sugar', 'kicks', 'epds']);
    });
    test('postpartum shows EPDS and child sections, and EPDS can be left out', () {
      const child = ReportChild(birthDate: '2026-05-01', gender: 'boy');
      expect(buildClinicalSections(extras, stage: 'mommy', range: month, child: child).map((s) => s.id), ['epds', 'growth']);
      expect(buildClinicalSections(extras, stage: 'mommy', range: month, child: child, includeEpds: false).map((s) => s.id), ['growth']);
    });
    test('cycle tracking shows none of them', () {
      expect(buildClinicalSections(extras, stage: 'flow', range: month), isEmpty);
    });
    test('reaches the report data through buildDoctorReportData', () {
      final snapshot = HealthReportSnapshot(range: month);
      final data = buildDoctorReportData(snapshot, userName: 'A', stageTitle: 'B', stage: 'bump', periodLabel: '1 ay', stageRows: const [], notes: '', extras: extras);
      expect(data.sections!.map((s) => s.id), ['blood_sugar', 'kicks', 'epds']);
    });
  });
}
