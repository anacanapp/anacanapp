// Ported from: src/components/tools/BabyTracker.tsx
//
// Feeding / sleep / diaper tracker over the last 90 days of baby_logs (useBabyLogsRange(90)): today's tiles, a tab per
// log type, a 7/14/30/90-day period, live breast and sleep timers (shared with the home widgets through the timer
// store), formula / solid / diaper entries (offline outbox through useBabyLogs.addLog), trend bars, a daily history,
// today's entries with a two-tap delete and the per-section AI insight. A home-screen widget deeplink
// (`?widget_action=feed|sleep|diaper`) picks the first tab (`consumeWidgetAction`).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../domain/baby/baby_logs_range.dart';
import '../../../domain/js_compat.dart';
import '../../../shell/nav/shell_controller.dart' show widgetActionStoreProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../../state/timer_store.dart';
import '../../baby/data/baby_repository.dart';
import '../../baby/hooks/baby_services.dart';
import '../../baby/hooks/use_baby_care_actions.dart';
import '../../baby/hooks/use_baby_insight.dart';
import '../../baby/hooks/use_baby_logs.dart';
import '../../baby/hooks/use_children.dart';
import '../../baby/models/baby_rules.dart';
import '../../baby/widgets/tracker_ai_insight.dart';
import '../../home_mommy/mommy_dashboard.dart' show babyInsightBackendProvider;
import '../kit/kit.dart';
import 'achievements.dart';
import 'baby_dates.g.dart';
import 'bt_ui.dart';

const List<int> _periods = [7, 14, 30, 90];
const int _diaperHeroAfter = 9;
const List<({String value, String emoji})> _diapers = [(value: 'wet', emoji: '💧'), (value: 'dirty', emoji: '💩'), (value: 'mixed', emoji: '💧💩')];

String _dur(num m) => formatMinutes(m, hour: bc('babytracker_hour_short'), minute: bc('babytracker_minute_short'));
String _diaperLabel(String k) =>
    k == 'wet' ? bc('babytracker_diaper_wet') : k == 'dirty' ? bc('babytracker_diaper_dirty') : bc('babytracker_diaper_mixed');
String _tabLabel(String t) =>
    t == 'feeding' ? bc('babytracker_tab_feeding') : t == 'sleep' ? bc('babytracker_tab_sleep') : bc('babytracker_tab_diaper');
String _ago(DateTime d, DateTime now) {
  final m = minutesBetween(d, now);
  return m < 1 ? bc('babytracker_just_now') : '${_dur(m)} ${bc('babytracker_ago')}';
}

/// Compact h:mm for the small stat tile.
String _clock(num m) {
  final t = jsRoundInt(m);
  return '${t ~/ 60}:${(t % 60).toString().padLeft(2, '0')}';
}

String _oneDecimal(num n) => jsIsInteger(n) ? jsNumberToString(n) : n.toStringAsFixed(1);
double _perDay(num total, int days) => jsRound(total / days * 10) / 10;
String _periodText(String key, int days) => bc(key).replaceFirst('{days}', '$days');

/// `dayLabel(days)`: 'd.MM' beyond 30 days, the day number beyond 14, else date-fns 'EEEEEE'.
String Function(DateTime d) _dayLabel(int days, String lang) => (d) {
      if (days > 30) return '${d.day}.${d.month.toString().padLeft(2, '0')}';
      if (days > 14) return '${d.day}';
      return (kBabyWeekdayShort[lang] ?? kBabyWeekdayShort['az']!)[d.weekday % 7];
    };

/// date-fns `format(d, 'd MMM', { locale: getCurrentDateLocale() })`.
String _dayMonth(DateTime d, String lang) => '${d.day} ${(kBabyMonthShort[lang] ?? kBabyMonthShort['az']!)[d.month - 1]}';

/// `formatMinutes` of a sleep sum, `mlFromNotes` values etc. print like JS numbers.
String _n(num v) => jsNumberToString(v);

class BabyTracker extends ConsumerStatefulWidget {
  const BabyTracker({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BabyTracker> createState() => _BabyTrackerState();
}

class _Entry {
  const _Entry({required this.id, required this.time, required this.title, required this.detail});
  final String id;
  final DateTime time;
  final String title;
  final String detail;
}

class _BabyTrackerState extends ConsumerState<BabyTracker> {
  late String _tab;
  int _days = 7;
  final _ml = TextEditingController();
  final _food = TextEditingController();
  DateTime _now = DomainClock.now();
  Timer? _minute;
  BabyCareActions? _actions;
  BabyInsightController? _insight;

  @override
  void initState() {
    super.initState();
    final a = ref.read(widgetActionStoreProvider).consume();
    _tab = a == 'diaper' ? 'diaper' : a == 'sleep' ? 'sleep' : 'feeding';
    // Minute clock for "x min ago" and day boundaries; the running timers tick on their own.
    _minute = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() => _now = DomainClock.now());
    });
    _ml.addListener(_rebuild);
    _food.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    _minute?.cancel();
    _ml.dispose();
    _food.dispose();
    _insight?.dispose();
    super.dispose();
  }

  void _toast({String? title, String? description, bool destructive = false}) {
    if (!mounted) return;
    AToastHost.of(context).show(title: title, description: description, destructive: destructive);
  }

  void _refresh() => unawaited(refreshBabyLogsRange(ref.read(queryClientProvider)));

  BabyCareActions _care(int feedingsToday) {
    final a = _actions ??= ref.read(babyCareActionsFactoryProvider)(toast: _toast, onSaved: _refresh, feedingsToday: feedingsToday);
    if (a.feedingsToday == feedingsToday) return a;
    final next = ref.read(babyCareActionsFactoryProvider)(toast: _toast, onSaved: _refresh, feedingsToday: feedingsToday)..busy = a.busy;
    return _actions = next;
  }

  Future<void> _guard(Future<void> Function() fn) async {
    setState(() {});
    final f = fn();
    setState(() {});
    await f;
    if (mounted) setState(() {});
  }

  Future<void> _addDiaper(String kind, DiaperStats today) => _guard(() => _actions!.run(() async {
        unawaited(ref.read(babyCareServicesProvider).hapticLight());
        final hero = today.total >= _diaperHeroAfter;
        final res = await ref.read(babyLogsActionsProvider).addLog(logType: 'diaper', diaperType: kind);
        if (res.error != null) return _actions!.saveError();
        _refresh();
        _toast(title: '${bc('babytracker_diaper_saved')}: ${_diaperLabel(kind)}');
        if (hero) unawaited(ref.read(babyCareServicesProvider).unlockAchievement('diaper_hero', 'mommy'));
      }));

  Future<void> _remove(String id) async {
    final error = await ref.read(babyLogsActionsProvider).deleteLog(id);
    if (error != null) return _actions?.saveError();
    _refresh();
  }

  BabyInsightController _insightController() => _insight ??= BabyInsightController(
        store: ref.read(localStoreProvider),
        repository: ref.read(babyRepositoryProvider),
        peekRemainingDaily: (f) => ref.read(babyCareServicesProvider).peekRemainingDaily(f),
      );

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(appLanguageProvider);
    final logsView = ref.watch(babyLogsProvider);
    final range = ref.watch(babyLogsRangeQuery(90));
    final logs = range.data ?? const <BabyLogRow>[];
    final children = ref.watch(childrenProvider);
    final selectedChild = children.selectedChild;
    ref.watch(timerStoreProvider);
    final now = _now;

    final today = logsOfDay(logs, now);
    final feedToday = feedingStats(today);
    final sleepToday = sleepStats(today);
    final diaperToday = diaperStats(today);
    final windowLogs = logsInWindow(logs, now, _days);
    final feedPeriod = feedingStats(windowLogs);
    final sleepPeriod = sleepStats(windowLogs);
    final diaperPeriod = diaperStats(windowLogs);
    final trend = trendPoints(logs, _tab, now, _days);
    final history = dailyHistory(logs, now, _days).where((r) => r.feedings + r.diapers + r.sleepMinutes > 0).toList();
    final labelOf = _dayLabel(_days, language);

    final care = _care(feedToday.total);
    final busy = care.busy;
    final timers = care.timers;

    final feedEntries = [
      for (final l in today.where((l) => l.logType == 'feeding' && feedKind(l.feedType) != null).toList().reversed)
        () {
          final kind = feedKind(l.feedType), at = jsParseDate(l.startTime)!;
          var title = bc('babytracker_formula'), detail = l.notes ?? '';
          if (kind == 'left') title = bc('babytracker_breast_left');
          if (kind == 'right') title = bc('babytracker_breast_right');
          if (kind == 'solid') title = bc('babytracker_solid');
          if (kind == 'left' || kind == 'right') {
            final end = l.endTime == null || l.endTime!.isEmpty ? null : jsParseDate(l.endTime!);
            detail = end != null ? formatClockSeconds((end.millisecondsSinceEpoch - at.millisecondsSinceEpoch) / 1000) : '';
          } else if (kind == 'formula') {
            final v = mlFromNotes(l.notes);
            detail = v != null ? '${_n(v)} ml' : '';
          }
          return _Entry(id: l.id, time: at, title: title, detail: detail);
        }(),
    ];
    final sleepEntries = [
      for (final s in sleepToday.sessions.reversed)
        _Entry(id: s.id, time: s.start, title: '${timeOfDay(s.start)} – ${timeOfDay(s.end)}', detail: '${bc('babytracker_duration')}: ${_dur(s.minutes)}'),
    ];
    final diaperEntries = [
      for (final l in today.where((l) => l.logType == 'diaper').toList().reversed)
        () {
          final k = diaperKind(l.diaperType);
          return _Entry(id: l.id, time: jsParseDate(l.startTime)!, title: k != null ? _diaperLabel(k) : bc('babytracker_tab_diaper'), detail: '');
        }(),
    ];

    // AI analysis of today, one request per section when its button is pressed.
    final age = selectedChild == null ? null : getChildAge(selectedChild);
    final insight = _insightController();
    insight.update(
      selectedChild != null && age != null
          ? BabyInsightStats(
              sleepMinutes: jsRoundInt(sleepToday.totalMinutes),
              sleepCount: sleepToday.sessions.length,
              feedingCount: feedToday.total,
              breastCount: feedToday.left + feedToday.right,
              formulaCount: feedToday.formulaCount,
              formulaMl: feedToday.formulaMl,
              solidCount: feedToday.solidCount,
              diaperCount: diaperToday.total,
              wetCount: diaperToday.wet,
              dirtyCount: diaperToday.dirty,
              mixedCount: diaperToday.mixed,
            )
          : null,
      selectedChild != null && age != null ? BabyInsightChild(id: selectedChild.id, ageMonths: age.months, ageDays: age.days, gender: selectedChild.gender) : null,
      BabyInsightScope(backend: ref.watch(babyInsightBackendProvider), userId: ref.watch(authUserProvider)?.id, language: language),
    );
    // After the second birthday breastfeeding is no longer offered (a running timer still shows).
    final showBreast = offersBreastfeeding(age?.months) || timers.left != null || timers.right != null;

    final totalTitle = _periodText('babytracker_period_total', _days);
    final avgLabel = _periodText('babytracker_period_avg', _days);
    final trendTitle = _periodText('babytracker_trend_period', _days);
    final times = bc('babytracker_times');
    final x = context.aText;
    final a = context.a;

    Widget stack(List<Widget> children) => Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 12), children[i]],
          ]),
        );
    Widget bars(num Function(TrendPoint p) value, String Function(num v) format, String label) => BtBars(
          values: [for (final p in trend) value(p)],
          labels: [for (final p in trend) labelOf(p.day)],
          format: format,
          label: label,
        );
    final historyCard = BtCard(title: bc('babytracker_history'), child: _History(rows: history, language: language));
    Widget entriesCard(List<_Entry> entries) =>
        BtCard(title: bc('babytracker_entries'), child: _Entries(entries: entries, onDelete: (id) => unawaited(_remove(id))));
    Widget breast(String side, ActiveTimer? timer) => BtTile(
          key: ValueKey('bt-breast-$side'),
          selected: timer != null,
          onTap: busy ? null : () => unawaited(_guard(() => care.toggleBreast(side))),
          background: timer != null ? a.coralStrong : a.coralSoft,
          foreground: timer != null ? a.onCoral : a.accentInk,
          shadow: timer != null ? a.coralShadow : null,
          children: [
            Text(side == 'left' ? bc('babytracker_breast_left') : bc('babytracker_breast_right'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
            timer != null
                ? _Elapsed(since: timer.startTime, prefix: '${bc('babytracker_running')} · ', style: const TextStyle(fontSize: 12.5))
                : Text(bc('babytracker_start'), style: const TextStyle(fontSize: 12.5)),
          ],
        );

    Future<void> saveFormula() async {
      if (await care.saveFormula(jsNumber(_ml.text.replaceFirst(',', '.')))) _ml.clear();
      if (mounted) setState(() {});
    }

    Future<void> saveSolid() async {
      if (await care.saveSolid(_food.text)) _food.clear();
      if (mounted) setState(() {});
    }

    final feeding = stack([
      if (showBreast)
        BtCard(
          title: bc('babytracker_live_breast'),
          child: Row(children: [Expanded(child: breast('left', timers.left)), const SizedBox(width: 10), Expanded(child: breast('right', timers.right))]),
        ),
      TrackerAIInsight(section: 'feeding', controller: insight),
      BtCard(
        title: bc('babytracker_bottle'),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Expanded(child: BtInput(key: const ValueKey('bt-ml'), controller: _ml, placeholder: bc('babytracker_ml_label'), decimal: true, onSubmitted: () => unawaited(saveFormula()))),
            const SizedBox(width: 8),
            Flexible(child: AButton(
              key: const ValueKey('bt-formula-save'),
              variant: AButtonVariant.soft,
              size: AButtonSize.sm,
              leading: const AIcon(AIcons.plus, size: 14),
              onPressed: busy || _ml.text.trim().isEmpty ? null : () => unawaited(saveFormula()),
              child: Text(bc('babytracker_formula_save'), maxLines: 1, overflow: TextOverflow.ellipsis),
            )),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: BtInput(key: const ValueKey('bt-food'), controller: _food, placeholder: bc('babytracker_solid_label'), maxLength: 80, onSubmitted: () => unawaited(saveSolid()))),
            const SizedBox(width: 8),
            Flexible(child: AButton(
              key: const ValueKey('bt-solid-save'),
              variant: AButtonVariant.soft,
              size: AButtonSize.sm,
              leading: const AIcon(AIcons.plus, size: 14),
              onPressed: busy || _food.text.trim().isEmpty ? null : () => unawaited(saveSolid()),
              child: Text(bc('babytracker_solid_save'), maxLines: 1, overflow: TextOverflow.ellipsis),
            )),
          ]),
        ]),
      ),
      BtCard(
        title: bc('babytracker_today'),
        child: BtRows(rows: [
          if (showBreast) ...[
            (bc('babytracker_breast_left'), '${feedToday.left} $times'),
            (bc('babytracker_breast_right'), '${feedToday.right} $times'),
            (bc('babytracker_breast_minutes'), _dur(feedToday.breastMinutes)),
          ],
          (bc('babytracker_formula'), '${feedToday.formulaCount} $times${feedToday.formulaMl != 0 ? ' · ${_n(feedToday.formulaMl)} ml' : ''}'),
          (bc('babytracker_solid'), '${feedToday.solidCount} $times'),
          (bc('babytracker_avg_gap'), feedToday.averageGapMinutes != null && feedToday.averageGapMinutes != 0 ? _dur(feedToday.averageGapMinutes!) : '—'),
          (bc('babytracker_last'), feedToday.last != null ? '${timeOfDay(feedToday.last!.at)} · ${_ago(feedToday.last!.at, now)}' : '—'),
        ]),
      ),
      BtCard(
        title: totalTitle,
        child: BtRows(rows: [
          (bc('babytracker_total'), '${feedPeriod.total}'),
          if (showBreast) (bc('babytracker_breast_minutes'), _dur(feedPeriod.breastMinutes)),
          (bc('babytracker_formula'), '${feedPeriod.formulaCount}${feedPeriod.formulaMl != 0 ? ' · ${_n(feedPeriod.formulaMl)} ml' : ''}'),
          (bc('babytracker_solid'), '${feedPeriod.solidCount}'),
          (avgLabel, '${_oneDecimal(_perDay(feedPeriod.total, _days))} ${bc('babytracker_per_day')}'),
        ]),
      ),
      BtCard(title: trendTitle, child: bars((p) => p.count, (v) => _n(v), trendTitle)),
      historyCard,
      entriesCard(feedEntries),
    ]);

    final sleep = stack([
      ACard(
        variant: ACardVariant.a3,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(timers.sleep != null ? bc('babytracker_sleep_running') : bc('babytracker_sleep_idle'), textAlign: TextAlign.center, style: x.a3Meta),
          if (timers.sleep != null) ...[
            const SizedBox(height: 8),
            _Elapsed(
              since: timers.sleep!.startTime,
              style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: em(-0.02, 30), color: a.ink, height: 1.5),
            ),
          ],
          const SizedBox(height: 8),
          AButton(
            key: const ValueKey('bt-sleep-toggle'),
            variant: timers.sleep != null ? AButtonVariant.accent : AButtonVariant.soft,
            leading: const AIcon(AIcons.moon, size: 16),
            onPressed: busy ? null : () => unawaited(_guard(care.toggleSleep)),
            child: Text(timers.sleep != null ? bc('babytracker_sleep_stop') : bc('babytracker_sleep_start')),
          ),
        ]),
      ),
      TrackerAIInsight(section: 'sleep', controller: insight),
      BtCard(
        title: bc('babytracker_today'),
        child: BtRows(rows: [
          (bc('babytracker_total'), _dur(sleepToday.totalMinutes)),
          (bc('babytracker_sessions'), '${sleepToday.sessions.length}'),
          (bc('babytracker_average'), sleepToday.averageMinutes != null && sleepToday.averageMinutes != 0 ? _dur(sleepToday.averageMinutes!) : '—'),
          (bc('babytracker_longest'), sleepToday.longestMinutes != null && sleepToday.longestMinutes != 0 ? _dur(sleepToday.longestMinutes!) : '—'),
          (bc('babytracker_last_wake'), sleepToday.lastEnd != null ? '${timeOfDay(sleepToday.lastEnd!)} · ${_ago(sleepToday.lastEnd!, now)}' : '—'),
        ]),
      ),
      BtCard(
        title: totalTitle,
        child: BtRows(rows: [
          (bc('babytracker_total'), _dur(sleepPeriod.totalMinutes)),
          (bc('babytracker_sessions'), '${sleepPeriod.sessions.length}'),
          (bc('babytracker_average'), sleepPeriod.averageMinutes != null && sleepPeriod.averageMinutes != 0 ? _dur(sleepPeriod.averageMinutes!) : '—'),
          (bc('babytracker_longest'), sleepPeriod.longestMinutes != null && sleepPeriod.longestMinutes != 0 ? _dur(sleepPeriod.longestMinutes!) : '—'),
          (avgLabel, '${_dur(sleepPeriod.totalMinutes / _days)} ${bc('babytracker_per_day')}'),
        ]),
      ),
      BtCard(title: trendTitle, child: bars((p) => jsRoundInt(p.minutes), _dur, bc('babytracker_trend_sleep'))),
      historyCard,
      entriesCard(sleepEntries),
    ]);

    final diaper = stack([
      BtCard(
        title: bc('babytracker_diaper_change'),
        child: Row(children: [
          for (var i = 0; i < _diapers.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: BtTile(
                key: ValueKey('bt-diaper-${_diapers[i].value}'),
                onTap: busy ? null : () => unawaited(_addDiaper(_diapers[i].value, diaperToday)),
                background: a.surfaceSoft,
                foreground: a.ink,
                children: [
                  ExcludeSemantics(child: Text(_diapers[i].emoji, style: const TextStyle(fontSize: 20))),
                  Text(_diaperLabel(_diapers[i].value), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ],
        ]),
      ),
      TrackerAIInsight(section: 'diaper', controller: insight),
      BtCard(
        title: bc('babytracker_today'),
        child: BtRows(rows: [
          (bc('babytracker_total'), '${diaperToday.total}'),
          (bc('babytracker_diaper_wet'), '${diaperToday.wet}'),
          (bc('babytracker_diaper_dirty'), '${diaperToday.dirty}'),
          (bc('babytracker_diaper_mixed'), '${diaperToday.mixed}'),
          (bc('babytracker_avg_gap'), diaperToday.averageGapMinutes != null && diaperToday.averageGapMinutes != 0 ? _dur(diaperToday.averageGapMinutes!) : '—'),
          (bc('babytracker_last'), diaperToday.last != null ? '${timeOfDay(diaperToday.last!)} · ${_ago(diaperToday.last!, now)}' : '—'),
        ]),
      ),
      BtCard(
        title: totalTitle,
        child: BtRows(rows: [
          (bc('babytracker_total'), '${diaperPeriod.total}'),
          (bc('babytracker_diaper_wet'), '${diaperPeriod.wet}'),
          (bc('babytracker_diaper_dirty'), '${diaperPeriod.dirty}'),
          (bc('babytracker_diaper_mixed'), '${diaperPeriod.mixed}'),
          (avgLabel, '${_oneDecimal(_perDay(diaperPeriod.total, _days))} ${bc('babytracker_per_day')}'),
        ]),
      ),
      BtCard(title: trendTitle, child: bars((p) => p.count, (v) => _n(v), bc('babytracker_trend_diaper'))),
      historyCard,
      entriesCard(diaperEntries),
    ]);

    return AchievementToasts(
      child: ToolPage(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          ToolHeader(
            title: bc('babytracker_title'),
            eyebrow: (selectedChild?.name ?? '').isEmpty ? null : selectedChild!.name,
            onBack: widget.onBack,
          ),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: BtStatTile(
                icon: AIcons.milk,
                tint: ATint.peach,
                label: bc('babytracker_tab_feeding'),
                value: '${feedToday.total}',
                sub: feedToday.formulaMl != 0 ? '${_n(feedToday.formulaMl)} ml' : null,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: BtStatTile(
                icon: AIcons.moon,
                tint: ATint.lav,
                label: bc('babytracker_tab_sleep'),
                value: _clock(sleepToday.totalMinutes),
                sub: '${sleepToday.sessions.length} ${bc('babytracker_sessions')}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: BtStatTile(
                icon: AIcons.droplets,
                tint: ATint.yellow,
                label: bc('babytracker_tab_diaper'),
                value: '${diaperToday.total}',
                sub: '${bc('babytracker_diaper_wet')} ${diaperToday.wet} · ${bc('babytracker_diaper_dirty')} ${diaperToday.dirty}',
              ),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.only(top: 14),
            child: BtSeg<String>(
              items: [
                for (final t in const ['feeding', 'sleep', 'diaper'])
                  (value: t, label: _tabLabel(t), icon: t == 'feeding' ? AIcons.milk : t == 'sleep' ? AIcons.moon : AIcons.droplets),
              ],
              selected: _tab,
              onChanged: (t) => setState(() => _tab = t),
            ),
          ),
          A3Chips(marginTop: 10, children: [
            for (final d in _periods)
              A3ChipButton(
                key: ValueKey('bt-period-$d'),
                label: _periodText('babytracker_period_days', d),
                on: _days == d,
                semanticsRadio: true,
                onTap: () => setState(() => _days = d),
              ),
          ]),
          if (logsView.loading && logs.isEmpty)
            Padding(padding: const EdgeInsets.only(top: 12), child: Text(bc('babytracker_loading'), textAlign: TextAlign.center, style: x.a3Meta)),
          if (_tab == 'feeding') feeding,
          if (_tab == 'sleep') sleep,
          if (_tab == 'diaper') diaper,
          SafetyStrip(signs: tr('safety_babytracker_signs', 'Zəng edin: yenidoğanda 6+ saat yaş bez yoxdur, yeməkdən imtina, 3 aya qədər 38°C+')),
        ]),
      ),
    );
  }
}

/// Seconds since a timer started; only this text re-renders every second.
class _Elapsed extends ConsumerStatefulWidget {
  const _Elapsed({required this.since, this.prefix = '', this.style});
  final int since;
  final String prefix;
  final TextStyle? style;
  @override
  ConsumerState<_Elapsed> createState() => _ElapsedState();
}

class _ElapsedState extends ConsumerState<_Elapsed> {
  Timer? _tick;
  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final nowMs = ref.read(timerClockProvider)();
    return Text('${widget.prefix}${formatClockSeconds((nowMs - widget.since) / 1000)}',
        style: (widget.style ?? const TextStyle()).copyWith(fontFeatures: const [FontFeature.tabularFigures()]), textAlign: TextAlign.center);
  }
}

class _History extends StatelessWidget {
  const _History({required this.rows, required this.language});
  final List<HistoryRow> rows;
  final String language;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    if (rows.isEmpty) return Text(bc('babytracker_history_empty'), style: context.aText.a3Meta);
    final base = TextStyle(fontSize: 12.5, color: a.inkSoft, height: 1.5, fontFeatures: const [FontFeature.tabularFigures()]);
    Widget row(List<Widget> cells, {bool head = false}) => Container(
          padding: EdgeInsets.only(top: head ? 0 : 9, bottom: 9),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
          child: DefaultTextStyle.merge(
            style: head ? base.copyWith(fontWeight: FontWeight.w600) : base,
            child: Row(children: [
              Expanded(flex: 13, child: cells[0]),
              const SizedBox(width: 8),
              Expanded(flex: 10, child: cells[1]),
              const SizedBox(width: 8),
              Expanded(flex: 10, child: cells[2]),
              const SizedBox(width: 8),
              Expanded(flex: 7, child: cells[3]),
            ]),
          ),
        );
    return DefaultTextStyle.merge(
      style: base,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        row([Text(bc('babytracker_day')), Text(bc('babytracker_tab_feeding')), Text(bc('babytracker_tab_sleep')), Text(bc('babytracker_tab_diaper'))], head: true),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 360),
          child: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              for (final r in rows)
                row([
                  Text(_dayMonth(r.day, language), style: TextStyle(color: a.ink, fontWeight: FontWeight.w600)),
                  Text('${r.feedings}${r.formulaMl != 0 ? ' · ${_n(r.formulaMl)} ml' : ''}'),
                  Text(r.sleepMinutes != 0 ? _dur(r.sleepMinutes) : '0'),
                  Text('${r.diapers}'),
                ]),
            ]),
          ),
        ),
      ]),
    );
  }
}

class _Entries extends StatefulWidget {
  const _Entries({required this.entries, required this.onDelete});
  final List<_Entry> entries;
  final void Function(String id) onDelete;
  @override
  State<_Entries> createState() => _EntriesState();
}

class _EntriesState extends State<_Entries> {
  String? _armed;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    if (widget.entries.isEmpty) return Text(bc('babytracker_empty'), style: x.a3Meta);
    final list = widget.entries;
    return Column(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < list.length; i++)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(border: i < list.length - 1 ? Border(bottom: BorderSide(color: a.line)) : null),
          child: Row(children: [
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 48),
              child: Text(timeOfDay(list[i].time),
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: a.ink, height: 1.5, fontFeatures: const [FontFeature.tabularFigures()])),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text(list[i].title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: a.ink, height: 1.5)),
                if (list[i].detail.isNotEmpty) Text(list[i].detail, style: x.a3Meta),
              ]),
            ),
            const SizedBox(width: 10),
            Semantics(
              button: true,
              label: _armed == list[i].id ? bc('babytracker_delete_confirm') : bc('babytracker_delete'),
              child: GestureDetector(
                key: ValueKey('bt-del-${list[i].id}'),
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  final id = list[i].id;
                  if (_armed == id) {
                    setState(() => _armed = null);
                    widget.onDelete(id);
                  } else {
                    setState(() => _armed = id);
                  }
                },
                child: Container(
                  constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: _armed == list[i].id ? a.pink1 : null, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(AIcons.trash2, size: 16, color: _armed == list[i].id ? a.alertInk : a.inkSoft),
                    if (_armed == list[i].id) ...[
                      const SizedBox(width: 4),
                      Text(bc('babytracker_delete'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: a.alertInk)),
                    ],
                  ]),
                ),
              ),
            ),
          ]),
        ),
    ]);
  }
}
