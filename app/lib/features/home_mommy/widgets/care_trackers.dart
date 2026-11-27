// Ported from: src/components/Dashboard.tsx (MommyDashboard: ElapsedTime, saveAndStopTimer, toggleSleep, toggleFeeding,
//              addFeeding, addDiaper and the Sleep / Feeding / Diaper / Today's-summary cards inside the
//              "baby_care_tracking" PremiumBlurGate, plus the solid-food-guide entry between them)
//
// Timers live in the timer store (per child for twins: `childId` of the selected child, child name only when
// there is more than one child). Stopping a timer saves a baby_logs row through the offline outbox; the timer is
// removed only once the row is saved or safely queued (a second tap while saving is ignored); a queued write shows
// the "saved offline" toast, a rejected one the destructive "not saved" toast and keeps the timer running.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../core/offline/outbox_copy.dart';
import '../../../design/design.dart';
import '../../../domain/js_compat.dart';
import '../../../state/timer_store.dart';
import '../../baby/hooks/baby_services.dart';
import '../../baby/hooks/use_baby_insight.dart';
import '../../baby/hooks/use_baby_logs.dart';
import '../../baby/hooks/use_children.dart';
import '../../baby/locale_format.dart';
import '../../baby/models/baby_rules.dart';
import '../../baby/widgets/feeding_history_panel.dart';
import '../../baby/widgets/tracker_ai_insight.dart';
import '../copy/mommy_copy.dart';
import '../mommy_home_slots.dart';
import 'mommy_ui.dart';

/// `formatTimerDuration(seconds)` → `m:ss`.
String formatTimerDuration(int seconds) => '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';

/// Live `m:ss` of one running timer; re-renders itself every second (not the whole dashboard).
class ElapsedTime extends ConsumerStatefulWidget {
  const ElapsedTime({super.key, required this.id, this.style});
  final String id;
  final TextStyle? style;
  @override
  ConsumerState<ElapsedTime> createState() => _ElapsedTimeState();
}

class _ElapsedTimeState extends ConsumerState<ElapsedTime> {
  Timer? _timer;
  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(timerStoreProvider);
    return Text(formatTimerDuration(ref.read(timerStoreProvider.notifier).getElapsedSeconds(widget.id)), style: widget.style);
  }
}

/// Inputs from MommyDashboard.
class CareBaby {
  const CareBaby({required this.ageInMonths});
  final int ageInMonths;
}

class MommyCareTrackers extends ConsumerStatefulWidget {
  const MommyCareTrackers({
    super.key,
    required this.baby,
    required this.insight,
    required this.slotArgs,
    this.onNavigate,
    this.onNavigateToTool,
  });

  final CareBaby baby;
  final BabyInsightController insight;
  final MommySlotArgs slotArgs;
  final void Function(String screen)? onNavigate;
  final void Function(String tool)? onNavigateToTool;

  @override
  ConsumerState<MommyCareTrackers> createState() => MommyCareTrackersState();
}

class MommyCareTrackersState extends ConsumerState<MommyCareTrackers> {
  final Set<String> _saving = <String>{};
  bool _showFeedingModal = false;
  bool _showFormula = false;
  bool _showSolid = false;
  bool _showDiaperModal = false;
  bool _sleepExpanded = false;
  final _formulaMl = TextEditingController();
  final _solidName = TextEditingController();
  final _summaryKey = GlobalKey();

  static const formulaMlPresets = [30, 60, 90, 120, 150, 180];

  @override
  void dispose() {
    _formulaMl.dispose();
    _solidName.dispose();
    super.dispose();
  }

  BabyCareServices get _services => ref.read(babyCareServicesProvider);

  void _toast({String? title, String? description, bool destructive = false}) {
    if (!mounted) return;
    AToastHost.of(context).show(title: title, description: description, destructive: destructive);
  }

  void _queued() => _toast(title: queuedToast().title);
  void _failed() {
    final f = saveFailedToast();
    _toast(title: f.title, description: f.description, destructive: true);
  }

  String? get _childId => ref.read(childrenProvider).selectedChild?.id;
  String? get _timerChildName {
    final v = ref.read(childrenProvider);
    return v.hasMultipleChildren ? v.selectedChild?.name : null;
  }

  ActiveTimer? _timer(String type, [String? feedType]) =>
      ref.read(timerStoreProvider.notifier).getActiveTimer(type, feedType: feedType, childId: _childId);

  /// `saveAndStopTimer(timer, log)` → `(durationSeconds, queued)` or null.
  Future<(int, bool)?> saveAndStopTimer(ActiveTimer timer, {required String logType, String? feedType}) async {
    if (_saving.contains(timer.id)) return null;
    _saving.add(timer.id);
    try {
      final end = DomainClock.nowMs();
      final result = await ref.read(babyLogsActionsProvider).addLog(
            logType: logType,
            feedType: feedType,
            startTime: jsToIsoString(DateTime.fromMillisecondsSinceEpoch(timer.startTime)),
            endTime: jsToIsoString(DateTime.fromMillisecondsSinceEpoch(end)),
            childId: timer.childId ?? _childId,
          );
      if (result.error != null) {
        _failed();
        return null;
      }
      ref.read(timerStoreProvider.notifier).stopTimer(timer.id);
      final duration = ((end - timer.startTime) / 1000).floor();
      if (result.queued) _queued();
      return (duration < 0 ? 0 : duration, result.queued);
    } finally {
      _saving.remove(timer.id);
    }
  }

  Future<void> toggleSleep() async {
    await _services.hapticMedium();
    final sleep = _timer('sleep');
    if (sleep != null) {
      final r = await saveAndStopTimer(sleep, logType: 'sleep');
      if (r != null && !r.$2) {
        _toast(title: tr('dashboard_sleep_ended', 'Yuxu bitdi! ☀️'), description: '${formatTimerDuration(r.$1)} ${tr('dashboard_slept', 'yatdı')}');
      }
    } else {
      ref.read(timerStoreProvider.notifier).startTimer('sleep', childId: _childId, childName: _timerChildName);
      _toast(title: tr('dashboard_yuxu_basladi_b503f7', 'Yuxu başladı! 😴'), description: tr('dashboard_bitirmek_ucun_yeniden_basin_37b592', 'Bitirmək üçün yenidən basın'));
    }
  }

  Future<void> toggleFeeding(String side) async {
    await _services.hapticMedium();
    final active = _timer('feeding', side);
    if (active != null) {
      final r = await saveAndStopTimer(active, logType: 'feeding', feedType: side == 'left' ? 'breast_left' : 'breast_right');
      if (r != null) {
        if (!r.$2) {
          _toast(
            title: side == 'left' ? tr('dashboard_left_breast_done', 'Sol sinə bitti!') : tr('dashboard_right_breast_done', 'Sağ sinə bitti!'),
            description: '${tr('dashboard_duration', 'Müddət:')} ${formatTimerDuration(r.$1)}',
          );
        }
        if (ref.read(babyLogsProvider).todayStats.feedingCount >= 9) unawaited(_services.unlockAchievement('feeding_pro', 'mommy'));
      }
    } else {
      ref.read(timerStoreProvider.notifier).startTimer('feeding', feedType: side, childId: _childId, childName: _timerChildName);
      setState(() => _showFeedingModal = false);
    }
  }

  Future<void> addFeeding(String type, {int? amountMl, String? foodName}) async {
    await _services.hapticMedium();
    String? notes;
    if (type == 'formula' && amountMl != null && amountMl > 0) notes = '$amountMl ml';
    if (type == 'solid' && foodName != null && foodName.isNotEmpty) notes = foodName;
    final result = await ref.read(babyLogsActionsProvider).addLog(logType: 'feeding', feedType: type, notes: notes);
    if (result.error != null) {
      _failed(); // keep the panel and the typed amount / food for a retry
      return;
    }
    if (mounted) {
      setState(() {
        _showFeedingModal = false;
        _showFormula = false;
        _showSolid = false;
      });
    }
    _formulaMl.clear();
    _solidName.clear();
    if (result.queued) return _queued();
    final label = type == 'formula'
        ? (amountMl != null && amountMl > 0
            ? '${tr('dashboard_sud_evezedicisi', 'Süd əvəzedicisi')} $amountMl ml 🍼'
            : tr('dashboard_sud_evezedicisi_057b37', 'Süd əvəzedicisi 🍼'))
        : (foodName != null && foodName.isNotEmpty ? '$foodName 🥣' : tr('dashboard_elave_qida_0e11a2', 'Əlavə qida 🥣'));
    _toast(title: '$label ${tr('dashboard_qeyd_edildi', 'qeyd edildi!')}');
  }

  void submitFormula() {
    final ml = int.tryParse(_formulaMl.text.trim()) ?? 0;
    addFeeding('formula', amountMl: ml > 0 ? ml : null);
  }

  Future<void> addDiaper(String type) async {
    await _services.hapticMedium();
    final result = await ref.read(babyLogsActionsProvider).addLog(logType: 'diaper', diaperType: type == 'both' ? 'mixed' : type);
    if (result.error != null) return _failed();
    if (mounted) setState(() => _showDiaperModal = false);
    if (result.queued) return _queued();
    const emojis = {'wet': '💧', 'dirty': '💩', 'both': '💧💩'};
    _toast(title: '${tr('dashboard_diaper_change', 'Bez dəyişmə:')} ${emojis[type]}');
    if (ref.read(babyLogsProvider).todayStats.diaperCount >= 9) unawaited(_services.unlockAchievement('diaper_hero', 'mommy'));
  }

  static String diaperIcon(String type) => switch (type) {
        'dirty' => '💩',
        'both' || 'mixed' => '💧💩',
        _ => '💧',
      };

  /// Today's sleep label of the sleep card.
  static String sleepToday(int minutes) {
    final h = minutes ~/ 60, rm = minutes % 60;
    if (h == 0 && rm == 0) return tr('dashboard_0_deq_86d70a', '0 dəq');
    if (h == 0) return '$rm ${tr('common_minutes_short', 'dəq')}';
    if (rm == 0) return '$h ${tr('common_hours', 'saat')}';
    return '$h${tr('common_h_short', 's')} $rm${tr('common_m_short', 'd')}';
  }

  /// Total of the summary row.
  static String sleepSummary(int minutes) {
    final h = minutes ~/ 60, m = minutes % 60;
    if (h == 0 && m == 0) return tr('dashboard_0_deq_86d70a', '0 dəq');
    if (h == 0) return '$m ${tr('dashboard_min', 'dəq')}';
    if (m == 0) return '$h ${tr('common_hours', 'saat')}';
    return '$h ${tr('dashboard_hour', 'saat')} $m ${tr('dashboard_min', 'dəq')}';
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    ref.watch(timerStoreProvider);
    final view = ref.watch(babyLogsProvider);
    final stats = view.todayStats;
    final slots = ref.watch(mommyHomeSlotsProvider);
    final childId = ref.watch(childrenProvider).selectedChild?.id;
    final store = ref.read(timerStoreProvider.notifier);
    final sleepTimer = store.getActiveTimer('sleep', childId: childId);
    final leftTimer = store.getActiveTimer('feeding', feedType: 'left', childId: childId);
    final rightTimer = store.getActiveTimer('feeding', feedType: 'right', childId: childId);
    final t = context.a;
    final x = context.aText;
    final months = widget.baby.ageInMonths;
    final sleepMinutes = stats.sleepMinutes != 0 ? stats.sleepMinutes : jsRoundInt(stats.sleepHours * 60);
    final todayLabel = tr('dashboard_today_label', 'Bu gün');
    final timesUnit = tr('dashboard_times_unit', 'dəfə');

    Widget listIcon(AIconData icon, {Gradient? gradient, Color? bg}) => Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(gradient: gradient, color: bg, borderRadius: BorderRadius.circular(13)),
          child: Center(child: AIcon(icon, size: 17, color: t.accentInk)),
        );

    Widget titleSub(String title, String sub) => Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(title, style: x.aListTitle),
          Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub, style: x.aListSub)),
        ]);

    Widget card({required Widget child, required String section}) => Padding(
          padding: const EdgeInsets.only(top: 10),
          child: AFadeIn(child: KeyedSubtree(key: ValueKey('care-$section'), child: ACard(child: child))),
        );

    // ── Sleep ──
    final sleepCard = card(
      section: 'sleep',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          listIcon(AIcons.moon, gradient: t.gradPeach),
          const SizedBox(width: 12),
          Expanded(child: titleSub(tr('dashboard_yuxu_izleme_adaa4f', 'Yuxu İzləmə'), '$todayLabel: ${sleepToday(sleepMinutes)}')),
          APillButton(
            key: const ValueKey('sleep-toggle'),
            solid: sleepTimer != null,
            onPressed: toggleSleep,
            child: sleepTimer != null
                ? Row(mainAxisSize: MainAxisSize.min, children: [const Text('☀️ '), ElapsedTime(id: sleepTimer.id)])
                : Text('😴 ${tr('dashboard_slept_btn', 'Yatdı')}'),
          ),
        ]),
        if (sleepTimer != null)
          Container(
            margin: const EdgeInsets.only(top: 14),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(t.radiusSm)),
            child: DefaultTextStyle.merge(
              style: TextStyle(fontSize: 12, height: 1.6, fontWeight: FontWeight.w600, color: t.ink),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 3), child: APulseDot(color: t.peach2)),
                const SizedBox(width: 9),
                Flexible(child: Text('${tr('dashboard_sleep_ongoing', 'Yuxu davam edir')}: ')),
                ElapsedTime(id: sleepTimer.id),
              ]),
            ),
          ),
        TrackerAIInsight(section: 'sleep', controller: widget.insight),
      ]),
    );

    // ── Feeding ──
    final breast = offersBreastfeeding(months);
    final feedingCard = card(
      section: 'feeding',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: [
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  final c = _summaryKey.currentContext;
                  if (c != null) Scrollable.ensureVisible(c, alignment: 0.5, duration: const Duration(milliseconds: 300));
                },
                child: Row(children: [
                  listIcon(AIcons.baby, gradient: t.gradPeach),
                  const SizedBox(width: 12),
                  Flexible(child: titleSub(tr('dashboard_qidalanmaya_nezaret_1b60b4', 'Qidalanmaya nəzarət'), '$todayLabel: ${stats.feedingCount} $timesUnit')),
                ]),
              ),
            ),
            APillButton(
              key: const ValueKey('feeding-add'),
              onPressed: () => setState(() => _showFeedingModal = true),
              child: Text(tr('dashboard_elave_et_a5fb21', '+ Əlavə et')),
            ),
          ]),
        ),
        FramerExpand(
          open: _showFeedingModal,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: AGrid(columns: 2, marginTop: 0, children: [
              if (breast) ...[
                AChoice(
                  key: const ValueKey('feed-left'),
                  tint: (t) => t.pink1,
                  running: leftTimer != null,
                  onTap: () => toggleFeeding('left'),
                  children: [
                    const Text('🤱', style: TextStyle(fontSize: 24, height: 1.33)),
                    leftTimer != null ? ElapsedTime(id: leftTimer.id) : Text(tr('dashboard_sol_sine_92503e', 'Sol Sinə')),
                  ],
                ),
                AChoice(
                  key: const ValueKey('feed-right'),
                  tint: (t) => t.pink1,
                  running: rightTimer != null,
                  onTap: () => toggleFeeding('right'),
                  children: [
                    const Text('🤱', style: TextStyle(fontSize: 24, height: 1.33)),
                    rightTimer != null ? ElapsedTime(id: rightTimer.id) : Text(tr('dashboard_sag_sine_590332', 'Sağ Sinə')),
                  ],
                ),
              ],
              AChoice(
                key: const ValueKey('feed-formula'),
                tint: (t) => t.blue1,
                onTap: () => setState(() => _showFormula = true),
                children: [const Text('🍼', style: TextStyle(fontSize: 20, height: 1.4)), Text(tr('dashboard_sud_evezedicisi_4ba2dd', 'Süd Əvəzedicisi'))],
              ),
              AChoice(
                key: const ValueKey('feed-solid'),
                tint: (t) => t.peach1,
                onTap: () => setState(() => _showSolid = true),
                children: [const Text('🥣', style: TextStyle(fontSize: 20, height: 1.4)), Text(tr('dashboard_elave_qida_676032', 'Əlavə Qida'))],
              ),
            ]),
          ),
        ),
        if (_showFeedingModal && breast) slots.slot(context, MommySlot.weaningFeedingLink, widget.slotArgs),
        FramerExpand(
          open: _showFormula,
          child: AInsetPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  const Text('🍼', style: TextStyle(fontSize: 18, height: 1.55)),
                  const SizedBox(width: 8),
                  Text(tr('dashboard_nece_ml_c9f7a6', 'Neçə ml?'), style: x.aListTitle),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Wrap(spacing: 6, runSpacing: 6, children: [
                  for (final ml in formulaMlPresets)
                    ATag(key: ValueKey('formula-$ml'), on: true, onTap: () => addFeeding('formula', amountMl: ml), child: Text('$ml ml')),
                ]),
              ),
              Row(children: [
                Expanded(child: AInput(controller: _formulaMl, number: true, placeholder: tr('dashboard_diger_ml_ph', 'Digər (ml)'))),
                const SizedBox(width: 8),
                APillButton(solid: true, onPressed: submitFormula, child: Text(tr('dashboard_qeyd_et_f12345', 'Qeyd et'))),
                const SizedBox(width: 8),
                ATag(
                  onTap: () {
                    setState(() => _showFormula = false);
                    _formulaMl.clear();
                  },
                  child: Text(tr('dashboard_legv_f7100a', 'Ləğv')),
                ),
              ]),
            ]),
          ),
        ),
        FramerExpand(
          open: _showSolid,
          child: AInsetPanel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  const Text('🥣', style: TextStyle(fontSize: 18, height: 1.55)),
                  const SizedBox(width: 8),
                  Text(tr('dashboard_elave_qida_676032', 'Əlavə Qida'), style: x.aListTitle),
                ]),
              ),
              Row(children: [
                Expanded(child: AInput(controller: _solidName, placeholder: tr('dashboard_qida_ph', 'Məs: balkabaqlı püre'))),
                const SizedBox(width: 8),
                APillButton(
                  solid: true,
                  onPressed: () {
                    final name = _solidName.text.trim();
                    if (name.isNotEmpty) addFeeding('solid', foodName: name);
                  },
                  child: Text(tr('dashboard_qeyd_et_f12345', 'Qeyd et')),
                ),
                const SizedBox(width: 8),
                ATag(
                  onTap: () {
                    setState(() => _showSolid = false);
                    _solidName.clear();
                  },
                  child: Text(tr('dashboard_legv_f7100a', 'Ləğv')),
                ),
              ]),
            ]),
          ),
        ),
        if ((leftTimer != null || rightTimer != null) && !_showFeedingModal)
          AInsetPanel(
            child: Row(children: [
              APulseDot(color: t.pink2),
              const SizedBox(width: 12),
              Expanded(
                child: DefaultTextStyle.merge(
                  style: x.aListTitle,
                  child: Row(children: [
                    Flexible(child: Text('${leftTimer != null ? tr('dashboard_left_breast', 'Sol sinə') : tr('dashboard_right_breast', 'Sağ sinə')}: ')),
                    ElapsedTime(id: (leftTimer ?? rightTimer)!.id),
                  ]),
                ),
              ),
              APillButton(
                key: const ValueKey('feeding-finish'),
                solid: true,
                onPressed: () => toggleFeeding(leftTimer != null ? 'left' : 'right'),
                child: Text(tr('dashboard_bitir_btn', 'Bitir')),
              ),
            ]),
          ),
        TrackerAIInsight(section: 'feeding', controller: widget.insight),
      ]),
    );

    // ── Solid food guide entry ──
    final sfg = solidFoodGuideRelevant(months) && widget.onNavigateToTool != null
        ? Padding(
            padding: const EdgeInsets.only(top: 10),
            child: AFadeIn(
              child: GestureDetector(
                onTap: () => widget.onNavigateToTool!('solid-food-guide'),
                child: ACard(
                  child: Row(children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(gradient: t.gradGreen, borderRadius: BorderRadius.circular(13)),
                      child: const Center(child: Text('🥣', style: TextStyle(fontSize: 18))),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: titleSub(feature37Text('sfg_home_title', language),
                          feature37Text(months < 6 ? 'sfg_home_sub_before' : 'sfg_home_sub_after', language)),
                    ),
                    const SizedBox(width: 12),
                    AIcon(AIcons.chevronRight, size: 16, color: t.inkFaint, mirrorInRtl: true),
                  ]),
                ),
              ),
            ),
          )
        : null;

    // ── Diaper ──
    final recentDiapers = stats.diaperLogs.length > 5 ? stats.diaperLogs.sublist(stats.diaperLogs.length - 5) : stats.diaperLogs;
    final diaperCard = card(
      section: 'diaper',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: [
            listIcon(AIcons.clock, gradient: t.gradPeach),
            const SizedBox(width: 12),
            Expanded(child: titleSub(tr('dashboard_bez_deyisme_ba242a', 'Bez Dəyişmə'), '$todayLabel: ${stats.diaperCount} $timesUnit')),
            APillButton(
              key: const ValueKey('diaper-add'),
              onPressed: () => setState(() => _showDiaperModal = true),
              child: Text(tr('dashboard_elave_et_a5fb21', '+ Əlavə et')),
            ),
          ]),
        ),
        FramerExpand(
          open: _showDiaperModal,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: AGrid(columns: 3, marginTop: 0, children: [
              AChoice(key: const ValueKey('diaper-wet'), tint: (t) => t.blue1, onTap: () => addDiaper('wet'), children: const [
                Text('💧', style: TextStyle(fontSize: 24, height: 1.33)),
              ]),
              AChoice(key: const ValueKey('diaper-dirty'), tint: (t) => t.yellow1, onTap: () => addDiaper('dirty'), children: const [
                Text('💩', style: TextStyle(fontSize: 24, height: 1.33)),
              ]),
              AChoice(key: const ValueKey('diaper-both'), tint: (t) => t.lav1, onTap: () => addDiaper('both'), children: const [
                Text('💧💩', style: TextStyle(fontSize: 20, height: 1.4)),
              ]),
            ]),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final (i, log) in recentDiapers.reversed.indexed) ...[
              if (i > 0) const SizedBox(width: 6),
              ATag(
                key: ValueKey('diaper-log-${log.id}'),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(diaperIcon(log.diaperType ?? 'wet'), style: const TextStyle(fontSize: 16, height: 1.5)),
                  const SizedBox(width: 6),
                  Text(log.start == null ? '' : localeTimeHm(log.start!)),
                ]),
              ),
            ],
          ]),
        ),
        TrackerAIInsight(section: 'diaper', controller: widget.insight),
      ]),
    );

    // ── Today's summary ──
    final sleepRows = stats.sleepLogs.reversed.toList();
    final summaryCard = card(
      section: 'summary',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ACardHead(
          title: tr('dashboard_bugunku_xulase_e1e1b3', 'Bugünkü xülasə'),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            if (widget.onNavigate != null) ...[
              AIconBtn(
                semanticLabel: tr('dash_pdf_report', 'Həkim hesabatı (PDF)'),
                onTap: () => widget.onNavigate!('doctor-report'),
                icon: const AIcon(AIcons.fileText, size: 13),
              ),
              const SizedBox(width: 6),
            ],
            AIconBtn(onTap: () => ref.read(babyLogsActionsProvider).refetch(), icon: const AIcon(AIcons.refreshCw, size: 13)),
          ]),
        ),
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(t.radiusLg), border: Border.all(color: t.line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            GestureDetector(
              key: const ValueKey('sleep-summary-toggle'),
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _sleepExpanded = !_sleepExpanded),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                child: Row(children: [
                  listIcon(AIcons.moon, bg: t.peach1),
                  const SizedBox(width: 13),
                  Expanded(
                    child: titleSub(tr('dashboard_yuxu_xulasesi_b2dc87', 'Yuxu xülasəsi'),
                        '${stats.sleepLogs.length} ${tr('dashboard_sleep_recorded', 'yuxu qeydə alınıb')}'),
                  ),
                  const SizedBox(width: 13),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(sleepSummary(sleepMinutes), style: x.aListValue),
                    Padding(padding: const EdgeInsets.only(top: 1), child: Text(tr('dashboard_bu_gun_7d7f30', 'bu gün'), style: x.aListTime)),
                  ]),
                  const SizedBox(width: 8),
                  AIcon(_sleepExpanded ? AIcons.chevronUp : AIcons.chevronDown, size: 15, color: t.inkFaint),
                ]),
              ),
            ),
            FramerExpand(
              open: _sleepExpanded,
              duration: const Duration(milliseconds: 200),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: sleepRows.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Text(tr('dashboard_bu_gun_yuxu_qeyde_alinmayib_8a3535', 'Bu gün yuxu qeydə alınmayıb'),
                            textAlign: TextAlign.center, style: x.aListSub),
                      )
                    : Column(children: [
                        for (final (i, log) in sleepRows.indexed) ...[if (i > 0) const SizedBox(height: 6), _sleepRow(log)],
                      ]),
              ),
            ),
            Container(
              key: _summaryKey,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: t.line))),
              child: const FeedingHistoryPanel(),
            ),
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _showDiaperModal = true),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: t.line))),
                child: Row(children: [
                  listIcon(AIcons.clock, bg: t.peach1),
                  const SizedBox(width: 13),
                  Expanded(
                    child: titleSub(tr('dashboard_bez_deyisme_647cbc', 'Bez dəyişmə'),
                        '💧${stats.wetCount} 💩${stats.dirtyCount} 💧💩${stats.bothCount}'),
                  ),
                  const SizedBox(width: 13),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text('${stats.diaperCount} ${tr('dashboard_defe_420246', 'dəfə')}', style: x.aListValue.copyWith(color: t.accentInk)),
                    Padding(padding: const EdgeInsets.only(top: 1), child: Text(tr('dashboard_bu_gun_7d7f30', 'bu gün'), style: x.aListTime)),
                  ]),
                ]),
              ),
            ),
          ]),
        ),
      ]),
    );

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      sleepCard,
      feedingCard,
      ?sfg,
      diaperCard,
      summaryCard,
    ]);
  }

  Widget _sleepRow(BabyLog log) {
    final t = context.a;
    final x = context.aText;
    final start = log.start;
    final end = log.end;
    final durationSec = start != null && end != null ? jsRoundInt((end.millisecondsSinceEpoch - start.millisecondsSinceEpoch) / 1000) : 0;
    final dH = durationSec ~/ 3600, dM = (durationSec % 3600) ~/ 60, dS = durationSec % 60;
    final dur = dH > 0
        ? '$dH${tr('dashboard_h', 's')} $dM${tr('dashboard_m', 'd')}'
        : dM > 0
            ? '$dM ${tr('dashboard_min', 'dəq')} $dS ${tr('dashboard_sec', 'san')}'
            : '$dS ${tr('dashboard_sec', 'san')}';
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(12)),
      child: Row(children: [
        const Text('😴', style: TextStyle(fontSize: 14)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            '${start == null ? '' : localeTimeHm(start)}${end != null ? ' – ${localeTimeHm(end)}' : ''}',
            style: x.aListSub.copyWith(color: t.ink),
          ),
        ),
        Text(end != null ? dur : tr('dashboard_davam_edir_88d3a2', 'Davam edir...'), style: x.aListValue.copyWith(color: t.accentInk)),
      ]),
    );
  }
}
