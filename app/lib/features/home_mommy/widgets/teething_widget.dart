// Ported from: src/components/mommy/TeethingWidget.tsx
//
// Teething summary card (tap → teething tool). Hidden without a selected child; a pulsing 80px placeholder while
// children or teething data load.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../baby/hooks/use_baby_records.dart';
import '../../baby/hooks/use_children.dart';
import 'mommy_ui.dart';

/// `getExpectedTeeth(months)`.
int expectedTeethFor(int months) {
  if (months < 6) return 0;
  if (months < 8) return 2;
  if (months < 10) return 4;
  if (months < 12) return 6;
  if (months < 14) return 8;
  if (months < 18) return 12;
  if (months < 24) return 16;
  return 20;
}

/// `getNextTeethInfo(months)` → (name, timeframe) or null.
(String, String)? nextTeethInfo(int months, int emergedCount) {
  if (months < 6) return (tr('teethingwidget_alt_merkezi_kesiciler_63d8b0', 'Alt mərkəzi kəsicilər'), tr('teethingwidget_timeframe_6_10', '6-10 ay'));
  if (months < 8) return (tr('teethingwidget_yuxari_merkezi_kesiciler_456b8c', 'Yuxarı mərkəzi kəsicilər'), tr('teethingwidget_timeframe_8_12', '8-12 ay'));
  if (months < 10) return (tr('teethingwidget_yan_kesiciler_c75ada', 'Yan kəsicilər'), tr('teethingwidget_timeframe_9_16', '9-16 ay'));
  if (months < 14) return (tr('teethingwidget_birinci_azi_disler_eccbbc', 'Birinci azı dişlər'), tr('teethingwidget_timeframe_13_19', '13-19 ay'));
  if (months < 18) return (tr('teethingwidget_kopek_disleri_a86ac1', 'Köpək dişləri'), tr('teethingwidget_timeframe_16_23', '16-23 ay'));
  if (months < 24) return (tr('teethingwidget_ikinci_azi_disler_861654', 'İkinci azı dişlər'), tr('teethingwidget_timeframe_23_33', '23-33 ay'));
  if (emergedCount < 20) return (tr('teethingwidget_son_sud_disleri_c43b8c', 'Son süd dişləri'), tr('teethingwidget_timeframe_soon', 'Tezliklə'));
  return null;
}

class TeethingWidget extends ConsumerWidget {
  const TeethingWidget({super.key, required this.onOpen});
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appLanguageProvider);
    final children = ref.watch(childrenProvider);
    final teething = ref.watch(teethingSummaryProvider);
    final t = context.a;
    if (children.loading || teething.loading) {
      return ACard(
        key: const ValueKey('teething-loading'),
        child: APulseBox(child: Container(height: 80, decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(16)))),
      );
    }
    final child = children.selectedChild;
    if (!children.hasChildren || child == null) return const SizedBox.shrink();
    final age = getChildAge(child);
    final months = age.months;
    final expected = expectedTeethFor(months);
    final next = nextTeethInfo(months, teething.emergedCount);
    final onTrack = teething.emergedCount >= expected - 2;
    final x = context.aText;
    return FramerEnter(
      y: 10,
      child: PressScale(
        scale: 0.98,
        onTap: onOpen,
        child: AFadeIn(
          child: ACard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(child: Text(tr('teethingwidget_dis_cixarma_ca53f7', 'Diş Çıxarma'), style: x.heading(x.aCardTitle))),
                      Row(mainAxisSize: MainAxisSize.min, children: [
                        Text('${teething.emergedCount}/${teething.totalTeeth}', style: x.aSectionLink.copyWith(color: t.inkSoft)),
                        const SizedBox(width: 2),
                        AIcon(AIcons.chevronRight, size: 13, color: t.inkSoft, mirrorInRtl: true),
                      ]),
                    ],
                  ),
                ),
                AInlineBar(percent: teething.progress),
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(
                        text: '${teething.emergedCount} / ${teething.totalTeeth}',
                        style: TextStyle(color: t.ink, fontWeight: FontWeight.w700),
                      ),
                      TextSpan(text: ' ${tr('teethingwidget_cixan_disler_a9eadd', 'Çıxan dişlər').toLowerCase()}'),
                    ]),
                    style: TextStyle(fontSize: 12.5, color: t.inkSoft, height: 1.5),
                  ),
                ),
                AGrid(columns: 2, children: [
                  AStatTile(
                    icon: AIcons.check,
                    background: onTrack ? t.green1 : t.yellow1,
                    iconBg: t.chipOverlay,
                    iconFg: onTrack ? t.green2 : t.yellow2,
                    lines: [
                      Text(
                        onTrack ? tr('teethingwidget_normal_development', 'Normal inkişaf') : tr('teethingwidget_diqqet_764567', 'Diqqət'),
                        style: AStatText.label(t),
                      ),
                      Text(
                        tr('teethingwidget_expected_teeth', '{n} aylıq üçün ~{t} diş gözlənilir')
                            .replaceFirst('{n}', '$months')
                            .replaceFirst('{t}', '$expected'),
                        style: AStatText.label(t).copyWith(fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  if (next != null)
                    AStatTile(
                      icon: AIcons.clock,
                      iconBg: t.peach1,
                      iconFg: t.accentInk,
                      lines: [
                        Text(tr('teethingwidget_novbeti_0fff9a', 'Növbəti:'), style: AStatText.label(t)),
                        Text(next.$1, style: AStatText.value(t).copyWith(fontSize: 12, height: 1.3)),
                        Text(next.$2, style: AStatText.label(t).copyWith(fontWeight: FontWeight.w600)),
                      ],
                    ),
                ]),
                ATeaser(
                  child: Row(
                    children: [
                      Expanded(
                        child: Text.rich(TextSpan(children: [
                          TextSpan(text: '${child.name} · '),
                          TextSpan(text: age.displayText, style: TextStyle(color: t.ink, fontWeight: FontWeight.w700)),
                        ])),
                      ),
                      AIcon(AIcons.chevronRight, size: 15, color: t.inkFaint, mirrorInRtl: true),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// `animate-pulse` on a block (opacity 1 → .5, 2 s infinite).
class APulseBox extends StatefulWidget {
  const APulseBox({super.key, required this.child});
  final Widget child;
  @override
  State<APulseBox> createState() => _APulseBoxState();
}

class _APulseBoxState extends State<APulseBox> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));
  var _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _c.forward();
    } else if (AnacanTokens.of(context).lite) {
      _c.repeat(count: 3);
    } else {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) {
          final p = _c.value < 0.5 ? _c.value * 2 : (1 - _c.value) * 2;
          return Opacity(opacity: 1 - 0.5 * const Cubic(0.4, 0, 0.6, 1).transform(p), child: child);
        },
      );
}
