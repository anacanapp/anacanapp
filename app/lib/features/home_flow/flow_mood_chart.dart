// Ported from: src/components/flow/FlowMoodChart.tsx (recharts AreaChart → fl_chart; deviations in README)
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/dates/local_date.dart' show storedCalendarDate;
import 'data/flow_hooks.dart';
import 'widgets/flow_common.dart';
import 'widgets/flow_ui.dart';

// FlowMoodChart.tsx literals: mood #ec4899, energy #f59e0b.
const Color _mood = Color(0xFFEC4899);
const Color _energy = Color(0xFFF59E0B);

class MoodPoint {
  const MoodPoint(this.date, this.dayLabel, this.mood, this.energy, this.pain, this.sleep);
  final String date;
  final String dayLabel;
  final num? mood;
  final num? energy;
  final num? pain;
  final num? sleep;
}

num? _truthy(Object? v) => v is num && v != 0 ? v : null;

/// The last 14 days (oldest first) with the logged values.
List<MoodPoint> moodChartData(List<Map<String, dynamic>> rows, DateTime now) => [
      for (var i = 13; i >= 0; i--)
        () {
          final d = DateTime(now.year, now.month, now.day - i);
          final key = ymd(d);
          final r = rows.where((x) => x['log_date'] == key).firstOrNull;
          return MoodPoint(key, flowFormat(d, 'd'), _truthy(r?['mood']), _truthy(r?['energy_level']), _truthy(r?['pain_level']),
              _truthy(r?['sleep_quality']));
        }(),
    ];

String _avg(List<Map<String, dynamic>> rows, String key) {
  final w = rows.where((r) => _truthy(r[key]) != null).toList();
  if (w.isEmpty) return '-';
  return (w.fold<num>(0, (s, r) => s + (r[key] as num)) / w.length).toStringAsFixed(1);
}

class FlowMoodChart extends ConsumerWidget {
  const FlowMoodChart({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final x = context.aText;
    final q = ref.watch(flowMoodChartQuery);
    final rows = q.data ?? const <Map<String, dynamic>>[];
    if (q.isLoading) return const FlowSkeletonCard(bars: [(height: 150, radius: 16)]);
    final data = moodChartData(rows, flowNow());
    final title = tr('flowmoodchart_ehval_qrafiki_fe3531', 'Əhval Qrafiki');
    final last14 = tr('flowmoodchart_son_14_gun_6be43a', 'Son 14 gün');

    LineChartBarData area(Color c, num? Function(MoodPoint) pick) {
      final spots = [for (var i = 0; i < data.length; i++) if (pick(data[i]) != null) FlSpot(i.toDouble(), pick(data[i])!.toDouble())];
      return LineChartBarData(
        spots: spots, // connectNulls: missing days are skipped, the line joins the logged ones
        isCurved: true,
        preventCurveOverShooting: true,
        color: c,
        barWidth: 2,
        dotData: FlDotData(getDotPainter: (_, _, _, _) => FlDotCirclePainter(radius: 3, color: c, strokeWidth: 2, strokeColor: c)),
        belowBarData: BarAreaData(
          show: true,
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: const [0.05, 0.95],
            colors: [c.withValues(alpha: 0.3), c.withValues(alpha: 0)],
          ),
        ),
      );
    }

    Widget chart() => SizedBox(
          height: 160, // h-40
          child: Padding(
            padding: const EdgeInsets.fromLTRB(5, 5, 5, 5), // recharts default chart margin
            child: LineChart(
              LineChartData(
                minX: 0,
                maxX: 13,
                minY: 0,
                maxY: 5,
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: false),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(),
                  rightTitles: const AxisTitles(),
                  leftTitles: const AxisTitles(),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      interval: 1,
                      getTitlesWidget: (v, meta) => SideTitleWidget(
                        meta: meta,
                        space: 4,
                        child: Text(data[v.toInt().clamp(0, 13)].dayLabel, style: TextStyle(fontSize: 10, color: s.mutedForeground)),
                      ),
                    ),
                  ),
                ),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => a.surface,
                    tooltipBorder: BorderSide(color: a.lineStrong),
                    tooltipBorderRadius: BorderRadius.circular(8),
                    tooltipPadding: const EdgeInsets.all(12),
                    fitInsideHorizontally: true,
                    getTooltipItems: (spots) => [
                      for (var i = 0; i < spots.length; i++)
                        i == 0 ? _tooltip(context, data[spots[i].x.toInt()]) : null,
                    ],
                  ),
                ),
                lineBarsData: [area(_mood, (p) => p.mood), area(_energy, (p) => p.energy)],
              ),
              duration: Duration.zero,
            ),
          ),
        );

    return AFadeIn(
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(children: [
              Expanded(child: Text(title, style: x.heading(x.aCardTitle))),
              Text(last14, style: aSectionLinkStyle(context, color: a.inkSoft)),
            ]),
          ),
          Padding(padding: const EdgeInsets.only(bottom: 14), child: aTodayInfoEyebrow(context, '$title · $last14')),
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Expanded(
                  child: ATrioItem(
                    icon: ATrioIcon(icon: AIcons.smile, gradient: a.gradPink, color: a.berryInk),
                    value: _avg(rows, 'mood'),
                    label: tr('flowmoodchart_orta_ehval_d444a0', 'Orta Əhval'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ATrioItem(
                    icon: ATrioIcon(icon: AIcons.zap, gradient: a.gradYellow, color: a.warnInk),
                    value: _avg(rows, 'energy_level'),
                    label: tr('untranslated_orta_enerji_ojxdi0', 'Orta Enerji'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ATrioItem(
                    icon: ATrioIcon(icon: AIcons.heart, gradient: a.gradLav, color: a.lavInk),
                    value: '${rows.length}',
                    label: tr('flowmoodchart_qeyd_sayi_3b2708', 'Qeyd Sayı'),
                  ),
                ),
              ]),
            ),
          ),
          if (rows.isNotEmpty)
            chart()
          else
            SizedBox(
              height: 160,
              child: Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.smile, size: 36, color: a.inkFaint),
                  const SizedBox(height: 8),
                  Text(tr('flowmoodchart_ehval_qeydleri_elave_edin_f86771', 'Əhval qeydləri əlavə edin'), style: x.aListSub),
                ]),
              ),
            ),
          Container(
            margin: const EdgeInsets.only(top: 14),
            padding: const EdgeInsets.only(top: 14),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
            child: Wrap(alignment: WrapAlignment.center, spacing: 14, runSpacing: 14, children: [
              ALegendItem(color: _mood, label: tr('flowmoodchart_ehval_0457f9', 'Əhval')),
              ALegendItem(color: _energy, label: tr('untranslated_enerji_q6zcss', 'Enerji')),
            ]),
          ),
        ]),
      ),
    );
  }

  LineTooltipItem _tooltip(BuildContext context, MoodPoint p) {
    final s = context.tokens.shadcn;
    final date = storedCalendarDate(p.date);
    final sub = TextStyle(fontSize: 12, color: s.mutedForeground, height: 16 / 12);
    const faces = ['', '😢', '😔', '😐', '😊', '🥰'];
    return LineTooltipItem(
      date != null ? flowFormat(date, 'd MMMM') : '',
      TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: s.foreground, height: 20 / 14),
      textAlign: TextAlign.start,
      children: [
        if (p.mood != null) TextSpan(text: '\n${tr('flowmoodchart_ehval_1ea198', 'Əhval:')} ${faces[p.mood!.toInt().clamp(0, 5)]} (${p.mood}/5)', style: sub),
        if (p.energy != null) TextSpan(text: '\n${tr('common_enerji_label', 'Enerji:')} ${p.energy}/5', style: sub),
        if (p.sleep != null) TextSpan(text: '\n${tr('flowmoodchart_yuxu_label', 'Yuxu:')} ${p.sleep}/5', style: sub),
      ],
    );
  }
}
