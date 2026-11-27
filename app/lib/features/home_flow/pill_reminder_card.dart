// Ported from: src/components/flow/PillReminderCard.tsx
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../../state/user_store.dart';
import 'data/flow_hooks.dart';
import 'flow_platform.dart';
import 'widgets/flow_common.dart';
import 'widgets/flow_ui.dart';

/// Local notification id of the daily pill reminder.
const int pillNotificationId = 91201;
const String _defaultTitleAz = 'Həbinizi qəbul edin';

/// The `flow-pill` namespace items for [enabled] / [time] (`HH:mm`) / [title].
List<StoredNotification> pillNotifications({required bool enabled, required String time, required String title, required DateTime now}) {
  if (!enabled) return const [];
  final p = time.split(':').map((x) => int.tryParse(x) ?? 0).toList();
  final at = DateTime(now.year, now.month, now.day, p[0], p.length > 1 ? p[1] : 0);
  return [
    StoredNotification(
      id: pillNotificationId,
      title: title.isNotEmpty ? title : tr('pillremindercard_hebinizi_qebul_edin_03c5be', _defaultTitleAz),
      body: tr('pillremindercard_gundelik_hebinizi_qebul_etmek__064f3f', '💊 Gündəlik həbinizi qəbul etmək vaxtıdır'),
      at: at.millisecondsSinceEpoch,
      repeat: 'day',
    ),
  ];
}

class PillReminderCard extends ConsumerStatefulWidget {
  const PillReminderCard({super.key});
  @override
  ConsumerState<PillReminderCard> createState() => _PillReminderCardState();
}

class _PillReminderCardState extends ConsumerState<PillReminderCard> {
  String _time = '09:00';
  final _title = TextEditingController();
  bool _editing = false;
  String? _syncKey;

  String _pillTitle(Map<String, dynamic>? pill) {
    final t = pill?['title'] as String?;
    if (t == null || t.isEmpty || t == _defaultTitleAz) return tr('pillremindercard_hebinizi_qebul_edin_03c5be', _defaultTitleAz);
    return t;
  }

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _schedule(bool enabled, String time, String title) async {
    final planner = ref.read(flowNotificationPlannerProvider);
    if (!planner.isNativePlatform) return;
    try {
      // Daily, through the central scheduler; turning the switch on is the user's own request, so it may ask.
      await planner.setLocalNotifications('flow-pill', pillNotifications(enabled: enabled, time: time, title: title, now: flowNow()),
          ask: true, cancelIds: const [pillNotificationId]);
    } catch (_) {}
  }

  Map<String, Object?> _row(bool enabled) => {
        'reminder_type': 'pill',
        'time_of_day': '$_time:00',
        'days_before': 0,
        'is_enabled': enabled,
        'title': _title.text,
        'message': tr('pillremindercard_gundelik_hebinizi_qebul_edin_ea7547', '💊 Gündəlik həbinizi qəbul edin'),
      };

  Future<void> _save(Map<String, dynamic>? pill) async {
    final toast = flowToast(context);
    final enabled = (pill?['is_enabled'] as bool?) ?? true;
    await ref.read(saveFlowReminderMutation.notifier).mutateAsync(_row(enabled));
    await _schedule(enabled, _time, _title.text);
    toast?.success(tr('pillremindercard_heb_xatirlatmasi_yadda_saxlani_27cacb', 'Həb xatırlatması yadda saxlanıldı'));
    if (mounted) setState(() => _editing = false);
  }

  Future<void> _toggle(Map<String, dynamic>? pill) async {
    if (pill == null) {
      await ref.read(saveFlowReminderMutation.notifier).mutateAsync(_row(true));
      await _schedule(true, _time, _title.text);
    } else {
      final enabled = pill['is_enabled'] == true;
      await ref.read(toggleReminderMutation.notifier).mutateAsync((id: pill['id'] as String, isEnabled: !enabled));
      await _schedule(!enabled, _time, _title.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final reminders = ref.watch(flowRemindersQuery).data ?? const [];
    final pill = reminders.where((r) => r['reminder_type'] == 'pill').firstOrNull;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final saving = ref.watch(saveFlowReminderMutation).isPending;
    final toggling = ref.watch(toggleReminderMutation).isPending;

    // useEffect([pill?.id, language]) + initial state.
    final key = '${pill?['id']}|$language';
    if (_syncKey != key) {
      final first = _syncKey == null;
      _syncKey = key;
      if (pill != null || first) {
        final t = pill?['time_of_day'] as String?;
        _time = (t != null && t.length >= 5) ? t.substring(0, 5) : '09:00';
        _title.text = _pillTitle(pill);
      }
    }
    final enabled = (pill?['is_enabled'] as bool?) ?? false;

    Widget editing() => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(tr('pillremindercard_basliq_e1f6c5', 'Başlıq'), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: a.inkSoft)),
          ),
          _AInput(child: EditableText(
            controller: _title,
            focusNode: _focus,
            style: TextStyle(fontSize: 13, color: a.ink),
            cursorColor: a.peach2,
            backgroundCursorColor: a.inkFaint,
          )),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(tr('untranslated_vaxt_8etncj', 'Vaxt'), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: a.inkSoft)),
          ),
          GestureDetector(
            onTap: () async {
              final p = _time.split(':').map(int.parse).toList();
              final picked = await showTimePicker(context: context, initialTime: TimeOfDay(hour: p[0], minute: p[1]));
              if (picked != null) {
                setState(() => _time = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
              }
            },
            child: _AInput(minHeight: 48, child: Text(_time, style: TextStyle(fontSize: 13, color: a.ink))),
          ),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: Opacity(
                opacity: saving ? 0.6 : 1,
                child: AButton(variant: AButtonVariant.pillSolid, onPressed: saving ? null : () => unawaited(_save(pill)), child: Text(tr('untranslated_yadda_saxla_bpdu9v', 'Yadda saxla'))),
              ),
            ),
            const SizedBox(width: 8),
            ATag(onTap: () => setState(() => _editing = false), child: Text(tr('pillremindercard_legv_et_b5e49c', 'Ləğv et'))),
          ]),
        ]);

    Widget display() => GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => setState(() => _editing = true),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_title.text, style: x.aListTitle),
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(children: [
                      AIcon(AIcons.clock, size: 11, color: a.inkSoft),
                      const SizedBox(width: 5),
                      Text('${tr('pillremindercard_her_gun_f4fe36', 'Hər gün')} $_time', style: x.aListSub),
                    ]),
                  ),
                ]),
              ),
              const SizedBox(width: 10),
              Text(tr('pillremindercard_redakte_d53ba7', 'Redaktə'), style: x.aListValue.copyWith(color: a.accentInk)),
            ]),
          ),
        );

    return AFadeIn(
      child: ACard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: EdgeInsets.only(bottom: enabled ? 12 : 8),
            child: Row(children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: a.gradYellow, borderRadius: BorderRadius.circular(11)),
                child: AIcon(AIcons.pill, size: 16, color: a.warnInk),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(tr('pillremindercard_heb_xatirlatmasi_e3e934', 'Həb Xatırlatması'), style: x.heading(x.aCardTitle))),
              ShadSwitch(
                checked: enabled,
                semanticLabel: tr('pillremindercard_heb_xatirlatmasi_e3e934', 'Həb Xatırlatması'),
                onChanged: saving || toggling ? null : (_) => unawaited(_toggle(pill)),
              ),
            ]),
          ),
          if (enabled) _editing ? editing() : display(),
          if (!enabled)
            Text(tr('pillremindercard_gundelik_kontrasepsiya_ve_ya_d_8f8e44', 'Gündəlik kontrasepsiya və ya dərman xatırlatması üçün aktiv edin.'), style: x.aListSub),
        ]),
      ),
    );
  }

  final FocusNode _focus = FocusNode();
}

/// `.a-input`: padding 10×14, radius 12, 1px `--a-line-strong`, surface, 13px.
class _AInput extends StatelessWidget {
  const _AInput({required this.child, this.minHeight = 0});
  final Widget child;
  final double minHeight;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      constraints: BoxConstraints(minHeight: minHeight),
      alignment: AlignmentDirectional.centerStart,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
      child: child,
    );
  }
}
