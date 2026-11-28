// Ported from: src/components/partner/v2/NightShiftScreen.tsx
//
// Gecə növbəsi: the mother and her partner plan who gets up with the baby tonight and this week, and log last
// night (wake-ups, a note). Both roles open it.
import 'package:flutter/services.dart' show LengthLimitingTextInputFormatter;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../../../core/auth/auth.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart' show DomainClock;
import '../../settings/ui/settings_ui.dart' show AIconBtn, AInput, ALoader, cssUpper, toasts;
import '../data/partner_data.dart';
import '../data/partner_family.dart';
import '../ui/partner_ui.dart';
import 'screens_copy.dart';
import 'screens_format.dart';
import 'screens_ui.dart';

/// `cycle(date)`: nobody → me → the other → nobody.
NightAssignee? nextNightAssignee(NightAssignee? current, NightAssignee me, NightAssignee other) =>
    current == null ? me : (current == me ? other : null);

/// Past nights (before [today]): mine, theirs and the total wake-ups.
({int mine, int theirs, int wakeups}) nightShiftStats(List<NightShift> shifts, String today, NightAssignee me, NightAssignee other) {
  final past = shifts.where((s) => s.shiftDate.compareTo(today) < 0);
  return (
    mine: past.where((s) => s.assignee == me).length,
    theirs: past.where((s) => s.assignee == other).length,
    wakeups: past.fold(0, (sum, s) => sum + (s.wakeups ?? 0)),
  );
}

String _errorMessage(Object? error) => error is PostgrestException ? error.message : '$error';

class NightShiftScreen extends ConsumerStatefulWidget {
  const NightShiftScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<NightShiftScreen> createState() => _NightShiftScreenState();
}

class _NightShiftScreenState extends ConsumerState<NightShiftScreen> {
  late final DateTime _today = DomainClock.now();
  late final (String, String) _range = (isoDay(addDays(_today, -7)), isoDay(addDays(_today, 6)));
  int _wakeups = 0;
  final TextEditingController _note = TextEditingController();
  String? _lastNightSeen;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  void _error() => toasts(context).show(title: feature37Text('bp_error'), destructive: true);

  void _assign(String date, NightAssignee? assignee) =>
      ref.read(setNightShiftMutation.notifier).mutate((date: date, assignee: assignee, isDone: null, wakeups: null, note: null), onError: (_, _, _) {
        if (mounted) _error();
      });

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final profile = ref.watch(authProfileProvider);
    final partnerProfile = ref.watch(partnerDataProvider.select((d) => d.partnerProfile));
    final me = profile?.lifeStage == 'partner' ? 'partner' : 'mother';
    final other = me == 'mother' ? 'partner' : 'mother';
    final otherName = (partnerProfile?.name ?? '').isNotEmpty
        ? partnerProfile!.name
        : (other == 'mother' ? tr('common_ana', 'Ana') : tr('common_partnyor', 'Partnyor'));
    final query = ref.watch(nightShiftsQuery(_range));
    final set = ref.watch(setNightShiftMutation);
    final shifts = query.data ?? const <NightShift>[];
    final byDate = {for (final s in shifts) s.shiftDate: s};
    final todayKey = isoDay(_today);
    final yesterdayKey = isoDay(addDays(_today, -1));
    final tonight = byDate[todayKey];
    final lastNight = byDate[yesterdayKey];

    // `useEffect(() => { setWakeups(…); setNote(…); }, [lastNight?.updated_at])`.
    if (_lastNightSeen != lastNight?.updatedAt) {
      _lastNightSeen = lastNight?.updatedAt;
      _wakeups = lastNight?.wakeups ?? 0;
      final note = lastNight?.note ?? '';
      // The field may already listen to the controller: change it after this build.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _note.text = note;
      });
    }

    String nameOf(NightAssignee who) => who == me ? feature37Text('ns_me') : otherName;
    final stats = nightShiftStats(shifts, todayKey, me, other);
    final error = query.error;
    final noFamily = error != null && _errorMessage(error).contains('NIGHT_SHIFT_NO_FAMILY');

    BoxDecoration card() => BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow);

    void finishLastNight() {
      if (lastNight == null) return;
      final note = _note.text.trim();
      ref.read(setNightShiftMutation.notifier).mutate(
        (date: yesterdayKey, assignee: lastNight.assignee, isDone: true, wakeups: _wakeups, note: note.isEmpty ? null : note),
        onError: (_, _, _) {
          if (mounted) _error();
        },
      );
    }

    final List<Widget> body;
    if (query.isLoading) {
      body = [Padding(padding: const EdgeInsets.symmetric(vertical: 64), child: Center(child: ALoader(size: 24, color: a.inkFaint)))];
    } else if (error != null) {
      body = [
        PartnerCard(
          padding: const EdgeInsets.all(22),
          child: Text(noFamily ? feature37Text('family_no_link') : feature37Text('family_error'), textAlign: TextAlign.center, style: pText(13.5, color: a.bodyText)),
        ),
      ];
    } else {
      body = [
        Container(
          key: const ValueKey('ns-tonight'),
          padding: const EdgeInsets.all(16),
          decoration: card(),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(13)),
                child: AIcon(AIcons.moon, size: 18, color: a.lavInk),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(feature37Text('pm_night_shift_sub'), style: pText(15.5, weight: FontWeight.w900, color: a.ink)),
                  Text(tonight != null ? nameOf(tonight.assignee) : feature37Text('ns_unassigned'), style: pText(11.5, color: a.inkSoft)),
                ]),
              ),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              for (final (i, who) in [me, other].indexed) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: () {
                    final active = tonight?.assignee == who;
                    return PartnerTap(
                      key: ValueKey('ns-assign-$who'),
                      scale: 0.97,
                      onTap: () => _assign(todayKey, active ? null : who),
                      child: Semantics(
                        toggled: active,
                        child: Container(
                          height: 48,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: active ? a.lavInk : a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            if (active) ...[AIcon(AIcons.check, size: 16, color: a.surface), const SizedBox(width: 6)],
                            Flexible(child: Text(nameOf(who), maxLines: 1, overflow: TextOverflow.ellipsis, style: pText(14, weight: FontWeight.w800, color: active ? a.surface : a.ink))),
                          ]),
                        ),
                      ),
                    );
                  }(),
                ),
              ],
            ]),
          ]),
        ),
        if (lastNight != null) ...[
          const SizedBox(height: 14),
          Container(
            key: const ValueKey('ns-last-night'),
            padding: const EdgeInsets.all(16),
            decoration: card(),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(cssUpper('${feature37Text('ns_last_night')} · ${nameOf(lastNight.assignee)}'), style: pText(11, weight: FontWeight.w800, color: a.inkFaint, ls: 0.06)),
              if (lastNight.isDone)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(top: 3), child: AIcon(AIcons.check, size: 15, color: a.greenInk)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text.rich(TextSpan(children: [
                        TextSpan(text: '${feature37Text('ns_done')} · ${lastNight.wakeups ?? 0} ${feature37Text('ns_total_wakeups')}'),
                        if ((lastNight.note ?? '').isNotEmpty) TextSpan(text: ' · ${lastNight.note}', style: TextStyle(fontWeight: FontWeight.w500, color: a.inkSoft)),
                      ]), style: pText(13.5, weight: FontWeight.w700, color: a.greenInk)),
                    ),
                  ]),
                )
              else ...[
                Padding(
                  padding: const EdgeInsets.only(top: 6, bottom: 10),
                  child: Text(feature37Text('ns_how_night'), style: pText(14, weight: FontWeight.w800, color: a.ink)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                  child: Row(children: [
                    Expanded(child: Text(feature37Text('ns_wakeups'), style: pText(13, weight: FontWeight.w700, color: a.ink))),
                    AIconBtn(
                      key: const ValueKey('ns-minus'),
                      size: 32,
                      semanticLabel: '−',
                      onTap: () => setState(() => _wakeups = _wakeups - 1 < 0 ? 0 : _wakeups - 1),
                      icon: const AIcon(AIcons.minus, size: 14),
                    ),
                    const SizedBox(width: 12),
                    SizedBox(
                      width: 22,
                      child: Text('$_wakeups', key: const ValueKey('ns-wakeups'), textAlign: TextAlign.center, style: pText(18, weight: FontWeight.w900, color: a.ink)),
                    ),
                    const SizedBox(width: 12),
                    AIconBtn(
                      key: const ValueKey('ns-plus'),
                      size: 32,
                      semanticLabel: '+',
                      onTap: () => setState(() => _wakeups = _wakeups + 1 > 20 ? 20 : _wakeups + 1),
                      icon: const AIcon(AIcons.plus, size: 14),
                    ),
                  ]),
                ),
                const SizedBox(height: 8),
                AInput(
                  fieldKey: const ValueKey('ns-note'),
                  controller: _note,
                  placeholder: feature37Text('ns_note_ph'),
                  inputFormatters: [LengthLimitingTextInputFormatter(280)],
                ),
                const SizedBox(height: 10),
                PartnerPillButton(
                  key: const ValueKey('ns-mark-done'),
                  solid: true,
                  expand: true,
                  label: feature37Text('ns_mark_done'),
                  onTap: set.isPending ? null : finishLastNight,
                ),
              ],
            ]),
          ),
        ],
        const SizedBox(height: 14),
        Container(
          key: const ValueKey('ns-week'),
          padding: const EdgeInsets.all(16),
          decoration: card(),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(feature37Text('ns_week'), style: pText(14, weight: FontWeight.w900, color: a.ink)),
            Padding(
              padding: const EdgeInsets.only(top: 2, bottom: 10),
              child: Text(feature37Text('ns_week_hint').replaceFirst('{name}', otherName), style: pText(11, color: a.inkSoft)),
            ),
            Row(children: [
              for (var i = 0; i < 7; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: () {
                    final day = addDays(_today, i);
                    final key = isoDay(day);
                    final shift = byDate[key];
                    final mine = shift?.assignee == me;
                    final weekday = fmtWeekdayShort(day);
                    return PartnerTap(
                      key: ValueKey('ns-day-$key'),
                      scale: 0.93,
                      semanticLabel: '$weekday: ${shift != null ? nameOf(shift.assignee) : feature37Text('ns_unassigned')}',
                      onTap: () => _assign(key, nextNightAssignee(byDate[key]?.assignee, me, other)),
                      child: ExcludeSemantics(
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(color: shift != null ? (mine ? a.lav1 : a.blue1) : a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                          child: Column(children: [
                            Text(weekday, maxLines: 1, overflow: TextOverflow.clip, style: pText(10, weight: FontWeight.w700, color: a.inkSoft)),
                            const SizedBox(height: 4),
                            Text('${day.day}', style: pText(13, weight: FontWeight.w900, color: a.ink)),
                            const SizedBox(height: 4),
                            Text(shift != null ? (mine ? '🙋' : '💙') : '·', style: const TextStyle(fontSize: 14, height: 1)),
                          ]),
                        ),
                      ),
                    );
                  }(),
                ),
              ],
            ]),
          ]),
        ),
        const SizedBox(height: 14),
        Container(
          key: const ValueKey('ns-stats'),
          padding: const EdgeInsets.all(16),
          decoration: card(),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(feature37Text('ns_stats'), style: pText(14, weight: FontWeight.w900, color: a.ink))),
            Row(children: [
              for (final (i, s) in [
                (stats.mine, '${feature37Text('ns_me')} · ${feature37Text('ns_nights')}'),
                (stats.theirs, '$otherName · ${feature37Text('ns_nights')}'),
                (stats.wakeups, feature37Text('ns_total_wakeups')),
              ].indexed) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
                    decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
                    child: Column(children: [
                      Text('${s.$1}', style: pText(20, weight: FontWeight.w900, color: a.ink)),
                      Text(s.$2, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: pText(10.5, color: a.inkSoft)),
                    ]),
                  ),
                ),
              ],
            ]),
          ]),
        ),
        const SizedBox(height: 14),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(feature37Text('ns_tip'), textAlign: TextAlign.center, style: pText(12, color: a.inkSoft)),
        ),
      ];
    }

    return PartnerSubScreen(
      onBack: widget.onBack,
      eyebrow: feature37Text('ns_eyebrow'),
      title: '${feature37Text('pm_night_shift')} 🌙',
      children: body,
    );
  }
}

/// Kept for the screen tests: the error text of a failed night-shift query.
String nightShiftErrorText(Object error) =>
    _errorMessage(error).contains('NIGHT_SHIFT_NO_FAMILY') ? feature37Text('family_no_link') : feature37Text('family_error');
