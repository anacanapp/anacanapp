// Ported from: src/components/flow/PeriodDelayBanner.tsx
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../state/user_store.dart';
import 'data/flow_hooks.dart';
import 'data/flow_repository.dart';
import 'flow_platform.dart';
import 'widgets/flow_ui.dart';

/// Days the period is late against the average cycle (`daysSince - avgCycle`), or null without a last period.
int? periodDelayDays({required DateTime? lastPeriodDate, required int averageCycleLength, required int cycleLength, required DateTime now}) {
  if (lastPeriodDate == null) return null;
  final today = DateTime(now.year, now.month, now.day);
  final lpd = DateTime(lastPeriodDate.year, lastPeriodDate.month, lastPeriodDate.day);
  final daysSince = ((today.millisecondsSinceEpoch - lpd.millisecondsSinceEpoch) / 86400000).floor();
  final avg = averageCycleLength != 0 ? averageCycleLength : (cycleLength != 0 ? cycleLength : 28);
  return daysSince - avg;
}

class PeriodDelayBanner extends ConsumerStatefulWidget {
  const PeriodDelayBanner({super.key});
  @override
  ConsumerState<PeriodDelayBanner> createState() => _PeriodDelayBannerState();
}

class _PeriodDelayBannerState extends ConsumerState<PeriodDelayBanner> {
  String? _effectKey;

  /// The throttled `notifications` insert (once per 24 h, `user_preferences.last_delay_notification_at`).
  Future<void> _notify(String uid, int delayDays) async {
    final repo = ref.read(flowRepositoryProvider);
    final key = _effectKey;
    try {
      final last = await repo.lastDelayNotificationAt(uid);
      if (!mounted || key != _effectKey) return;
      final lastAt = last == null ? null : DateTime.tryParse(last);
      final hoursAgo = lastAt == null ? double.infinity : (DateTime.now().millisecondsSinceEpoch - lastAt.millisecondsSinceEpoch) / 3.6e6;
      if (hoursAgo < 24) return;
      await repo.insertNotification({
        'user_id': uid,
        'title': 'Period gecikir',
        'message':
            '${tr('flow_period_delay_1', 'Periodunuz təxmini tarixdən')} $delayDays ${tr('flow_period_delay_2', 'gün gecikir. Hamiləlik testi etməyi və ya Dr. Anacan-dan soruşmağı düşünün.')}',
        'notification_type': 'flow_delay',
        'is_read': false,
      });
      await repo.setLastDelayNotificationAt(uid, DateTime.now().toUtc().toIso8601String());
    } catch (_) {
      // best effort, like the un-awaited effect
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final cycleLength = ref.watch(effectiveCycleLengthProvider);
    final lastPeriodDate = ref.watch(userStoreProvider.select((s) => s.lastPeriodDate));
    final uid = ref.watch(flowUserIdProvider);
    final stats = ref.watch(cycleStatsProvider);
    final avgCycle = stats.averageCycleLength != 0 ? stats.averageCycleLength : (cycleLength != 0 ? cycleLength : 28);
    final delay = periodDelayDays(
        lastPeriodDate: lastPeriodDate, averageCycleLength: stats.averageCycleLength, cycleLength: cycleLength, now: flowNow());

    final effect = '$delay|$uid|$lastPeriodDate';
    if (effect != _effectKey) {
      _effectKey = effect;
      if (lastPeriodDate != null && delay != null && delay >= 3 && uid != null) unawaited(_notify(uid, delay));
    }
    if (lastPeriodDate == null || delay == null || delay < 3) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: AFadeIn(
        child: Container(
          clipBehavior: Clip.antiAlias,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: a.alertBg,
            borderRadius: BorderRadius.circular(a.radiusLg),
            border: Border.all(color: const Color(0x24D8425C)), // .a-alert-card rgba(216, 66, 92, 0.14)
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const AIcon(AIcons.circleAlert, size: 13, strokeWidth: 2.3, color: Color(0xFFC23C56)),
                const SizedBox(width: 6),
                Text(tr('flow_cycle_alert', 'Tsikl xəbərdarlığı').toUpperCase(),
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: em(0.06, 11), color: const Color(0xFFC23C56), height: 1.5)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(formatTr('perioddelaybanner_period_late', 'Periodunuz {days} gün gecikir', {'days': delay}),
                  style: context.aText.heading(TextStyle(fontSize: 21, color: a.alertInk, height: 1.5))),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                tr('perioddelaybanner_avg_cycle_desc',
                        'Orta tsikliniz {days} gündür. Stress, çəki dəyişikliyi, hormonal dalğalanma və ya hamiləlik səbəb ola bilər. Hamiləlik testi etməyi düşünün.')
                    .replaceFirst('{days}', '$avgCycle'),
                style: TextStyle(fontSize: 12.5, height: 1.6, color: a.alertSoft),
              ),
            ),
            ACtaButton(
              label: tr('perioddelaybanner_dr_anacan_dan_sorus_1fb5f1', 'Dr. Anacan-dan soruş'),
              icon: const AIcon(AIcons.messageCircle, size: 14, strokeWidth: 2.2),
              color: a.pink2,
              tapScale: null,
              onTap: () => ref.read(flowOpenAiChatProvider)(
                  '${tr('flow_period_delay_prompt_1', 'Periodum')} $delay ${tr('flow_period_delay_prompt_2', 'gün gecikib, nə edə bilərəm?')}'),
            ),
          ]),
        ),
      ),
    );
  }
}
