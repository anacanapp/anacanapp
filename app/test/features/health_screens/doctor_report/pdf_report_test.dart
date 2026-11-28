// Ported from: src/lib/pdfReport.test.ts
//
// 'doctor PDF generation' draws with jsPDF in React; the Flutter renderer needs the `pdf` package (not a
// dependency yet), so those three cases are kept with their names and skipped, plus the default renderer's
// contract. 'PDF delivery' is ported against a fake [PdfDeliveryPlatform].
import 'dart:typed_data';

import 'package:anacan/features/health_screens/doctor_report/pdf_report.dart';
import 'package:flutter_test/flutter_test.dart';

const String _noPdfPackage = 'needs the `pdf` package (generateDoctorReportPdf is behind DoctorReportPdfRenderer)';

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
    test('registers Unicode font bytes in every document, including repeated exports', () {}, skip: _noPdfPackage);
    test('paginates long notes and large reading tables instead of dropping text off the page', () {}, skip: _noPdfPackage);
    test('renders clinical sections with a clinician flag, cards, note and table', () {}, skip: _noPdfPackage);

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
