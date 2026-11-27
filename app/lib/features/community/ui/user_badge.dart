// Ported from: src/components/community/UserBadge.tsx, src/styles/anacan-design.css (.a-post-badge(.admin|.moderator),
//              .a-verified-tick)
import 'package:flutter/widgets.dart';

import '../../../design/design.dart';
import '../../chat/copy/chat_copy.dart' show groupTr;
import '../../settings/ui/settings_ui.dart' show cssUpper;
import 'community_widgets.dart';

/// `UserBadge type premium`: staff badge (admin / moderator) and the Premium badge (an explicit `premium: false`
/// hides it even for a stale `premium` badge type).
class UserBadge extends StatelessWidget {
  const UserBadge({super.key, required this.type, this.premium});
  final String? type;
  final bool? premium;

  static List<String> kinds(String? type, bool? premium) => [
        if (type == 'admin' || type == 'moderator') type!,
        if (premium == true || (premium == null && type == 'premium')) 'premium',
      ];

  @override
  Widget build(BuildContext context) {
    final list = kinds(type, premium);
    if (list.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 6, runSpacing: 4, children: [for (final kind in list) _Badge(kind: kind)]);
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.kind});
  final String kind;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final (Gradient bg, Color ink, AIconData icon) = switch (kind) {
      'admin' => (a.gradPink, a.alertInk, AIcons.shield),
      'moderator' => (a.gradBlue, a.blueInk, AIcons.shield),
      _ => (a.gradYellow, a.warnInk, AIcons.sparkles),
    };
    final label = kind == 'admin'
        ? groupTr('group_administrator')
        : kind == 'moderator'
            ? groupTr('community_moderator_label')
            : 'Premium';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(gradient: bg, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        AIcon(icon, size: 9, color: ink),
        const SizedBox(width: 3),
        Text(cssUpperLabel(label), style: px(9.5, weight: FontWeight.w800, color: ink, ls: 0.03, height: 1.3)),
      ]),
    );
  }
}

/// `text-transform: uppercase` in the document language.
String cssUpperLabel(String text) => cssUpper(text);

/// `VerifiedTick`: lucide BadgeCheck with `fill=#0095F6` and a white check.
class VerifiedTick extends StatelessWidget {
  const VerifiedTick({super.key, this.size = 14});
  final double size;
  @override
  Widget build(BuildContext context) => Semantics(
        label: groupTr('userbadge_tesdiqlenmis_hesab', 'Təsdiqlənmiş hesab'),
        child: Padding(
          padding: const EdgeInsets.only(top: 0.5),
          // UserBadge.tsx fill / color literals
          child: LucideFilled('badge-check', size: size, fill: const Color(0xFF0095F6), stroke: const Color(0xFFFFFFFF), strokeWidth: 2.25),
        ),
      );
}

/// `isVerifiedActive(isVerified, verifiedUntil)`: permanent without an end date, else until it passes.
bool isVerifiedActive(Object? isVerified, Object? verifiedUntil, {DateTime? now}) {
  if (isVerified != true) return false;
  if (verifiedUntil is! String || verifiedUntil.isEmpty) return true;
  final until = DateTime.tryParse(verifiedUntil);
  return until != null && until.isAfter(now ?? DateTime.now());
}
