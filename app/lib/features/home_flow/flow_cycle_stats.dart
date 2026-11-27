// Ported from: src/components/flow/FlowCycleStats.tsx
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/cycle/cycle_predictions.dart' show isAnomalousCycleLength;
import '../../domain/dates/local_date.dart' show storedCalendarDate;
import 'copy/flow_copy.dart';
import 'data/flow_hooks.dart';
import 'widgets/flow_common.dart';
import 'widgets/flow_ui.dart';

class FlowCycleStats extends ConsumerWidget {
  const FlowCycleStats({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final x = context.aText;
    final q = ref.watch(cycleHistoryQuery);
    final cycles = q.data ?? const <Map<String, dynamic>>[];
    final stats = ref.watch(cycleStatsProvider);
    if (q.isLoading) {
      return const FlowSkeletonCard(bars: [(height: 60, radius: 16), (height: 60, radius: 16)]);
    }
    final day = tr('flowcyclestats_gun_54e78d', 'gün');
    return AFadeIn(
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ACardHead(
            title: tr('flowcyclestats_tsikl_statistikasi_e8cbea', 'Tsikl Statistikası'),
            trailing: Text(tr('flowcyclestats_tsikl_count', '{count} tsikl').replaceFirst('{count}', '${stats.totalCycles}'),
                style: aSectionLinkStyle(context, color: a.inkSoft)),
          ),
          AGrid2(top: 0, children: [
            AStatTile(
              icon: AStatTileIcon(gradient: a.gradPink, child: AIcon(AIcons.calendar, size: 15, color: a.berryInk)),
              label: tr('untranslated_orta_tsikl_vxzcvs', 'Orta Tsikl'),
              value: '${stats.averageCycleLength} $day',
            ),
            AStatTile(
              icon: AStatTileIcon(gradient: a.gradBlue, child: AIcon(AIcons.clock, size: 15, color: a.blueInk)),
              label: tr('untranslated_orta_period_tvx5me', 'Orta Period'),
              value: '${stats.averagePeriodLength} $day',
            ),
            AStatTile(
              icon: AStatTileIcon(gradient: a.gradYellow, child: AIcon(AIcons.trendingUp, size: 15, color: a.warnInk)),
              label: tr('untranslated_diapazon_dgfplg', 'Diapazon'),
              value: '${stats.shortestCycle}–${stats.longestCycle} $day',
            ),
            AStatTile(
              icon: AStatTileIcon(gradient: a.gradGreen, child: AIcon(AIcons.activity, size: 15, color: a.greenInk)),
              label: tr('untranslated_variasiya_nbjh0m', 'Variasiya'),
              value: '${stats.cycleVariation} ${tr('flowcyclestats_gun_ferq_d595f3', 'gün fərq')}',
            ),
          ]),
          if (stats.anomalousCycles > 0)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(feature37Text('cycle_anomaly_note').replaceFirst('{n}', '${stats.anomalousCycles}'), style: x.aListSub),
            ),
          if (cycles.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Padding(padding: const EdgeInsets.only(bottom: 4), child: aTodayInfoEyebrow(context, tr('flowcyclestats_son_tsikller_7e7eb6', 'Son Tsikllər'))),
                for (var i = 0; i < cycles.length && i < 3; i++) _row(context, cycles[i], i == 0, day),
              ]),
            ),
          if (cycles.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Column(children: [
                AIcon(AIcons.calendar, size: 36, color: a.inkFaint),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(tr('flowcyclestats_tsikl_tarixi_yoxdur_b78f8c', 'Tsikl tarixi yoxdur'), textAlign: TextAlign.center, style: x.aListTitle),
                ),
                Text(tr('flowcyclestats_period_gunlerini_qeyd_etdikde__f44b96', 'Period günlərini qeyd etdikdə tarix yaranacaq'),
                    textAlign: TextAlign.center, style: x.aListSub),
              ]),
            ),
        ]),
      ),
    );
  }

  Widget _row(BuildContext context, Map<String, dynamic> c, bool first, String day) {
    final a = context.a;
    final start = storedCalendarDate(c['start_date']);
    final end = storedCalendarDate(c['end_date']);
    final length = c['cycle_length'] as num?;
    final period = c['period_length'] as num?;
    return ARankRow(first: first, children: [
      Container(
        width: 42,
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(13)),
        child: Text('#${c['cycle_number']}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: a.inkSoft)),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text.rich(
            TextSpan(text: start != null ? flowFormat(start, 'd MMM') : '—', children: [
              if (end != null) TextSpan(text: ' – ${flowFormat(end, 'd MMM')}', style: TextStyle(color: a.inkSoft)),
            ]),
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: a.ink, height: 1.5),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              length != null && length != 0
                  ? tr('flowcyclestats_gun_tsikl_f123bc', '{length} gün tsikl').replaceFirst('{length}', '$length')
                  : tr('flowcyclestats_davam_edir_f842cd', 'Davam edir'),
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: a.inkSoft, height: 1.5),
            ),
          ),
        ]),
      ),
      if (isAnomalousCycleLength(length)) ...[
        ARankTag(text: feature37Text('cycle_anomaly_badge'), background: a.yellow1, color: a.warnInk),
        const SizedBox(width: 6),
      ],
      if (period != null && period != 0) ARankTag(text: '$period $day', background: a.peach1, color: a.accentInk),
    ]);
  }
}
