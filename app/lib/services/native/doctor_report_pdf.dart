// Ported from: src/lib/pdfReport.ts (generateDoctorReportPdf: A4 in mm, Noto Sans / Noto Naskh Arabic registered in
//              every document, running header, numbered section headings drawn only with their first block,
//              two-column cards, clinician flag box, paginated tables with repeated headers, footer + "n / N" on every
//              page, RTL layout)
//
// [DoctorReportPdfRenderer] on the `pdf` package. The layout is computed in millimetres exactly as the jsPDF code
// does (same measure / wrap / ensureSpace logic) and every page is drawn as absolutely positioned boxes and single
// text lines. Differences: Arabic shaping and bidi come from the pdf package instead of `doc.processArabic`; glyphs
// missing from both Noto fonts (emoji) are dropped instead of rasterised through a canvas (the WebView-only path).
import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart' show DateFormat, NumberFormat;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/i18n/app_languages.dart' show appLanguage, isRtlLang;
import '../../core/i18n/tr.dart';
import '../../features/health_screens/doctor_report/pdf_report.dart';

typedef _Rgb = (int, int, int);

const _Rgb _ink = (31, 49, 62);
const _Rgb _muted = (91, 107, 119);
const _Rgb _accent = (188, 94, 70);
const _Rgb _soft = (246, 248, 250);
const _Rgb _line = (221, 228, 234);
const _Rgb _alert = (158, 32, 32);
const _Rgb _alertBg = (253, 236, 236);
const _Rgb _white = (255, 255, 255);
const _Rgb _badge = (252, 239, 234);

/// One point in millimetres (jsPDF font sizes are points, positions millimetres).
const double _pt = 25.4 / 72;
final RegExp _arabic = RegExp('[\u0600-\u06ff\u0750-\u077f]');

String _clean(String? value) => (value ?? '—')
    .replaceAll(RegExp(r'\r\n?'), '\n')
    .replaceAll('\t', '    ')
    .replaceAll(RegExp('[\u0000-\u0008\u000b\u000c\u000e-\u001f]'), '');

enum _Weight { normal, bold }

enum _Align { left, center, right }

/// The four report fonts (public/fonts, bundled as assets/fonts/recap).
class DoctorReportFonts {
  const DoctorReportFonts({required this.sans, required this.sansBold, required this.arabic, required this.arabicBold});
  final ByteData sans;
  final ByteData sansBold;
  final ByteData arabic;
  final ByteData arabicBold;

  static Future<DoctorReportFonts> load() async {
    final data = <ByteData>[];
    for (final file in const ['NotoSans-Regular', 'NotoSans-Bold', 'NotoNaskhArabic-Regular', 'NotoNaskhArabic-Bold']) {
      data.add(await rootBundle.load('assets/fonts/recap/$file.ttf'));
    }
    for (final d in data) {
      // A TrueType file starts with 0x00010000 (REPORT_FONT_INVALID otherwise).
      if (d.lengthInBytes < 100 || d.getUint8(0) != 0 || d.getUint8(1) != 1) throw StateError('REPORT_FONT_INVALID');
    }
    return DoctorReportFonts(sans: data[0], sansBold: data[1], arabic: data[2], arabicBold: data[3]);
  }
}

/// The built document: bytes and page count (`doc.getNumberOfPages()`).
class DoctorReportPdf {
  const DoctorReportPdf(this.bytes, this.pages);
  final Uint8List bytes;
  final int pages;
}

class PdfPackageDoctorReportRenderer implements DoctorReportPdfRenderer {
  PdfPackageDoctorReportRenderer({Future<DoctorReportFonts> Function()? fonts, String Function()? language})
      : _fonts = fonts ?? DoctorReportFonts.load,
        _language = language ?? currentLanguage;
  final Future<DoctorReportFonts> Function() _fonts;
  final String Function() _language;

  @override
  Future<Uint8List> render(DoctorReportData data) async => (await build(data)).bytes;

  Future<DoctorReportPdf> build(DoctorReportData data) async {
    final fonts = await _fonts();
    final language = _language();
    final layout = _Layout(data, fonts, language);
    await layout.run();
    return await layout.finish();
  }
}

class _Run {
  _Run(this.text, this.arabic);
  String text;
  final bool arabic;
}

class _Layout {
  _Layout(this.data, DoctorReportFonts fonts, this.language)
      : rtl = isRtlLang(language),
        _sans = pw.Font.ttf(fonts.sans),
        _sansBold = pw.Font.ttf(fonts.sansBold),
        _arabicFont = pw.Font.ttf(fonts.arabic),
        _arabicBold = pw.Font.ttf(fonts.arabicBold) {
    // Metrics only (the drawing document registers its own copies of the fonts).
    final scratch = PdfDocument();
    _mSans = PdfTtfFont(scratch, fonts.sans);
    _mSansBold = PdfTtfFont(scratch, fonts.sansBold);
    _mArabic = PdfTtfFont(scratch, fonts.arabic);
    _mArabicBold = PdfTtfFont(scratch, fonts.arabicBold);
    arabic = rtl || _arabic.hasMatch(_dataText(data));
  }

  final DoctorReportData data;
  final String language;
  final bool rtl;
  late final bool arabic;
  final pw.Font _sans, _sansBold, _arabicFont, _arabicBold;
  late final PdfTtfFont _mSans, _mSansBold, _mArabic, _mArabicBold;

  static const double pageW = 210, pageH = 297, margin = 16, width = pageW - margin * 2, bottom = 276;
  final List<List<pw.Widget>> _pages = [[]];
  List<pw.Widget>? _target;
  List<pw.Widget> get _page => _target ?? _pages.last;
  double y = 0;
  int sectionNumber = 0;
  ({List<String> lines, int number})? pendingSection;
  final Map<String, double> _measureCache = {};
  late final String title = tr('pdf_report_subtitle', 'Həkim Hesabatı');

  static String _dataText(DoctorReportData d) => [
        d.userName, d.stageTitle, d.periodLabel, d.dateRangeLabel, d.notes,
        for (final r in d.stageRows) ...[r.label, r.value],
        for (final t in d.trends) ...[t.label, t.value, t.trend],
        for (final b in d.bpRows ?? const <ReportBpRow>[]) ...[b.date, b.reading, b.category, b.pulse],
        for (final r in [...?d.babyCareRows, ...?d.fetalGrowthRows]) ...[r.label, r.value],
        for (final t in d.historyTables ?? const <ReportTable>[]) ...[t.title, ...t.headers, for (final row in t.rows) ...row],
        for (final s in d.sections ?? const <ReportSection>[]) ...[
          s.title, s.flag, s.note,
          for (final r in s.rows ?? const <ReportRow>[]) ...[r.label, r.value],
          ...?s.table?.headers,
          for (final row in s.table?.rows ?? const <List<String>>[]) ...row,
        ],
      ].whereType<String>().join('\n');

  double lineHeight(double size) => size * _pt * 1.4;

  List<_Run> runs(String value) {
    if (!arabic || !_arabic.hasMatch(value)) return [_Run(value, false)];
    final result = <_Run>[];
    for (final rune in value.runes) {
      final char = String.fromCharCode(rune);
      final isArabic = _arabic.hasMatch(char);
      final last = result.isEmpty ? null : result.last;
      if (last != null && (char == ' ' || last.arabic == isArabic)) {
        last.text += char;
      } else {
        result.add(_Run(char, isArabic));
      }
    }
    return result;
  }

  PdfTtfFont _metrics(bool arabicRun, _Weight weight) => arabicRun
      ? (weight == _Weight.bold ? _mArabicBold : _mArabic)
      : (weight == _Weight.bold ? _mSansBold : _mSans);

  /// Width in mm.
  double measure(String value, double size, [_Weight weight = _Weight.normal]) {
    final key = '${weight.name}:$size:$value';
    final cached = _measureCache[key];
    if (cached != null) return cached;
    var total = 0.0;
    for (final run in runs(value)) {
      total += _metrics(run.arabic, weight).stringMetrics(run.text).advanceWidth * size * _pt;
    }
    _measureCache[key] = total;
    return total;
  }

  static PdfColor _color(_Rgb c) => PdfColor(c.$1 / 255, c.$2 / 255, c.$3 / 255);
  static double _p(double mm) => mm / _pt;

  void write(String value, double x, double baseline,
      {double size = 10, _Weight weight = _Weight.normal, _Rgb color = _ink, _Align align = _Align.left}) {
    final text = _clean(value);
    if (text.isEmpty) return;
    final isArabicText = arabic && _arabic.hasMatch(text);
    final base = isArabicText
        ? (weight == _Weight.bold ? _arabicBold : _arabicFont)
        : (weight == _Weight.bold ? _sansBold : _sans);
    final fallback = isArabicText
        ? [weight == _Weight.bold ? _sansBold : _sans]
        : [if (arabic) weight == _Weight.bold ? _arabicBold : _arabicFont];
    final ascent = _metrics(isArabicText, weight).ascent * size * _pt;
    final widget = pw.Text(
      text,
      softWrap: false,
      maxLines: 1,
      textDirection: isArabicText ? pw.TextDirection.rtl : pw.TextDirection.ltr,
      style: pw.TextStyle(font: base, fontFallback: fallback, fontSize: size, color: _color(color), lineSpacing: 0),
    );
    final top = _p(baseline - ascent);
    switch (align) {
      case _Align.left:
        _page.add(pw.Positioned(left: _p(x), top: top, child: widget));
      case _Align.right:
        _page.add(pw.Positioned(right: _p(pageW - x), top: top, child: widget));
      case _Align.center:
        _page.add(pw.Positioned(left: _p(x - measure(text, size, weight) / 2), top: top, child: widget));
    }
  }

  void rect(double x, double top, double w, double h, _Rgb fill, {double radius = 0, _Rgb? stroke, double strokeWidth = 0}) {
    _page.add(pw.Positioned(
      left: _p(x),
      top: _p(top),
      child: pw.Container(
        width: _p(w),
        height: _p(h),
        decoration: pw.BoxDecoration(
          color: _color(fill),
          borderRadius: radius > 0 ? pw.BorderRadius.circular(_p(radius)) : null,
          border: stroke == null ? null : pw.Border.all(color: _color(stroke), width: _p(strokeWidth)),
        ),
      ),
    ));
  }

  void hLine(double x1, double x2, double at, _Rgb color, double lineWidth) =>
      rect(x1, at - lineWidth / 2, x2 - x1, lineWidth, color);

  List<String> wrap(String value, double maxWidth, double size, [_Weight weight = _Weight.normal]) {
    final lines = <String>[];
    for (final paragraph in _clean(value).split('\n')) {
      var line = '';
      for (final word in _splitKeepingSpaces(paragraph)) {
        if (measure(line + word, size, weight) <= maxWidth) {
          line += word;
          continue;
        }
        if (line.trim().isNotEmpty) {
          lines.add(line.trimRight());
          line = '';
        }
        for (final rune in word.trimLeft().runes) {
          final char = String.fromCharCode(rune);
          if (line.isNotEmpty && measure(line + char, size, weight) > maxWidth) {
            lines.add(line);
            line = '';
          }
          line += char;
        }
      }
      lines.add(line.trimRight());
    }
    return lines;
  }

  /// `paragraph.split(/(\s+)/)`.
  static List<String> _splitKeepingSpaces(String s) {
    final parts = <String>[];
    var last = 0;
    for (final m in RegExp(r'\s+').allMatches(s)) {
      parts.add(s.substring(last, m.start));
      parts.add(m.group(0)!);
      last = m.end;
    }
    parts.add(s.substring(last));
    return parts;
  }

  double get _startX => rtl ? pageW - margin : margin;
  _Align get _startAlign => rtl ? _Align.right : _Align.left;

  void paragraph(String text, [double size = 10, _Rgb color = _ink]) {
    for (final line in wrap(text, width, size)) {
      ensureSpace(lineHeight(size));
      write(line, _startX, y + size * _pt, size: size, color: color, align: _startAlign);
      y += lineHeight(size);
    }
  }

  void alertBox(String text) {
    const size = 10.0;
    final lines = wrap(text, width - 12, size, _Weight.bold);
    final height = lines.length * lineHeight(size) + 8;
    ensureSpace(height + 4);
    rect(margin, y, width, height, _alertBg, radius: 2, stroke: _alert, strokeWidth: 0.5);
    for (var n = 0; n < lines.length; n++) {
      write(lines[n], rtl ? pageW - margin - 6 : margin + 6, y + 4 + size * _pt + n * lineHeight(size),
          size: size, weight: _Weight.bold, color: _alert, align: _startAlign);
    }
    y += height + 4;
  }

  void addPage() => _pages.add([]);

  void runningHeader() {
    rect(0, 0, pageW, 2, _ink);
    write('Anacan', _startX, 13, size: 12, weight: _Weight.bold, align: _startAlign);
    write(title, rtl ? margin : pageW - margin, 13, size: 9, color: _muted, align: rtl ? _Align.left : _Align.right);
    hLine(margin, pageW - margin, 18, _line, 0.25);
    y = 25;
  }

  void ensureSpace(double needed) {
    final pending = pendingSection;
    final headingHeight = pending != null ? 10 + _max(8, pending.lines.length * lineHeight(11.5)) : 0;
    if (y + needed + headingHeight > bottom) {
      addPage();
      runningHeader();
    }
    if (pending != null) {
      pendingSection = null;
      y += 4;
      final badgeX = rtl ? pageW - margin - 10 : margin;
      rect(badgeX, y, 10, 8, _badge, radius: 2);
      write('${pending.number}'.padLeft(2, '0'), badgeX + 5, y + 5.5, size: 8.5, weight: _Weight.bold, color: _accent, align: _Align.center);
      for (var i = 0; i < pending.lines.length; i++) {
        write(pending.lines[i], rtl ? pageW - margin - 15 : margin + 15, y + 5.5 + i * lineHeight(11.5),
            size: 11.5, weight: _Weight.bold, align: _startAlign);
      }
      y += _max(8, pending.lines.length * lineHeight(11.5)) + 6;
    }
  }

  static double _max(double a, double b) => a > b ? a : b;

  void section(String text) => pendingSection = (lines: wrap(text, width - 16, 11.5, _Weight.bold), number: ++sectionNumber);

  void cards(List<ReportRow> rows) {
    const gap = 6.0;
    const cellWidth = (width - gap) / 2;
    for (var index = 0; index < rows.length; index += 2) {
      final slice = rows.sublist(index, index + 2 > rows.length ? rows.length : index + 2);
      final pair = [for (final row in slice) (label: wrap(row.label, cellWidth - 12, 8.5), value: wrap(row.value, cellWidth - 12, 11, _Weight.bold))];
      final height = pair.map((r) => 12 + r.label.length * lineHeight(8.5) + r.value.length * lineHeight(11)).reduce(_max);
      if (height > bottom - 30) {
        for (final row in slice) {
          paragraph('${row.label}:', 9, _muted);
          paragraph(row.value, 10);
          y += 4;
        }
        continue;
      }
      ensureSpace(height + 5);
      for (var col = 0; col < pair.length; col++) {
        final row = pair[col];
        final x = margin + (rtl ? 1 - col : col) * (cellWidth + gap);
        rect(x, y, cellWidth, height, _soft, radius: 2.5);
        final anchor = rtl ? x + cellWidth - 6 : x + 6;
        for (var n = 0; n < row.label.length; n++) {
          write(row.label[n], anchor, y + 7 + n * lineHeight(8.5), size: 8.5, color: _muted, align: _startAlign);
        }
        final valueY = y + 10 + row.label.length * lineHeight(8.5);
        for (var n = 0; n < row.value.length; n++) {
          write(row.value[n], anchor, valueY + n * lineHeight(11), size: 11, weight: _Weight.bold, align: _startAlign);
        }
      }
      y += height + 5;
    }
  }

  void table(List<String> headers, List<List<String>> rows, [List<double>? fractions]) {
    final proportions = fractions ?? [for (final _ in headers) 1.0];
    final sum = proportions.fold<double>(0, (n, v) => n + v);
    final widths = [for (final v in proportions) width * v / sum];
    double widthsUpTo(int count) => widths.take(count).fold<double>(0, (n, v) => n + v);
    double cellX(int col) => rtl ? pageW - margin - widthsUpTo(col + 1) : margin + widthsUpTo(col);
    final headerLines = [for (var i = 0; i < headers.length; i++) wrap(headers[i], widths[i] - 8, 8.5, _Weight.bold)];
    final headerHeight = headerLines.map((l) => l.length).reduce((a, b) => a > b ? a : b) * lineHeight(8.5) + 6;
    void drawHeader() {
      ensureSpace(headerHeight + 10);
      rect(margin, y, width, headerHeight, _ink, radius: 1.5);
      for (var i = 0; i < headerLines.length; i++) {
        for (var n = 0; n < headerLines[i].length; n++) {
          write(headerLines[i][n], rtl ? cellX(i) + widths[i] - 4 : cellX(i) + 4, y + 5 + n * lineHeight(8.5),
              size: 8.5, weight: _Weight.bold, color: _white, align: _startAlign);
        }
      }
      y += headerHeight;
    }

    drawHeader();
    for (var rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      final row = rows[rowIndex];
      final lines = [for (var i = 0; i < headers.length; i++) wrap(i < row.length ? row[i] : '—', widths[i] - 8, 9)];
      final count = lines.map((l) => l.length).reduce((a, b) => a > b ? a : b);
      var offset = 0;
      while (offset < count) {
        if (y + lineHeight(9) + 7 > bottom) {
          addPage();
          runningHeader();
          drawHeader();
        }
        final fit = ((bottom - y - 7) / lineHeight(9)).floor();
        final take = (count - offset) < (fit < 1 ? 1 : fit) ? count - offset : (fit < 1 ? 1 : fit);
        final height = take * lineHeight(9) + 7;
        if (rowIndex % 2 == 0) rect(margin, y, width, height, _soft);
        for (var i = 0; i < lines.length; i++) {
          final column = lines[i];
          final end = offset + take > column.length ? column.length : offset + take;
          for (var n = offset; n < end; n++) {
            write(column[n], rtl ? cellX(i) + widths[i] - 4 : cellX(i) + 4, y + 5 + (n - offset) * lineHeight(9),
                size: 9, weight: i == 1 ? _Weight.bold : _Weight.normal, align: _startAlign);
          }
        }
        hLine(margin, pageW - margin, y + height, _line, 0.15);
        y += height;
        offset += take;
      }
    }
    y += 5;
  }

  String _weight(double value) {
    try {
      return NumberFormat.decimalPatternDigits(locale: appLanguage(language).intlLocale, decimalDigits: 1).format(value);
    } catch (_) {
      return value.toStringAsFixed(1);
    }
  }

  Future<void> run() async {
    final createdAt = data.generatedAt ?? DateTime.now();
    // Cover / patient identification.
    rect(0, 0, pageW, 3, _accent);
    write('Anacan', _startX, 17, size: 18, weight: _Weight.bold, align: _startAlign);
    write(tr('pdf_health_record', 'SAĞLAMLIQ HESABATI'), _startX, 24, size: 8.5, weight: _Weight.bold, color: _muted, align: _startAlign);
    final end = rtl ? margin : pageW - margin;
    final endAlign = rtl ? _Align.left : _Align.right;
    write(DateFormat('dd.MM.yyyy').format(createdAt), end, 16, size: 9, color: _muted, align: endAlign);
    write(data.periodLabel, end, 23, size: 9, weight: _Weight.bold, color: _accent, align: endAlign);
    y = 36;
    for (final line in wrap(data.userName, width - 14, 17, _Weight.bold)) {
      ensureSpace(9);
      write(line, _startX, y, size: 17, weight: _Weight.bold, align: _startAlign);
      y += lineHeight(17);
    }
    paragraph(data.stageTitle, 10, _muted);
    if (data.dateRangeLabel != null && data.dateRangeLabel!.isNotEmpty) paragraph(data.dateRangeLabel!, 9, _muted);
    y += 4;
    final coverage = data.coverage;
    if (coverage != null) {
      cards([
        ReportRow(tr('pdf_record_count', 'Hesabata daxil olan qeydlər'), '${coverage.records}'),
        ReportRow(tr('pdf_recorded_days', 'Qeyd aparılmış günlər'), '${coverage.recordedDays}'),
      ]);
    }
    if (data.stageRows.isNotEmpty) {
      section(tr('pdf_section_basics', 'Cari məlumatlar'));
      cards(data.stageRows);
    }
    if (data.trends.isNotEmpty) {
      await Future<void>.delayed(Duration.zero);
      section(tr('pdf_section_trends', 'Sağlamlıq göstəriciləri'));
      table([tr('pdf_metric', 'Göstərici'), tr('pdf_value', 'Nəticə'), tr('pdf_coverage_change', 'Əhatə / dəyişiklik')],
          [for (final t in data.trends) [t.label, t.value, t.trend]], const [1.1, 1, 1.2]);
    }
    final weights = data.weightSeries;
    if (weights != null && weights.isNotEmpty) {
      await Future<void>.delayed(Duration.zero);
      section(tr('pdf_weight_history', 'Çəki qeydləri'));
      table([tr('pdf_date', 'Tarix'), tr('pdf_weight_kg', 'Çəki (kq)')], [for (final w in weights) [w.date, _weight(w.weight)]], const [1, 1]);
    }
    final babyCare = data.babyCareRows;
    if (babyCare != null && babyCare.isNotEmpty) {
      await Future<void>.delayed(Duration.zero);
      section(tr('pdf_section_babycare', 'Körpə qulluğu'));
      paragraph(
          tr('pdf_logged_days_note',
              'Ortalamalar yalnız müvafiq qeydin olduğu günlərə əsaslanır. Davam edən yuxu intervalları yuxu müddətinə daxil edilmir.'),
          8.5,
          _muted);
      y += 4;
      cards(babyCare);
    }
    final fetal = data.fetalGrowthRows;
    if (fetal != null && fetal.isNotEmpty) {
      await Future<void>.delayed(Duration.zero);
      section(tr('pdf_section_fetalgrowth', 'Fetal böyümə'));
      cards(fetal);
    }
    final bp = data.bpRows;
    if (bp != null && bp.isNotEmpty) {
      await Future<void>.delayed(Duration.zero);
      section(tr('pdf_section_bp_period', 'Dövr üzrə qan təzyiqi'));
      table(
        [tr('pdf_date_time', 'Tarix / saat'), tr('pdf_bp_mmhg', 'Təzyiq (mmHg)'), tr('pdf_pulse', 'Nəbz'), tr('pdf_reading_range', 'Ölçmə aralığı')],
        [for (final r in bp) [r.date, r.reading, r.pulse == null || r.pulse!.isEmpty ? '—' : r.pulse!, r.category]],
        const [1.15, 1, 0.55, 1.5],
      );
    }
    for (final item in data.sections ?? const <ReportSection>[]) {
      final hasRows = item.rows?.isNotEmpty ?? false;
      final hasTable = item.table?.rows.isNotEmpty ?? false;
      final flag = item.flag;
      if ((flag == null || flag.isEmpty) && !hasRows && !hasTable) continue;
      await Future<void>.delayed(Duration.zero);
      section(item.title);
      if (flag != null && flag.isNotEmpty) alertBox(flag);
      if (hasRows) cards(item.rows!);
      final note = item.note;
      if (note != null && note.isNotEmpty) {
        paragraph(note, 8.5, _muted);
        y += 3;
      }
      if (hasTable) table(item.table!.headers, item.table!.rows, item.table!.widths);
    }
    for (final history in data.historyTables ?? const <ReportTable>[]) {
      if (history.rows.isEmpty) continue;
      await Future<void>.delayed(Duration.zero);
      section(history.title);
      table(history.headers, history.rows, history.widths);
    }
    final notes = data.notes?.trim() ?? '';
    if (notes.isNotEmpty) {
      section(tr('pdf_section_notes', 'Həkim üçün qeydlər'));
      paragraph(notes, 10);
      y += 5;
    }
    if (coverage?.records == 0 && (data.sections?.isEmpty ?? true)) {
      section(tr('pdf_no_observations', 'Müşahidələr'));
      paragraph(tr('pdf_no_records_period', 'Seçilmiş dövr üçün sağlamlıq qeydi yoxdur.'), 10, _muted);
    }
  }

  Future<DoctorReportPdf> finish() async {
    final count = _pages.length;
    final footer = wrap(tr('pdf_footer', 'Anacan tətbiqi ilə yaradılıb · Bu hesabat tibbi sənəd deyil, məlumat xarakterlidir.'), width - 20, 7);
    final doc = pw.Document(
      compress: true,
      title: '$title — ${data.userName}',
      author: 'Anacan',
      creator: 'Anacan',
      subject: data.periodLabel,
    );
    for (var page = 0; page < count; page++) {
      // doc.setPage(page): the footer joins that page's items.
      _target = _pages[page];
      hLine(margin, pageW - margin, pageH - 15, _line, 0.2);
      for (var i = 0; i < footer.length; i++) {
        write(footer[i], _startX, pageH - 11 + i * lineHeight(7), size: 7, color: _muted, align: _startAlign);
      }
      write('${page + 1} / $count', rtl ? margin : pageW - margin, pageH - 11,
          size: 8, weight: _Weight.bold, color: _muted, align: rtl ? _Align.left : _Align.right);
      final items = _pages[page];
      doc.addPage(pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: pw.EdgeInsets.zero,
        build: (_) => pw.SizedBox(width: _p(pageW), height: _p(pageH), child: pw.Stack(children: items)),
      ));
    }
    _target = null;
    return DoctorReportPdf(await doc.save(), count);
  }
}
