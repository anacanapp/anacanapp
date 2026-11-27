// Ported from: src/components/mommy/MommyPeriodTracker.tsx (MommyPeriodBanner only — the period screen
//              `mommy-period` is ported by features/home_flow and opened through the shell)
//
// Before anything is recorded since the birth: an invitation card (open the tracker / "Başladı"). Afterwards a
// minimal tracker: status, last 14 days (tap toggles a day; days before the birth are locked), and
// started / continues / ended actions. The end marker is kept on the device
// (`anacan.mommyPeriod.endedOn.<userId>`).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/i18n/date_utils.dart' show formatDatePattern;
import '../../../core/i18n/language_controller.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../state/persisted_store.dart';
import '../copy/mommy_copy.dart';
import 'mommy_period.dart';

String mommyPeriodEndedKey(String userId) => 'anacan.mommyPeriod.endedOn.$userId';

class MommyPeriodBanner extends ConsumerStatefulWidget {
  const MommyPeriodBanner({super.key, required this.onOpen});
  final VoidCallback onOpen;

  @override
  ConsumerState<MommyPeriodBanner> createState() => _MommyPeriodBannerState();
}

class _MommyPeriodBannerState extends ConsumerState<MommyPeriodBanner> {
  String? _endedOn;
  String? _endedUser;
  bool _pending = false;

  String? _readEnded(String? userId) {
    if (userId == null) return null;
    try {
      return ref.read(localStoreProvider).getItem(mommyPeriodEndedKey(userId));
    } catch (_) {
      return null;
    }
  }

  Future<void> _save(MommyPeriodWrite input, {String? ended}) async {
    final toast = AToastHost.of(context);
    final userId = ref.read(authUserProvider)?.id;
    setState(() => _pending = true);
    try {
      await ref.read(mommyPeriodActionsProvider)(input);
      if (ended != null && userId != null) {
        try {
          ref.read(localStoreProvider).setItem(mommyPeriodEndedKey(userId), ended);
        } catch (_) {}
        if (mounted) setState(() => _endedOn = ended);
      }
      toast.success(feature37Text('period_saved'));
    } catch (_) {
      toast.error(feature37Text('period_failed'));
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    final userId = ref.watch(authUserProvider)?.id;
    if (_endedUser != userId) {
      _endedUser = userId;
      _endedOn = _readEnded(userId);
    }
    final birth = ref.watch(authProfileProvider)?.babyBirthDate;
    final since = birth != null && birth.length >= 10 ? birth.substring(0, 10) : (birth?.isNotEmpty == true ? birth : null);
    final logs = ref.watch(mommyPeriodDayLogsQuery).data ?? const <Map<String, dynamic>>[];
    final flowDays = [
      for (final row in logs)
        if ((since == null || '${row['log_date']}'.compareTo(since) >= 0) && rowHasFlow(row)) '${row['log_date']}',
    ];
    final today = formatYmd(DomainClock.now());
    final status = mommyPeriodStatus(flowDays, today, _endedOn);
    String t(String key) => feature37Text(key, language);
    final a = context.a;
    final x = context.aText;

    void logToday() => _save(MommyPeriodWrite(dates: [today], flow: 'unspecified', preserveExisting: true));
    void endOn(String last) =>
        _save(MommyPeriodWrite(dates: eachDay(status.start!, last), flow: 'unspecified', complete: true, preserveExisting: true), ended: last);
    void toggleDay(String day) {
      if (since != null && day.compareTo(since) < 0) return;
      _save(flowDays.contains(day) ? MommyPeriodWrite(dates: [day], flow: 'clear') : MommyPeriodWrite(dates: [day], flow: 'unspecified'));
    }

    Widget pill(String label, VoidCallback onTap, {bool solid = false, bool expand = false}) {
      final b = AButton(
        variant: solid ? AButtonVariant.pillSolid : AButtonVariant.pillSoft,
        block: expand,
        onPressed: _pending ? null : onTap,
        child: Text(label),
      );
      return Semantics(button: true, label: label, child: Opacity(opacity: _pending ? 0.5 : 1, child: b));
    }

    if (status.state == 'none') {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: ACard(
          color: a.pink1,
          child: Row(children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: widget.onOpen,
                child: Row(children: [
                  const AListIcon(background: Color(0x00000000), child: AIcon(AIcons.calendarDays, size: 22)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(t('period_banner_title'), style: x.aListTitle),
                      Padding(padding: const EdgeInsets.only(top: 2), child: Text(t('period_banner_body'), style: x.aListSub)),
                    ]),
                  ),
                ]),
              ),
            ),
            const SizedBox(width: 12),
            pill(t('period_start'), logToday),
          ]),
        ),
      );
    }

    final ongoing = status.state == 'today' || status.state == 'askToday';
    final strip = recentDays(today);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: ACard(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(gradient: a.gradPink, borderRadius: BorderRadius.circular(13)),
              child: Center(child: AIcon(AIcons.droplets, size: 17, color: a.berryInk)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('period_card_title'), style: x.aListTitle),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    ongoing
                        ? t('period_day_n').replaceFirst('{n}', '${status.dayNumber}')
                        : t('period_last_short').replaceFirst('{date}', formatDatePattern(parseIsoDateFns(status.lastDay!)!, 'd MMM')),
                    style: x.aListSub,
                  ),
                ),
              ]),
            ),
            const SizedBox(width: 12),
            GestureDetector(
              onTap: widget.onOpen,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Text(t('period_calendar'), style: x.aSectionLink),
                const SizedBox(width: 4),
                AIcon(AIcons.chevronRight, size: 13, color: x.aSectionLink.color, mirrorInRtl: true),
              ]),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Semantics(
              container: true,
              label: t('period_card_title'),
              child: Row(
                key: const ValueKey('period-strip'),
                children: [
                  for (var i = 0; i < strip.length; i++) ...[
                    if (i > 0) const SizedBox(width: 3),
                    Expanded(
                      child: _PeriodDay(
                        day: strip[i],
                        on: flowDays.contains(strip[i]),
                        today: strip[i] == today,
                        disabled: (since != null && strip[i].compareTo(since) < 0) || _pending,
                        onTap: () => toggleDay(strip[i]),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (status.state == 'askToday') Padding(padding: const EdgeInsets.only(top: 10), child: Text(t('period_ask_today'), style: x.aListSub)),
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Row(children: [
              if (status.state == 'idle') Expanded(child: pill(t('period_start'), logToday, expand: true)),
              if (status.state == 'askToday') ...[
                Expanded(child: pill(t('period_continue'), logToday, expand: true)),
                const SizedBox(width: 8),
                Expanded(child: pill(t('period_end'), () => endOn(status.lastDay!), solid: true, expand: true)),
              ],
              if (status.state == 'today') Expanded(child: pill(t('period_end'), () => endOn(today), solid: true, expand: true)),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// `.a-period-day` (+ `.on` #ef4b6c / white, `.today` ink border, `:disabled` opacity .35), max 26px circle.
class _PeriodDay extends StatelessWidget {
  const _PeriodDay({required this.day, required this.on, required this.today, required this.disabled, required this.onTap});
  final String day;
  final bool on;
  final bool today;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final d = parseIsoDateFns(day)!;
    return Semantics(
      button: true,
      toggled: on,
      enabled: !disabled,
      label: formatDatePattern(d, 'd MMMM'),
      child: GestureDetector(
        onTap: disabled ? null : onTap,
        child: Opacity(
          opacity: disabled ? 0.35 : 1,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 26),
              child: AspectRatio(
                aspectRatio: 1,
                child: Container(
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    // `.a-period-day.on { background: #ef4b6c }` (anacan-design.css:3030)
                    color: on ? const Color(0xFFEF4B6C) : t.surfaceSoft,
                    border: Border.all(color: today ? t.ink : const Color(0x00000000), width: 1.5),
                  ),
                  child: Text('${d.day}',
                      style: TextStyle(fontSize: 10, height: 1, fontWeight: FontWeight.w600, color: on ? const Color(0xFFFFFFFF) : t.inkSoft)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
