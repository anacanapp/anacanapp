// Ported from: src/components/flow/CycleTrendChart.tsx (recharts LineChart → fl_chart; deviations in README)
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import 'data/flow_hooks.dart';
import 'widgets/flow_ui.dart';

/// `{ cycle: '#n', length }` points, oldest first (last 12 with a length).
List<({String cycle, int length})> cycleTrendData(List<Map<String, dynamic>> cycles) => [
      for (final c in cycles.where((c) => (c['cycle_length'] as num? ?? 0) > 0).take(12).toList().reversed)
        (cycle: '#${c['cycle_number']}', length: (c['cycle_length'] as num).toInt()),
    ];

/// recharts nice ticks for the fixed domain [15, 45] with tickCount 5.
const List<double> _yTicks = [15, 22.5, 30, 37.5, 45];

class CycleTrendChart extends ConsumerWidget {
  const CycleTrendChart({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final q = ref.watch(cycleHistoryQuery);
    final stats = ref.watch(cycleStatsProvider);
    final data = cycleTrendData(q.data ?? const []);
    if (q.isLoading) return const FlowSkeletonCard(titleWidthFactor: 0.5, bars: [(height: 150, radius: 16)]);
    if (data.length < 2) return const SizedBox.shrink();
    const ref21 = Color(0xFFE05575); // CycleTrendChart.tsx ReferenceLine stroke="#e05575"
    final tick = TextStyle(fontSize: 10, color: a.inkSoft);
    final avg = stats.averageCycleLength.toDouble();
    String num(double v) => v == v.roundToDouble() ? '${v.toInt()}' : '$v';

    return AFadeIn(
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(children: [
              Expanded(child: Text(tr('cycletrendchart_tsikl_uzunlugu_trendi_13a67d', 'Tsikl Uzunluğu Trendi'), style: context.aText.heading(context.aText.aCardTitle))),
              Text(tr('cycletrendchart_tsikl_count', '{count} tsikl').replaceFirst('{count}', '${data.length}'), style: aSectionLinkStyle(context, color: a.inkSoft)),
            ]),
          ),
          Transform.translate(
            offset: Offset(Directionality.of(context) == TextDirection.rtl ? 8 : -8, 0), // -ms-2
            child: SizedBox(
              height: 176, // h-44
              child: Padding(
                padding: const EdgeInsets.only(top: 6, right: 8),
                child: LineChart(
                  LineChartData(
                    minX: 0,
                    maxX: (data.length - 1).toDouble(),
                    minY: 15,
                    maxY: 45,
                    clipData: const FlClipData.all(),
                    gridData: FlGridData(
                      horizontalInterval: 7.5,
                      verticalInterval: 1,
                      getDrawingHorizontalLine: (_) => FlLine(color: a.lineStrong.withValues(alpha: a.lineStrong.a * 0.6), strokeWidth: 1, dashArray: const [3, 5]),
                      getDrawingVerticalLine: (_) => FlLine(color: a.lineStrong.withValues(alpha: a.lineStrong.a * 0.6), strokeWidth: 1, dashArray: const [3, 5]),
                    ),
                    borderData: FlBorderData(show: true, border: Border(left: BorderSide(color: a.lineStrong), bottom: BorderSide(color: a.lineStrong))),
                    titlesData: FlTitlesData(
                      topTitles: const AxisTitles(),
                      rightTitles: const AxisTitles(),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 28,
                          interval: 7.5,
                          getTitlesWidget: (v, meta) => _yTicks.contains(v)
                              ? SideTitleWidget(meta: meta, space: 8, child: Text(num(v), maxLines: 1, softWrap: false, overflow: TextOverflow.visible, style: tick))
                              : const SizedBox.shrink(),
                        ),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 30,
                          interval: 1,
                          getTitlesWidget: (v, meta) => SideTitleWidget(
                              meta: meta, space: 8, child: Text(v.toInt() >= 0 && v.toInt() < data.length ? data[v.toInt()].cycle : '', style: tick)),
                        ),
                      ),
                    ),
                    extraLinesData: ExtraLinesData(horizontalLines: [
                      HorizontalLine(
                        y: avg,
                        color: a.chartLine,
                        strokeWidth: 1,
                        dashArray: const [4, 4],
                        label: HorizontalLineLabel(
                          show: true,
                          alignment: Alignment.topRight,
                          padding: const EdgeInsets.only(right: 5, bottom: 2),
                          style: TextStyle(fontSize: 10, color: a.chartLine),
                          labelResolver: (_) => '${tr('common_orta', 'Orta')} ${stats.averageCycleLength}',
                        ),
                      ),
                      HorizontalLine(y: 21, color: ref21.withValues(alpha: 0.35), strokeWidth: 1, dashArray: const [2, 4]),
                      HorizontalLine(y: 35, color: ref21.withValues(alpha: 0.35), strokeWidth: 1, dashArray: const [2, 4]),
                    ]),
                    lineTouchData: LineTouchData(
                      touchTooltipData: LineTouchTooltipData(
                        getTooltipColor: (_) => a.surface,
                        tooltipBorder: BorderSide(color: a.lineStrong),
                        tooltipBorderRadius: BorderRadius.circular(12),
                        tooltipPadding: const EdgeInsets.all(10),
                        getTooltipItems: (spots) => [
                          for (final s in spots)
                            LineTooltipItem('${data[s.x.toInt()].cycle}\n', TextStyle(fontSize: 12, color: a.ink), children: [
                              TextSpan(text: '${tr('cycletrendchart_uzunluq_f427cd', 'Uzunluq')} : ${s.y.toInt()} ${tr('common_gun', 'gün')}', style: TextStyle(fontSize: 12, color: a.chartLine)),
                            ]),
                        ],
                      ),
                    ),
                    lineBarsData: [
                      LineChartBarData(
                        spots: [for (var i = 0; i < data.length; i++) FlSpot(i.toDouble(), data[i].length.toDouble())],
                        isCurved: true,
                        preventCurveOverShooting: true,
                        color: a.chartLine,
                        barWidth: 2.5,
                        dotData: FlDotData(
                          getDotPainter: (_, _, _, _) => FlDotCirclePainter(radius: 3, color: a.chartLine, strokeWidth: 2.5, strokeColor: a.chartLine),
                        ),
                      ),
                    ],
                  ),
                  duration: Duration.zero,
                ),
              ),
            ),
          ),
          Container(
            margin: const EdgeInsets.only(top: 14),
            padding: const EdgeInsets.only(top: 14),
            child: CustomPaint(
              painter: _DashedTop(a.lineStrong),
              child: Padding(
                padding: const EdgeInsets.only(top: 0),
                child: Text(tr('cycletrendchart_normal_diapazon_21_35_gun_acog_48b2bf', 'Normal diapazon: 21–35 gün (ACOG)'),
                    textAlign: TextAlign.center, style: TextStyle(fontSize: 12, height: 1.55, color: a.inkSoft)),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

/// `.a-teaser` `border-top: 1px dashed` (drawn 14px above the text, i.e. at the padding edge).
class _DashedTop extends CustomPainter {
  _DashedTop(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += 6) {
      canvas.drawLine(Offset(x, -14), Offset((x + 3).clamp(0, size.width), -14), p);
    }
  }

  @override
  bool shouldRepaint(_DashedTop old) => old.color != color;
}
