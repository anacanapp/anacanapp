// Ported from: src/components/tools/FetalGrowthTracker.tsx
import 'dart:async';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/count_format.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/pregnancy/fetal_growth.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart' show getPregnancyWeekAtDate;
import '../../../state/user_store.dart';
import '../../legal/medical_disclaimer.dart' show MedicalDisclaimer, MedicalDisclaimerVariant;
import '../../settings/ui/settings_ui.dart' show px, todayInfoEyebrow;
import '../kit/kit.dart';
import '../pregnancy_common/pregnancy_ui.dart';
import 'fetal_growth_scans.dart';

/// `BABY_COLORS` (FetalGrowthTracker.tsx literals).
const Map<String, Color> kBabyColors = {
  'A': Color(0xFFE8879C),
  'B': Color(0xFF6B9BD8),
  'C': Color(0xFFA78BDA),
  'D': Color(0xFF5CB88A),
};

/// Chart literals: `#63bd8b` band / P50, `#e4a3b8` P3 / P97.
const Color kFetalBandColor = Color(0xFF63BD8B);
const Color kFetalOuterColor = Color(0xFFE4A3B8);

/// `BABY_COLORS[label] + '22'` / `+ '18'` (hex alpha suffixes).
Color _babyAlpha(String label, int alpha) => (kBabyColors[label] ?? kBabyColors['A']!).withAlpha(alpha);

class _ScanView {
  const _ScanView(this.scan, this.week, this.percentile);
  final FetalGrowthScan scan;
  final int? week;
  final int? percentile;
}

class FetalGrowthTracker extends ConsumerStatefulWidget {
  const FetalGrowthTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<FetalGrowthTracker> createState() => _FetalGrowthTrackerState();
}

class _FetalGrowthTrackerState extends ConsumerState<FetalGrowthTracker> {
  FetalToast _toast(BuildContext context) {
    final host = AToastHost.of(context);
    return ({required title, description, destructive = false}) => host.show(title: title, description: description, destructive: destructive);
  }

  Future<void> _openAdd(bool isMultiple, List<String> labels) async {
    final toast = _toast(context);
    await showPeachSheet<void>(context, icon: AIcons.trendingUp, builder: (ctx) => _AddScanForm(
          isMultiple: isMultiple,
          labels: labels,
          onSave: (label, date, grams) async =>
              await ref.read(fetalGrowthScansProvider.notifier).addScan(isMultiple ? label : 'A', date, grams, toast: toast) != null,
        ));
  }

  Future<void> _confirmDelete(String id) async {
    final toast = _toast(context);
    final ok = await showTrashConfirm(
      context,
      text: tr('fetalgrowth_delete_confirm', 'Bu USM qeydini silmək istəyirsiniz?'),
      cancel: tr('weighttracker_legv_et_b5e49c', 'Ləğv et'),
      confirm: tr('weighttracker_sil', 'Sil'),
    );
    if (ok && mounted) await ref.read(fetalGrowthScansProvider.notifier).deleteScan(id, toast: toast);
  }

  ({Gradient grad, Color ink}) _toneStyle(String tone) {
    final a = context.a;
    if (tone == 'watch-low') return (grad: a.gradYellow, ink: a.warnInk);
    if (tone == 'watch-high') return (grad: a.gradBlue, ink: a.blueInk);
    return (grad: a.gradGreen, ink: a.greenInk);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final profile = ref.watch(authProfileProvider);
    final store = ref.watch(userStoreProvider);
    final data = ref.watch(fetalGrowthScansProvider);
    final pregData = store.getPregnancyData();
    // Today's week only for a known pregnancy; never an invented default.
    final currentWeek = store.lifeStage == 'bump' && pregData != null && pregData.currentWeek > 0 ? pregData.currentWeek : null;
    final trimester = currentWeek == null ? null : (pregData!.trimester != 0 ? pregData.trimester : (currentWeek <= 12 ? 1 : (currentWeek <= 26 ? 2 : 3)));
    final lmp = pregData?.lastPeriodDate;
    final babyCount = (profile?.babyCount ?? 1).clamp(1, 4);
    final isMultiple = babyCount > 1;
    final labels = babyLabels.take(babyCount).toList();

    // Week of each scan at its own date (not today); without a last period date: no week, no percentile.
    final views = [
      for (final s in data.scans)
        () {
          final w = lmp == null ? null : getPregnancyWeekAtDate(lmp, s.scanDate);
          final week = w == null || w.isNaN ? null : w.toInt();
          return _ScanView(s, week, week == null ? null : estimatePercentileForWeight(week, s.efwGrams));
        }(),
    ];
    final latest = <String, _ScanView>{};
    for (final v in views) {
      final existing = latest[v.scan.babyLabel];
      if (existing == null || (jsDateParseMs(v.scan.scanDate) ?? 0) >= (jsDateParseMs(existing.scan.scanDate) ?? 0)) latest[v.scan.babyLabel] = v;
    }
    final discordance = isMultiple ? calculateDiscordance([for (final l in labels) if (latest[l] != null && latest[l]!.scan.efwGrams != 0) latest[l]!.scan.efwGrams]) : null;
    final discordanceStyle = discordance?.level == 'high'
        ? (grad: a.gradPink, ink: a.berryInk)
        : discordance?.level == 'watch'
            ? (grad: a.gradYellow, ink: a.warnInk)
            : (grad: a.gradGreen, ink: a.greenInk);

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          onBack: widget.onBack,
          eyebrow: currentWeek != null && trimester != null ? '${weekOrdinal(currentWeek)} · ${trimesterOrdinal(trimester)}' : null,
          title: tr('fetalgrowth_title', 'Fetal Böyümə İzləyicisi'),
          actions: [
            PTap(
              scale: 0.9,
              semanticLabel: tr('a11y_add', 'Əlavə et'),
              onTap: () => unawaited(_openAdd(isMultiple, labels)),
              child: Container(
                key: const ValueKey('fetal-add'),
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(12)),
                child: const AIcon(AIcons.plus, size: 17, strokeWidth: 2.4, color: Color(0xFFFFFFFF)),
              ),
            ),
          ],
        ),
        const MedicalDisclaimer(variant: MedicalDisclaimerVariant.anacan),
        PTrio(marginTop: 12, children: [
          PTrioItem(icon: AIcons.trendingUp, iconGradient: a.gradPeach, iconColor: a.accentInk, value: currentWeek?.toString() ?? '–', label: tr('fetalgrowth_current_week', 'Cari həftə')),
          PTrioItem(icon: AIcons.baby, iconGradient: a.gradBlue, iconColor: a.blueInk, value: '${data.scans.length}', label: tr('fetalgrowth_scan_count', 'USM qeydi')),
          PTrioItem(icon: AIcons.users, iconGradient: a.gradLav, iconColor: a.lavInk, value: '$babyCount', label: tr('fetalgrowth_baby_count', 'Körpə sayı')),
        ]),
        for (var i = 0; i < labels.length; i++)
          if (latest[labels[i]] != null) _latestCard(context, labels[i], latest[labels[i]]!, isMultiple, i == 0 ? 12 : 8),
        if (isMultiple && discordance != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: ACard(
              child: Row(children: [
                _Avatar(gradient: discordanceStyle.grad, child: AIcon(AIcons.users, size: 19, strokeWidth: 2.2, color: discordanceStyle.ink)),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(upperCss(tr('fetalgrowth_discordance_title', 'Böyümə uyğunluğu')), style: todayInfoEyebrow(context)),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        discordance.level == 'high'
                            ? tr('fetalgrowth_discordance_high', 'Əhəmiyyətli fərq — həkiminizlə müzakirə edin')
                            : discordance.level == 'watch'
                                ? tr('fetalgrowth_discordance_watch', 'Yüngül fərq — izləməyə davam edin')
                                : tr('fetalgrowth_discordance_normal', 'Uyğun böyüyürlər'),
                        style: x.heading(px(17, color: a.ink)),
                      ),
                    ),
                    Text(tr('fetalgrowth_discordance_desc', 'Körpələr arasında çəki fərqi: {percent}%').replaceFirst('{percent}', '${discordance.percent}'), style: x.aListSub),
                  ]),
                ),
              ]),
            ),
          ),
        _chart(context, views, labels, currentWeek, isMultiple),
        if (views.isNotEmpty)
          _history(context, views, isMultiple)
        else if (!data.loading)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ACard(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 28),
              child: Column(children: [
                Text(tr('fetalgrowth_no_scans_yet', 'Hələ USM qeydi yoxdur'), textAlign: TextAlign.center, style: x.aListSub),
                const SizedBox(height: 4),
                Text(tr('fetalgrowth_add_scan_hint', 'İlk USM ölçünüzü əlavə edin'), textAlign: TextAlign.center, style: x.aListSub),
              ]),
            ),
          ),
      ]),
    );
  }

  Widget _latestCard(BuildContext context, String label, _ScanView v, bool isMultiple, double top) {
    final a = context.a;
    final x = context.aText;
    final style = _toneStyle(v.percentile != null ? percentileTone(v.percentile!) : 'ok');
    final color = kBabyColors[label]!;
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: ACard(
        child: Row(children: [
          _Avatar(
            color: _babyAlpha(label, 0x22),
            child: isMultiple ? Text(label, style: px(17, weight: FontWeight.w700, color: color)) : AIcon(AIcons.baby, size: 19, strokeWidth: 2.2, color: color),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                upperCss(isMultiple ? tr('fetalgrowth_baby_label_n', 'Körpə {n}').replaceFirst('{n}', label) : tr('fetalgrowth_latest_efw', 'Son EFW')),
                style: todayInfoEyebrow(context),
              ),
              Padding(padding: const EdgeInsets.only(top: 2), child: Text('${jsNumberToString(v.scan.efwGrams)} q', style: x.heading(px(19, color: a.ink)))),
              Text('${v.week != null ? '${weekOrdinal(v.week!)} · ' : ''}${formatDateAz(v.scan.scanDate)}', style: x.aListSub),
            ]),
          ),
          if (v.percentile != null) PTag(background: null, gradient: style.grad, color: style.ink, child: Text('${v.percentile}p')),
        ]),
      ),
    );
  }

  Widget _chart(BuildContext context, List<_ScanView> views, List<String> labels, int? currentWeek, bool isMultiple) {
    final a = context.a;
    final tickStyle = px(10, color: a.inkSoft);
    final bands = buildFetalGrowthChartData();
    LineChartBarData line(List<FlSpot> spots, Color color, double width, {List<int>? dash, bool dots = false, String? label}) => LineChartBarData(
          spots: spots,
          color: color,
          barWidth: width,
          dashArray: dash,
          dotData: FlDotData(show: dots, getDotPainter: (_, _, _, _) => FlDotCirclePainter(radius: 4, color: color, strokeWidth: 0)),
        );
    final babyLines = <LineChartBarData>[
      for (final l in labels)
        line(
          [
            for (final b in bands)
              for (final v in views)
                if (v.scan.babyLabel == l && v.week == b.week) FlSpot(b.week.toDouble(), v.scan.efwGrams.toDouble()),
          ],
          kBabyColors[l]!,
          2.5,
          dots: true,
        ),
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ACardHead(title: tr('fetalgrowth_chart_title', 'Böyümə qrafiki')),
          SizedBox(
            height: 220,
            child: LineChart(
              key: const ValueKey('fetal-chart'),
              LineChartData(
                minX: fetalGrowthMinWeek.toDouble(),
                maxX: fetalGrowthMaxWeek.toDouble(),
                gridData: const FlGridData(show: false),
                borderData: FlBorderData(show: true, border: Border(bottom: BorderSide(color: a.line))),
                titlesData: FlTitlesData(
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      interval: 4,
                      reservedSize: 22,
                      getTitlesWidget: (v, meta) => SideTitleWidget(meta: meta, child: Text('${v.toInt()}h', style: tickStyle)),
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 40,
                      getTitlesWidget: (v, meta) => SideTitleWidget(meta: meta, child: Text('${jsNumberToString(jsRound(v / 100) / 10)}kq', style: tickStyle)),
                    ),
                  ),
                ),
                extraLinesData: ExtraLinesData(verticalLines: [
                  if (currentWeek != null)
                    VerticalLine(
                      x: currentWeek.toDouble(),
                      color: a.inkFaint,
                      strokeWidth: 1,
                      dashArray: const [4, 4],
                      label: VerticalLineLabel(show: true, alignment: Alignment.topCenter, style: tickStyle, labelResolver: (_) => tr('weighttracker_indi_ref', 'indi')),
                    ),
                ]),
                betweenBarsData: [BetweenBarsData(fromIndex: 0, toIndex: 1, color: kFetalBandColor.withValues(alpha: 0.15))],
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => a.surface,
                    getTooltipItems: (spots) => [
                      for (final s in spots)
                        s.barIndex < 2
                            ? null
                            : LineTooltipItem(
                                '${s.barIndex == 2 ? 'P97' : s.barIndex == 3 ? tr('fetalgrowth_median_label', 'Median (P50)') : s.barIndex == 4 ? 'P3' : (isMultiple ? tr('fetalgrowth_baby_label_n', 'Körpə {n}').replaceFirst('{n}', labels[s.barIndex - 5]) : tr('fetalgrowth_latest_efw', 'Son EFW'))}: ${jsNumberToString(s.y)} q',
                                px(11, color: a.ink),
                              ),
                    ],
                  ),
                ),
                lineBarsData: [
                  line([for (final b in bands) FlSpot(b.week.toDouble(), b.p10.toDouble())], const Color(0x00000000), 0),
                  line([for (final b in bands) FlSpot(b.week.toDouble(), b.p90.toDouble())], const Color(0x00000000), 0),
                  line([for (final b in bands) FlSpot(b.week.toDouble(), b.p97.toDouble())], kFetalOuterColor, 1, dash: const [4, 3]),
                  line([for (final b in bands) FlSpot(b.week.toDouble(), b.p50.toDouble())], kFetalBandColor, 1.5, dash: const [2, 2]),
                  line([for (final b in bands) FlSpot(b.week.toDouble(), b.p3.toDouble())], kFetalOuterColor, 1, dash: const [4, 3]),
                  ...babyLines,
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(tr('fetalgrowth_chart_legend', 'Yaşıl zolaq — normal aralıq (P10–P90), nöqtələr — sizin USM ölçmələriniz'),
                style: px(12, color: a.inkSoft, height: 1.55)),
          ),
        ]),
      ),
    );
  }

  Widget _history(BuildContext context, List<_ScanView> views, bool isMultiple) {
    final a = context.a;
    final x = context.aText;
    final reversed = views.reversed.toList();
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 96),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(tr('fetalgrowth_history_title', 'USM Tarixçəsi'), style: x.aSectionTitle)),
        ACard(
          variant: ACardVariant.list,
          child: Column(children: [
            for (var i = 0; i < reversed.length; i++)
              PListRow(
                first: i == 0,
                leading: PListIcon(
                  background: _babyAlpha(reversed[i].scan.babyLabel, 0x22),
                  child: isMultiple
                      ? Text(reversed[i].scan.babyLabel, style: px(15, weight: FontWeight.w700, color: kBabyColors[reversed[i].scan.babyLabel]))
                      : AIcon(AIcons.baby, size: 17, strokeWidth: 2, color: kBabyColors[reversed[i].scan.babyLabel]),
                ),
                body: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    '${jsNumberToString(reversed[i].scan.efwGrams)} q${reversed[i].percentile != null ? ' · ${reversed[i].percentile}p' : ''}',
                    style: x.aListTitle.copyWith(fontSize: 14.5),
                  ),
                  const SizedBox(height: 2),
                  Text('${reversed[i].week != null ? '${weekOrdinal(reversed[i].week!)} · ' : ''}${formatDateAz(reversed[i].scan.scanDate)}', style: x.aListSub),
                ]),
                trailing: Semantics(
                  button: true,
                  label: tr('common_sil', 'Sil'),
                  child: GestureDetector(
                    key: ValueKey('fetal-delete-${reversed[i].scan.id}'),
                    onTap: () => unawaited(_confirmDelete(reversed[i].scan.id)),
                    child: Container(
                      width: 30,
                      height: 30,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.btnBorder)),
                      child: AIcon(AIcons.trash2, size: 13, strokeWidth: 2, color: a.ink),
                    ),
                  ),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// `.a-rank-avatar` (42×42, radius 13).
class _Avatar extends StatelessWidget {
  const _Avatar({required this.child, this.color, this.gradient});
  final Widget child;
  final Color? color;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) => Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: gradient == null ? color : null, gradient: gradient, borderRadius: BorderRadius.circular(13)),
        child: child,
      );
}

class _AddScanForm extends StatefulWidget {
  const _AddScanForm({required this.isMultiple, required this.labels, required this.onSave});
  final bool isMultiple;
  final List<String> labels;
  final Future<bool> Function(String label, String date, int grams) onSave;

  @override
  State<_AddScanForm> createState() => _AddScanFormState();
}

class _AddScanFormState extends State<_AddScanForm> {
  String _label = 'A';
  String _date = todayKey();
  final TextEditingController _efw = TextEditingController();

  @override
  void dispose() {
    _efw.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final grams = int.tryParse(_efw.text.trim());
    if (_efw.text.isEmpty || grams == null || grams < 100 || grams > 6000) return;
    final ok = await widget.onSave(_label, _date, grams);
    if (ok && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 4),
        child: Text(tr('fetalgrowth_add_title', 'USM ölçüsü əlavə et'), textAlign: TextAlign.center, style: x.heading(px(18, color: a.ink))),
      ),
      Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Text(tr('fetalgrowth_add_subtitle', 'Son USM-dəki təxmini çəkini daxil edin'), textAlign: TextAlign.center, style: x.aListSub),
      ),
      if (widget.isMultiple)
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('fetalgrowth_which_baby', 'Hansı körpə?'), style: x.aListTime)),
            Row(children: [
              for (var i = 0; i < widget.labels.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    key: ValueKey('fetal-label-${widget.labels[i]}'),
                    onTap: () => setState(() => _label = widget.labels[i]),
                    child: Container(
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _label == widget.labels[i] ? _babyAlpha(widget.labels[i], 0x18) : a.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: _label == widget.labels[i] ? kBabyColors[widget.labels[i]]! : a.lineStrong,
                          width: _label == widget.labels[i] ? 2 : 1,
                        ),
                      ),
                      child: Text(widget.labels[i],
                          style: px(14, weight: FontWeight.w700, color: _label == widget.labels[i] ? kBabyColors[widget.labels[i]] : a.inkSoft)),
                    ),
                  ),
                ),
              ],
            ]),
          ]),
        ),
      Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('fetalgrowth_scan_date_label', 'USM tarixi'), style: x.aListTime)),
          PDateInput(value: _date, max: DateTime.now(), onChanged: (v) => setState(() => _date = v)),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.only(bottom: 20),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr('fetalgrowth_efw_label', 'Təxmini çəki (qram)'), style: x.aListTime)),
          PBigInput(fieldKey: const ValueKey('fetal-efw'), controller: _efw, placeholder: '1200', unit: 'q', decimal: false),
        ]),
      ),
      PTap(
        scale: 0.98,
        onTap: _submit,
        child: Container(
          key: const ValueKey('fetal-save'),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            const AIcon(AIcons.sparkles, size: 17, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
            const SizedBox(width: 6),
            Text(tr('weighttracker_yadda_saxla', 'Yadda saxla'), style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
          ]),
        ),
      ),
    ]);
  }
}
