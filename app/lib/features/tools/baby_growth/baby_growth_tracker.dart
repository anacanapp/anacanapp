// Ported from: src/components/tools/BabyGrowthTracker.tsx (BabyGrowthTracker, WHOPercentileCard)
//
// Weight / height / head circumference history of the selected child with the WHO percentile curves (0-60 months,
// P3/P15/P50/P85/P97 + the child's points; corrected age for preterm babies), add / edit dialog and delete.
// recharts ComposedChart → fl_chart LineChart.
import 'dart:async';
import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/count_format.dart';
import '../../../core/i18n/date_utils.dart';
import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/growth/who_growth.dart';
import '../../../domain/js_compat.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart';
import '../../baby/hooks/baby_services.dart';
import '../../baby/hooks/use_children.dart';
import '../../settings/ui/settings_ui.dart' show AIconBtn, DateFieldBox, FadeRise, ShadDialogFrame, ShadInput, Tw, shadTitle, showShadDialog;
import '../baby_tracker/bt_ui.dart' show ARankTag;
import '../kit/kit.dart';
import 'baby_growth_data.dart';
import 'growth_chart_view.dart';

// Percentile line colours (BabyGrowthTracker.tsx:161-165, recharts stroke literals).
const Color _p97 = Color(0xFFE4A3B8);
const Color _p85 = Color(0xFFD4B48C);
const Color _p50 = Color(0xFF63BD8B);

String _num(Object? v) => v is num ? jsNumberToString(v) : '';

/// JS `parseFloat` (leading number of the string, NaN when there is none).
double _parseFloat(String s) {
  final m = RegExp(r'^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)').firstMatch(s);
  return m == null ? double.nan : double.parse(m[1]!);
}

class BabyGrowthTracker extends ConsumerStatefulWidget {
  const BabyGrowthTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BabyGrowthTracker> createState() => _BabyGrowthTrackerState();
}

class _BabyGrowthTrackerState extends ConsumerState<BabyGrowthTracker> {
  void _toast({String? title, String? description, bool destructive = false}) {
    if (!mounted) return;
    AToastHost.of(context).show(title: title, description: description, destructive: destructive);
  }

  Future<void> _refetch() => ref.read(queryClientProvider).invalidateQueries(queryKey: ['baby-growth']);

  Future<void> _openForm([GrowthRow? editing]) async {
    await showShadDialog<void>(
      context,
      builder: (ctx) => _GrowthForm(
        editing: editing,
        onSubmit: (values) => _submit(values, editing),
      ),
    );
  }

  /// `handleSubmit`; returns true when the dialog closes (saved or failed after the request).
  Future<bool> _submit(({String weight, String height, String head, String notes, String date}) f, GrowthRow? editing) async {
    final user = ref.read(authUserProvider);
    if (user == null) return false;
    final weight = _parseFloat(f.weight), height = _parseFloat(f.height), head = _parseFloat(f.head);
    if (weight.isNaN && height.isNaN && head.isNaN) {
      _toast(
        title: tr('babygrowthtracker_xeta_3cdbb6', 'Xəta'),
        description: tr('babygrowthtracker_en_azi_bir_olcu_daxil_edin_bfceff', 'Ən azı bir ölçü daxil edin'),
        destructive: true,
      );
      return false;
    }
    await ref.read(babyCareServicesProvider).hapticMedium();
    final repo = ref.read(growthRepositoryProvider);
    final values = <String, dynamic>{
      'weight_kg': weight.isNaN ? null : weight,
      'height_cm': height.isNaN ? null : height,
      'head_cm': head.isNaN ? null : head,
      'notes': f.notes.isEmpty ? null : f.notes,
      'entry_date': f.date,
    };
    try {
      if (editing != null) {
        await repo.update('${editing['id']}', values);
        _toast(title: tr('babygrowthtracker_olcu_yenilendi_163440', 'Ölçü yeniləndi! 📏'));
      } else {
        await repo.insert({'user_id': user.id, 'child_id': selectedChildNowOf(ref), ...values});
        _toast(title: tr('babygrowthtracker_yeni_olcu_elave_edildi_a55e91', 'Yeni ölçü əlavə edildi! 📏'));
      }
      unawaited(_refetch());
      return true;
    } catch (e) {
      debugPrint('Error saving growth entry: $e');
      _toast(title: tr('babygrowthtracker_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true);
      return false;
    }
  }

  Future<void> _delete(String id) async {
    await ref.read(babyCareServicesProvider).hapticLight();
    try {
      await ref.read(growthRepositoryProvider).delete(id);
      _toast(title: tr('babygrowthtracker_olcu_silindi_cbd1ac', 'Ölçü silindi'));
      unawaited(_refetch());
    } catch (_) {
      _toast(title: tr('babygrowthtracker_xeta_bas_verdi_f22fba', 'Xəta baş verdi'), destructive: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(appLanguageProvider);
    final selectedChild = ref.watch(childrenProvider).selectedChild;
    final q = ref.watch(growthEntriesQuery);
    final entries = q.data ?? const <GrowthRow>[];
    final isLoading = ref.watch(authUserProvider) != null && q.isLoading;
    final a = context.a;
    final x = context.aText;

    final latest = entries.isNotEmpty ? entries[0] : null;
    final previous = entries.length > 1 ? entries[1] : null;
    num? val(GrowthRow? r, String k) => r?[k] as num?;
    final weightChange = latest != null && previous != null ? (val(latest, 'weight_kg') ?? 0) - (val(previous, 'weight_kg') ?? 0) : null;
    final heightChange = latest != null && previous != null ? (val(latest, 'height_cm') ?? 0) - (val(previous, 'height_cm') ?? 0) : null;

    // WHO curves are per sex: unknown gender → no chart and no percentile.
    final growthSex = selectedChild?.gender == 'boy' || selectedChild?.gender == 'girl' ? selectedChild!.gender : null;
    final likes = [for (final e in entries) GrowthEntryLike.fromRow(e)];
    int? headPercentile;
    if (selectedChild != null && selectedChild.birthDate.isNotEmpty && growthSex != null) {
      final due = selectedChild.dueDate;
      final premature = getPrematurityInfo(selectedChild.birthDate, due, tr: tr).isPremature;
      headPercentile = latestPercentile(likes, 'head', growthSex, premature && due != null ? due : selectedChild.birthDate);
    }
    final headChip = headPercentile != null ? percentileChip(headPercentile) : null;

    Widget change(num? c, int digits) {
      if (c == null || c == 0) return const SizedBox.shrink();
      final up = c > 0;
      return Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          AIcon(up ? AIcons.trendingUp : AIcons.trendingDown, size: 11, color: up ? a.green2 : a.pink2),
          const SizedBox(width: 3),
          Text('${up ? '+' : ''}${c.toStringAsFixed(digits)}', style: x.aListSub.copyWith(fontSize: 11, fontWeight: FontWeight.w700, color: up ? a.green2 : a.pink2)),
        ]),
      );
    }

    Widget trio(int i, {required Gradient bg, required Color ink, required AIconData icon, required String value, required String label, Widget? extra}) =>
        FadeRise(
          dy: 20,
          delay: Duration(milliseconds: 100 + i * 50),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
            decoration: BoxDecoration(
              color: a.surface,
              border: Border.all(color: a.line),
              borderRadius: BorderRadius.circular(a.radiusMd),
              boxShadow: a.cardShadow,
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                width: 38,
                height: 38,
                margin: const EdgeInsets.only(bottom: 9),
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: bg, borderRadius: BorderRadius.circular(12)),
                child: AIcon(icon, size: 17, color: ink),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(value, textAlign: TextAlign.center, style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: a.ink, height: 1.5)),
              ),
              Text(label, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: a.inkSoft, height: 1.5)),
              ?extra,
            ]),
          ),
        );

    String valueText(Object? v) => v is num && v != 0 ? _num(v) : '—';

    return ToolPage(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ToolHeader(
          title: tr('babygrowthtracker_i_nkisaf_izleyicisi_71039e', 'İnkişaf izləyicisi'),
          eyebrow: (selectedChild?.name ?? '').isNotEmpty ? selectedChild!.name : tr('common_qeyd', 'qeyd'),
          onBack: widget.onBack,
          actions: [
            AIconBtn(
              key: const ValueKey('growth-add'),
              semanticLabel: tr('a11y_add', 'Əlavə et'),
              background: a.peach2,
              foreground: const Color(0xFFFFFFFF),
              border: false,
              onTap: () => unawaited(_openForm()),
              icon: const AIcon(AIcons.plus, size: 17, strokeWidth: 2.4),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: trio(0,
                  bg: a.gradPeach,
                  ink: a.accentInk,
                  icon: AIcons.scale,
                  value: valueText(latest?['weight_kg']),
                  label: tr('unit_kg', 'kq'),
                  extra: change(weightChange, 2)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: trio(1,
                  bg: a.gradBlue,
                  ink: a.blueInk,
                  icon: AIcons.ruler,
                  value: valueText(latest?['height_cm']),
                  label: tr('unit_cm', 'sm'),
                  extra: change(heightChange, 1)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: trio(2,
                  bg: a.gradYellow,
                  ink: a.warnInk,
                  icon: AIcons.baby,
                  value: valueText(latest?['head_cm']),
                  label: tr('babygrowthtracker_bas_sm_1367d0', 'baş sm'),
                  extra: headPercentile != null && headChip != null
                      ? Tooltip(
                          message: tr(headChip.key, headChip.fallback),
                          child: Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Text('P$headPercentile',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  height: 1.5,
                                  color: headChip.tone == 'ok' ? a.greenInk : headChip.tone == 'watch' ? a.warnInk : a.pinkInk,
                                )),
                          ),
                        )
                      : null),
            ),
          ]),
        ),
        if (selectedChild != null && selectedChild.birthDate.isNotEmpty && growthSex != null && entries.isNotEmpty)
          _WhoPercentileCard(entries: likes, birthDate: selectedChild.birthDate, dueDate: selectedChild.dueDate, sex: growthSex),
        FadeRise(
          dy: 20,
          delay: const Duration(milliseconds: 250),
          child: ASection(
            variant: ASectionVariant.a,
            title: tr('babygrowthtracker_olcu_tarixcesi_249279', 'Ölçü Tarixçəsi'),
            trailing: Text(formatCount(CountNoun.records, entries.length), style: x.aSectionLink),
            child: isLoading
                ? Column(children: [
                    for (var i = 0; i < 3; i++) ...[
                      if (i > 0) const SizedBox(height: 10),
                      const _SkeletonCard(),
                    ],
                  ])
                : entries.isEmpty
                    ? ACard(
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Container(
                            width: 64,
                            height: 64,
                            margin: const EdgeInsets.only(bottom: 16),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(gradient: a.gradPeach, shape: BoxShape.circle),
                            child: AIcon(AIcons.scale, size: 26, color: a.accentInk),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Text(tr('babygrowthtracker_hele_olcu_yoxdur_7f7813', 'Hələ ölçü yoxdur'), textAlign: TextAlign.center, style: x.aListTitle),
                          ),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Text(tr('babygrowthtracker_korpenizin_ceki_ve_boyunu_izle_36b05f', 'Körpənizin çəki və boyunu izləmək üçün ilk ölçünü əlavə edin'),
                                textAlign: TextAlign.center, style: x.aListSub),
                          ),
                          AButton(
                            key: const ValueKey('growth-first'),
                            variant: AButtonVariant.cta,
                            leading: const AIcon(AIcons.plus, size: 14, strokeWidth: 2.4),
                            onPressed: () => unawaited(_openForm()),
                            child: Text(tr('babygrowthtracker_i_lk_olcunu_elave_et_5a19bb', 'İlk ölçünü əlavə et')),
                          ),
                        ]),
                      )
                    : ACard(
                        variant: ACardVariant.list,
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          for (var i = 0; i < entries.length; i++)
                            FadeRise(
                              key: ValueKey('growth-row-${entries[i]['id']}'),
                              dy: 0,
                              dx: -20,
                              delay: Duration(milliseconds: math.min(i * 50, 300)),
                              child: _EntryRow(
                                entry: entries[i],
                                first: i == 0,
                                onEdit: () => unawaited(_openForm(entries[i])),
                                onDelete: () => unawaited(_delete('${entries[i]['id']}')),
                              ),
                            ),
                        ]),
                      ),
          ),
        ),
        SafetyStrip(signs: tr('safety_growth_signs', 'Zəng edin: yeməkdən imtina, az yaş bez, çox süstlük və ya çətin oyanma')),
      ]),
    );
  }
}

/// `selectedChild?.id || null` at write time.
String? selectedChildNowOf(WidgetRef ref) => ref.read(childrenProvider).selectedChild?.id;

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard();
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return ACard(
      child: LayoutBuilder(
        builder: (context, c) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(height: 16, width: c.maxWidth * 0.33, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(8))),
          const SizedBox(height: 8),
          Container(height: 12, width: c.maxWidth * 0.66, decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(8))),
        ]),
      ),
    );
  }
}

class _EntryRow extends StatelessWidget {
  const _EntryRow({required this.entry, required this.first, required this.onEdit, required this.onDelete});
  final GrowthRow entry;
  final bool first;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    Widget part(AIconData icon, Object? v, String unit) => Row(mainAxisSize: MainAxisSize.min, children: [
          AIcon(icon, size: 11, color: a.inkSoft),
          const SizedBox(width: 3),
          Text('${_num(v)} $unit', style: x.aListSub),
        ]);
    bool has(Object? v) => v is num && v != 0;
    final date = parseJsDate('${entry['entry_date']}');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: first ? a.gradPeach : null,
            color: first ? null : a.surfaceSoft,
            borderRadius: BorderRadius.circular(13),
          ),
          child: AIcon(AIcons.calendar, size: 17, color: first ? a.accentInk : a.inkSoft),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(date == null ? '' : formatDateAz(date, includeYear: true), style: x.aListTitle),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Wrap(spacing: 10, children: [
                if (has(entry['weight_kg'])) part(AIcons.scale, entry['weight_kg'], tr('unit_kg', 'kq')),
                if (has(entry['height_cm'])) part(AIcons.ruler, entry['height_cm'], tr('unit_cm', 'sm')),
                if (has(entry['head_cm'])) part(AIcons.baby, entry['head_cm'], tr('unit_cm', 'sm')),
              ]),
            ),
            if ((entry['notes'] as String? ?? '').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 1),
                child: Text('📝 ${entry['notes']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: x.aListTime),
              ),
          ]),
        ),
        const SizedBox(width: 13),
        AIconBtn(
          key: ValueKey('growth-edit-${entry['id']}'),
          size: 30,
          semanticLabel: tr('a11y_edit', 'Redaktə et'),
          onTap: onEdit,
          icon: const AIcon(AIcons.pen, size: 13),
        ),
        const SizedBox(width: 6),
        AIconBtn(
          key: ValueKey('growth-delete-${entry['id']}'),
          size: 30,
          semanticLabel: tr('common_sil', 'Sil'),
          background: a.pink1,
          foreground: a.pinkInk,
          border: false,
          onTap: onDelete,
          icon: const AIcon(AIcons.trash2, size: 13),
        ),
      ]),
    );
  }
}

/// WHO percentile curves (0-60 months) for weight, height and head circumference.
class _WhoPercentileCard extends StatefulWidget {
  const _WhoPercentileCard({required this.entries, required this.birthDate, required this.sex, this.dueDate});
  final List<GrowthEntryLike> entries;
  final String birthDate;
  final Sex sex;

  /// Original EDD: preterm babies are plotted at the corrected age.
  final String? dueDate;

  @override
  State<_WhoPercentileCard> createState() => _WhoPercentileCardState();
}

class _WhoPercentileCardState extends State<_WhoPercentileCard> {
  Measure _measure = 'weight';

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final prematurity = getPrematurityInfo(widget.birthDate, widget.dueDate, tr: tr);
    final ref = prematurity.isPremature && widget.dueDate != null ? widget.dueDate! : widget.birthDate;
    final allPoints = childPoints(widget.entries, _measure, ref, maxAgeMonths);
    final lastPointMonth = allPoints.isNotEmpty ? allPoints.last.month : 0;
    final max = chartMaxMonth(math.max(ageInMonths(ref, todayKey()), lastPointMonth));
    final curve = buildCurveData(_measure, widget.sex, max);
    final points = allPoints.where((p) => p.month <= max).toList();
    final latest = latestPercentile(widget.entries, _measure, widget.sex, ref);
    final chip = latest != null ? percentileChip(latest) : null;
    final (Color tagBg, Color tagInk) = chip?.tone == 'ok'
        ? (a.green1, a.greenInk)
        : chip?.tone == 'watch'
            ? (a.yellow1, a.warnInk)
            : (a.pink1, a.pinkInk);
    final ticks = chartTicks(max);
    final monthShort = tr('who_month_short', 'ay');

    LineChartBarData line(double? Function(GrowthCurvePoint p) pick, Color color, double width, {List<int>? dash}) => LineChartBarData(
          spots: [for (final c in curve) if (pick(c) != null) FlSpot(c.month.toDouble(), pick(c)!)],
          color: color,
          barWidth: width,
          dashArray: dash,
          dotData: const FlDotData(show: false),
        );
    final ys = [
      for (final c in curve) ...[?c.p3, ?c.p97],
      for (final p in points) p.value.toDouble(),
    ];
    final (minY, maxY) = _niceDomain(ys);

    final labels = {
      0: 'P97', 1: 'P85', 2: tr('who_median', 'P50 (median)'), 3: 'P15', 4: 'P3', 5: tr('who_child', 'Körpəniz'),
    };

    return FadeRise(
      dy: 20,
      delay: const Duration(milliseconds: 220),
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            ACardHead(
              title: tr('who_curves_title', 'WHO inkişaf əyriləri'),
              trailing: latest != null
                  ? ARankTag(text: 'P$latest · ${chip != null ? tr(chip.key, chip.fallback) : ''}', background: tagBg, color: tagInk)
                  : null,
            ),
            if (prematurity.isPremature)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${tr('who_corrected_note', 'Qrafik korreksiya olunmuş yaşla qurulur (vaxtından əvvəl doğulub')}'
                  '${prematurity.gestationalWeeksAtBirth != null ? ' — ${prematurity.gestationalWeeksAtBirth} ${tr('who_corrected_weeks', 'həftəlik')}' : ''})',
                  style: TextStyle(fontSize: 11, color: a.inkSoft, height: 1.5),
                ),
              ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(children: [
                for (var i = 0; i < growthMeasures.length; i++) ...[
                  if (i > 0) const SizedBox(width: 8),
                  Expanded(
                    child: Semantics(
                      button: true,
                      toggled: _measure == growthMeasures[i],
                      child: GestureDetector(
                        key: ValueKey('who-measure-${growthMeasures[i]}'),
                        onTap: () => setState(() => _measure = growthMeasures[i]),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: _measure == growthMeasures[i] ? a.peach1 : a.surfaceSoft,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: _measure == growthMeasures[i] ? a.peach2 : const Color(0x00000000), width: 2),
                          ),
                          child: Text(
                            tr(measureLabel(growthMeasures[i]).key, measureLabel(growthMeasures[i]).fallback),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              height: 1.33,
                              color: _measure == growthMeasures[i] ? a.accentInk : a.inkSoft,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
            SizedBox(
              height: 220,
              child: Padding(
                padding: const EdgeInsets.only(top: 6, right: 6),
                child: LineChart(
                  LineChartData(
                    minX: 0,
                    maxX: max.toDouble(),
                    minY: minY,
                    maxY: maxY,
                    gridData: const FlGridData(show: false),
                    borderData: FlBorderData(show: true, border: Border(bottom: BorderSide(color: a.line))),
                    titlesData: FlTitlesData(
                      topTitles: const AxisTitles(),
                      rightTitles: const AxisTitles(),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 26,
                          getTitlesWidget: (v, meta) => SideTitleWidget(
                            meta: meta,
                            child: Text(meta.formattedValue, style: TextStyle(fontSize: 10, color: a.inkSoft)),
                          ),
                        ),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: 6,
                          reservedSize: 22,
                          getTitlesWidget: (v, meta) => ticks.contains(v.round()) && (v - v.round()).abs() < 1e-6
                              ? SideTitleWidget(meta: meta, child: Text('${v.round()}$monthShort', style: TextStyle(fontSize: 10, color: a.inkSoft)))
                              : const SizedBox.shrink(),
                        ),
                      ),
                    ),
                    lineTouchData: LineTouchData(
                      touchTooltipData: LineTouchTooltipData(
                        getTooltipColor: (_) => a.surface,
                        tooltipBorder: BorderSide(color: a.line),
                        getTooltipItems: (spots) => [
                          for (final s in spots)
                            LineTooltipItem('${labels[s.barIndex]}: ${jsNumberToString(s.y)}', TextStyle(fontSize: 11, color: a.ink)),
                        ],
                      ),
                    ),
                    lineBarsData: [
                      line((c) => c.p97, _p97, 1, dash: const [4, 3]),
                      line((c) => c.p85, _p85, 1),
                      line((c) => c.p50, _p50, 2),
                      line((c) => c.p15, _p85, 1),
                      line((c) => c.p3, _p97, 1, dash: const [4, 3]),
                      LineChartBarData(
                        spots: [for (final p in points) FlSpot(p.month, p.value.toDouble())],
                        color: a.peach2,
                        barWidth: 2.5,
                        dotData: FlDotData(
                          getDotPainter: (spot, _, _, _) => FlDotCirclePainter(radius: 3.5, color: a.peach2, strokeWidth: 0),
                        ),
                      ),
                    ],
                  ),
                  duration: Duration.zero,
                ),
              ),
            ),
            Container(
              margin: const EdgeInsets.only(top: 8 + 14),
              padding: const EdgeInsets.only(top: 14),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: a.lineStrong))),
              child: Text(
                tr('who_explainer', 'Yaşıl xətt — WHO medianı (P50). P15-P85 arası tam normaldır; P3-dən aşağı və ya P97-dən yuxarıdırsa pediatrla məsləhətləşin.'),
                style: TextStyle(fontSize: 12, color: a.inkSoft, height: 1.55),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// recharts `domain={['auto', 'auto']}`: the data range widened to "nice" tick steps.
(double, double) _niceDomain(List<double> values) {
  if (values.isEmpty) return (0, 1);
  var lo = values.reduce(math.min), hi = values.reduce(math.max);
  if (lo == hi) {
    lo -= 1;
    hi += 1;
  }
  final raw = (hi - lo) / 4;
  final mag = math.pow(10, (math.log(raw) / math.ln10).floor()).toDouble();
  final norm = raw / mag;
  final step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  return ((lo / step).floor() * step, (hi / step).ceil() * step);
}

/// Add / edit dialog (shadcn Dialog, max-w-md).
class _GrowthForm extends StatefulWidget {
  const _GrowthForm({required this.editing, required this.onSubmit});
  final GrowthRow? editing;
  final Future<bool> Function(({String weight, String height, String head, String notes, String date}) values) onSubmit;

  @override
  State<_GrowthForm> createState() => _GrowthFormState();
}

class _GrowthFormState extends State<_GrowthForm> {
  late final TextEditingController _weight = TextEditingController(text: _num(widget.editing?['weight_kg']));
  late final TextEditingController _height = TextEditingController(text: _num(widget.editing?['height_cm']));
  late final TextEditingController _head = TextEditingController(text: _num(widget.editing?['head_cm']));
  late final TextEditingController _notes = TextEditingController(text: widget.editing?['notes'] as String? ?? '');
  late String _date = widget.editing?['entry_date'] as String? ?? todayKey();

  @override
  void dispose() {
    _weight.dispose();
    _height.dispose();
    _head.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final s = context.tokens.shadcn;
    final label = Tw.sm.copyWith(fontWeight: FontWeight.w500, color: s.foreground);
    final muted = s.muted.withValues(alpha: 0.5);
    Widget field(String title, Widget input, {AIconData? icon, Color? iconColor}) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(children: [
              if (icon != null) ...[AIcon(icon, size: 14, color: iconColor), const SizedBox(width: 4)],
              Flexible(child: Text(title, style: label)),
            ]),
          ),
          input,
        ]);
    final decimal = [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))];
    return ShadDialogFrame(
      radius: 8,
      maxWidth: 448,
      inset: 16,
      children: [
        Row(children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(8)),
            child: AIcon(AIcons.scale, size: 16, color: a.accentInk),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              widget.editing != null
                  ? tr('babygrowthtracker_olcunu_redakte_et_44cfb4', 'Ölçünü redaktə et')
                  : tr('babygrowthtracker_yeni_olcu_elave_et_45ac37', 'Yeni ölçü əlavə et'),
              style: shadTitle(context),
            ),
          ),
        ]),
        field(tr('untranslated_tarix_6hhkyx', 'Tarix'), DateFieldBox(value: _date, onChanged: (v) => setState(() => _date = v), height: 40, radius: 6, background: muted)),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: field(tr('babygrowthtracker_ceki_kq_2f7555', 'Çəki (kq)'),
                ShadInput(fieldKey: const ValueKey('growth-weight'), controller: _weight, placeholder: '5.2', background: muted, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: decimal),
                icon: AIcons.scale,
                iconColor: TwColors.rose500),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: field(tr('babygrowthtracker_boy_sm_3bc841', 'Boy (sm)'),
                ShadInput(fieldKey: const ValueKey('growth-height'), controller: _height, placeholder: '58', background: muted, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: decimal),
                icon: AIcons.ruler,
                iconColor: TwColors.indigo500),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: field(tr('babygrowthtracker_bas_sm_927b99', 'Baş (sm)'),
                ShadInput(fieldKey: const ValueKey('growth-head'), controller: _head, placeholder: '38', background: muted, keyboardType: const TextInputType.numberWithOptions(decimal: true), inputFormatters: decimal),
                icon: AIcons.baby,
                iconColor: TwColors.violet500),
          ),
        ]),
        field(
          tr('babygrowthtracker_qeyd_isteye_bagli_96c689', 'Qeyd (istəyə bağlı)'),
          ShadInput(controller: _notes, placeholder: tr('babygrowthtracker_hekim_yoxlamasi_vaksinasiya_6ce4a0', 'Həkim yoxlaması, vaksinasiya...'), background: muted),
        ),
        AButton(
          key: const ValueKey('growth-save'),
          variant: AButtonVariant.pillSolid,
          block: true,
          leading: const AIcon(AIcons.sparkles, size: 15, strokeWidth: 2.2),
          onPressed: () async {
            final close = await widget.onSubmit((
              weight: _weight.text.replaceFirst(',', '.'),
              height: _height.text.replaceFirst(',', '.'),
              head: _head.text.replaceFirst(',', '.'),
              notes: _notes.text,
              date: _date,
            ));
            if (close && context.mounted) Navigator.of(context).pop();
          },
          child: Text(widget.editing != null ? tr('babygrowthtracker_yenile_570ce2', 'Yenilə') : tr('babygrowthtracker_yadda_saxla_3c7a2d', 'Yadda saxla')),
        ),
      ],
    );
  }
}
