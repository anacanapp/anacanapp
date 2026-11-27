// Ported from: src/components/flow/CycleAnomalyBanner.tsx
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import 'data/flow_hooks.dart';
import 'widgets/flow_ui.dart';

class CycleAnomaly {
  const CycleAnomaly(this.warn, this.title, this.message);
  final bool warn;
  final String title;
  final String message;
}

/// The anomaly list the banner shows (empty → nothing rendered).
List<CycleAnomaly> cycleAnomalies(List<Map<String, dynamic>> cycles, FlowCycleStats stats) {
  if (!cycles.any((c) => c['cycle_length'] != null && c['cycle_length'] != 0)) return const [];
  return [
    if (stats.shortestCycle > 0 && stats.shortestCycle < 21)
      CycleAnomaly(
          true,
          tr('cycleanomalybanner_qisa_tsikl_askar_edildi_b0e734', 'Qısa tsikl aşkar edildi'),
          tr('flow_shortest_cycle_msg', 'Ən qısa tsikliniz {days} gündür. 21 gündən az tsikllər həkim müraciəti tələb edə bilər.')
              .replaceFirst('{days}', '${stats.shortestCycle}')),
    if (stats.longestCycle > 35)
      CycleAnomaly(
          true,
          tr('cycleanomalybanner_uzun_tsikl_askar_edildi_14479e', 'Uzun tsikl aşkar edildi'),
          tr('flow_longest_cycle_msg', 'Ən uzun tsikliniz {days} gündür. 35 gündən uzun tsikllər PCOS və ya hormonal disbalans əlaməti ola bilər.')
              .replaceFirst('{days}', '${stats.longestCycle}')),
    if (cycles.length >= 3 && stats.cycleVariation > 7)
      CycleAnomaly(
          false,
          tr('cycleanomalybanner_duzensiz_tsikl_7b2693', 'Düzənsiz tsikl'),
          tr('flow_cycle_diff_msg', 'Tsikllər arasında {days} gün fərq var. Bu stress, çəki dəyişikliyi və ya tireoid problemlərlə bağlı ola bilər.')
              .replaceFirst('{days}', '${stats.cycleVariation}')),
  ];
}

class CycleAnomalyBanner extends ConsumerWidget {
  const CycleAnomalyBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final cycles = ref.watch(cycleHistoryQuery).data ?? const <Map<String, dynamic>>[];
    final anomalies = cycleAnomalies(cycles, ref.watch(cycleStatsProvider));
    if (anomalies.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < anomalies.length; i++) ...[
          if (i > 0) const SizedBox(height: 10),
          FramerEnter(
            dy: 6,
            child: ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  AListIcon(
                    background: anomalies[i].warn ? a.pink1 : a.blue1,
                    foreground: anomalies[i].warn ? a.pinkInk : a.blueInk,
                    child: AIcon(anomalies[i].warn ? AIcons.triangleAlert : AIcons.info, size: 16),
                  ),
                  const SizedBox(width: 13),
                  Expanded(child: Text(anomalies[i].title, style: context.aText.aListTitle)),
                ]),
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(anomalies[i].message, style: TextStyle(fontSize: 12, height: 1.55, color: a.inkSoft)),
                ),
              ]),
            ),
          ),
        ],
      ]),
    );
  }
}
