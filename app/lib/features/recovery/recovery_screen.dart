// Ported from: src/components/recovery/RecoveryScreen.tsx (RecoveryScreen, Shell, WeekTab, CheckinTab,
//              SeverityAlert, SignsTab), src/styles/care.css (.cx-weeks, .cx-tabs, .cx-pain, .cx-mood, .cx-flag,
//              .cx-check, .cx-hist)
//
// Postpartum recovery: the birth type first, then four tabs (this week, daily check-in, Kegel trainer, warning
// signs). `recovery/kegel` opens the Kegel tab.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/auth/auth.dart';
import '../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../design/design.dart';
import '../../domain/health/emergency.dart' show getEmergencyNumber;
import '../../domain/js_compat.dart';
import '../home/data/appointments.dart' show appointmentsApiProvider;
import '../health_screens/common/care_ui.dart';
import '../health_screens/common/feature_text.dart' show FeatureText;
import '../health_screens/common/health_format.dart';
import '../health_screens/common/health_ports.dart';
import '../profile/profile_interfaces.dart' show accountActionsProvider;
import '../settings/ui/settings_ui.dart' show px, toasts;
import '../tools/health_common/health_common.dart' show healthLinkLauncherProvider, healthPaywallProvider;
import '../tools/pregnancy_common/pregnancy_ports.dart' show pregnancyHapticsProvider, sosAlertPortProvider;
import 'kegel_trainer.dart';
import 'recovery.dart';
import 'recovery_data.dart';

const List<String> _moodEmoji = ['😢', '😟', '😐', '🙂', '😊'];

/// RecoveryScreen inline pain colours.
Color _painColor(int n) => n <= 3 ? const Color(0xFF63BD8B) : (n <= 6 ? const Color(0xFFF59F00) : const Color(0xFFE03131));

/// 'week' | 'checkin' | 'kegel' | 'signs'.
typedef RecoveryTab = String;

class RecoveryScreen extends ConsumerStatefulWidget {
  const RecoveryScreen({super.key, required this.onBack, this.onNavigateToTool, this.initialTab = 'week'});
  final VoidCallback onBack;
  final void Function(String tool)? onNavigateToTool;
  final RecoveryTab initialTab;
  @override
  ConsumerState<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends ConsumerState<RecoveryScreen> {
  late BirthType? _birthType = ref.read(authProfileProvider)?.row['birth_type'] as String?;
  bool _choosing = false;
  late RecoveryTab _tab = widget.initialTab;

  Future<void> _chooseType(String userId, BirthType type) async {
    setState(() {
      _birthType = type;
      _choosing = false;
    });
    try {
      await ref.read(recoveryActionsProvider).saveBirthType(userId, type);
      unawaited(ref.read(accountActionsProvider).refreshProfile());
    } catch (_) {
      if (mounted) toasts(context).error('—');
    }
  }

  Future<void> _save(String userId, Map<String, Object?> patch) => ref.read(recoveryActionsProvider).saveCheckin(userId, patch);

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    final t = FeatureText(recoveryText(language));
    final user = ref.watch(authUserProvider);
    final profile = ref.watch(authProfileProvider);
    final isPremium = ref.watch(healthScreensIsPremiumProvider);
    final birthDate = profile?.babyBirthDate;
    final week = weekAfterBirth(birthDate);
    final emergency = getEmergencyNumber(profile?.countryCode);
    final checkins = ref.watch(recoveryCheckinsQuery(14)).data ?? const <Checkin>[];
    final today = isoDay(DomainClock.now());
    final todayCheckin = checkins.where((c) => c.day == today).firstOrNull;
    final a = context.a;
    final userId = user?.id ?? '';

    Widget shell({required VoidCallback onBack, required String eyebrow, required String title, required List<Widget> children}) =>
        CxPage(children: [CxHead(onBack: onBack, eyebrow: eyebrow, title: title, backLabel: t.s('title')), ...children]);

    if (_birthType == null || _choosing) {
      return shell(
        onBack: _choosing ? () => setState(() => _choosing = false) : widget.onBack,
        eyebrow: t.s('title'),
        title: t.s('choose_title'),
        children: [
          Padding(padding: const EdgeInsets.only(bottom: 14), child: Text(t.s('choose_desc'), style: cxSub(context))),
          CxGrid(columns: 2, gap: 10, children: [
            for (final type in const ['vaginal', 'cesarean'])
              CxTile(
                emoji: type == 'vaginal' ? '🌸' : '🩹',
                emojiSize: 44,
                fontSize: 15,
                label: t.s(type),
                minHeight: 150,
                pressed: _birthType == type,
                background: type == 'vaginal' ? a.peach1 : a.lav1,
                onTap: () => _chooseType(userId, type),
              ),
          ]),
        ],
      );
    }

    final birthType = _birthType!;
    final program = t.sub('weeks').items(birthType);
    final weekIdx = (week ?? 1).clamp(1, programWeeks) - 1;
    final content = program[weekIdx];
    final afterProgram = (week ?? 1) > programWeeks;
    final kegel = kegelLevel(week);
    final tabs = t.sub('tabs');

    Widget body;
    switch (_tab) {
      case 'checkin':
        body = _CheckinTab(
          // `useEffect(() => { setBleeding(existing.bleeding) … }, [existing])`: a new row resets the form.
          key: ValueKey('checkin:${todayCheckin?.toRow()}'),
          t: t,
          existing: todayCheckin,
          history: checkins,
          emergency: emergency,
          language: language,
          onSave: (patch) async {
            await _save(userId, patch);
            if (mounted) toasts(this.context).success(t.s('checkin_saved'));
          },
        );
      case 'kegel':
        body = CxCard(
          child: KegelTrainer(
            t: t,
            level: kegel,
            locked: !isPremium,
            onUpgrade: () => ref.read(healthPaywallProvider)(context, t.s('kegel_premium')),
            cesarean: birthType == 'cesarean',
            done: todayCheckin?.kegelSessions ?? 0,
            onComplete: () async {
              final n = (todayCheckin?.kegelSessions ?? 0) + 1;
              await _save(userId, {'kegel_sessions': n < 10 ? n : 10});
              if (mounted) toasts(this.context).success(fill(t.s('kegel_done'), {'n': n}));
            },
          ),
        );
      case 'signs':
        body = _SignsTab(t: t, emergency: emergency, existing: todayCheckin, onSave: (flags) => _save(userId, {'flags': flags}));
      default:
        body = _WeekTab(
          t: t,
          weekIdx: weekIdx,
          week: week,
          afterProgram: afterProgram,
          content: content,
          birthDate: birthDate,
          language: language,
          todayCheckin: todayCheckin,
          kegelText: fill(t.s('kegel_today'), {'done': todayCheckin?.kegelSessions ?? 0, 'goal': kegelDailyGoal, 'min': kegelMinutes(kegel)}),
          onTab: (tab) => setState(() => _tab = tab),
          onChangeType: () => setState(() => _choosing = true),
          onMoodTest: () => widget.onNavigateToTool?.call('mental-health'),
        );
    }

    return shell(
      onBack: widget.onBack,
      eyebrow: birthType == 'cesarean' ? t.s('eyebrow_cesarean') : t.s('eyebrow_vaginal'),
      title: afterProgram ? t.s('after_title') : fill(t.s('week_title'), {'n': week ?? 1}),
      children: [
        CxTabs(
          tabs: [for (final key in tabs.data.keys) (key, tabs.s(key))],
          selected: _tab,
          onSelect: (key) {
            setState(() => _tab = key);
            unawaited(ref.read(pregnancyHapticsProvider).light());
          },
        ),
        body,
        CxDisc(t.s('disclaimer')),
      ],
    );
  }
}

class _WeekTab extends ConsumerStatefulWidget {
  const _WeekTab({
    required this.t,
    required this.weekIdx,
    required this.week,
    required this.afterProgram,
    required this.content,
    required this.birthDate,
    required this.language,
    required this.todayCheckin,
    required this.kegelText,
    required this.onTab,
    required this.onChangeType,
    required this.onMoodTest,
  });
  final FeatureText t;
  final int weekIdx;
  final int? week;
  final bool afterProgram;
  final FeatureText content;
  final String? birthDate;
  final String language;
  final Checkin? todayCheckin;
  final String kegelText;
  final ValueChanged<RecoveryTab> onTab;
  final VoidCallback onChangeType;
  final VoidCallback onMoodTest;
  @override
  ConsumerState<_WeekTab> createState() => _WeekTabState();
}

class _WeekTabState extends ConsumerState<_WeekTab> {
  bool _added = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final a = context.a;
    final birthDate = widget.birthDate;
    final checkup = birthDate != null && birthDate.length >= 10 ? checkupDate(birthDate) : null;
    final chevron = AIcon(AIcons.chevronRight, size: 18, color: a.inkFaint, mirrorInRtl: true);
    return CxEnter(
      dy: 10,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CxCard(
          gradient: LinearGradient(begin: const Alignment(-0.34, -0.94), end: const Alignment(0.34, 0.94), colors: [a.surface, a.surfaceSoft]),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            ExcludeSemantics(
              child: Row(children: [
                for (var i = 0; i < programWeeks; i++) ...[
                  if (i > 0) const SizedBox(width: 6),
                  Expanded(
                    child: Container(
                      height: 8,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(99),
                        color: i < widget.weekIdx || widget.afterProgram ? a.peach2 : (i == widget.weekIdx ? null : a.peach1),
                        gradient: !(i < widget.weekIdx || widget.afterProgram) && i == widget.weekIdx
                            ? LinearGradient(colors: [a.peach2, a.peach2, a.peach1, a.peach1], stops: const [0, 0.5, 0.5, 1])
                            : null,
                      ),
                    ),
                  ),
                ],
              ]),
            ),
            const SizedBox(height: 14),
            CxEyebrow(t.s('focus')),
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 4, 0, 6),
              child: Text(widget.afterProgram ? t.s('after_title') : widget.content.s('title'), style: cxTitle(context, 18)),
            ),
            Text(widget.afterProgram ? t.s('after_body') : widget.content.s('body'), style: cxSub(context, 13.5)),
            if (!widget.afterProgram)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: CxList(children: [
                  for (final tip in widget.content.list('tips'))
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(children: [
                        CxCheck(on: true, fill: a.green2),
                        const SizedBox(width: 12),
                        Expanded(child: Text(tip, style: px(13.5, color: a.ink))),
                      ]),
                    ),
                ]),
              ),
          ]),
        ),
        CxCard(
          gap: true,
          onTap: () => widget.onTab('checkin'),
          child: Row(children: [
            CxIcon(emoji: widget.todayCheckin != null ? _moodEmoji[((widget.todayCheckin!.mood ?? 3) - 1).clamp(0, 4)] : '📝', color: a.peach1),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.s('checkin_title'), style: px(14.5, weight: FontWeight.w700, color: a.ink)),
                Text(widget.todayCheckin != null ? t.s('checkin_saved') : '30 s', style: cxSub(context)),
              ]),
            ),
            chevron,
          ]),
        ),
        CxCard(
          gap: true,
          border: false,
          color: a.lav1,
          onTap: () => widget.onTab('kegel'),
          child: Row(children: [
            CxIcon(emoji: '🌸', color: a.surface),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.s('kegel_title'), style: px(14.5, weight: FontWeight.w700, color: a.ink)),
                Text(widget.kegelText, style: px(13, color: a.lavInk, height: 1.45)),
              ]),
            ),
            const SizedBox(width: 12),
            IgnorePointer(child: AButton(variant: AButtonVariant.ghost, size: AButtonSize.sm, onPressed: () {}, child: Text(t.s('kegel_start')))),
          ]),
        ),
        if (checkup != null && (widget.week ?? 1) <= 8)
          CxCard(
            gap: true,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                CxIcon(emoji: '🩺', color: a.green1),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(t.s('checkup_title'), style: px(14.5, weight: FontWeight.w700, color: a.ink)),
                    Text(fill(t.s('checkup_desc'), {'date': fmtDayMonthLong(checkup, widget.language)}), style: cxSub(context)),
                  ]),
                ),
              ]),
              const SizedBox(height: 8),
              CxList(children: [
                for (final q in t.list('checkup_questions'))
                  Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text('❓ $q', style: px(13.5, color: a.ink))),
              ]),
              const SizedBox(height: 8),
              AButton(
                variant: AButtonVariant.soft,
                block: true,
                onPressed: _added
                    ? null
                    : () async {
                        final toast = toasts(context);
                        final ok = await ref.read(appointmentsApiProvider).add({
                          'title': t.s('checkup_title'),
                          'description': t.list('checkup_questions').join('\n'),
                          'event_date': isoDay(checkup),
                          'event_type': 'doctor',
                          'reminder_enabled': true,
                        }, toast: toast);
                        if (ok != null && mounted) {
                          setState(() => _added = true);
                          toast.success(t.s('added_calendar'));
                        }
                      },
                leading: const AIcon(AIcons.calendarPlus, size: 17),
                child: Text(_added ? t.s('added_calendar') : t.s('add_to_calendar')),
              ),
            ]),
          ),
        CxCard(
          gap: true,
          padding: EdgeInsets.zero,
          clip: true,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            CxLink(onTap: () => widget.onTab('signs'), children: [CxIcon(emoji: '🚨', color: a.pink1), Expanded(child: Text(t.s('signs_question'))), chevron]),
            CxLink(topBorder: true, onTap: widget.onMoodTest, children: [CxIcon(emoji: '💜', color: a.lav1), Expanded(child: Text(t.s('mood_test'))), chevron]),
            CxLink(topBorder: true, onTap: widget.onChangeType, children: [CxIcon(emoji: '🔁', color: a.surfaceSoft), Expanded(child: Text(t.s('change_type')))]),
          ]),
        ),
      ]),
    );
  }
}

class _CheckinTab extends StatefulWidget {
  const _CheckinTab({super.key, required this.t, required this.existing, required this.history, required this.emergency, required this.language, required this.onSave});
  final FeatureText t;
  final Checkin? existing;
  final List<Checkin> history;
  final String emergency;
  final String language;
  final Future<void> Function(Map<String, Object?> patch) onSave;
  @override
  State<_CheckinTab> createState() => _CheckinTabState();
}

class _CheckinTabState extends State<_CheckinTab> {
  late int? _bleeding = widget.existing?.bleeding;
  late int? _pain = widget.existing?.pain;
  late String? _stitches = widget.existing?.stitches;
  late int? _mood = widget.existing?.mood;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final a = context.a;
    final severity = flagSeverity(widget.existing?.flags ?? const [], _bleeding);
    final now = DomainClock.now();
    final last7 = [
      for (var i = 0; i < 7; i++)
        () {
          final d = addDays(now, -(6 - i));
          final key = isoDay(d);
          return (key: key, label: fmtWeekdayNarrow(d, widget.language), row: widget.history.where((h) => h.day == key).firstOrNull);
        }(),
    ];
    final levels = t.list('bleeding_levels');
    final stitches = t.sub('stitches_levels');
    final moods = t.list('mood_levels');
    Widget card(Widget child) => CxCard(child: child);
    final children = <Widget>[
      card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CxField('🩸 ${t.s('bleeding')}'),
        CxSeg(items: [
          for (var i = 0; i < levels.length; i++)
            (
              label: levels[i],
              pressed: _bleeding == i,
              onTap: () => setState(() => _bleeding = i),
              color: _bleeding == i && i == 3 ? const Color(0xFFC92A2A) : null, // RecoveryScreen inline #c92a2a
            ),
        ]),
      ])),
      card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            CxField('⚡ ${t.s('pain')}', bottom: 0),
            if (_pain != null) Text('$_pain/10', style: px(18, weight: FontWeight.w700, color: _painColor(_pain!))),
          ]),
        ),
        Row(children: [
          for (var n = 0; n <= 10; n++) ...[
            if (n > 0) const SizedBox(width: 4),
            Expanded(
              child: Semantics(
                button: true,
                selected: _pain == n,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _pain = n),
                  child: Container(
                    height: 38,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: _pain == n ? _painColor(n) : a.surfaceSoft, borderRadius: BorderRadius.circular(10)),
                    child: Text('$n', style: px(13, weight: FontWeight.w800, color: _pain == n ? const Color(0xFFFFFFFF) : a.ink, height: 1)),
                  ),
                ),
              ),
            ),
          ],
        ]),
      ])),
      card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CxField('🩹 ${t.s('stitches')}'),
        CxChips(children: [
          for (final s in stitches.data.keys) CxChip(label: stitches.s(s), pressed: _stitches == s, onTap: () => setState(() => _stitches = s)),
        ]),
      ])),
      card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CxField('💭 ${t.s('mood')}'),
        Row(children: [
          for (var i = 0; i < _moodEmoji.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: Semantics(
                button: true,
                selected: _mood == i + 1,
                label: i < moods.length ? moods[i] : null,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _mood = i + 1),
                  child: AnimatedScale(
                    scale: _mood == i + 1 ? 1.08 : 1,
                    duration: const Duration(milliseconds: 120),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: _mood == i + 1 ? a.lav1 : a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                      child: Text(_moodEmoji[i], style: const TextStyle(fontSize: 26, height: 1.2)),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ]),
        if (_mood != null && _mood! - 1 < moods.length)
          Padding(padding: const EdgeInsets.only(top: 6), child: Text(moods[_mood! - 1], textAlign: TextAlign.center, style: cxSub(context))),
      ])),
      if (severity != null) SeverityAlert(t: t, severity: severity, emergency: widget.emergency, harm: false),
      AButton(
        variant: AButtonVariant.accent,
        block: true,
        onPressed: _saving || (_bleeding == null && _pain == null && _mood == null && _stitches == null)
            ? null
            : () async {
                setState(() => _saving = true);
                try {
                  await widget.onSave({'bleeding': _bleeding, 'pain': _pain, 'stitches': _stitches, 'mood': _mood});
                } catch (_) {
                } finally {
                  if (mounted) setState(() => _saving = false);
                }
              },
        child: Text(t.s('save_checkin')),
      ),
      card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CxField(t.s('history')),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (var i = 0; i < last7.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            Expanded(
              child: Column(children: [
                Container(
                  height: 30,
                  margin: const EdgeInsets.only(bottom: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(9),
                    color: (last7[i].row?.flags.isNotEmpty ?? false) ? a.pink1 : (last7[i].row != null ? a.lav1 : a.surfaceSoft),
                  ),
                  child: Text(
                    last7[i].row?.mood != null ? _moodEmoji[(last7[i].row!.mood! - 1).clamp(0, 4)] : '',
                    style: const TextStyle(fontSize: 16, height: 1.2),
                  ),
                ),
                Text(last7[i].label, style: px(10, color: a.inkFaint)),
              ]),
            ),
          ],
        ]),
      ])),
    ];
    return CxEnter(
      dy: 10,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 16), children[i]],
      ]),
    );
  }
}

/// 'doctor' → the yellow note; 'urgent' → call the emergency number (and tell the partner when linked).
class SeverityAlert extends ConsumerStatefulWidget {
  const SeverityAlert({super.key, required this.t, required this.severity, required this.emergency, required this.harm});
  final FeatureText t;
  final String severity;
  final String emergency;
  final bool harm;
  @override
  ConsumerState<SeverityAlert> createState() => _SeverityAlertState();
}

class _SeverityAlertState extends ConsumerState<SeverityAlert> {
  bool _told = false;

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    if (widget.severity == 'doctor') {
      return CxWarn(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('🩺 ${t.s('doctor_alert_title')}', style: px(14, weight: FontWeight.w700, color: context.a.warnInk)),
          Text(t.s('doctor_alert_body')),
        ]),
      );
    }
    final sos = ref.watch(sosAlertPortProvider);
    return CxAlert(title: '🚨 ${t.s('urgent_title')}', children: [
      Text(fill(widget.harm ? t.s('harm_body') : t.s('urgent_body'), {'number': widget.emergency})),
      CxCallButton(
        label: fill(t.s('call'), {'number': widget.emergency}),
        onTap: () => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: widget.emergency)),
      ),
      if (sos.hasPartner)
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: AButton(
            variant: AButtonVariant.ghost,
            block: true,
            onPressed: _told || sos.sendSOS == null
                ? null
                : () async {
                    final toast = toasts(context);
                    final error = await sos.sendSOS!(t.s('partner_alert_msg'), false, 'emergency');
                    if (error == null && mounted) {
                      setState(() => _told = true);
                      toast.success(t.s('partner_told'));
                    }
                  },
            leading: const AIcon(AIcons.send, size: 16),
            child: Text(_told ? t.s('partner_told') : t.s('tell_partner')),
          ),
        ),
    ]);
  }
}

class _SignsTab extends ConsumerStatefulWidget {
  const _SignsTab({required this.t, required this.emergency, required this.existing, required this.onSave});
  final FeatureText t;
  final String emergency;
  final Checkin? existing;
  final Future<void> Function(List<String> flags) onSave;
  @override
  ConsumerState<_SignsTab> createState() => _SignsTabState();
}

class _SignsTabState extends ConsumerState<_SignsTab> {
  late List<String> _flags = [...?widget.existing?.flags];

  void _toggle(String f) {
    final next = _flags.contains(f) ? _flags.where((x) => x != f).toList() : [..._flags, f];
    setState(() => _flags = next);
    unawaited(ref.read(pregnancyHapticsProvider).medium());
    unawaited(widget.onSave(next).catchError((Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final a = context.a;
    final severity = flagSeverity(_flags, null);
    return CxEnter(
      dy: 10,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        CxCard(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(t.s('signs_question'), style: px(14.5, weight: FontWeight.w700, color: a.ink))),
            CxList(children: [
              for (final f in recoveryFlags)
                Semantics(
                  button: true,
                  selected: _flags.contains(f),
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => _toggle(f),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(children: [
                        CxCheck(on: _flags.contains(f)),
                        const SizedBox(width: 12),
                        Expanded(child: Text(t.at('flags', f) ?? f, style: px(13.5, weight: FontWeight.w600, color: a.ink))),
                      ]),
                    ),
                  ),
                ),
            ]),
          ]),
        ),
        if (severity != null) ...[const SizedBox(height: 16), SeverityAlert(t: t, severity: severity, emergency: widget.emergency, harm: _flags.contains('harm'))],
      ]),
    );
  }
}
