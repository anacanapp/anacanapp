// Ported from: src/components/sleep/NextNapSection.tsx, src/data/sleep-next/index.ts (useSleepNextText),
//              src/lib/feature-text.ts (fill), src/lib/nap-alerts.ts (readNapAlerts, saveNapAlerts, syncNapAlerts,
//              requestNapAlertPermission), src/styles/care.css (.cx-card, .cx-gap, .cx-row, .cx-icon, .cx-sub, .cx-pill,
//              .cx-eyebrow, .cx-field, .cx-chips, .cx-chip, .cx-seg, .cx-list, .cx-li, .cx-disc)
//
// The "Next nap" block on the sleep tool's Today tab: gauge, plan, regressions and alerts. The copy is one JSON per
// language (assets/i18n/sleep-next.<lang>.json; English, then Azerbaijani when a file is missing).
import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../domain/notifications/local_notification_plan.dart' show StoredNotification;
import '../../../domain/sleep/nap_alerts.dart';
import '../../../domain/sleep/sleep_predict.dart';
import '../../../domain/sleep/sleep_training.dart';
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../settings/ui/settings_ui.dart' show ShadSwitch;
import '../parenting/programme_ports.dart';
import '../parenting/programme_ui.dart';

// ── Copy ───────────────────────────────────────────────────────────────────────────────────────

/// `SleepNextText` (the JSON of one language).
class SleepNextText {
  const SleepNextText(this.json);
  final Map<String, dynamic> json;
  String s(String key) => '${json[key] ?? ''}';
  String cue(String c) => '${(json['cues'] as Map?)?[c] ?? c}';
  Map<String, dynamic> regression(String key) => Map<String, dynamic>.from((json['regressions'] as Map)[key] as Map);
  List<String> regressionList(String key, String field) => [for (final x in regression(key)[field] as List) '$x'];
}

/// `fill(template, values)`: unknown names stay as `{name}`.
String fill(String template, Map<String, Object?> values) =>
    template.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!);

typedef SleepNextAssetLoader = Future<String?> Function(String language);

final sleepNextAssetLoaderProvider = Provider<SleepNextAssetLoader>((ref) => (language) async {
      try {
        return await rootBundle.loadString('assets/i18n/sleep-next.$language.json');
      } catch (_) {
        return null;
      }
    });

/// `useSleepNextText(language)`: the language file, else English, else Azerbaijani.
final sleepNextTextProvider = FutureProvider.family<SleepNextText, String>((ref, language) async {
  final load = ref.watch(sleepNextAssetLoaderProvider);
  final raw = await load(language) ?? await load('en') ?? await load('az');
  return SleepNextText(Map<String, dynamic>.from(jsonDecode(raw!) as Map));
}, name: 'sleepNextTextProvider');

// ── Nap alert settings / cues (this phone) ─────────────────────────────────────────────────────

const String cuesKey = 'anacan.sleepCues.v1';

/// `fmtDur(min)`: `h:mm` from an hour, else `n′`.
String fmtDur(num min) => min >= 60 ? '${(min / 60).floor()}:${'${(min % 60).round()}'.padLeft(2, '0')}' : '${min.round()}′';

class NextNapSection extends ConsumerStatefulWidget {
  const NextNapSection({
    super.key,
    required this.entries,
    required this.band,
    required this.now,
    required this.birth,
    required this.childName,
    required this.sleepingSince,
    required this.morningWake,
    required this.busy,
    required this.onStartSleep,
  });
  final List<SleepEntry> entries;
  final AgeBand band;
  final DateTime now;
  final DateTime birth;
  final String childName;
  final DateTime? sleepingSince;
  final DateTime? morningWake;
  final bool busy;
  final VoidCallback onStartSleep;

  @override
  ConsumerState<NextNapSection> createState() => _NextNapSectionState();
}

class _NextNapSectionState extends ConsumerState<NextNapSection> {
  late NapAlertSettings _alerts;
  ({String key, List<String> cues})? _cueState;
  String? _alertKey;

  @override
  void initState() {
    super.initState();
    _alerts = parseNapAlerts(ref.read(localStoreProvider).getItem(napAlertsStorageKey));
  }

  /// Sleep cues apply to the current awake period only (keyed by its start).
  List<String> _cues(DateTime? lastWake) {
    final key = lastWake == null ? '' : '${lastWake.millisecondsSinceEpoch}';
    var st = _cueState;
    if (st == null) {
      try {
        final raw = jsonDecode(ref.read(localStoreProvider).getItem(cuesKey) ?? 'null');
        st = raw is Map && raw['key'] == key ? (key: key, cues: [for (final c in raw['cues'] as List) '$c']) : (key: key, cues: <String>[]);
      } catch (_) {
        st = (key: key, cues: <String>[]);
      }
      _cueState = st;
    }
    return st.key == key ? st.cues : const [];
  }

  void _toggleCue(DateTime? lastWake, String c) {
    final key = lastWake == null ? '' : '${lastWake.millisecondsSinceEpoch}';
    final cues = _cues(lastWake);
    final next = (key: key, cues: cues.contains(c) ? cues.where((x) => x != c).toList() : [...cues, c]);
    setState(() => _cueState = next);
    try {
      ref.read(localStoreProvider).setItem(cuesKey, jsonEncode({'key': next.key, 'cues': next.cues}));
    } catch (_) {}
  }

  Future<void> _setAlerts(NapAlertSettings s) async {
    if (s.enabled && !_alerts.enabled) await ref.read(programmeNotificationsProvider).requestPermission();
    if (!mounted) return;
    setState(() => _alerts = s);
    try {
      ref.read(localStoreProvider).setItem(napAlertsStorageKey, jsonEncode(s.toJson()));
    } catch (_) {}
  }

  /// `syncNapAlerts(planNapAlerts(…))`: replace this feature's pending notifications.
  void _syncAlerts(SleepNextText t, NextNap next, List<Regression> regressions, String language, String Function(DateTime) clock) {
    final key = '${next.windowStart?.millisecondsSinceEpoch}|${widget.sleepingSince?.millisecondsSinceEpoch}|'
        '${regressions.isEmpty ? null : regressions.first.key}|${jsonEncode(_alerts.toJson())}|$language';
    if (key == _alertKey) return;
    _alertKey = key;
    final name = widget.childName.isNotEmpty ? widget.childName : t.s('baby');
    final reg = regressions.isEmpty ? null : regressions.first;
    final planned = planNapAlerts(
      settings: _alerts,
      now: DateTime.now(),
      next: next,
      sleepingSince: widget.sleepingSince,
      regression: reg,
      text: NapAlertText(
        napTitle: (min) => fill(t.s('notif_nap_title'), {'name': name, 'min': min}),
        napBody: next.windowStart != null && next.windowEnd != null
            ? fill(t.s('notif_nap_body'), {'from': clock(next.windowStart!), 'to': clock(next.windowEnd!)})
            : '',
        longTitle: fill(t.s('notif_long_title'), {'name': name}),
        longBody: t.s('notif_long_body'),
        regressTitle: reg != null ? fill(t.s('notif_regress_title'), {'name': name, 'regression': t.regression(reg.key)['name']}) : '',
        regressBody: t.s('notif_regress_body'),
      ),
    );
    unawaited(() async {
      try {
        await ref.read(programmeNotificationsProvider).setLocalNotifications(
              'nap',
              [for (final p in planned) StoredNotification(id: p.id, title: p.title, body: p.body, at: p.at.millisecondsSinceEpoch)],
              cancelIds: NapAlertIds.all,
            );
      } catch (_) {}
    }());
  }

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(programmeInputsProvider.select((i) => i.language));
    final t = ref.watch(sleepNextTextProvider(language)).value;
    if (t == null) return const SizedBox.shrink();
    String clock(DateTime d) => localeClock(d, language);
    final base = predictNextNap(entries: widget.entries, band: widget.band, now: widget.now, sleepingSince: widget.sleepingSince, morningWake: widget.morningWake);
    final cues = _cues(base.lastWake);
    final next = predictNextNap(
        entries: widget.entries, band: widget.band, now: widget.now, sleepingSince: widget.sleepingSince, morningWake: widget.morningWake, cues: cues);
    final plan = predictDay(entries: widget.entries, band: widget.band, now: widget.now, next: next, sleepingSince: widget.sleepingSince);
    final regressions = upcomingRegressions(widget.birth, widget.now);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _syncAlerts(t, next, regressions, language, clock);
    });
    final ww = personalWakeWindow(widget.entries, widget.band, widget.now);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.sleepingSince == null)
          _NextNapCard(t: t, next: next, ww: ww, clock: clock, cues: cues, onCue: (c) {
            _toggleCue(base.lastWake, c);
            unawaited(ref.read(programmeHapticProvider)());
          }, busy: widget.busy, onStart: widget.onStartSleep),
        _DayPlanCard(t: t, plan: plan, now: widget.now, clock: clock),
        if (regressions.isNotEmpty) _RegressionCard(t: t, regression: regressions.first, later: regressions.skip(1).take(3).toList(), language: language),
        _AlertsCard(t: t, settings: _alerts, onChange: (s) => unawaited(_setAlerts(s))),
        // `.cx-disc` with `marginTop: 0`
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text('🧠 ${t.s('learning')}', textAlign: TextAlign.center, style: css(11.5, height: 1.45, color: context.a.inkFaint)),
        ),
      ],
    );
  }
}

// ── Pieces ──────────────────────────────────────────────────────────────────────────────────────

/// `.cx-card` (+ `.cx-gap` when [gap]).
class CxCard extends StatelessWidget {
  const CxCard({super.key, required this.child, this.gap = false, this.background, this.gradient, this.padding = const EdgeInsets.all(16)});
  final Widget child;
  final bool gap;
  final Color? background;
  final Gradient? gradient;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      margin: EdgeInsets.only(top: gap ? 12 : 0),
      padding: padding,
      decoration: BoxDecoration(
        color: gradient == null ? (background ?? a.surface) : null,
        gradient: gradient,
        border: Border.all(color: a.line),
        borderRadius: BorderRadius.circular(a.radiusLg),
        boxShadow: a.cardShadow,
      ),
      child: child,
    );
  }
}

/// `.cx-icon` (42×42, radius 14, 20px emoji).
class CxIcon extends StatelessWidget {
  const CxIcon({super.key, required this.child, this.background, this.size = 42, this.fontSize = 20, this.border});
  final Widget child;
  final Color? background;
  final double size;
  final double fontSize;
  final BoxBorder? border;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(14), border: border),
        child: DefaultTextStyle.merge(style: TextStyle(fontSize: fontSize, height: 1.2), child: child),
      );
}

/// `linear-gradient(160deg, var(--a-surface), var(--a-lav-1))`.
Gradient _surfaceToLav(ATokens a) => LinearGradient(
      begin: const Alignment(-0.34, -0.94),
      end: const Alignment(0.34, 0.94),
      colors: [a.surface, a.lav1],
    );

// Literal colours of NextNapSection.tsx (inline styles / SVG).
const Color _violet = Color(0xFF7C5CD6);
const Color _violetDark = Color(0xFF5B3AA5);
const Color _night = Color(0xFF3B2C6B);
const Color _orange = Color(0xFFE8590C);
const Color _hatchA = Color(0xFFC7AEF5);
const Color _hatchB = Color(0xFFE9DDFC);

class _Gauge extends StatelessWidget {
  const _Gauge({required this.next, required this.t, required this.clock});
  final NextNap next;
  final SleepNextText t;
  final String Function(DateTime) clock;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final total = next.windowEnd != null && next.lastWake != null
        ? (next.windowEnd!.millisecondsSinceEpoch - next.lastWake!.millisecondsSinceEpoch).toDouble()
        : 1.0;
    final winFrom = next.windowStart != null && next.lastWake != null
        ? (next.windowStart!.millisecondsSinceEpoch - next.lastWake!.millisecondsSinceEpoch) / total
        : 0.85;
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: AspectRatio(
          aspectRatio: 280 / 168,
          child: CustomPaint(
            painter: _GaugePainter(
              progress: math.min(1, next.progress.toDouble()),
              winFrom: winFrom,
              over: next.state == 'overtired',
              track: a.surfaceSoft,
              knobFill: a.surface,
              awakeLabel: t.s('awake'),
              value: next.awakeMinutes != null ? fmtDur(next.awakeMinutes!) : '—',
              woke: next.lastWake != null ? fill(t.s('woke_at'), {'time': clock(next.lastWake!)}) : null,
              window: t.s('window_label'),
              inkSoft: a.inkSoft,
              ink: a.ink,
              rtl: Directionality.of(context) == TextDirection.rtl,
            ),
          ),
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({
    required this.progress,
    required this.winFrom,
    required this.over,
    required this.track,
    required this.knobFill,
    required this.awakeLabel,
    required this.value,
    required this.woke,
    required this.window,
    required this.inkSoft,
    required this.ink,
    required this.rtl,
  });
  final double progress;
  final double winFrom;
  final bool over;
  final Color track;
  final Color knobFill;
  final String awakeLabel;
  final String value;
  final String? woke;
  final String window;
  final Color inkSoft;
  final Color ink;
  final bool rtl;

  static const double w = 280, h = 168, cx = 140, cy = 150, r = 118;

  Offset _pt(double f) {
    final ang = math.pi * (1 - math.min(1, f));
    return Offset(cx + r * math.cos(ang), cy - r * math.sin(ang));
  }

  void _arc(Canvas c, double f0, double f1, Paint p) {
    final start = math.pi * (1 + f0);
    final sweep = math.pi * (math.min(1, f1) - f0);
    c.drawArc(Rect.fromCircle(center: const Offset(cx, cy), radius: r), start, sweep, false, p);
  }

  void _text(Canvas c, String s, Offset at, double size, FontWeight wt, Color color, TextAlign align) {
    final tp = TextPainter(
      text: TextSpan(text: s, style: TextStyle(fontSize: size, fontWeight: wt, color: color)),
      textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
    )..layout();
    final dx = align == TextAlign.center ? at.dx - tp.width / 2 : align == TextAlign.end ? at.dx - tp.width : at.dx;
    // SVG `y` is the baseline.
    tp.paint(c, Offset(dx, at.dy - tp.computeDistanceToActualBaseline(TextBaseline.alphabetic)));
    tp.dispose();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / w, size.height / h);
    Paint stroke(Color c, double width) => Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round
      ..color = c;
    _arc(canvas, 0, 1, stroke(track, 20));
    _arc(canvas, winFrom, 1, stroke(_violet.withValues(alpha: 0.22), 28));
    if (progress > 0.01) {
      final p = stroke(_violet, 20);
      if (over) {
        p.color = _orange;
      } else {
        p.shader = const LinearGradient(colors: [Color(0xFF9AD7B0), _hatchA, _violet], stops: [0, 0.6, 1])
            .createShader(Rect.fromCircle(center: const Offset(cx, cy), radius: r));
      }
      _arc(canvas, 0, progress, p);
    }
    final k = _pt(progress);
    canvas.drawCircle(k, 12, Paint()..color = knobFill);
    canvas.drawCircle(k, 12, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..color = over ? _orange : _violetDark);
    _text(canvas, awakeLabel, const Offset(cx, cy - 46), 13, FontWeight.w700, inkSoft, TextAlign.center);
    _text(canvas, value, const Offset(cx, cy - 10), 38, FontWeight.w800, ink, TextAlign.center);
    if (woke != null) _text(canvas, woke!, const Offset(22, h - 2), 11, FontWeight.w400, inkSoft, TextAlign.start);
    _text(canvas, window, const Offset(w - 22, h - 2), 11, FontWeight.w800, _violetDark, TextAlign.end);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_GaugePainter o) =>
      o.progress != progress || o.winFrom != winFrom || o.over != over || o.value != value || o.woke != woke || o.track != track || o.ink != ink;
}

class _NextNapCard extends StatelessWidget {
  const _NextNapCard({required this.t, required this.next, required this.ww, required this.clock, required this.cues, required this.onCue, required this.busy, required this.onStart});
  final SleepNextText t;
  final NextNap next;
  final WakeWindow ww;
  final String Function(DateTime) clock;
  final List<String> cues;
  final ValueChanged<String> onCue;
  final bool busy;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final sub = css(13, height: 1.45, color: a.inkSoft);
    final range = '${fmtDur(ww.range[0])}–${fmtDur(ww.range[1])}';
    if (next.state == 'unknown') {
      return CxCard(
        key: const ValueKey('next-nap-unknown'),
        gradient: _surfaceToLav(a),
        child: Row(children: [
          CxIcon(background: a.surface, child: const Text('🌙')),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t.s('unknown_title'), style: css(15, weight: FontWeight.w700, color: a.ink)),
              Text(t.s('unknown_desc'), style: sub),
            ]),
          ),
        ]),
      );
    }
    final (Color bg, Color ink) = next.state == 'overtired'
        ? (const Color(0xFFFFF1E6), const Color(0xFFB35309))
        : next.state == 'window'
            ? (a.green1, a.greenInk)
            : (a.lav1, a.lavInk);
    final headline = next.state == 'window'
        ? t.s('now_open')
        : next.state == 'overtired'
            ? t.s('overtired')
            : next.minutesToStart != null
                ? fill(t.s('in_min'), {'min': fmtDur(next.minutesToStart!)})
                : '';
    return CxCard(
      key: const ValueKey('next-nap-card'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Flexible(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t.s('next_title'), style: css(16, weight: FontWeight.w700, color: a.ink)),
                Text(t.s('next_sub'), style: css(12, height: 1.45, color: a.inkSoft)),
              ]),
            ),
            if (ww.samples > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(999)),
                child: Text('✨ ${fill(t.s('personal'), {'n': ww.samples})}', style: css(12, weight: FontWeight.w800, color: a.lavInk)),
              ),
          ]),
        ),
        _Gauge(next: next, t: t, clock: clock),
        if (next.windowStart != null && next.windowEnd != null)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(18)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CxIcon(background: a.surface, child: Text(next.isBedtime ? '🌛' : '🌙')),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text((next.isBedtime ? t.s('bedtime_best') : t.s('best_time')).toUpperCase(), style: css(11, weight: FontWeight.w800, em: 0.07, color: ink)),
                  Text('${clock(next.windowStart!)} – ${clock(next.windowEnd!)}', style: css(22, weight: FontWeight.w800, em: -0.02, color: ink)),
                  Text('$headline · ${fill(t.s('range_age'), {'range': range})}', style: sub),
                ]),
              ),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 14, bottom: 6),
          child: Text(t.s('cues_title'), style: css(12.5, weight: FontWeight.w700, color: a.inkSoft)),
        ),
        WrapRow(gap: 8, children: [
          for (final c in sleepyCues)
            Tap(
              key: ValueKey('cue-$c'),
              pressed: cues.contains(c),
              onTap: () => onCue(c),
              child: Container(
                constraints: const BoxConstraints(minHeight: 38),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: cues.contains(c) ? a.lav1 : a.surface,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: cues.contains(c) ? a.lav2 : a.lineStrong, width: 1.5),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(t.cue(c), style: css(13.5, weight: FontWeight.w700, color: cues.contains(c) ? a.lavInk : a.ink)),
                ]),
              ),
            ),
        ]),
        if (cues.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('✨ ${fill(t.s('cues_applied'), {'n': cues.length, 'min': math.min(15, cues.length * 5)})}',
                style: css(13, weight: FontWeight.w700, height: 1.45, color: a.lavInk)),
          ),
        Padding(
          padding: const EdgeInsets.only(top: 14),
          child: Tap(
            key: const ValueKey('next-nap-start'),
            enabled: !busy,
            onTap: onStart,
            child: Opacity(
              opacity: busy ? 0.45 : 1,
              child: Container(
                constraints: const BoxConstraints(minHeight: 48),
                decoration: BoxDecoration(color: _violet, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const AIcon(AIcons.moon, size: 17, color: Color(0xFFFFFFFF)),
                  const SizedBox(width: 8),
                  Text(t.s('start_sleep'), style: css(15, weight: FontWeight.w600, color: const Color(0xFFFFFFFF))),
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

/// `repeating-linear-gradient(45deg,#c7aef5,#c7aef5 5px,#e9ddfc 5px,#e9ddfc 10px)`.
class _Hatch extends StatelessWidget {
  const _Hatch({required this.radius});
  final double radius;
  @override
  Widget build(BuildContext context) =>
      ClipRRect(borderRadius: BorderRadius.circular(radius), child: CustomPaint(painter: _HatchPainter(), child: const SizedBox.expand()));
}

class _HatchPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = _hatchB);
    final p = Paint()
      ..color = _hatchA
      ..strokeWidth = 5 / math.sqrt2 * 2 / 2;
    // Stripes 10px apart along the 45° axis, half of each period coloured.
    final period = 10 * math.sqrt2;
    for (var x = -size.height; x < size.width + size.height; x += period) {
      final path = Path()
        ..moveTo(x, size.height)
        ..lineTo(x + 5 * math.sqrt2, size.height)
        ..lineTo(x + 5 * math.sqrt2 + size.height, 0)
        ..lineTo(x + size.height, 0)
        ..close();
      canvas.drawPath(path, p);
    }
  }

  @override
  bool shouldRepaint(_HatchPainter old) => false;
}

class _DayPlanCard extends StatelessWidget {
  const _DayPlanCard({required this.t, required this.plan, required this.now, required this.clock});
  final SleepNextText t;
  final List<PlanItem> plan;
  final DateTime now;
  final String Function(DateTime) clock;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final dayStart = DateTime(now.year, now.month, now.day, 6).millisecondsSinceEpoch;
    const span = 15 * 3600000;
    double pct(DateTime d) => math.min(100, math.max(0, (d.millisecondsSinceEpoch - dayStart) / span * 100)).toDouble();
    final naps = plan.where((p) => p.kind == 'nap').toList();
    final bedIdx = plan.indexWhere((p) => p.kind == 'bedtime');
    final bed = bedIdx < 0 ? null : plan[bedIdx];
    var napNo = 0;
    final rows = <Widget>[];
    for (final p in plan) {
      if (p.kind == 'bedtime') {
        final ritual = DateTime.fromMillisecondsSinceEpoch(p.start.millisecondsSinceEpoch - 30 * 60000);
        rows.add(_li(context, CxIcon(background: _night, child: const Text('🌛')), fill(t.s('bedtime'), {'time': clock(p.start)}),
            fill(t.s('bedtime_sub'), {'time': clock(ritual)})));
        continue;
      }
      napNo += 1;
      final sub = p.status == 'done'
          ? fill(t.s('nap_done'), {'time': '${clock(p.start)}–${clock(p.end)}', 'dur': fmtDur(p.minutes)})
          : p.status == 'now'
              ? fill(t.s('nap_now'), {'time': clock(p.start)})
              : fill(t.s('nap_predicted'), {'time': clock(p.start), 'dur': fmtDur(p.minutes)});
      rows.add(_li(
        context,
        CxIcon(
          background: p.status == 'predicted' ? a.surface : a.lav1,
          border: p.status == 'predicted' ? Border.all(color: a.lav2, width: 2) : null,
          child: Text(p.status == 'done' ? '✅' : p.status == 'now' ? '😴' : '🌙'),
        ),
        fill(t.s('nap_n'), {'n': napNo}),
        sub,
      ));
    }
    return CxCard(
      gap: true,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(t.s('plan_title'), style: css(15, weight: FontWeight.w700, color: a.ink)),
          if (bed != null) Flexible(child: Text(fill(t.s('plan_sub'), {'naps': naps.length, 'time': clock(bed.start)}), style: css(13, height: 1.45, color: a.inkSoft))),
        ]),
        const SizedBox(height: 10),
        SizedBox(
          height: 58,
          child: LayoutBuilder(builder: (context, c) {
            final w = c.maxWidth;
            final nowLeft = pct(now) / 100 * w;
            return Stack(clipBehavior: Clip.none, children: [
              Positioned(top: 14, left: 0, right: 0, height: 20, child: Container(decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(10)))),
              for (final p in naps)
                Positioned(
                  top: 14,
                  height: 20,
                  left: pct(p.start) / 100 * w,
                  width: math.max(2.5, pct(p.end) - pct(p.start)) / 100 * w,
                  child: p.status == 'predicted' ? const _Hatch(radius: 10) : Container(decoration: BoxDecoration(color: _violet, borderRadius: BorderRadius.circular(10))),
                ),
              if (bed != null)
                Positioned(top: 14, height: 20, left: pct(bed.start) / 100 * w, right: 0, child: Container(decoration: BoxDecoration(color: _night, borderRadius: BorderRadius.circular(10)))),
              Positioned(top: 6, width: 3, height: 36, left: nowLeft - 1, child: Container(decoration: BoxDecoration(color: a.ink, borderRadius: BorderRadius.circular(3)))),
              Positioned(
                top: 42,
                left: nowLeft,
                child: FractionalTranslation(translation: const Offset(-0.5, 0), child: Text(t.s('now'), style: css(10.5, weight: FontWeight.w800, color: a.ink))),
              ),
              Positioned(top: 42, left: 0, child: Text('06', style: css(10, color: a.inkFaint))),
              Positioned(top: 42, right: 0, child: Text('21', style: css(10, color: a.inkFaint))),
            ]);
          }),
        ),
        const SizedBox(height: 4),
        DefaultTextStyle.merge(
          style: css(11.5, color: a.inkSoft),
          child: WrapRow(gap: 14, children: [
            _legend(const ColoredBox(color: _violet), t.s('done')),
            _legend(const _Hatch(radius: 4), t.s('predicted')),
            _legend(const ColoredBox(color: _night), t.s('night')),
          ]),
        ),
        const SizedBox(height: 8),
        for (var i = 0; i < rows.length; i++)
          Container(
            decoration: BoxDecoration(border: i > 0 ? Border(top: BorderSide(color: a.line)) : null),
            child: rows[i],
          ),
      ]),
    );
  }

  Widget _legend(Widget swatch, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
        ClipRRect(borderRadius: BorderRadius.circular(4), child: SizedBox(width: 12, height: 12, child: swatch)),
        const SizedBox(width: 5),
        Text(label),
      ]);

  Widget _li(BuildContext context, Widget icon, String title, String sub) {
    final a = context.a;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(children: [
        icon,
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: css(14, weight: FontWeight.w700, color: a.ink)),
            Padding(padding: const EdgeInsets.only(top: 1), child: Text(sub, style: css(12, color: a.inkSoft))),
          ]),
        ),
      ]),
    );
  }
}

class _RegressionCard extends StatefulWidget {
  const _RegressionCard({required this.t, required this.regression, required this.later, required this.language});
  final SleepNextText t;
  final Regression regression;
  final List<Regression> later;
  final String language;

  @override
  State<_RegressionCard> createState() => _RegressionCardState();
}

class _RegressionCardState extends State<_RegressionCard> {
  late bool _open = widget.regression.active || widget.regression.daysUntil <= 21;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final t = widget.t;
    final reg = widget.regression;
    String day(DateTime d) => localeDayMonthShort(d, widget.language);
    Widget bullets(List<String> xs, Color color) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final x in xs)
              Padding(
                padding: const EdgeInsetsDirectional.only(top: 3, start: 6),
                child: Text('• $x', style: css(13, height: 1.45, color: color)),
              ),
          ],
        );
    return CxCard(
      gap: true,
      gradient: _surfaceToLav(a),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Tap(
          key: const ValueKey('regression-toggle'),
          onTap: () => setState(() => _open = !_open),
          child: Row(children: [
            CxIcon(background: a.surface, size: 50, fontSize: 24, child: const Text('🌀')),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${t.s('regress_title')} · ${reg.active ? t.s('regress_active') : fill(t.s('regress_in'), {'days': reg.daysUntil})}'.toUpperCase(),
                    style: css(11, weight: FontWeight.w800, em: 0.07, color: a.lavInk)),
                Text('${t.regression(reg.key)['name']}', style: css(16, weight: FontWeight.w700, color: a.ink)),
                Text(fill(t.s('regress_range'), {'from': day(reg.start), 'to': day(reg.end)}), style: css(13, height: 1.45, color: a.inkSoft)),
              ]),
            ),
          ]),
        ),
        if (_open) ...[
          const SizedBox(height: 10),
          Text(t.s('expect_title'), style: css(12.5, weight: FontWeight.w700, color: a.inkSoft)),
          const SizedBox(height: 6),
          bullets(t.regressionList(reg.key, 'expect'), a.ink),
          const SizedBox(height: 10),
          Text(t.s('prep_title'), style: css(12.5, weight: FontWeight.w700, color: a.inkSoft)),
          const SizedBox(height: 6),
          bullets(t.regressionList(reg.key, 'prep'), a.greenInk),
          if (widget.later.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(t.s('later_title'), style: css(12.5, weight: FontWeight.w700, color: a.inkSoft)),
            const SizedBox(height: 6),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < widget.later.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${t.regression(widget.later[i].key)['name']}', style: css(12.5, weight: FontWeight.w700, color: a.ink)),
                      Text(day(widget.later[i].start), style: css(11, height: 1.45, color: a.inkSoft)),
                    ]),
                  ),
                ),
              ],
            ]),
          ],
        ],
      ]),
    );
  }
}

class _AlertsCard extends StatelessWidget {
  const _AlertsCard({required this.t, required this.settings, required this.onChange});
  final SleepNextText t;
  final NapAlertSettings settings;
  final ValueChanged<NapAlertSettings> onChange;

  NapAlertSettings _with({bool? enabled, int? lead, bool? longNap, bool? regression, bool? quiet}) => NapAlertSettings(
        enabled: enabled ?? settings.enabled,
        lead: lead ?? settings.lead,
        longNap: longNap ?? settings.longNap,
        regression: regression ?? settings.regression,
        quiet: quiet ?? settings.quiet,
      );

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    Widget li(Widget icon, String title, String sub, bool value, ValueChanged<bool> set, {Key? key}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(children: [
            icon,
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: css(14, weight: FontWeight.w700, color: a.ink)),
                Padding(padding: const EdgeInsets.only(top: 1), child: Text(sub, style: css(12, color: a.inkSoft))),
              ]),
            ),
            const SizedBox(width: 12),
            ShadSwitch(key: key, checked: value, onChanged: set, checkedColor: _violet, semanticLabel: title),
          ]),
        );
    final rows = <Widget>[
      li(CxIcon(background: a.lav1, child: AIcon(AIcons.bell, size: 18, color: a.lavInk)), t.s('alerts_title'), t.s('alerts_sub'), settings.enabled,
          (v) => onChange(_with(enabled: v)), key: const ValueKey('nap-alerts-switch')),
      if (settings.enabled) ...[
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 10),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('⏰ ${t.s('alert_lead')}', style: css(12.5, weight: FontWeight.w700, color: a.inkSoft)),
            ),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                for (final n in const [5, 10, 15, 20]) ...[
                  if (n != 5) const SizedBox(width: 4),
                  Expanded(
                    child: Tap(
                      key: ValueKey('nap-lead-$n'),
                      pressed: settings.lead == n,
                      onTap: () => onChange(_with(lead: n)),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 38),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: settings.lead == n ? a.surface : null,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: settings.lead == n ? const [BoxShadow(color: Color(0x14000000), offset: Offset(0, 2), blurRadius: 8)] : null,
                        ),
                        child: Text(fill(t.s('alert_lead_min'), {'n': n}),
                            style: css(13, weight: FontWeight.w700, color: settings.lead == n ? a.ink : a.inkSoft)),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
          ]),
        ),
        li(CxIcon(background: a.lav1, child: const Text('😴')), t.s('alert_long'), t.s('alert_long_sub'), settings.longNap, (v) => onChange(_with(longNap: v))),
        li(CxIcon(background: a.lav1, child: const Text('🌀')), t.s('alert_regress'), t.s('alert_regress_sub'), settings.regression,
            (v) => onChange(_with(regression: v))),
        li(CxIcon(background: a.lav1, child: const Text('🌙')), t.s('alert_quiet'), t.s('alert_quiet_sub'), settings.quiet, (v) => onChange(_with(quiet: v))),
      ],
    ];
    return CxCard(
      gap: true,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      // The card is not a `.cx-list`: no separators between the rows.
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows),
    );
  }
}
