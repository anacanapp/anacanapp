// Ported from: src/components/partner/v2/PartnerBabyDayScreen.tsx
//
// "Körpə Günü": in the baby stage the partner sees the baby's day so far (feeds, sleep, diapers; RLS "Partners can
// view linked baby logs"), her sleep-training plan for the current child, and a tip.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/dates/local_date.dart';
import '../../../domain/sleep/sleep_training.dart' show PlanState, planDayNumber, planDays;
import '../../baby/hooks/use_baby_care_actions.dart' show bc;
import '../../baby/locale_format.dart' show localeTimeHm;
import '../../settings/ui/settings_ui.dart' show FadeRise;
import '../../tools/sleep_training/sleep_training_sync.dart' show fetchSharedSleepPlan, sleepPlanRemoteProvider;
import '../data/partner_data.dart';
import '../ui/partner_ui.dart';
import 'data/partner_live_rows.dart';
import 'screens_ui.dart';

/// Her sleep-training plan for one child (read-only; same sharing switch as baby logs). Null without an active
/// plan (method + start date).
final partnerSleepPlanProvider = FutureProvider.autoDispose.family<PlanState?, ({String ownerId, String childId})>((ref, arg) async {
  try {
    final r = await fetchSharedSleepPlan(ref.read(sleepPlanRemoteProvider), arg.ownerId, arg.childId, todayKey());
    final plan = r?.plan;
    return plan != null && (plan.method ?? '').isNotEmpty && (plan.planStartDate ?? '').isNotEmpty ? plan : null;
  } catch (_) {
    return null; // optional card
  }
});

/// The day's totals: feeds (+ ml), sleep minutes of finished sleeps, diapers.
({int feeds, num totalMl, int sleeps, double sleepMinutes, int diapers}) babyDayTotals(List<Map<String, dynamic>> logs) {
  final feedings = logs.where((l) => l['log_type'] == 'feeding').toList();
  final sleeps = logs.where((l) => l['log_type'] == 'sleep').toList();
  final diapers = logs.where((l) => l['log_type'] == 'diaper').length;
  final totalMl = feedings.fold<num>(0, (s, l) => s + (l['amount_ml'] is num ? l['amount_ml'] as num : 0));
  var minutes = 0.0;
  for (final l in sleeps) {
    final end = DateTime.tryParse('${l['end_time'] ?? ''}');
    final start = DateTime.tryParse('${l['start_time'] ?? ''}');
    if (end == null || start == null) continue;
    final m = end.difference(start).inMilliseconds / 60000;
    minutes += m > 0 ? m : 0;
  }
  return (feeds: feedings.length, totalMl: totalMl, sleeps: sleeps.length, sleepMinutes: minutes, diapers: diapers);
}

class PartnerBabyDayScreen extends ConsumerWidget {
  const PartnerBabyDayScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final data = ref.watch(partnerDataProvider);
    final profile = data.partnerProfile;
    final userId = profile?.userId ?? '';
    final share = data.sharing.shareBabyLogs;
    final kids = data.partnerChildren;
    final planChild = kids.where((c) => c.isCurrent).firstOrNull ?? kids.firstOrNull;
    final active = userId.isNotEmpty && share;
    final live = active ? ref.watch(partnerLiveRowsProvider((kind: 'baby-day', userId: userId))) : const LiveRowsState(loading: false);
    final plan = active && planChild != null ? ref.watch(partnerSleepPlanProvider((ownerId: userId, childId: planChild.id))).value : null;
    final logs = live.rows;
    final t = babyDayTotals(logs);
    final babyName = (profile?.babyName ?? '').isNotEmpty ? profile!.babyName! : tr('partnerv2_korpe', 'Körpə');
    final sleepH = t.sleepMinutes ~/ 60;
    final sleepM = (t.sleepMinutes % 60).round();

    final stats = [
      (emoji: '🍼', value: '${t.feeds}', sub: t.totalMl > 0 ? '${t.totalMl} ml' : tr('partnerv2_qidalanma', 'Qidalanma'), bg: a.green1, ink: a.greenInk),
      (emoji: '😴', value: t.sleepMinutes > 0 ? '${sleepH}s ${sleepM}d' : '${t.sleeps}', sub: tr('partnerv2_yuxu', 'Yuxu'), bg: a.lav1, ink: a.lavInk),
      (emoji: '🧷', value: '${t.diapers}', sub: tr('partnerv2_bez', 'Bez'), bg: a.yellow1, ink: a.warnInk),
    ];

    String time(Object? iso) {
      final d = DateTime.tryParse('${iso ?? ''}');
      return d == null ? '' : localeTimeHm(d);
    }

    ({AIconData icon, Color bg, Color ink, String label}) meta(Map<String, dynamic> l) {
      if (l['log_type'] == 'feeding') {
        final ml = l['amount_ml'];
        return (icon: AIcons.milk, bg: a.green1, ink: a.greenInk, label: '${tr('partnerv2_qidalanma', 'Qidalanma')}${ml is num && ml != 0 ? ' · $ml ml' : ''}');
      }
      if (l['log_type'] == 'sleep') {
        final end = l['end_time'];
        return (
          icon: AIcons.moon,
          bg: a.lav1,
          ink: a.lavInk,
          label: end != null && '$end'.isNotEmpty
              ? '${tr('partnerv2_yuxu', 'Yuxu')} · ${time(l['start_time'])}–${time(end)}'
              : '${tr('partnerv2_yuxu', 'Yuxu')} · ${tr('partnerv2_davam_edir', 'davam edir')} 😴',
        );
      }
      final diaper = l['diaper_type'];
      return (
        icon: AIcons.baby,
        bg: a.yellow1,
        ink: a.yellowInk,
        label: '${tr('partnerv2_bez_deyisme', 'Bez dəyişmə')}${diaper is String && diaper.isNotEmpty ? ' · $diaper' : ''}',
      );
    }

    return PartnerSubScreen(
      onBack: onBack,
      eyebrow: babyName,
      title: tr('partnerv2_korpe_gunu', 'Körpə Günü'),
      children: [
        if (!share)
          PartnerEmptyCard(
            icon: AIcons.baby,
            title: tr('partnerv2_paylasim_bagli', 'Paylaşım bağlıdır'),
            sub: tr('partnerv2_korpe_paylasimi_bagli_izah', 'Həyat yoldaşınız körpə qeydlərinin paylaşımını hazırda bağlayıb.'),
          )
        else if (live.loading)
          const PartnerRingLoader()
        else ...[
          Row(children: [
            for (final (i, s) in stats.indexed) ...[
              if (i > 0) const SizedBox(width: 10),
              Expanded(
                child: FadeRise(
                  dy: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                    decoration: BoxDecoration(color: s.bg, borderRadius: BorderRadius.circular(18)),
                    child: Column(children: [
                      Text(s.emoji, style: const TextStyle(fontSize: 22, height: 1.5)),
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(s.value, textAlign: TextAlign.center, style: pText(16, weight: FontWeight.w900, color: s.ink)),
                      ),
                      Opacity(opacity: 0.75, child: Text(s.sub, textAlign: TextAlign.center, style: pText(10, weight: FontWeight.w700, color: s.ink))),
                    ]),
                  ),
                ),
              ),
            ],
          ]),
          if (plan != null) ...[
            const SizedBox(height: 16),
            PartnerCard(
              key: const ValueKey('partner-sleep-plan'),
              child: Row(children: [
                Container(
                  width: 36,
                  height: 36,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: a.lav1, shape: BoxShape.circle),
                  child: AIcon(AIcons.moon, size: 15, color: a.lavInk),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${tr('partnerv2_sleep_plan_title', 'Yuxu təlimi planı')} · ${bc('sleeptraining_method_${plan.method}')}', style: context.aText.aListTitle),
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '${formatTr('partnerv2_sleep_plan_day', 'Gün {n}/{total}', {'n': planDayNumber(plan.planStartDate!, todayKey()).clamp(1, planDays), 'total': planDays})}'
                        ' · ${formatTr('partnerv2_sleep_plan_wake', 'Oyanma vaxtı: {time}', {'time': plan.wakeTime})}',
                        style: context.aText.aListSub,
                      ),
                    ),
                  ]),
                ),
              ]),
            ),
          ],
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(color: a.disclaimerBg, border: Border.all(color: a.disclaimerBorder), borderRadius: BorderRadius.circular(16)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.sparkles, size: 15, color: a.disclaimerStrong)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(tr('partnerv2_korpe_gunu_ipucu', 'Gecə növbəsini öz üzərinə götür — ananın 4 saatlıq fasiləsiz yuxusu qızıl dəyərindədir. 💛'),
                    style: pText(11.5, color: a.disclaimerInk)),
              ),
            ]),
          ),
          const SizedBox(height: 16),
          PartnerCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(tr('partnerv2_bugunku_qeydler', 'Bugünkü qeydlər'), style: context.aText.aCardTitle),
              ),
              if (logs.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Text(tr('partnerv2_bugun_qeyd_yoxdur', 'Bu gün hələ qeyd yoxdur'), textAlign: TextAlign.center, style: pText(12.5, color: a.inkSoft)),
                )
              else
                for (final (i, l) in logs.take(12).indexed) ...[
                  if (i > 0) const SizedBox(height: 6),
                  () {
                    final m = meta(l);
                    return FadeRise(
                      key: ValueKey('baby-log-${l['id']}'),
                      dy: 0,
                      dx: -8,
                      delay: Duration(milliseconds: i * 30),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        child: Row(children: [
                          Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(color: m.bg, shape: BoxShape.circle),
                            child: AIcon(m.icon, size: 15, color: m.ink),
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Text(m.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(12.5, weight: FontWeight.w600, color: a.ink))),
                          const SizedBox(width: 10),
                          Text(time(l['start_time']), style: pText(10.5, weight: FontWeight.w600, color: a.inkFaint)),
                        ]),
                      ),
                    );
                  }(),
                ],
            ]),
          ),
        ],
      ],
    );
  }
}
