// Ported from: src/components/partner/v2/PartnerOnboardingTour.tsx
//
// Partner Module 2.0 onboarding tour: shown once on the first visit of the partner home (LocalStore flag), a
// step-by-step bottom sheet with the blue partner accent.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../partner_copy.dart';
import '../partner_ports.dart';
import 'partner_ui.dart';

/// v2: the rebuilt partner module (missions on "Bu gün", shared tools, Ata AI) is shown once more.
const String kPartnerTourKey = 'anacan_partner_tour_v2';

class PartnerOnboardingTour extends ConsumerStatefulWidget {
  const PartnerOnboardingTour({super.key, required this.onClose});
  final VoidCallback onClose;

  @override
  ConsumerState<PartnerOnboardingTour> createState() => _PartnerOnboardingTourState();
}

class _PartnerOnboardingTourState extends ConsumerState<PartnerOnboardingTour> {
  int _step = 0;

  List<(AIconData, String, String, String)> _steps() => [
        (AIcons.heartHandshake, '💙', tr('ptour_welcome_title', '"Birlikdə"yə xoş gəldiniz!'),
            tr('ptour_welcome_text', 'Bu bölmə sizin üçündür — xanımınızın səyahətində ən böyük dəstəkçisi olun. Qısa tura baxaq?')),
        (AIcons.house, '🏠', tr('ptour_home_title', '"Bu gün" ekranı'), feature37Text('ptour2_home_text')),
        (AIcons.users, '🤝', tr('ptour_together_title', '"Birlikdə" bölməsi'), feature37Text('ptour2_together_text')),
        (AIcons.sparkles, '🤖', feature37Text('pm_ata_ai'), feature37Text('ptour2_ai_text')),
        (AIcons.bellRing, '🚨', tr('ptour_sos_title', 'SOS siqnalları'),
            tr('ptour_sos_text', 'Xanımınız təcili kömək və ya doğuş siqnalı göndərsə, telefonunuza dərhal bildiriş gələcək. Sancı rejimində canlı izləyə bilərsiniz.')),
        (AIcons.shield, '🔒', tr('ptour_privacy_title', 'Məxfilik və Premium'),
            tr('ptour_privacy_text', 'Nəyin paylaşılacağını xanımınız özü seçir. Premium isə ailəvidir — biri alsa, hər ikiniz istifadə edirsiniz.')),
      ];

  Future<void> _next(int count) async {
    await quietly(ref.read(partnerHapticsProvider).light);
    if (!mounted) return;
    if (_step == count - 1) {
      widget.onClose();
    } else {
      setState(() => _step++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final steps = _steps();
    final isLast = _step == steps.length - 1;
    final current = steps[_step];
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final reduce = animationsDisabled(context);
    const white = Color(0xFFFFFFFF);

    return Stack(children: [
      Positioned.fill(
        child: GestureDetector(
          key: const ValueKey('partner-tour-backdrop'),
          onTap: widget.onClose,
          // bg-black/60 (backdrop-blur-sm not reproduced over the shell)
          child: const ColoredBox(color: Color(0x99000000)),
        ),
      ),
      Positioned(
        left: 0,
        right: 0,
        bottom: 0,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: reduce ? 0 : 1, end: 0),
          duration: const Duration(milliseconds: 450),
          curve: ACurves.spring,
          builder: (context, v, child) => FractionalTranslation(translation: Offset(0, v), child: child),
          child: GestureDetector(
            onTap: () {},
            child: AScope(
              child: Container(
                key: const ValueKey('partner-tour'),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(30))),
                padding: EdgeInsets.only(bottom: (bottom == 0 ? 16 : bottom) + 16),
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Container(
                    height: 96,
                    decoration: BoxDecoration(gradient: a.gradBlue),
                    child: Stack(alignment: Alignment.center, children: [
                      AnimatedSwitcher(
                        duration: reduce ? Duration.zero : const Duration(milliseconds: 250),
                        transitionBuilder: (child, anim) => ScaleTransition(scale: Tween(begin: 0.6, end: 1.0).animate(anim), child: FadeTransition(opacity: anim, child: child)),
                        child: Container(
                          key: ValueKey('tour-icon-$_step'),
                          width: 64,
                          height: 64,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.chipOverlay, borderRadius: BorderRadius.circular(16)),
                          child: AIcon(current.$1, size: 30, color: a.blueInk),
                        ),
                      ),
                      PositionedDirectional(
                        top: 12,
                        end: 12,
                        child: PartnerTap(
                          key: const ValueKey('partner-tour-x'),
                          semanticLabel: tr('ptour_skip', 'Keç'),
                          onTap: widget.onClose,
                          scale: 1,
                          child: Container(
                            width: 32,
                            height: 32,
                            alignment: Alignment.center,
                            // rgba(255,255,255,0.45)
                            decoration: BoxDecoration(color: white.withValues(alpha: 0.45), shape: BoxShape.circle),
                            child: AIcon(AIcons.x, size: 15, strokeWidth: 2.4, color: a.blueInk),
                          ),
                        ),
                      ),
                    ]),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      AnimatedSwitcher(
                        duration: reduce ? Duration.zero : const Duration(milliseconds: 180),
                        transitionBuilder: (child, anim) => FadeTransition(
                          opacity: anim,
                          child: SlideTransition(position: Tween(begin: Offset(rtl ? -0.07 : 0.07, 0), end: Offset.zero).animate(anim), child: child),
                        ),
                        child: ConstrainedBox(
                          key: ValueKey('tour-step-$_step'),
                          constraints: const BoxConstraints(minHeight: 108),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Text('${current.$2} ${current.$3}', style: pText(19, weight: FontWeight.w700, color: a.ink, ls: -0.02)),
                            ),
                            Text(current.$4, style: pText(13.5, weight: FontWeight.w500, color: a.inkSoft, height: 1.55)),
                          ]),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                          for (var i = 0; i < steps.length; i++) ...[
                            if (i > 0) const SizedBox(width: 6),
                            AnimatedContainer(
                              duration: reduce ? Duration.zero : const Duration(milliseconds: 300),
                              width: i == _step ? 22 : 7,
                              height: 7,
                              decoration: BoxDecoration(
                                // `${BLUE_SOFT}66` = var(--a-blue-ink) with alpha 0x66
                                color: i == _step ? a.blue2 : i < _step ? a.blueInk.withValues(alpha: 0x66 / 255) : a.lineStrong,
                                borderRadius: BorderRadius.circular(999),
                              ),
                            ),
                          ],
                        ]),
                      ),
                      Row(children: [
                        if (!isLast) ...[
                          GestureDetector(
                            key: const ValueKey('partner-tour-skip'),
                            onTap: widget.onClose,
                            child: Container(
                              constraints: const BoxConstraints(minWidth: 92),
                              height: 48,
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                              child: Text(tr('ptour_skip', 'Keç'), style: pText(12, weight: FontWeight.w700, color: a.accentInk)),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        Expanded(
                          child: PartnerTap(
                            key: const ValueKey('partner-tour-next'),
                            scale: 0.98,
                            onTap: () => _next(steps.length),
                            child: Container(
                              height: 48,
                              padding: const EdgeInsets.symmetric(horizontal: 18),
                              decoration: BoxDecoration(color: a.blue2, borderRadius: BorderRadius.circular(999)),
                              child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                                Flexible(
                                  child: Text(isLast ? tr('ptour_done', 'Başlayaq! 💙') : tr('ptour_next', 'Növbəti'),
                                      style: pText(12.5, weight: FontWeight.w700, color: white)),
                                ),
                                if (!isLast) ...[
                                  const SizedBox(width: 6),
                                  const AIcon(AIcons.chevronRight, size: 16, strokeWidth: 2.4, color: white, mirrorInRtl: true),
                                ],
                              ]),
                            ),
                          ),
                        ),
                      ]),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    ]);
  }
}
