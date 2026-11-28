// Ported from: src/components/tools/parenting/ParentingIntro.tsx, src/styles/anacan-design.css (.a3-sheet,
//              .a3-sheet-overlay, .a3-grabber, .a-par-intro*)
//
// Short 3-step intro (age guide, SOS, programmes and quizzes), once per device and account. Without a birth date it
// ends with the age-band question instead of silently defaulting to 1–3. Skippable at every step; Android back
// skips it. Drawn over the tool as a bottom sheet with its overlay.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../design/design.dart';
import '../../../state/local_store.dart';
import 'parenting_content.dart' show ageBandIds;
import 'parenting_copy.dart';
import 'programme_ports.dart';
import 'programme_ui.dart';

String introKey(String? uid) => 'anacan.parenting.intro.v1.${uid == null || uid.isEmpty ? 'guest' : uid}';

bool introSeen(LocalStore store, String? uid) {
  try {
    return store.getItem(introKey(uid)) == '1';
  } catch (_) {
    return true;
  }
}

void markIntroSeen(LocalStore store, String? uid) {
  try {
    store.setItem(introKey(uid), '1');
  } catch (_) {}
}

const List<({String emoji, String title, String text})> _steps = [
  (emoji: '🧭', title: 'par_intro_title_1', text: 'par_intro_text_1'),
  (emoji: '🆘', title: 'par_intro_title_2', text: 'par_intro_text_2'),
  (emoji: '📅', title: 'par_intro_title_3', text: 'par_intro_text_3'),
];

class ParentingIntro extends ConsumerStatefulWidget {
  const ParentingIntro({super.key, required this.askBand, required this.onDone});
  final bool askBand;
  final void Function(String? band) onDone;
  @override
  ConsumerState<ParentingIntro> createState() => _ParentingIntroState();
}

class _ParentingIntroState extends ConsumerState<ParentingIntro> {
  int _step = 0;
  VoidCallback? _release;

  @override
  void initState() {
    super.initState();
    _release = ref.read(programmeBackProvider)(() {
      widget.onDone(null);
      return true;
    });
  }

  @override
  void dispose() {
    _release?.call();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final total = _steps.length + (widget.askBand ? 1 : 0);
    final info = _step < _steps.length ? _steps[_step] : null;
    final last = _step == total - 1;
    return Stack(children: [
      Positioned.fill(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => widget.onDone(null),
          child: const ColoredBox(color: Color(0x73000000)),
        ),
      ),
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: Container(
          key: const ValueKey('parenting-intro'),
          decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
          child: AScope(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                margin: const EdgeInsets.only(top: 8, bottom: 4),
                width: 38,
                height: 4,
                decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(4)),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(20, 8, 20, 24 + MediaQuery.paddingOf(context).bottom),
                child: Gap(gap: 12, crossAxisAlignment: CrossAxisAlignment.center, children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    Text(pf('par_intro_step', {'n': _step + 1, 'total': total}), style: css(12, weight: FontWeight.w700, color: a.inkSoft)),
                    Tap(
                      key: const ValueKey('par-intro-skip'),
                      label: pt('par_intro_skip'),
                      onTap: () => widget.onDone(null),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 40),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        alignment: Alignment.center,
                        child: Text(pt('par_intro_skip'), style: css(13, weight: FontWeight.w800, color: a.inkSoft)),
                      ),
                    ),
                  ]),
                  Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(24)),
                    child: Text(info?.emoji ?? '🧒', style: css(36, height: 1.2)),
                  ),
                  Text(pt(info?.title ?? 'par_intro_band_title'), textAlign: TextAlign.center, style: css(20, weight: FontWeight.w800, em: -0.02, color: a.ink)),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 340),
                    child: Text(pt(info?.text ?? 'par_intro_band_text'), textAlign: TextAlign.center, style: css(14, height: 1.45, color: a.inkSoft)),
                  ),
                  if (info == null)
                    Semantics(
                      label: pt('par_band_pick'),
                      container: true,
                      child: Grid(columns: 2, gap: 8, children: [
                        for (final b in ageBandIds)
                          Tap(
                            key: ValueKey('par-intro-band-$b'),
                            label: pt(bandKey(b)),
                            onTap: () => widget.onDone(b),
                            child: Container(
                              constraints: const BoxConstraints(minHeight: 48),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: a.surface,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: a.lineStrong, width: 1.5),
                              ),
                              child: Text(pt(bandKey(b)), style: css(14, weight: FontWeight.w800, color: a.ink)),
                            ),
                          ),
                      ]),
                    ),
                  ExcludeSemantics(
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      for (var i = 0; i < total; i++) ...[
                        if (i > 0) const SizedBox(width: 6),
                        Container(
                          width: i == _step ? 18 : 7,
                          height: 7,
                          decoration: BoxDecoration(color: i == _step ? a.coral : a.lineStrong, borderRadius: BorderRadius.circular(99)),
                        ),
                      ],
                    ]),
                  ),
                  if (info != null)
                    Tap(
                      key: const ValueKey('par-intro-next'),
                      label: pt(last ? 'par_intro_start' : 'par_intro_next'),
                      excludeSemantics: true,
                      onTap: () => last ? widget.onDone(null) : setState(() => _step += 1),
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 48),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(999), boxShadow: a.coralShadow),
                        child: Text(pt(last ? 'par_intro_start' : 'par_intro_next'), style: css(15, weight: FontWeight.w800, color: a.onCoral)),
                      ),
                    ),
                ]),
              ),
            ]),
          ),
        ),
      ),
    ]);
  }
}
