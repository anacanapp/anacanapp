// Ported from: src/components/recovery/KegelTrainer.tsx, src/styles/care.css (.cx-kegel, .cx-orb, .cx-orb-halo,
//              .cx-orb-core, .cx-orb-text, .cx-reps)
//
// Guided pelvic-floor session: the orb grows while squeezing and shrinks while relaxing.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import '../health_screens/common/care_ui.dart';
import '../health_screens/common/feature_text.dart' show FeatureText;
import '../settings/ui/settings_ui.dart' show px;
import '../tools/pregnancy_common/pregnancy_ports.dart' show pregnancyHapticsProvider;
import 'recovery.dart';

/// 'idle' | 'squeeze' | 'relax' | 'done'.
typedef KegelPhase = String;

class KegelTrainer extends ConsumerStatefulWidget {
  const KegelTrainer({super.key, required this.t, required this.level, required this.locked, this.onUpgrade, required this.cesarean, required this.done, required this.onComplete});
  final FeatureText t;
  final KegelLevel level;
  final bool locked;
  final VoidCallback? onUpgrade;
  final bool cesarean;
  final int done;
  final Future<void> Function() onComplete;
  @override
  ConsumerState<KegelTrainer> createState() => KegelTrainerState();
}

class KegelTrainerState extends ConsumerState<KegelTrainer> {
  KegelPhase phase = 'idle';
  int rep = 0;
  late int left = widget.level.hold;
  bool paused = false;
  bool _completing = false;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _restartTimer() {
    _timer?.cancel();
    _timer = null;
    if (phase == 'idle' || phase == 'done' || paused) return;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    if (!mounted) return;
    setState(() => left -= 1);
    if (left > 0 || phase == 'idle' || phase == 'done') return;
    final haptics = ref.read(pregnancyHapticsProvider);
    final level = widget.level;
    if (phase == 'squeeze') {
      setState(() {
        phase = 'relax';
        left = level.rest;
      });
      unawaited(haptics.light());
      return;
    }
    final next = rep + 1;
    if (next >= level.reps) {
      setState(() {
        phase = 'done';
        rep = next;
      });
      _restartTimer();
      if (!_completing) {
        _completing = true;
        unawaited(widget.onComplete().catchError((Object _) {}).whenComplete(() => _completing = false));
      }
      unawaited(haptics.heavy());
      return;
    }
    setState(() {
      rep = next;
      phase = 'squeeze';
      left = level.hold;
    });
    unawaited(haptics.medium());
  }

  void _start() {
    setState(() {
      rep = 0;
      phase = 'squeeze';
      left = widget.level.hold;
      paused = false;
    });
    _restartTimer();
    unawaited(ref.read(pregnancyHapticsProvider).medium());
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.t;
    final level = widget.level;
    final a = context.a;
    final squeezing = phase == 'squeeze';
    final size = phase == 'idle' || phase == 'done' ? 150.0 : (squeezing ? 196.0 : 120.0);
    final duration = squeezing ? level.hold : level.rest;
    final white = const Color(0xFFFFFFFF);
    final levels = t.list('kegel_level');
    final minutes = kegelMinutes(level);

    Widget orbText() {
      if (phase == 'idle') return const Text('🌸', style: TextStyle(fontSize: 64, height: 1));
      if (phase == 'done') {
        return Column(mainAxisSize: MainAxisSize.min, children: [
          Text('✓', style: px(52, weight: FontWeight.w800, color: white, height: 1)),
          Text(fill(t.s('kegel_done'), {'n': widget.done == 0 ? 1 : widget.done}), textAlign: TextAlign.center, style: px(15, weight: FontWeight.w700, color: white)),
        ]);
      }
      return Column(mainAxisSize: MainAxisSize.min, children: [
        Text(squeezing ? t.s('squeeze') : t.s('relax'), style: px(15, weight: FontWeight.w700, color: white)),
        Text('${left < 0 ? 0 : left}', style: px(52, weight: FontWeight.w800, color: white, height: 1)),
        Opacity(opacity: 0.85, child: Text(t.s('seconds'), style: px(12, color: white))),
      ]);
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 10, 0, 4),
      child: Column(children: [
        Column(children: [
          CxEyebrow(level.level < levels.length ? levels[level.level] : ''),
          Text(t.s('kegel_title'), textAlign: TextAlign.center, style: px(17, weight: FontWeight.w700, color: a.ink)),
          Text(
            '${fill(t.s('rhythm'), {'hold': level.hold, 'rest': level.rest})} · ${fill(t.s('kegel_today'), {'done': widget.done, 'goal': kegelDailyGoal, 'min': minutes})}',
            textAlign: TextAlign.center,
            style: cxSub(context),
          ),
        ]),
        const SizedBox(height: 16),
        SizedBox(
          width: 240,
          height: 240,
          child: Stack(alignment: Alignment.center, children: [
            AnimatedScale(
              scale: squeezing ? 1 : 0.86,
              duration: paused ? Duration.zero : Duration(milliseconds: (duration < 1.2 ? duration * 1000 : 1200).round()),
              child: AnimatedOpacity(
                opacity: squeezing ? 1 : 0.7,
                duration: paused ? Duration.zero : Duration(milliseconds: (duration < 1.2 ? duration * 1000 : 1200).round()),
                child: Container(decoration: BoxDecoration(color: a.lav1, shape: BoxShape.circle)),
              ),
            ),
            AnimatedContainer(
              width: size,
              height: size,
              duration: paused ? Duration.zero : Duration(milliseconds: phase == 'idle' || phase == 'done' ? 400 : duration * 1000),
              curve: Curves.easeInOut,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                // care.css .cx-orb-core
                gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFC7AEF5), Color(0xFFAB84EE)]),
                boxShadow: [BoxShadow(color: Color(0x995B3AA5), offset: Offset(0, 20), blurRadius: 40, spreadRadius: -14)],
              ),
            ),
            orbText(),
          ]),
        ),
        const SizedBox(height: 16),
        Semantics(
          label: fill(t.s('rep'), {'n': rep, 'total': level.reps}),
          child: Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: [
            for (var i = 0; i < level.reps; i++)
              Container(
                width: 20,
                height: 8,
                decoration: BoxDecoration(color: i < rep || phase == 'done' ? a.lav2 : a.lav1, borderRadius: BorderRadius.circular(99)),
              ),
          ]),
        ),
        const SizedBox(height: 16),
        Text(
          phase == 'idle' ? t.s('kegel_howto') : fill(t.s('rep'), {'n': rep + 1 < level.reps ? rep + 1 : level.reps, 'total': level.reps}),
          textAlign: TextAlign.center,
          style: cxSub(context),
        ),
        const SizedBox(height: 16),
        if (widget.locked)
          AButton(variant: AButtonVariant.accent, block: true, onPressed: widget.onUpgrade, leading: const AIcon(AIcons.lock, size: 16), child: Text(t.s('kegel_premium')))
        else if (phase == 'idle' || phase == 'done')
          AButton(variant: AButtonVariant.accent, block: true, onPressed: _start, leading: const AIcon(AIcons.play, size: 17), child: Text(t.s('kegel_start')))
        else
          Row(children: [
            Expanded(
              child: AButton(
                variant: AButtonVariant.ghost,
                block: true,
                onPressed: () {
                  setState(() => paused = !paused);
                  _restartTimer();
                },
                leading: AIcon(paused ? AIcons.play : AIcons.pause, size: 16),
                child: Text(paused ? t.s('resume') : t.s('pause')),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: AButton(
                variant: AButtonVariant.ghost,
                block: true,
                onPressed: () {
                  setState(() {
                    phase = 'idle';
                    paused = false;
                  });
                  _restartTimer();
                },
                leading: const AIcon(AIcons.square, size: 15),
                child: Text(t.s('finish')),
              ),
            ),
          ]),
        const SizedBox(height: 16),
        CxDisc(widget.cesarean ? t.s('kegel_note_cesarean') : t.s('kegel_note'), top: 0),
      ]),
    );
  }
}
