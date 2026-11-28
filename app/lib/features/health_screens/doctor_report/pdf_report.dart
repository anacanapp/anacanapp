// Ported from: src/lib/pdfReport.ts (DoctorReportData and its parts, deliverPdf; generateDoctorReportPdf is behind
//              [DoctorReportPdfRenderer])
//
// The report content is assembled in Dart (doctor_report.dart, doctor_report_extras.dart, illness_report.dart).
// Drawing the PDF (jsPDF in React: A4, Noto Sans / Noto Naskh Arabic, cards, paginated tables, footer on every
// page) needs the `pdf` package, which is not a dependency yet: [doctorReportPdfRendererProvider] defaults to
// "unsupported", so exporting shows React's error toast. Delivery (cache folder, pruning, share sheet, cancel)
// is ported here against [PdfDeliveryPlatform] (`share_plus` + `path_provider` in the app root, phase 9).
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/tr.dart';

@immutable
class ReportRow {
  const ReportRow(this.label, this.value);
  final String label;
  final String value;

  @override
  bool operator ==(Object other) => other is ReportRow && other.label == label && other.value == value;
  @override
  int get hashCode => Object.hash(label, value);
  @override
  String toString() => '{label: $label, value: $value}';
}

/// `ReportTable` (a section's table has no title: `Omit<ReportTable, 'title'>`).
@immutable
class ReportTable {
  const ReportTable({this.title = '', required this.headers, required this.rows, this.widths});
  final String title;
  final List<String> headers;
  final List<List<String>> rows;
  final List<double>? widths;
}

/// A clinical section (blood sugar, kicks, contractions, EPDS, vaccines, growth). Omitted when it has no data.
@immutable
class ReportSection {
  const ReportSection({required this.id, required this.title, this.flag, this.rows, this.note, this.table});
  final String id;
  final String title;
  final String? flag;
  final List<ReportRow>? rows;
  final String? note;
  final ReportTable? table;
}

@immutable
class ReportTrend {
  const ReportTrend({required this.label, required this.value, required this.trend});
  final String label;
  final String value;
  final String trend;
}

@immutable
class ReportBpRow {
  const ReportBpRow({required this.date, required this.reading, required this.category, this.pulse});
  final String date;
  final String reading;
  final String category;
  final String? pulse;
}

@immutable
class ReportWeightPoint {
  const ReportWeightPoint({required this.date, required this.weight});
  final String date;
  final double weight;
}

@immutable
class ReportCoverage {
  const ReportCoverage({required this.records, required this.recordedDays});
  final int records;
  final int recordedDays;
}

@immutable
class DoctorReportData {
  const DoctorReportData({
    required this.userName,
    required this.stageTitle,
    required this.periodLabel,
    this.dateRangeLabel,
    this.generatedAt,
    required this.stageRows,
    required this.trends,
    this.bpRows,
    this.babyCareRows,
    this.fetalGrowthRows,
    this.historyTables,
    this.sections,
    this.weightSeries,
    this.coverage,
    this.notes,
  });
  final String userName;
  final String stageTitle;
  final String periodLabel;
  final String? dateRangeLabel;
  final DateTime? generatedAt;
  final List<ReportRow> stageRows;
  final List<ReportTrend> trends;
  final List<ReportBpRow>? bpRows;
  final List<ReportRow>? babyCareRows;
  final List<ReportRow>? fetalGrowthRows;
  final List<ReportTable>? historyTables;
  final List<ReportSection>? sections;
  final List<ReportWeightPoint>? weightSeries;
  final ReportCoverage? coverage;
  final String? notes;
}

/// `generateDoctorReportPdf(data)` → PDF bytes.
abstract interface class DoctorReportPdfRenderer {
  Future<Uint8List> render(DoctorReportData data);
}

class UnsupportedDoctorReportPdfRenderer implements DoctorReportPdfRenderer {
  const UnsupportedDoctorReportPdfRenderer();
  @override
  Future<Uint8List> render(DoctorReportData data) async => throw UnsupportedError('REPORT_PDF_UNAVAILABLE');
}

/// Default: unsupported until the `pdf` package lands (phase 9).
final doctorReportPdfRendererProvider = Provider<DoctorReportPdfRenderer>((ref) => const UnsupportedDoctorReportPdfRenderer());

/// 'shared' | 'downloaded' | 'cancelled'.
typedef PdfDeliveryResult = String;

/// A file in the report cache folder.
@immutable
class CachedPdfFile {
  const CachedPdfFile({required this.name, required this.mtime});
  final String name;

  /// Epoch ms.
  final int mtime;
}

/// Thrown by [PdfDeliveryPlatform.share] when the user closes the share sheet.
class PdfShareCancelled implements Exception {
  const PdfShareCancelled();
  @override
  String toString() => 'Share canceled';
}

/// The native file/share side of `deliverPdf` (@capacitor/filesystem Cache + @capacitor/share).
abstract interface class PdfDeliveryPlatform {
  /// `Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')`.
  bool get canShareFiles;

  /// `Filesystem.readdir({ path, directory: Cache })`; throws when the folder does not exist.
  Future<List<CachedPdfFile>> listCache(String folder);

  /// `Filesystem.deleteFile({ path, directory: Cache })`.
  Future<void> deleteCache(String path);

  /// `Filesystem.writeFile({ path, directory: Cache, data, recursive: true })` → the file URI.
  Future<String> writeCache(String path, Uint8List bytes);

  /// `Share.share({ title, files, dialogTitle })`; throws [PdfShareCancelled] when cancelled.
  Future<void> share({required String title, required List<String> files, required String dialogTitle});

  /// The non-native branch: save the file (`doc.save(name)`).
  Future<void> saveDownload(String fileName, Uint8List bytes);
}

class UnsupportedPdfDeliveryPlatform implements PdfDeliveryPlatform {
  const UnsupportedPdfDeliveryPlatform();
  @override
  bool get canShareFiles => false;
  @override
  Future<List<CachedPdfFile>> listCache(String folder) async => const [];
  @override
  Future<void> deleteCache(String path) async {}
  @override
  Future<String> writeCache(String path, Uint8List bytes) async => throw UnsupportedError('REPORT_FILES_UNAVAILABLE');
  @override
  Future<void> share({required String title, required List<String> files, required String dialogTitle}) async =>
      throw UnsupportedError('REPORT_SHARE_UNAVAILABLE');
  @override
  Future<void> saveDownload(String fileName, Uint8List bytes) async => throw UnsupportedError('REPORT_SAVE_UNAVAILABLE');
}

final pdfDeliveryPlatformProvider = Provider<PdfDeliveryPlatform>((ref) => const UnsupportedPdfDeliveryPlatform());

bool _isCancelled(Object error) {
  if (error is PdfShareCancelled) return true;
  final text = error.toString();
  return text.contains('AbortError') || RegExp('share cancel(l)?ed', caseSensitive: false).hasMatch(text);
}

const String _reportFolder = 'doctor-reports';

/// `deliverPdf(doc, fileName, mode)`.
Future<PdfDeliveryResult> deliverPdf(PdfDeliveryPlatform platform, Uint8List bytes, String fileName, String mode, {DateTime? now}) async {
  final cleaned = fileName.replaceAll(RegExp('[^a-zA-Z0-9._-]'), '-');
  final safeName = cleaned.isEmpty ? 'anacan-report.pdf' : cleaned;
  if (platform.canShareFiles) {
    final at = (now ?? DateTime.now()).millisecondsSinceEpoch;
    // Keep recently shared URIs valid for receiving Android apps; prune only older cache files.
    try {
      final old = await platform.listCache(_reportFolder);
      await Future.wait([
        for (final file in old)
          if (file.name.endsWith('.pdf') && file.mtime < at - 3 * 86400000) platform.deleteCache('$_reportFolder/${file.name}'),
      ]);
    } catch (_) {
      // The report cache may not exist yet.
    }
    final uri = await platform.writeCache('$_reportFolder/$at-$safeName', bytes);
    try {
      await platform.share(title: safeName, files: [uri], dialogTitle: tr('pdf_share_title', 'Hesabatı paylaş / saxla'));
      return 'shared';
    } catch (error) {
      if (_isCancelled(error)) return 'cancelled';
      rethrow;
    }
  }
  await platform.saveDownload(safeName, bytes);
  return 'downloaded';
}
