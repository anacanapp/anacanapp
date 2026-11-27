// Ported from: src/components/mommy/DevelopmentTipsWidget.tsx
//
// Development tips for the child's (corrected) age group. The home uses the `embedded` variant inside the
// development card; the standalone card variant is kept for parity.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../baby/hooks/use_children.dart';
import '../../baby/hooks/use_content_queries.dart';
import 'mommy_ui.dart';

/// `getAgeGroup()`.
String developmentAgeGroup(int ageInMonths) => ageInMonths < 3 ? 'newborn' : (ageInMonths < 6 ? 'infant' : 'older');

/// `getAgeLabel()`.
String developmentAgeLabel(int m) {
  if (m < 1) return tr('developmenttipswidget_newborn', 'Yenidoğan');
  if (m < 3) return tr('developmenttipswidget_0_3_mo', '0-3 ay');
  if (m < 6) return tr('developmenttipswidget_3_6_mo', '3-6 ay');
  if (m < 9) return tr('developmenttipswidget_6_9_mo', '6-9 ay');
  if (m < 12) return tr('developmenttipswidget_9_12_mo', '9-12 ay');
  return tr('developmenttipswidget_12_plus_mo', '12+ ay');
}

class DevelopmentTipsWidget extends ConsumerStatefulWidget {
  const DevelopmentTipsWidget({super.key, this.embedded = false});
  final bool embedded;

  @override
  ConsumerState<DevelopmentTipsWidget> createState() => _DevelopmentTipsWidgetState();
}

class _DevelopmentTipsWidgetState extends ConsumerState<DevelopmentTipsWidget> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    ref.watch(appLanguageProvider);
    final selected = ref.watch(childrenProvider).selectedChild;
    final age = selected == null ? null : getChildAge(selected);
    final months = (age == null ? 0 : (age.correctionApplied ? age.correctedMonths : age.months));
    final q = ref.watch(developmentTipsQuery(developmentAgeGroup(months)));
    final tips = q.data ?? const <DevelopmentTip>[];
    final t = context.a;
    final x = context.aText;
    if (widget.embedded && (q.isLoading || tips.isEmpty)) return const SizedBox.shrink();
    if (q.isLoading) {
      return AFadeIn(child: ACard(child: SizedBox(height: 96, child: Center(child: SizedBox(width: 24, height: 24, child: _Spinner(color: t.peach2))))));
    }
    if (tips.isEmpty) {
      return AFadeIn(
        child: ACard(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Text(tr('developmenttipswidget_bu_yas_qrupu_ucun_tovsiye_yoxdur_3e49db', 'Bu yaş qrupu üçün tövsiyə yoxdur'),
                textAlign: TextAlign.center, style: x.aListSub),
          ),
        ),
      );
    }
    final index = _index % tips.length;
    final tip = tips[index];
    void next() => setState(() => _index = (index + 1) % tips.length);
    void prev() => setState(() => _index = (index - 1 + tips.length) % tips.length);

    if (widget.embedded) {
      return Container(
        margin: const EdgeInsets.fromLTRB(14, 12, 14, 0),
        padding: const EdgeInsets.only(top: 12),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: t.line))),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AListIcon(background: t.peach1, child: Text(tip.emoji, style: const TextStyle(fontSize: 18))),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: DefaultTextStyle.merge(
                      style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.inkSoft, height: 1.5),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Flexible(child: Text('${tr('developmenttipswidget_inkisaf_tovsiyeleri_9f473e', 'İnkişaf Tövsiyələri')} · ${developmentAgeLabel(months)}')),
                          if (tips.length > 1) ...[const SizedBox(width: 8), Text('${index + 1}/${tips.length}', textDirection: TextDirection.ltr)],
                        ],
                      ),
                    ),
                  ),
                  Text(tip.title, style: x.aListTitle),
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(tip.content,
                        maxLines: 3, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, height: 1.5, color: t.inkSoft)),
                  ),
                ],
              ),
            ),
            if (tips.length > 1) ...[
              const SizedBox(width: 12),
              AIconBtn(
                semanticLabel: tr('common_next', 'Növbəti'),
                onTap: next,
                icon: const AIcon(AIcons.chevronRight, size: 15, mirrorInRtl: true),
              ),
            ],
          ],
        ),
      );
    }

    return AFadeIn(
      child: ACard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ACardHead(
              title: tr('developmenttipswidget_inkisaf_tovsiyeleri_9f473e', 'İnkişaf Tövsiyələri'),
              trailing: Text(developmentAgeLabel(months), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: t.inkSoft)),
            ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              child: Padding(
                key: ValueKey(tip.id),
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    AListIcon(background: t.peach1, child: Text(tip.emoji, style: const TextStyle(fontSize: 19))),
                    const SizedBox(width: 13),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(tip.title, style: x.aListTitle),
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(tip.content, style: x.aListSub.copyWith(height: 1.55)),
                        ),
                      ]),
                    ),
                  ],
                ),
              ),
            ),
            if (tips.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    AIconBtn(semanticLabel: tr('common_previous', 'Əvvəlki'), onTap: prev, icon: const AIcon(AIcons.chevronLeft, size: 15, mirrorInRtl: true)),
                    Row(mainAxisSize: MainAxisSize.min, children: [
                      for (var i = 0; i < tips.length; i++) ...[
                        if (i > 0) const SizedBox(width: 5),
                        Semantics(
                          button: true,
                          label: tr('devtips_tip_n', 'Məsləhət {n}').replaceFirst('{n}', '${i + 1}'),
                          child: GestureDetector(
                            onTap: () => setState(() => _index = i),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 150),
                              width: i == index ? 16 : 6,
                              height: 6,
                              decoration: BoxDecoration(color: i == index ? t.peach2 : t.lineStrong, borderRadius: BorderRadius.circular(999)),
                            ),
                          ),
                        ),
                      ],
                    ]),
                    AIconBtn(semanticLabel: tr('common_next', 'Növbəti'), onTap: next, icon: const AIcon(AIcons.chevronRight, size: 15, mirrorInRtl: true)),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// `w-6 h-6 rounded-full animate-spin` ring (2px peach-2, transparent top).
class _Spinner extends StatefulWidget {
  const _Spinner({required this.color});
  final Color color;
  @override
  State<_Spinner> createState() => _SpinnerState();
}

class _SpinnerState extends State<_Spinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(
        turns: _c,
        child: CustomPaint(painter: _RingPainter(widget.color), size: const Size.square(24)),
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.color);
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawArc(Offset.zero & size, -3.14159 / 4, 3 * 3.14159 / 2, false, p);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.color != color;
}
