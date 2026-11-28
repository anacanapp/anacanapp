// Ported from: src/components/pregnancy-loss/LossSignsChecker.tsx
//
// Body and mood check after a pregnancy loss (the mother for herself, or the partner for her). Not a diagnosis:
// urgent signs lead to the local emergency number, the others to a doctor visit soon.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show cssUpper, px;
import '../../tools/health_common/health_common.dart' show healthLinkLauncherProvider;
import '../common/feature_text.dart';
import 'loss_ui.dart';
import 'pregnancy_loss.dart';

class LossSignsChecker extends ConsumerStatefulWidget {
  const LossSignsChecker({super.key, required this.text, this.forPartner = false});
  final FeatureText text;
  final bool forPartner;
  @override
  ConsumerState<LossSignsChecker> createState() => _LossSignsCheckerState();
}

class _LossSignsCheckerState extends ConsumerState<LossSignsChecker> {
  final List<String> _picked = [];

  @override
  Widget build(BuildContext context) {
    final text = widget.text;
    final t = text.sub('ui');
    final signs = text.sub('signs');
    final urgentSigns = signs.list('urgent');
    final urgent = _picked.any(urgentSigns.contains);
    final emergency = lossEmergencyNumber(text);
    final a = context.a;
    final l = LossTokens.of(context);
    const white = Color(0xFFFFFFFF);

    Widget group(String title, List<String> list, bool isUrgent) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(2, 4, 2, 8),
            child: Text(cssUpper(title), style: lossTag(context, isUrgent ? a.alertInk : l.accentInk)),
          ),
          lossStack(gap: 8, [
            for (final sign in list)
              Semantics(
                checked: _picked.contains(sign),
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _picked.contains(sign) ? _picked.remove(sign) : _picked.add(sign)),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                    decoration: BoxDecoration(
                      color: _picked.contains(sign) ? (isUrgent ? a.peach1 : l.soft) : a.surface,
                      borderRadius: BorderRadius.circular(14),
                      // 0 6px 16px -14px rgba(120, 90, 170, 0.5)
                      boxShadow: _picked.contains(sign) ? null : const [BoxShadow(color: Color(0x80785AAA), offset: Offset(0, 6), blurRadius: 16, spreadRadius: -14)],
                    ),
                    child: Row(children: [
                      Container(
                        width: 22,
                        height: 22,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _picked.contains(sign) ? (isUrgent ? a.alertInk : l.accent) : null,
                          borderRadius: BorderRadius.circular(7),
                          border: _picked.contains(sign) ? null : Border.all(color: a.lineStrong, width: 1.5),
                        ),
                        child: _picked.contains(sign) ? const AIcon(AIcons.check, size: 14, color: white, strokeWidth: 3) : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Text(sign, style: px(13.5, weight: FontWeight.w600, color: a.ink, height: 1.4))),
                    ]),
                  ),
                ),
              ),
          ]),
        ]);

    final tone = urgent ? a.alertInk : (_picked.isNotEmpty ? a.warnInk : a.greenInk);
    return lossStack([
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t.s('signs_title'), style: px(18, weight: FontWeight.w900, color: a.ink)),
          Text(widget.forPartner ? t.s('p_signs_sub') : t.s('signs_sub'), style: lossRowSub(context, 12.5)),
        ]),
      ),
      group(t.s('signs_urgent_group'), urgentSigns, true),
      group(t.s('signs_soon_group'), signs.list('soon'), false),
      Semantics(
        liveRegion: true,
        child: Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: urgent ? a.alertBg : null,
            color: urgent ? null : (_picked.isNotEmpty ? a.yellow1 : a.green1),
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: AIcon(urgent ? AIcons.triangleAlert : (_picked.isNotEmpty ? AIcons.stethoscope : AIcons.check), size: 17, color: tone),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(urgent ? t.s('signs_urgent') : (_picked.isNotEmpty ? t.s('signs_some') : t.s('signs_none')),
                    style: px(13, weight: FontWeight.w600, color: tone, height: 1.5)),
                if (urgent)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Semantics(
                      link: true,
                      child: GestureDetector(
                        onTap: () => ref.read(healthLinkLauncherProvider)(Uri(scheme: 'tel', path: emergency)),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                          decoration: BoxDecoration(color: a.alertInk, borderRadius: BorderRadius.circular(999)),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const AIcon(AIcons.phone, size: 15, color: white),
                            const SizedBox(width: 8),
                            Text('${t.s('call')} $emergency', style: px(13.5, weight: FontWeight.w800, color: white, height: 1.2)),
                          ]),
                        ),
                      ),
                    ),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    ]);
  }
}
