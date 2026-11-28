// Ported from: (no React suite) src/components/DoctorReportScreen.tsx, src/hooks/{useHealthReport,
//              useDoctorReportExtras}.ts behaviour
import 'dart:typed_data';

import 'package:anacan/domain/js_compat.dart';
import 'package:anacan/features/health_screens/doctor_report/doctor_report_screen.dart';
import 'package:anacan/features/health_screens/doctor_report/pdf_report.dart';
import 'package:flutter/widgets.dart' show Size;
import 'package:flutter_test/flutter_test.dart';

import '../../settings/support/harness.dart';
import '../support/health_harness.dart';
import 'pdf_report_test.dart' show FakeDelivery;

class FakeRenderer implements DoctorReportPdfRenderer {
  final List<DoctorReportData> rendered = [];
  @override
  Future<Uint8List> render(DoctorReportData data) async {
    rendered.add(data);
    return Uint8List.fromList([1, 2, 3]);
  }
}

String daysAgoIso(int d) => jsToIsoString(DateTime.now().subtract(Duration(days: d)));
String daysAgo(int d) => daysAgoIso(d).substring(0, 10);

// The test font (Ahem) is wider than Nunito: the four period tabs need more room than 390 px.
const Size wide = Size(700, 1600);

void main() {
  screenTest('loads every tracker of the stage and shows the report contents', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'bump', 'lastPeriodDate': daysAgo(100)}, profile: {'name': 'Leyla'});
    env.backend.reportTables['weight_entries'] = [
      {'id': 'w1', 'entry_date': daysAgo(10), 'weight': 60},
      {'id': 'w2', 'entry_date': daysAgo(2), 'weight': '61.5'},
    ];
    env.backend.reportTables['blood_pressure_logs'] = [
      {'id': 'b1', 'measured_at': daysAgoIso(3), 'systolic': 120, 'diastolic': 80, 'pulse': 70},
    ];
    env.backend.reportTables['kick_sessions'] = [
      {'id': 'k1', 'kick_count': 10, 'duration_seconds': 600, 'session_date': daysAgo(1), 'created_at': daysAgoIso(1)},
    ];
    await pumpScreen(tester, DoctorReportScreen(onBack: () {}), env, size: wide);
    await tester.pump();
    await tester.pump();
    final tables = {for (final p in env.backend.pages) p.table};
    expect(tables, containsAll(['weight_entries', 'daily_logs', 'exercise_logs', 'blood_pressure_logs', 'fetal_growth_scans', 'blood_sugar_logs', 'kick_sessions', 'contractions', 'epds_assessments']));
    expect(tables, isNot(contains('period_day_logs')));
    expect(tables, isNot(contains('baby_logs')));
    expect(find.text('Leyla'), findsOneWidget);
    expect(find.text('Hamiləlik dövrü'), findsOneWidget);
    expect(find.text('Sağlamlıq göstəriciləri'), findsOneWidget);
    expect(find.text('Təpik sayı'), findsOneWidget);
  });

  screenTest('exporting needs Premium', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'flow'});
    await pumpScreen(tester, DoctorReportScreen(onBack: () {}), env, size: wide);
    await tester.pump();
    await tester.tap(find.text('PDF yüklə'));
    await tester.pump();
    expect(env.paywalls, ['doctor_report']);
  });

  screenTest('a Premium export renders the assembled report and delivers the file', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'flow'}, isPremium: true);
    final renderer = FakeRenderer();
    final delivery = FakeDelivery();
    await pumpApp(
      tester,
      DoctorReportScreen(onBack: () {}),
      overrides: [...env.overrides, doctorReportPdfRendererProvider.overrideWithValue(renderer), pdfDeliveryPlatformProvider.overrideWithValue(delivery)],
      scroll: false,
      size: wide,
    );
    await tester.pump();
    await tester.pump();
    await tester.tap(find.text('PDF yüklə'));
    await tester.pump();
    await tester.pump();
    expect(renderer.rendered.single.periodLabel, '1 Ay');
    expect(delivery.saved.single, startsWith('anacan-hesabat-'));
    expect(find.text('PDF yükləndi'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
  });

  screenTest('without the pdf package the export shows the error toast', (tester) async {
    final env = HealthEnv(user: {'lifeStage': 'flow'}, isPremium: true);
    await pumpScreen(tester, DoctorReportScreen(onBack: () {}), env, size: wide);
    await tester.pump();
    await tester.tap(find.text('Paylaş / e-poçt'));
    await tester.pump();
    await tester.pump();
    expect(find.text('PDF yaradıla bilmədi'), findsOneWidget);
    await tester.pump(const Duration(seconds: 6));
  });
}
