// Ported from: src/components/mommy/GrowthTrackerWidget.tsx
//
// Development tracker card: weight / height tabs, SVG line chart (300×116 viewBox stretched to the 128px chart box
// with preserveAspectRatio="none"), stat tiles (head circumference under 12 months) and the quick-add form.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../baby/hooks/baby_services.dart';
import '../../baby/hooks/use_baby_records.dart';
import '../../baby/hooks/use_children.dart';
import '../../baby/locale_format.dart';
import 'mommy_ui.dart';

const double _w = 300, _h = 116, _pad = 10;

/// `buildPath(values, width, height, pad)` → points (viewBox units).
List<Offset> growthChartPoints(List<double> values, {double width = _w, double height = _h, double pad = _pad}) {
  final min = values.reduce((a, b) => a < b ? a : b);
  final max = values.reduce((a, b) => a > b ? a : b);
  final span = (max - min) == 0 ? 1 : max - min;
  final stepX = (width - pad * 2) / (values.length - 1);
  return [
    for (var i = 0; i < values.length; i++) Offset(pad + i * stepX, pad + (height - pad * 2) * (1 - (values[i] - min) / span)),
  ];
}

/// `formatAxisDate`: `new Date('YYYY-MM-DD')` (UTC midnight) shown with local getDate/getMonth.
String formatAxisDate(String dateStr) {
  final d = jsParseDate(dateStr)?.toLocal();
  if (d == null) return 'NaN.NaN';
  return '${pad2(d.day)}.${pad2(d.month)}';
}

/// `Number.prototype.toFixed(n)` for the change labels.
String toFixedN(double v, int n) => v.toStringAsFixed(n);

/// JS `String(number)` for a stored numeric column.
String numText(Object? v) => v is num ? jsNumberToString(v) : '$v';

class GrowthTrackerWidget extends ConsumerStatefulWidget {
  const GrowthTrackerWidget({super.key});

  @override
  ConsumerState<GrowthTrackerWidget> createState() => _GrowthTrackerWidgetState();
}

class _GrowthTrackerWidgetState extends ConsumerState<GrowthTrackerWidget> {
  String _metric = 'weight';
  bool _showInput = false;
  final _weight = TextEditingController();
  final _height = TextEditingController();
  final _head = TextEditingController();

  @override
  void dispose() {
    _weight.dispose();
    _height.dispose();
    _head.dispose();
    super.dispose();
  }

  double _parse(String s) => double.tryParse(s.trim().replaceAll(',', '.')) ?? double.nan;

  Future<void> _add(bool showHead) async {
    if (ref.read(authUserProvider) == null) return;
    final toast = AToastHost.of(context);
    final weight = _parse(_weight.text), height = _parse(_height.text), head = _parse(_head.text);
    if (weight.isNaN && height.isNaN) {
      toast.show(
        title: tr('growthtrackerwidget_melumat_daxil_edin_2ab80a', 'Məlumat daxil edin'),
        description: tr('growthtrackerwidget_ceki_ve_ya_boy_daxil_edin_10a689', 'Çəki və ya boy daxil edin'),
        destructive: true,
      );
      return;
    }
    await ref.read(babyCareServicesProvider).hapticMedium();
    try {
      await ref.read(babyGrowthActionsProvider).addEntry(
            weightKg: weight.isNaN ? null : weight,
            heightCm: height.isNaN ? null : height,
            headCm: showHead && !head.isNaN ? head : null,
          );
      _weight.clear();
      _height.clear();
      _head.clear();
      if (mounted) setState(() => _showInput = false);
      final kg = tr('growthtrackerwidget_unit_kg', 'kq'), cm = tr('growthtrackerwidget_unit_cm', 'sm');
      toast.show(
        title: tr('growthtrackerwidget_olcu_yadda_saxlandi_3c8d60', 'Ölçü yadda saxlandı! 📏'),
        description: '${weight.isNaN ? '' : '${jsNumberToString(weight)} $kg'} ${height.isNaN ? '' : '${jsNumberToString(height)} $cm'}',
      );
    } catch (_) {
      toast.show(title: tr('growthtrackerwidget_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appLanguageProvider);
    final selected = ref.watch(childrenProvider).selectedChild;
    final showHead = selected == null || getChildAge(selected).months < 12;
    final entries = ref.watch(babyGrowthQuery).data ?? const <Map<String, dynamic>>[];
    final latest = entries.isNotEmpty ? entries[0] : null;
    final previous = entries.length > 1 ? entries[1] : null;
    num n(Object? v) => v is num ? v : 0;
    final weightChange = latest != null && previous != null ? toFixedN((n(latest['weight_kg']) - n(previous['weight_kg'])).toDouble(), 2) : null;
    final heightChange = latest != null && previous != null ? toFixedN((n(latest['height_cm']) - n(previous['height_cm'])).toDouble(), 1) : null;

    final field = _metric == 'weight' ? 'weight_kg' : 'height_cm';
    final chartEntries = [for (final e in entries.reversed) if (e[field] != null) e];
    final values = [for (final e in chartEntries) (e[field] as num).toDouble()];
    final unit = _metric == 'weight' ? tr('growthtrackerwidget_unit_kg', 'kq') : tr('growthtrackerwidget_unit_cm', 'sm');
    final hasChart = values.length >= 2;
    final t = context.a;
    final x = context.aText;

    Widget change(String? value) {
      if (value == null) return const SizedBox.shrink();
      final v = double.parse(value);
      if (v == 0) return const SizedBox.shrink();
      final color = v > 0 ? t.green2 : t.pink2;
      return Row(mainAxisSize: MainAxisSize.min, children: [
        Transform.rotate(angle: v > 0 ? 0 : 3.141592653589793, child: AIcon(AIcons.trendingUp, size: 10, color: color)),
        const SizedBox(width: 3),
        // `overflow-wrap: break-word` on the label: long values wrap inside the narrow tile.
        Flexible(child: Text('${v > 0 ? '+' : ''}$value', style: AStatText.label(t).copyWith(color: color))),
      ]);
    }

    Widget tile(AIconData icon, String label, Object? value, String unitText, {String? delta}) => AStatTile(
          icon: icon,
          iconBg: t.peach1,
          iconFg: t.accentInk,
          lines: [
            Text(label, style: AStatText.label(t)),
            Text(value != null && value != 0 ? '${numText(value)} $unitText' : '—', style: AStatText.value(t).copyWith(fontSize: 13)),
            if (delta != null) change(delta),
          ],
        );

    Widget input(String label, TextEditingController c, String placeholder) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(label, style: AStatText.label(t))),
            AInput(controller: c, placeholder: placeholder, number: true, decimal: true),
          ],
        );

    return AFadeIn(
      child: ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Flexible(child: Text(tr('growthtrackerwidget_inkisaf_izleyicisi_71039e', 'İnkişaf izləyicisi'), style: x.heading(x.aCardTitle))),
                  ATabs(
                    labels: [tr('growthtrackerwidget_ceki_b10cc4', 'Çəki'), tr('growthtrackerwidget_height', 'Boy')],
                    active: _metric == 'weight' ? 0 : 1,
                    onSelect: (i) => setState(() => _metric = i == 0 ? 'weight' : 'height'),
                  ),
                ],
              ),
            ),
            if (hasChart) ...[
              Padding(
                padding: const EdgeInsets.only(top: 6, bottom: 4),
                child: SizedBox(
                  height: 128,
                  child: LayoutBuilder(builder: (context, box) {
                    final pts = growthChartPoints(values);
                    final lastX = pts.last.dx / _w * box.maxWidth;
                    return Stack(clipBehavior: Clip.none, children: [
                      Positioned.fill(child: CustomPaint(painter: _GrowthChartPainter(pts, t))),
                      // `inset-inline-start: X%` + physical translate(-50%, -100%): in RTL the box is anchored on the
                      // right (the SVG itself is not mirrored) — kept as in React.
                      Positioned(
                        left: Directionality.of(context) == TextDirection.rtl ? null : lastX,
                        right: Directionality.of(context) == TextDirection.rtl ? lastX : null,
                        top: -6,
                        child: FractionalTranslation(
                          translation: const Offset(-0.5, -1),
                          child: _ChartTooltip(text: '${jsNumberToString(values.last)} $unit'),
                        ),
                      ),
                    ]);
                  }),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: DefaultTextStyle.merge(
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: t.inkFaint, height: 1.5),
                  child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text(formatAxisDate(chartEntries.first['entry_date'] as String)),
                    Text(formatAxisDate(chartEntries.last['entry_date'] as String)),
                  ]),
                ),
              ),
            ] else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(tr('mommy_growth_empty', 'Qrafik üçün ən azı 2 ölçü lazımdır'), textAlign: TextAlign.center, style: x.aListSub),
              ),
            AGrid(columns: showHead ? 3 : 2, children: [
              tile(AIcons.scale, tr('growthtrackerwidget_ceki_b10cc4', 'Çəki'), latest?['weight_kg'], tr('growthtrackerwidget_unit_kg', 'kq'),
                  delta: weightChange),
              tile(AIcons.ruler, tr('growthtrackerwidget_height', 'Boy'), latest?['height_cm'], tr('growthtrackerwidget_unit_cm', 'sm'),
                  delta: heightChange),
              if (showHead) tile(AIcons.circleDot, tr('growthtrackerwidget_bas_compact', 'Baş'), latest?['head_cm'], tr('growthtrackerwidget_unit_cm', 'sm')),
            ]),
            FramerExpand(
              open: _showInput,
              child: Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: input(tr('growthtrackerwidget_ceki_kq_2f7555', 'Çəki (kq)'), _weight, '5.2')),
                    const SizedBox(width: 8),
                    Expanded(child: input(tr('growthtrackerwidget_height_cm', 'Boy (sm)'), _height, '58')),
                    if (showHead) ...[const SizedBox(width: 8), Expanded(child: input(tr('growthtrackerwidget_bas_sm_927b99', 'Baş (sm)'), _head, '38'))],
                  ]),
                  const SizedBox(height: 8),
                  APillButton(solid: true, block: true, tapScale: 0.98, onPressed: () => _add(showHead), child: Text(tr('growthtrackerwidget_save', 'Yadda saxla'))),
                ]),
              ),
            ),
            ATeaser(
              child: Row(children: [
                Expanded(
                  child: latest != null
                      ? Text.rich(TextSpan(children: [
                          TextSpan(text: '${tr('growthtrackerwidget_last_meas_label', 'Son ölçü:')} '),
                          TextSpan(
                            text: localeDate(jsParseDate('${latest['entry_date']}') ?? DomainClock.now()),
                            style: TextStyle(color: t.ink, fontWeight: FontWeight.w700),
                          ),
                        ]))
                      : Text(tr('mommy_growth_no_entries', 'Hələ ölçü qeyd edilməyib')),
                ),
                const SizedBox(width: 10),
                APillButton(
                  tapScale: 0.9,
                  onPressed: () => setState(() => _showInput = !_showInput),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    AnimatedRotation(
                      turns: _showInput ? 0.125 : 0,
                      duration: const Duration(milliseconds: 150),
                      child: AIcon(AIcons.plus, size: 13, strokeWidth: 2.5, color: t.accentInk),
                    ),
                    const SizedBox(width: 6),
                    Text(tr('dashboard_elave_et_a5fb21', '+ Əlavə et').replaceFirst('+ ', '')),
                  ]),
                ),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChartTooltip extends StatelessWidget {
  const _ChartTooltip({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) {
    final t = context.a;
    return Stack(clipBehavior: Clip.none, alignment: Alignment.bottomCenter, children: [
      Positioned(
        bottom: -4,
        child: Transform.rotate(angle: 0.785398, child: Container(width: 8, height: 8, color: t.ink)),
      ),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(color: t.ink, borderRadius: BorderRadius.circular(8)),
        child: Text(text, maxLines: 1, softWrap: false, style: TextStyle(color: t.bg, fontSize: 11, fontWeight: FontWeight.w800, height: 1.5)),
      ),
    ]);
  }
}

class _GrowthChartPainter extends CustomPainter {
  _GrowthChartPainter(this.points, this.t);
  final List<Offset> points;
  final ATokens t;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / _w, size.height / _h);
    final grid = Paint()
      ..color = t.line
      ..strokeWidth = 1;
    for (final f in const [0.25, 0.5, 0.75]) {
      for (double x = 0; x < _w; x += 8) {
        canvas.drawLine(Offset(x, _h * f), Offset((x + 3).clamp(0, _w), _h * f), grid);
      }
    }
    final line = Path()..moveTo(points.first.dx, points.first.dy);
    for (final p in points.skip(1)) {
      line.lineTo(p.dx, p.dy);
    }
    final area = Path.from(line)
      ..lineTo(points.last.dx, _h - _pad)
      ..lineTo(points.first.dx, _h - _pad)
      ..close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [t.chartLine.withValues(alpha: 0.22), t.chartLine.withValues(alpha: 0)],
        ).createShader(Rect.fromLTRB(
          points.first.dx,
          points.map((p) => p.dy).reduce((a, b) => a < b ? a : b),
          points.last.dx,
          _h - _pad,
        )),
    );
    canvas.drawPath(
      line,
      Paint()
        ..color = t.chartLine
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    final last = points.last;
    canvas.drawCircle(last, 4.5, Paint()..color = t.surface);
    canvas.drawCircle(
      last,
      4.5,
      Paint()
        ..color = t.chartLine
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GrowthChartPainter old) => old.points != points || old.t != t;
}
