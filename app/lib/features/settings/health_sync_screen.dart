// Ported from: src/components/HealthSyncScreen.tsx, src/styles/health-sync.css
//
// Apple Health (iOS) / Health Connect (Android), both directions: reads steps / workouts (+ mindful minutes on
// iOS) to show here, and optionally copies measurements and period days to the phone's health store.
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/cache/cache.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../state/state.dart';
import 'copy/feature_copy.dart';
import 'data/health_service.dart';
import 'ui/settings_ui.dart';

const int kStepGoal = 7000;

class HealthSyncScreen extends ConsumerStatefulWidget {
  const HealthSyncScreen({super.key, required this.onBack});
  final VoidCallback onBack;
  @override
  ConsumerState<HealthSyncScreen> createState() => _HealthSyncScreenState();
}

class _HealthSyncScreenState extends ConsumerState<HealthSyncScreen> {
  HealthService get _s => ref.read(healthServiceProvider);
  bool get _connected => ref.read(healthConnectedProvider);
  set _connected(bool v) => ref.read(healthConnectedProvider.notifier).set(v);
  bool _connecting = false;
  late bool _vitalsWrite = _s.isVitalsWriteEnabled();
  bool _vitalsBusy = false;
  int? _lastSync;
  late bool _cycleWrite = _s.isCycleWriteEnabled();
  bool _cycleBusy = false;

  @override
  void initState() {
    super.initState();
    final uid = ref.read(userStoreProvider).userId;
    _lastSync = uid == null ? null : _s.getLastVitalsSync(uid);
  }

  FeatureText get _t => healthSyncText(ref.read(userStoreProvider).language);
  String get _platformName => _s.healthPlatform() == 'android' ? 'Health Connect' : 'Apple Health';

  void _refresh() {
    final qc = ref.read(queryClientProvider);
    unawaited(qc.invalidateQueries(queryKey: const ['health-read-access']));
    unawaited(qc.invalidateQueries(queryKey: const ['health-daily']));
    unawaited(qc.invalidateQueries(queryKey: const ['health-workouts']));
  }

  void _toast(String title, {String? description, bool destructive = false}) => toasts(context).show(title: title, description: description, destructive: destructive);

  Future<void> _connect() async {
    setState(() => _connecting = true);
    final ok = await _s.requestHealthPermissions();
    if (!mounted) return;
    setState(() => _connecting = false);
    final t = _t;
    if (ok) {
      setState(() => _connected = true);
      _refresh();
      _toast(t('connected_toast'), description: fill(t('dir_in_title'), {'platform': _platformName}));
    } else {
      _toast(t('denied_title'), description: fill(t('denied_desc'), {'platform': _platformName}), destructive: true);
    }
  }

  void _disconnect() {
    _s.disconnectHealth();
    setState(() => _connected = false);
    _toast(_t('disconnect'), description: _t('disconnected_toast'));
  }

  Future<void> _runVitalsSync(bool announceEmpty) async {
    final uid = ref.read(userStoreProvider).userId;
    if (uid == null) return;
    final t = _t;
    setState(() => _vitalsBusy = true);
    try {
      final r = await _s.syncVitalsToHealth(uid);
      if (!mounted) return;
      setState(() => _lastSync = _s.getLastVitalsSync(uid));
      if (r.failed > 0) {
        _toast(t('sync_failed'), destructive: true);
      } else if (r.written > 0) {
        _toast(fill(t('synced_toast'), {'count': r.written}));
      } else if (announceEmpty) {
        _toast(t('synced_none'));
      }
    } catch (_) {
      if (mounted) _toast(t('sync_failed'), destructive: true);
    } finally {
      if (mounted) setState(() => _vitalsBusy = false);
    }
  }

  Future<void> _toggleVitals(bool on) async {
    final t = _t;
    final android = _s.healthPlatform() == 'android';
    if (!on) {
      _s.setVitalsWriteEnabled(false);
      setState(() => _vitalsWrite = false);
      return;
    }
    setState(() => _vitalsBusy = true);
    if (!await _s.isVitalsWriteAvailable()) {
      if (!mounted) return;
      setState(() => _vitalsBusy = false);
      _toast(t('unavailable'), description: android ? t('install_desc') : t('unavailable_update'), destructive: true);
      return;
    }
    final granted = await _s.requestVitalsWritePermission();
    if (!mounted) return;
    setState(() => _vitalsBusy = false);
    if (!granted) {
      _toast(t('denied_title'), description: fill(t('denied_desc'), {'platform': _platformName}), destructive: true);
      return;
    }
    _s.setVitalsWriteEnabled(true);
    setState(() => _vitalsWrite = true);
    _toast(t('connected_toast'), description: t('vitals_on'));
    await _runVitalsSync(false);
  }

  Future<void> _toggleCycle(bool on) async {
    final t = _t;
    final android = _s.healthPlatform() == 'android';
    if (!on) {
      _s.setCycleWriteEnabled(false);
      setState(() => _cycleWrite = false);
      return;
    }
    setState(() => _cycleBusy = true);
    if (!await _s.isCycleWriteAvailable()) {
      if (!mounted) return;
      setState(() => _cycleBusy = false);
      _toast(t('unavailable'), description: android ? t('install_desc') : t('unavailable_update'), destructive: true);
      return;
    }
    final granted = await _s.requestCycleWritePermission();
    if (!mounted) return;
    setState(() => _cycleBusy = false);
    if (granted) {
      _s.setCycleWriteEnabled(true);
      setState(() => _cycleWrite = true);
      _toast(t('connected_toast'), description: t('cycle_on'));
    } else {
      _toast(t('denied_title'), description: fill(t('denied_desc'), {'platform': _platformName}), destructive: true);
    }
  }

  String _workoutLabel(FeatureText t, String type) {
    final k = type.toLowerCase();
    if (k.contains('walk') || k.contains('hik')) return t('wt_walking');
    if (k.contains('run')) return t('wt_running');
    if (k.contains('yoga')) return t('wt_yoga');
    if (k.contains('swim')) return t('wt_swimming');
    if (k.contains('cycl') || k.contains('bik')) return t('wt_cycling');
    if (k.contains('pilates')) return t('wt_pilates');
    return t('wt_workout');
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final store = ref.watch(userStoreProvider);
    final t = healthSyncText(store.language);
    final s = ref.watch(healthServiceProvider);
    final platform = s.healthPlatform();
    final android = platform == 'android';
    final locale = appLanguage(store.language).intlLocale;
    // `n.toLocaleString(locale)` with the ICU symbols React renders (package:intl's CLDR data differs for some locales).
    String number(int n) => formatIntlNumber(store.language, n);

    final availability = ref.watch(healthAvailabilityQuery);
    final hcMissing = android && availability.data == false && !availability.isLoading;
    ref.watch(healthConnectedProvider);
    final access = ref.watch(healthReadAccessQuery);
    final daily = ref.watch(healthDailyQuery(7));
    final workoutsQ = ref.watch(healthWorkoutsQuery(7));
    final cycleAvailable = ref.watch(healthCycleWriteAvailableQuery).data;
    final workouts = workoutsQ.data ?? const <HealthWorkout>[];
    final noAccess = android && access.data != null && !access.data!.steps && !access.data!.workouts;

    final today = localDayKey(DateTime.now());
    final steps = daily.data?.steps ?? const <DailyHealthSample>[];
    final todaySteps = steps.where((e) => e.date == today).firstOrNull?.value ?? 0;
    final avgSteps = steps.isEmpty ? 0 : (steps.fold<int>(0, (s, e) => s + e.value) / steps.length + 0.5).floor();
    final maxSteps = [kStepGoal, ...steps.map((e) => e.value)].reduce(math.max);
    final weekMindful = (daily.data?.mindfulness ?? const <DailyHealthSample>[]).fold<int>(0, (s, e) => s + e.value);
    final activeMinutes = (workouts.fold<double>(0, (s, w) => s + w.duration) / 60 + 0.5).floor();
    final loaded = daily.isSuccess && workoutsQ.isSuccess;
    final nothingFound = loaded && steps.every((e) => e.value == 0) && workouts.isEmpty && weekMindful == 0;
    final readError = daily.isError || workoutsQ.isError;

    final (String cls, String statusLabel) = hcMissing
        ? ('warn', t('status_install'))
        : !_connected
            ? ('', t('status_off'))
            : noAccess
                ? ('warn', t('status_no_access'))
                : ('on', t('status_connected'));
    final lastSyncText = _lastSync != null
        ? fill(t('last_sync'), {'time': _fmt(DateTime.fromMillisecondsSinceEpoch(_lastSync!), 'MMMd', locale, withTime: true)})
        : t('never_synced');

    Widget enter(Widget child, [int delayMs = 0]) => FadeRise(dy: 14, delay: Duration(milliseconds: delayMs), child: child);
    Widget chipBtn(String text, AIconData icon, VoidCallback? onTap, {Key? key, bool spin = false}) => Opacity(
          opacity: onTap == null ? 0.55 : 1,
          child: Semantics(
            button: true,
            label: text,
            child: GestureDetector(
              key: key,
              onTap: onTap,
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.lineStrong)),
                child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                  spin ? ALoader(size: 14, color: a.ink) : AIcon(icon, size: 14, color: a.ink),
                  const SizedBox(width: 6),
                  ExcludeSemantics(child: Text(text, style: px(13, weight: FontWeight.w700, color: a.ink))),
                ]),
              ),
            ),
          ),
        );
    Widget hint(String title, String body, List<Widget> actions) => Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(color: a.yellow1, borderRadius: BorderRadius.circular(a.radiusMd)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Padding(padding: const EdgeInsets.only(bottom: 4), child: Text(title, style: px(14, weight: FontWeight.w700, color: a.warnInk))),
            Text(body, style: px(13, color: a.warnSoft, height: 1.45)),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: actions),
          ]),
        );
    Widget sectionTitle(String text) => Padding(
          padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
          child: Text(cssUpper(text), style: px(12, weight: FontWeight.w800, color: a.inkSoft, ls: 0.05)),
        );
    Widget listIcon(AIconData icon, Color bg, Color ink, {double size = 17}) => AListIcon(background: bg, foreground: ink, child: AIcon(icon, size: size));
    Widget cta(String text, AIconData icon, VoidCallback? onTap, {double height = 48, Key? key}) => Opacity(
          opacity: onTap == null ? 0.6 : 1,
          child: Semantics(
            button: true,
            label: text,
            child: GestureDetector(
              key: key,
              onTap: onTap,
              child: Container(
                height: height,
                decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                  AIcon(icon, size: 16, strokeWidth: 2.2, color: const Color(0xFFFFFFFF)),
                  const SizedBox(width: 6),
                  ExcludeSemantics(child: Text(text, style: x.aCtaBtn)),
                ]),
              ),
            ),
          ),
        );

    final List<Widget> content = <Widget>[];
    if (platform == null) {
      content.add(ACard(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 28),
        child: Column(children: <Widget>[
          Padding(padding: const EdgeInsets.only(bottom: 10), child: AIcon(AIcons.heartPulse, size: 34, color: a.inkFaint)),
          Text(t('web_title'), textAlign: TextAlign.center, style: x.aListTitle.copyWith(fontSize: 15)),
          Padding(padding: const EdgeInsets.only(top: 4), child: Text(t('web_desc'), textAlign: TextAlign.center, style: x.aListSub)),
        ]),
      ));
    } else {
      if (hcMissing) {
        content.add(enter(ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(t('install_desc'), style: x.aListSub)),
            cta(t('install_btn'), AIcons.download, () => unawaited(s.installHealthConnect()), key: const ValueKey<String>('health-install')),
          ]),
        )));
      } else if (!_connected) {
        content.add(enter(ACard(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            Center(
              child: Container(
                width: 56,
                height: 56,
                margin: const EdgeInsets.only(bottom: 12),
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: a.gradGreen, borderRadius: BorderRadius.circular(18)),
                child: AIcon(AIcons.heartPulse, size: 26, color: a.greenInk),
              ),
            ),
            Text(t('intro'), textAlign: TextAlign.center, style: x.aListSub),
            _Directions(t: t, platformName: _platformName, mindful: s.mindfulnessSupported()),
            cta(_connecting ? t('connecting') : fill(t('connect_btn'), {'platform': _platformName}), AIcons.link2, _connecting ? null : _connect, height: 50, key: const ValueKey<String>('health-connect')),
          ]),
        )));
      } else if (noAccess) {
        content.add(enter(hint(t('status_no_access'), t('no_access_desc'), <Widget>[
          chipBtn(t('grant_btn'), AIcons.link2, _connecting ? null : _connect, key: const ValueKey<String>('health-grant')),
          chipBtn(t('open_permissions'), AIcons.settings2, () => unawaited(s.openHealthSettings())),
        ])));
      } else {
        content.add(enter(ACard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
            Row(children: <Widget>[
              _StepRing(
                value: todaySteps,
                goal: kStepGoal,
                loading: daily.isLoading,
                child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
                  AIcon(AIcons.footprints, size: 14, color: a.greenInk),
                  Text(daily.isLoading ? '…' : number(todaySteps), style: px(22, weight: FontWeight.w800, color: a.ink, ls: -0.02, height: 1.1)),
                  Text(t('steps'), style: px(11.5, color: a.inkSoft)),
                ]),
              ),
              const SizedBox(width: 18),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                  Text(cssUpper(t('today')), style: px(12, weight: FontWeight.w700, color: a.inkFaint, ls: 0.04)),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: todaySteps >= kStepGoal
                        ? Text(t('goal_done'), style: px(13.5, weight: FontWeight.w700, color: a.greenInk, height: 1.4))
                        : Text(fill(t('goal'), {'goal': number(kStepGoal)}), style: px(13.5, color: a.inkSoft, height: 1.4)),
                  ),
                ]),
              ),
            ]),
            const SizedBox(height: 14),
            Row(children: <Widget>[
              _Stat(value: number(avgSteps), label: t('avg7')),
              const SizedBox(width: 8),
              _Stat(value: '${workouts.length}', label: t('workouts7')),
              const SizedBox(width: 8),
              s.mindfulnessSupported() ? _Stat(value: '$weekMindful', label: t('mindful7')) : _Stat(value: '$activeMinutes', label: t('active7')),
            ]),
          ]),
        )));
        if (readError || nothingFound) {
          content.add(Padding(
            padding: const EdgeInsets.only(top: 12),
            child: enter(
              hint(readError ? t('load_error') : t('empty_title'), android ? t('empty_android') : t('empty_ios'), <Widget>[
                chipBtn(t('open_permissions'), AIcons.settings2, () => unawaited(s.openHealthSettings()), key: const ValueKey<String>('health-open-permissions')),
                chipBtn(t('refresh'), AIcons.refreshCw, _refresh),
              ]),
              50,
            ),
          ));
        }
        if (!nothingFound) {
          content.add(Padding(
            padding: const EdgeInsets.only(top: 12),
            child: enter(
              ACard(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: <Widget>[
                      Expanded(child: Text(t('week_title'), style: x.heading(x.aCardTitle))),
                      AIconBtn(size: 34, semanticLabel: t('refresh'), onTap: _refresh, icon: daily.isFetching ? ALoader(size: 15, color: a.ink) : const AIcon(AIcons.refreshCw, size: 15)),
                    ]),
                  ),
                  _StepBars(steps: steps, today: today, maxSteps: maxSteps),
                  const SizedBox(height: 6),
                  Row(children: <Widget>[
                    for (var i = 0; i < steps.length; i++) ...<Widget>[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _weekday(steps[i].date, locale),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: px(10, weight: steps[i].date == today ? FontWeight.w800 : FontWeight.w400, color: steps[i].date == today ? a.ink : a.inkFaint),
                        ),
                      ),
                    ],
                  ]),
                ]),
              ),
              80,
            ),
          ));
        }
        if (workouts.isNotEmpty) {
          content.add(sectionTitle(t('workouts_title')));
          content.add(enter(
            ACard(
              variant: ACardVariant.list,
              child: Column(children: <Widget>[
                for (var i = 0; i < math.min(5, workouts.length); i++)
                  AListRow(
                    first: i == 0,
                    title: _workoutLabel(t, workouts[i].workoutType),
                    subtitle: '${_fmt(DateTime.tryParse(workouts[i].startDate)?.toLocal(), 'MMMd', locale)} · ${math.max(1, (workouts[i].duration / 60 + 0.5).floor())} ${t('min')}',
                    leading: listIcon(AIcons.activity, a.lav1, a.lavInk),
                    trailing: workouts[i].calories > 0 ? Text('${workouts[i].calories} ${t('kcal')}', style: x.aListValue) : null,
                  ),
              ]),
            ),
            120,
          ));
        }
      }
      if (!hcMissing) {
        content.add(sectionTitle(fill(t('out_title'), {'platform': _platformName})));
        final showCycle = store.lifeStage == 'flow' || _cycleWrite;
        content.add(ACard(
          variant: ACardVariant.list,
          child: Column(children: <Widget>[
            _SwitchRow(
              first: true,
              icon: listIcon(AIcons.scale, a.blue1, a.blueInk, size: 16),
              title: t('vitals_title'),
              desc: t('vitals_desc'),
              switchKey: 'health-vitals',
              checked: _vitalsWrite,
              disabled: _vitalsBusy,
              onChanged: (v) => unawaited(_toggleVitals(v)),
            ),
            if (_vitalsWrite)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(color: a.surfaceSoft, border: Border(top: BorderSide(color: a.line))),
                child: Row(children: <Widget>[
                  Expanded(child: Text(lastSyncText, style: px(12.5, color: a.inkSoft))),
                  const SizedBox(width: 10),
                  chipBtn(_vitalsBusy ? t('syncing') : t('sync_now'), AIcons.refreshCw, _vitalsBusy ? null : () => unawaited(_runVitalsSync(true)), key: const ValueKey<String>('health-sync-now'), spin: _vitalsBusy),
                ]),
              ),
            if (showCycle)
              _SwitchRow(
                icon: listIcon(AIcons.droplet, a.pink1, a.pinkInk, size: 16),
                title: t('cycle_title'),
                desc: t('cycle_desc'),
                switchKey: 'health-cycle',
                checked: _cycleWrite,
                disabled: _cycleBusy || (!_cycleWrite && (store.lifeStage != 'flow' || cycleAvailable == false)),
                onChanged: (v) => unawaited(_toggleCycle(v)),
              ),
          ]),
        ));
      }
      content.add(Padding(
        padding: const EdgeInsets.only(top: 22),
        child: ACard(
          variant: ACardVariant.list,
          child: Column(children: <Widget>[
            AListRow(
              first: true,
              title: t('permissions'),
              subtitle: fill(t('permissions_desc'), {'platform': _platformName}),
              leading: listIcon(AIcons.settings2, a.blue1, a.blueInk),
              onTap: () => unawaited(s.openHealthSettings()),
            ),
            if (_connected)
              GestureDetector(
                key: const ValueKey<String>('health-disconnect'),
                behavior: HitTestBehavior.opaque,
                onTap: _disconnect,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: a.line))),
                  child: Row(children: <Widget>[
                    listIcon(AIcons.link2, a.pink1, a.pinkInk),
                    const SizedBox(width: 13),
                    Text(t('disconnect'), style: x.aListTitle.copyWith(fontSize: 14, color: a.pinkInk)),
                  ]),
                ),
              ),
          ]),
        ),
      ));
      content.add(Padding(
        padding: const EdgeInsets.only(top: 14),
        child: CustomPaint(
          painter: _DashTop(a.lineStrong),
          child: Padding(
            padding: const EdgeInsets.only(top: 14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
              Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.shieldCheck, size: 15, color: a.inkSoft)),
              const SizedBox(width: 8),
              Expanded(child: Text(t('privacy'), style: px(12, color: a.inkSoft, height: 1.55))),
            ]),
          ),
        ),
      ));
    }

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: Stack(children: <Widget>[
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 96),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 448),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Row(children: <Widget>[
                        AIconBtn(size: 44, semanticLabel: tr('common_geri', 'Geri'), onTap: widget.onBack, icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                            Text(cssUpper(t('eyebrow')), style: todayInfoEyebrow(context)),
                            Text(_platformName, style: px(20, weight: FontWeight.w700, color: a.ink, ls: -0.02)),
                          ]),
                        ),
                        if (platform != null) ...<Widget>[const SizedBox(width: 12), _Status(cls: cls, label: statusLabel)],
                      ]),
                    ),
                    ...content,
                  ]),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  static String _fmt(DateTime? d, String skeleton, String locale, {bool withTime = false}) {
    if (d == null) return '';
    DateFormat f(String l) => withTime ? (DateFormat.MMMd(l)..add_Hm()) : DateFormat(skeleton, l);
    try {
      return f(locale).format(d);
    } catch (_) {
      return f('en_US').format(d);
    }
  }

  static String _weekday(String key, String locale) {
    final p = key.split('-').map(int.parse).toList();
    final d = DateTime(p[0], p[1], p[2]);
    try {
      return DateFormat.E(locale).format(d);
    } catch (_) {
      return DateFormat.E('en_US').format(d);
    }
  }
}

class _Status extends StatelessWidget {
  const _Status({required this.cls, required this.label});
  final String cls;
  final String label;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (Color bg, Color fg, Color dot) = switch (cls) {
      'on' => (a.green1, a.greenInk, a.green2),
      'warn' => (a.yellow1, a.yellowInk, a.yellow2),
      _ => (a.surfaceSoft, a.inkSoft, a.inkFaint),
    };
    return Container(
      key: const ValueKey<String>('health-status'),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
        Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: px(12, weight: FontWeight.w700, color: fg)),
      ]),
    );
  }
}

class _Directions extends StatelessWidget {
  const _Directions({required this.t, required this.platformName, required this.mindful});
  final FeatureText t;
  final String platformName;
  final bool mindful;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget dir(AIconData icon, Color bg, Color fg, String title, String body) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(18)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Container(width: 36, height: 36, alignment: Alignment.center, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)), child: AIcon(icon, size: 17, color: fg)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                Text(title, style: px(13.5, weight: FontWeight.w700, color: a.ink)),
                Padding(padding: const EdgeInsets.only(top: 2), child: Text(body, style: px(12.5, color: a.inkSoft, height: 1.4))),
              ]),
            ),
          ]),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 14, 0, 16),
      child: VGap(gap: 10, children: <Widget>[
        dir(AIcons.arrowDownToLine, a.green1, a.greenInk, fill(t('dir_in_title'), {'platform': platformName}), mindful ? t('dir_in_ios') : t('dir_in_android')),
        dir(AIcons.arrowUpFromLine, a.peach1, a.accentInk, fill(t('dir_out_title'), {'platform': platformName}), t('dir_out_desc')),
      ]),
    );
  }
}

class _StepRing extends StatelessWidget {
  const _StepRing({required this.value, required this.goal, required this.loading, required this.child});
  final int value;
  final int goal;
  final bool loading;
  final Widget child;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final progress = loading ? 0.0 : math.min(1.0, value / goal);
    return SizedBox(
      width: 112,
      height: 112,
      child: Stack(alignment: Alignment.center, children: <Widget>[
        TweenAnimationBuilder<double>(
          tween: Tween<double>(begin: 0, end: progress),
          duration: const Duration(milliseconds: 600),
          curve: ACurves.cssEase,
          builder: (context, p, _) => CustomPaint(size: const Size.square(112), painter: _RingPainter(track: a.green1, fill: a.green2, progress: p)),
        ),
        child,
      ]),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.track, required this.fill, required this.progress});
  final Color track;
  final Color fill;
  final double progress;
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: 48);
    canvas.drawArc(rect, 0, 2 * math.pi, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..color = track);
    if (progress > 0) {
      canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * progress, false, Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..strokeCap = StrokeCap.round
        ..color = fill);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.fill != fill || old.track != track;
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
        child: Column(children: <Widget>[
          Text(value, textAlign: TextAlign.center, style: px(17, weight: FontWeight.w800, color: a.ink)),
          Padding(padding: const EdgeInsets.only(top: 2), child: Text(label, textAlign: TextAlign.center, style: px(11, color: a.inkSoft, height: 1.25))),
        ]),
      ),
    );
  }
}

class _StepBars extends StatelessWidget {
  const _StepBars({required this.steps, required this.today, required this.maxSteps});
  final List<DailyHealthSample> steps;
  final String today;
  final int maxSteps;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.only(top: 22),
      child: SizedBox(
        height: 104,
        child: Stack(clipBehavior: Clip.none, children: <Widget>[
          Positioned(left: 0, right: 0, bottom: 104 * kStepGoal / maxSteps, child: CustomPaint(size: const Size(double.infinity, 1.5), painter: _DashTop(a.lineStrong, width: 1.5))),
          Row(crossAxisAlignment: CrossAxisAlignment.end, children: <Widget>[
            for (var i = 0; i < steps.length; i++) ...<Widget>[
              if (i > 0) const SizedBox(width: 8),
              Expanded(
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: TweenAnimationBuilder<double>(
                    tween: Tween<double>(begin: 0, end: math.max(4, steps[i].value / maxSteps * 100) / 100),
                    duration: const Duration(milliseconds: 300),
                    curve: ACurves.framerDefault,
                    builder: (context, h, _) => Container(
                      height: 104 * h,
                      constraints: const BoxConstraints(maxWidth: 30),
                      decoration: BoxDecoration(
                        color: steps[i].value >= kStepGoal ? a.green2 : a.green1,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(8), bottom: Radius.circular(4)),
                        border: steps[i].date == today ? Border.all(color: a.green2, width: 2) : null,
                      ),
                      child: Stack(clipBehavior: Clip.none, alignment: Alignment.topCenter, children: <Widget>[
                        if (steps[i].value > 0)
                          Positioned(
                            top: -15,
                            left: -20,
                            right: -20,
                            child: Text(
                              textAlign: TextAlign.center,
                              steps[i].value >= 1000 ? '${(steps[i].value / 1000).toStringAsFixed(1)}k' : '${steps[i].value}',
                              softWrap: false,
                              overflow: TextOverflow.visible,
                              style: px(9.5, weight: FontWeight.w700, color: a.inkSoft, height: 1.2),
                            ),
                          ),
                      ]),
                    ),
                  ),
                ),
              ),
            ],
          ]),
        ]),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({required this.icon, required this.title, required this.desc, required this.switchKey, required this.checked, required this.disabled, required this.onChanged, this.first = false});
  final Widget icon;
  final String title;
  final String desc;
  final String switchKey;
  final bool checked;
  final bool disabled;
  final ValueChanged<bool> onChanged;
  final bool first;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
      child: Row(children: <Widget>[
        icon,
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(title, style: x.aListTitle.copyWith(fontSize: 14)),
            Padding(padding: const EdgeInsets.only(top: 2), child: Text(desc, style: x.aListSub)),
          ]),
        ),
        const SizedBox(width: 12),
        ShadSwitch(key: ValueKey<String>(switchKey), semanticLabel: title, checked: checked, checkedColor: a.peach2, disabled: disabled, onChanged: onChanged),
      ]),
    );
  }
}

class _DashTop extends CustomPainter {
  _DashTop(this.color, {this.width = 1});
  final Color color;
  final double width;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = width;
    final dash = 3 * width;
    for (var x = 0.0; x < size.width; x += dash * 2) {
      canvas.drawLine(Offset(x, width / 2), Offset(math.min(x + dash, size.width), width / 2), p);
    }
  }

  @override
  bool shouldRepaint(_DashTop old) => old.color != color;
}
