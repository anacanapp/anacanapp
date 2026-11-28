// Ported from: src/lib/pdfReport.test.ts
//
// 'doctor PDF generation' runs against the `pdf` package renderer (services/native/doctor_report_pdf.dart; the
// fonts are the bundled public/fonts files), plus the contract of the web default. 'PDF delivery' is ported against
// a fake [PdfDeliveryPlatform].
import 'dart:typed_data';

import 'package:anacan/features/health_screens/doctor_report/pdf_report.dart';
import 'package:anacan/services/native/doctor_report_pdf.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pdf/pdf.dart' show TtfParser;

class FakeDelivery implements PdfDeliveryPlatform {
  FakeDelivery({this.native = false});
  bool native;
  List<CachedPdfFile> files = const [];
  Object? shareError;
  final List<String> deleted = [];
  final List<String> written = [];
  final List<({String title, List<String> files, String dialogTitle})> shared = [];
  final List<String> saved = [];

  @override
  bool get canShareFiles => native;
  @override
  Future<List<CachedPdfFile>> listCache(String folder) async => files;
  @override
  Future<void> deleteCache(String path) async => deleted.add(path);
  @override
  Future<String> writeCache(String path, Uint8List bytes) async {
    written.add(path);
    return 'file://cache/report.pdf';
  }

  @override
  Future<void> share({required String title, required List<String> files, required String dialogTitle}) async {
    if (shareError != null) throw shareError!;
    shared.add((title: title, files: files, dialogTitle: dialogTitle));
  }

  @override
  Future<void> saveDownload(String fileName, Uint8List bytes) async => saved.add(fileName);
}

final Uint8List pdf = Uint8List.fromList('fake'.codeUnits);

void main() {
  group('doctor PDF generation', () {
    TestWidgetsFlutterBinding.ensureInitialized();
    var fontLoads = 0;
    PdfPackageDoctorReportRenderer renderer() => PdfPackageDoctorReportRenderer(
          language: () => 'az',
          fonts: () {
            fontLoads++;
            return DoctorReportFonts.load();
          },
        );

    test('registers Unicode font bytes in every document, including repeated exports', () async {
      const data = DoctorReportData(userName: 'Əsmər Əliyeva — Şəfəq', stageTitle: 'Hamiləlik', periodLabel: '1 ay', stageRows: [], trends: []);
      fontLoads = 0;
      final first = await renderer().build(data);
      final second = await renderer().build(data);
      final fonts = await DoctorReportFonts.load();
      expect(TtfParser(fonts.sans).fontName, contains('NotoSans'));
      expect(TtfParser(fonts.sans).charToGlyphIndexMap['Ə'.codeUnitAt(0)], greaterThan(0));
      for (final doc in [first, second]) {
        expect(doc.bytes.length, greaterThan(10000));
        expect(String.fromCharCodes(doc.bytes.sublist(0, 5)), '%PDF-');
      }
      expect(fontLoads, 2);
    });

    test('paginates long notes and large reading tables instead of dropping text off the page', () async {
      final doc = await renderer().build(DoctorReportData(
        userName: 'Test pasiyenti',
        stageTitle: 'Analıq',
        periodLabel: 'Hamısı',
        stageRows: [ReportRow('Uzun məlumat', 'Məlumat ' * 60)],
        trends: const [],
        bpRows: [for (var n = 0; n < 100; n++) ReportBpRow(date: '15.09.2026 $n', reading: '120/80', pulse: '72', category: 'Normal')],
        notes: [for (var n = 0; n < 150; n++) 'Qeyd $n: Həkim üçün tam saxlanmalı olan müşahidə.'].join('\n'),
      ));
      expect(doc.pages, greaterThan(5));
    });

    test('renders clinical sections with a clinician flag, cards, note and table', () async {
      const base = (userName: 'Test', stageTitle: 'Analıq', periodLabel: '1 ay', coverage: ReportCoverage(records: 0, recordedDays: 0));
      final sections = [
        const ReportSection(
          id: 'epds',
          title: 'EPDS',
          flag: 'Diqqət: 10-cu sual 0-dan yuxarı: 05.11.2026 (1/3).',
          note: 'Skrininq.',
          table: ReportTable(headers: ['Tarix', 'Bal', 'Risk', 'Sual 10'], rows: [['05.11.2026', '14 / 30', 'Ehtimal', '1 (!)']]),
        ),
        ReportSection(
          id: 'growth',
          title: 'Böyümə',
          rows: const [ReportRow('Çəki persentili', 'P40 · 7 kq')],
          table: ReportTable(headers: const ['Tarix', 'Çəki'], rows: [for (var n = 0; n < 60; n++) ['0$n.11.2026', '7']]),
        ),
      ];
      final doc = await renderer().build(DoctorReportData(
          userName: base.userName, stageTitle: base.stageTitle, periodLabel: base.periodLabel, coverage: base.coverage,
          stageRows: const [], trends: const [], sections: sections));
      expect(doc.pages, greaterThan(1));
      expect(doc.bytes.length, greaterThan(10000));
      // An empty section is skipped instead of printing a bare heading.
      final empty = await renderer().build(DoctorReportData(
        userName: base.userName,
        stageTitle: base.stageTitle,
        periodLabel: base.periodLabel,
        coverage: base.coverage,
        stageRows: const [],
        trends: const [],
        sections: const [ReportSection(id: 'kicks', title: 'Təpik', table: ReportTable(headers: ['a'], rows: []))],
      ));
      expect(empty.pages, 1);
    });

    test('the default renderer reports that PDF is unavailable', () async {
      const data = DoctorReportData(userName: 'A', stageTitle: 'B', periodLabel: '1 ay', stageRows: [], trends: []);
      await expectLater(const UnsupportedDoctorReportPdfRenderer().render(data), throwsUnsupportedError);
    });
  });

  group('PDF delivery', () {
    test('downloads an actual PDF when file sharing is unavailable', () async {
      final platform = FakeDelivery();
      expect(await deliverPdf(platform, pdf, 'report.pdf', 'download'), 'downloaded');
      expect(platform.saved, ['report.pdf']);
    });

    test('shares a native cached PDF URI and keeps recent files available to the receiving app', () async {
      final now = DateTime(2026, 11, 8, 12);
      final platform = FakeDelivery(native: true)
        ..files = [
          CachedPdfFile(name: 'old.pdf', mtime: now.millisecondsSinceEpoch - 4 * 86400000),
          CachedPdfFile(name: 'recent.pdf', mtime: now.millisecondsSinceEpoch),
        ];
      expect(await deliverPdf(platform, pdf, 'report.pdf', 'share', now: now), 'shared');
      expect(platform.shared.single.files, ['file://cache/report.pdf']);
      expect(platform.written, ['doctor-reports/${now.millisecondsSinceEpoch}-report.pdf']);
      expect(platform.deleted, ['doctor-reports/old.pdf']);
    });

    test('does not report sharing success or trigger a download when the user cancels', () async {
      final platform = FakeDelivery(native: true)..shareError = const PdfShareCancelled();
      expect(await deliverPdf(platform, pdf, 'report.pdf', 'share'), 'cancelled');
      expect(platform.saved, isEmpty);
    });

    test('keeps only safe file name characters', () async {
      final platform = FakeDelivery();
      await deliverPdf(platform, pdf, 'anacan hesabat/ə.pdf', 'download');
      expect(platform.saved, ['anacan-hesabat--.pdf']);
    });
  });
}
