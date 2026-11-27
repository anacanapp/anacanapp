// Ported from: src/components/flow/FlowRemindersCard.tsx
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import 'copy/flow_copy.dart';
import 'data/flow_hooks.dart';
import 'data/phase_info.dart';
import 'widgets/flow_ui.dart';

class FlowRemindersCard extends ConsumerStatefulWidget {
  const FlowRemindersCard({super.key});
  @override
  ConsumerState<FlowRemindersCard> createState() => _FlowRemindersCardState();
}

class _FlowRemindersCardState extends ConsumerState<FlowRemindersCard> {
  bool _showAll = false;
  bool _initFired = false;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final q = ref.watch(flowRemindersQuery);
    final reminders = q.data ?? const <Map<String, dynamic>>[];
    final toggling = ref.watch(toggleReminderMutation).isPending;
    ref.watch(initializeFlowRemindersMutation);

    // Default reminders on the first open when there are none.
    if (!q.isLoading && reminders.isEmpty && !_initFired) {
      _initFired = true;
      scheduleMicrotask(() {
        if (mounted) ref.read(initializeFlowRemindersMutation.notifier).mutate(null);
      });
    }
    if (q.isLoading) {
      return const FlowSkeletonCard(bars: [(height: 48, radius: 14), (height: 48, radius: 14)]);
    }
    final shown = _showAll ? reminders : reminders.take(3).toList();
    final enabledCount = reminders.where((r) => r['is_enabled'] == true).length;

    Widget row(Map<String, dynamic> r, {bool first = false}) {
      final type = r['reminder_type'] as String? ?? 'custom';
      final enabled = r['is_enabled'] == true;
      final time = r['time_of_day'] as String?;
      final daysBefore = (r['days_before'] as num?) ?? 0;
      return Opacity(
        opacity: enabled ? 1 : 0.55,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
          child: Row(children: [
            AListIcon(background: a.surfaceSoft, child: Text(kReminderTypeInfo[type]?.emoji ?? '🔔', style: const TextStyle(fontSize: 17))),
            const SizedBox(width: 13),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Saved titles keep the language of the day they were created; show the current one.
                Text(type != 'custom' ? feature37Text('reminder_$type') : (r['title'] as String? ?? ''), style: x.aListTitle),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Row(children: [
                    AIcon(AIcons.clock, size: 11, color: a.inkSoft),
                    const SizedBox(width: 5),
                    Text(time != null && time.length >= 5 ? time.substring(0, 5) : '09:00', style: x.aListSub),
                    if (daysBefore > 0) ...[
                      const SizedBox(width: 5),
                      Text('· ${tr('flow_days_before', '{days} gün əvvəl').replaceFirst('{days}', '$daysBefore')}', style: x.aListSub),
                    ],
                  ]),
                ),
              ]),
            ),
            const SizedBox(width: 13),
            ShadSwitch(
              checked: enabled,
              onChanged: toggling
                  ? null
                  : (_) => unawaited(ref.read(toggleReminderMutation.notifier).mutateAsync((id: r['id'] as String, isEnabled: !enabled)).then((_) {}, onError: (Object _) {})),
            ),
          ]),
        ),
      );
    }

    return AFadeIn(
      child: ACard(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(children: [
              Expanded(child: Text(tr('flowreminderscard_xatirlatmalar_ddd8e7', 'Xatırlatmalar'), style: x.heading(x.aCardTitle))),
              ATag(on: true, child: Text('$enabledCount ${tr('flowreminderscard_aktiv_d7a82c', 'aktiv')}')),
            ]),
          ),
          if (reminders.isNotEmpty) ...[
            for (var i = 0; i < shown.length; i++) row(shown[i], first: i == 0), // .a-list-row:first-child
            if (reminders.length > 3)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _showAll = !_showAll),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
                  child: Row(children: [
                    Expanded(
                      child: Text(
                        _showAll
                            ? tr('flowreminderscard_daha_az_goster_47a81d', 'Daha az göstər')
                            : tr('flowreminderscard_hamisini_goster_f123bc', 'Hamısını göstər ({count})').replaceFirst('{count}', '${reminders.length}'),
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: a.inkSoft),
                      ),
                    ),
                    AnimatedRotation(
                      turns: _showAll ? 0.25 : 0,
                      duration: const Duration(milliseconds: 150),
                      child: AIcon(AIcons.chevronRight, size: 15, color: a.inkFaint, mirrorInRtl: true),
                    ),
                  ]),
                ),
              ),
          ] else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Column(children: [
                AIcon(AIcons.bell, size: 36, color: a.inkFaint),
                const SizedBox(height: 8),
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(tr('flowreminderscard_hec_bir_xatirlatma_yoxdur_dc234b', 'Heç bir xatırlatma yoxdur'), style: x.aListTitle),
                ),
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(tr('flowreminderscard_tenzimlemelerden_xatirlatmalar_389fd8', 'Tənzimləmələrdən xatırlatmalar əlavə edin'), style: x.aListSub),
                ),
              ]),
            ),
        ]),
      ),
    );
  }
}
