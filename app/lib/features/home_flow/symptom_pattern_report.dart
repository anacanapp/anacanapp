// Ported from: src/components/flow/SymptomPatternReport.tsx
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/cycle/cycle_utils.dart';
import '../../domain/js_compat.dart' show jsDate, jsRoundInt, jsSorted;
import '../../state/user_store.dart';
import 'data/flow_hooks.dart';
import 'flow_platform.dart';
import 'widgets/flow_ui.dart';

/// Cycle anchor when it is not the Flow profile's (the Mommy module computes its own).
class SymptomAnchor {
  const SymptomAnchor({required this.lastPeriodDate, required this.cycleLength, required this.periodLength});
  final DateTime lastPeriodDate;
  final int cycleLength;
  final int periodLength;
}

Map<String, (String, String)> _phaseLabel() => {
      'menstrual': (tr('symptompatternreport_menstruasiya_1c9b68', 'Menstruasiya'), '🩸'),
      'follicular': (tr('symptompatternreport_follikular_f123bc', 'Follikular'), '🌱'),
      'ovulation': (tr('symptompatternreport_ovulyasiya_f123bc', 'Ovulyasiya'), '🌸'),
      'luteal': (tr('symptompatternreport_lutein_f123bc', 'Lutein'), '🌙'),
    };

class SymptomPattern {
  const SymptomPattern(this.symptom, this.label, this.emoji, this.dominantPhase, this.total, this.percentage);
  final String symptom;
  final String label;
  final String emoji;
  final String dominantPhase;
  final int total;
  final int percentage;
}

/// Top 5 symptoms of [logs] with their dominant cycle phase.
List<SymptomPattern> symptomPatterns(List<Map<String, dynamic>> logs, List<Map<String, dynamic>> symptomsList,
    {required DateTime? lastPeriodDate, required int cycleLength, required int periodLength}) {
  if (lastPeriodDate == null || logs.isEmpty) return const [];
  final counts = <String, (Map<String, int>, int)>{};
  for (final log in logs) {
    final syms = (log['symptoms'] as List?)?.cast<String>() ?? const [];
    if (syms.isEmpty) continue;
    final date = jsDate(log['log_date'])?.toLocal(); // new Date('yyyy-MM-dd') = UTC midnight, read in local fields
    if (date == null) continue;
    final phase = getPhaseInfoForDate(date, lastPeriodDate, cycleLength == 0 ? 28 : cycleLength, periodLength == 0 ? 5 : periodLength).phase;
    for (final s in syms) {
      final c = counts[s] ?? (<String, int>{}, 0);
      c.$1[phase] = (c.$1[phase] ?? 0) + 1;
      counts[s] = (c.$1, c.$2 + 1);
    }
  }
  final list = [
    for (final e in counts.entries)
      () {
        final dom = jsSorted(e.value.$1.entries, (a, b) => b.value - a.value).firstOrNull;
        final info = symptomsList.where((s) => s['symptom_key'] == e.key).firstOrNull;
        return SymptomPattern(e.key, (info?['label'] as String?) ?? e.key, (info?['emoji'] as String?) ?? '•', dom?.key ?? 'unknown', e.value.$2,
            dom == null ? 0 : jsRoundInt(dom.value / e.value.$2 * 100));
      }(),
  ];
  return jsSorted(list, (a, b) => b.total - a.total).take(5).toList();
}

class SymptomPatternReport extends ConsumerWidget {
  const SymptomPatternReport({super.key, this.onUpgrade, this.anchor});
  final VoidCallback? onUpgrade;
  final SymptomAnchor? anchor;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final x = context.aText;
    final isPremium = ref.watch(flowIsPremiumProvider);
    final user = ref.watch(userStoreProvider);
    final lpd = anchor?.lastPeriodDate ?? user.lastPeriodDate;
    final cl = anchor?.cycleLength ?? user.cycleLength;
    final pl = anchor?.periodLength ?? user.periodLength;
    final now = flowNow();
    final q = ref.watch(flowDailyLogsQuery((ymd(DateTime(now.year, now.month, now.day - 90)), ymd(now))));
    final symptomsList = ref.watch(flowSymptomsQuery).data ?? const [];
    final title = tr('symptompatternreport_title_e8cbea', 'Simptom Pattern Analizi');

    if (!isPremium) {
      return AFadeIn(
        child: ACard(
          variant: ACardVariant.cta,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.sparkles, size: 12, strokeWidth: 2.2, color: a.accentInk),
                  const SizedBox(width: 6),
                  Text(title, style: x.aCtaBadge),
                ]),
              ),
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(14)),
                // .a-cta-deco #d96c2b, .dark .a-cta-deco rgba(255,255,255,.4)
                child: AIcon(AIcons.lock, size: 16, color: context.tokens.isDark ? const Color(0x66FFFFFF) : const Color(0xFFD96C2B)),
              ),
            ]),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Text(
                  tr('symptompatternreport_simptomlarinizin_tsikl_merhele_e8cc92',
                      'Simptomlarınızın tsikl mərhələləri üzrə paylanmasını görün. Hansı simptomun hansı fazada baş verdiyini AI ilə kəşf edin.'),
                  style: x.aCtaText),
            ),
            ACtaButton(label: tr('symptompatternreport_premium_a_kec_9dadb6', 'Premium-a keç'), onTap: onUpgrade, tapScale: null),
          ]),
        ),
      );
    }
    if (q.isLoading) {
      return const FlowSkeletonCard(titleWidthFactor: 0.5, bars: [(height: 48, radius: 14), (height: 48, radius: 14)]);
    }
    final patterns = symptomPatterns(q.data ?? const [], symptomsList, lastPeriodDate: lpd, cycleLength: cl, periodLength: pl);
    if (patterns.isEmpty) {
      return ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(title, style: x.heading(x.aCardTitle))),
          Text(
              tr('symptompatternreport_hele_kifayet_qeder_data_yoxdur_8ad930',
                  'Hələ kifayət qədər data yoxdur. Gündəlik simptomlarınızı qeyd edin və 1-2 tsikldən sonra burada paylanma görəcəksiniz.'),
              style: x.aListSub),
        ]),
      );
    }
    final phases = _phaseLabel();
    return AFadeIn(
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Expanded(child: Text(title, style: x.heading(x.aCardTitle))),
              Text(tr('flowmoodchart_son_90_gun', 'Son 90 gün'), style: aSectionLinkStyle(context, color: a.inkSoft)),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(tr('symptompatternreport_son_90_gun_uzre_top_5_simptom__c1b6a8', 'Son 90 gün üzrə top 5 simptom və dominant faza:'), style: x.aListSub),
          ),
          for (var i = 0; i < patterns.length; i++)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  AListIcon(background: a.surfaceSoft, child: Text(patterns[i].emoji, style: const TextStyle(fontSize: 17))),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(patterns[i].label, maxLines: 1, overflow: TextOverflow.ellipsis, softWrap: false, style: x.aListTitle),
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '${patterns[i].total} ${tr('symptompatternreport_defe_05c318', 'dəfə •')} ${patterns[i].percentage}% '
                          '${(phases[patterns[i].dominantPhase] ?? (patterns[i].dominantPhase, '•')).$2} '
                          '${(phases[patterns[i].dominantPhase] ?? (patterns[i].dominantPhase, '•')).$1}',
                          style: x.aListSub,
                        ),
                      ),
                    ]),
                  ),
                  const SizedBox(width: 13),
                  Text('${patterns[i].percentage}%', style: x.aListValue),
                ]),
                Padding(
                  padding: const EdgeInsetsDirectional.only(start: 53),
                  child: AInlineBar(percent: patterns[i].percentage.toDouble()),
                ),
              ]),
            ),
        ]),
      ),
    );
  }
}
