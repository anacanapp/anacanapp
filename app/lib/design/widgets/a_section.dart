// Ported from: src/styles/anacan-design.css (.a-section, .a-section-head, .a-section-title, .a-section-link,
//              .a3-sec, .a3-sec-head, .a3-sec-title, .a3-link, .a3-sheet-body .a3-sec),
//              src/components/aptek/AptekScreen.tsx (a3-sec usage: link + ChevronRight 14 rtl:rotate-180)
import 'package:flutter/widgets.dart';

import '../icons.g.dart';
import '../theme.dart';

enum ASectionVariant {
  /// `.a-section`: margin-top 22; head aligned on baseline, 12px below; title 17px `.a-heading`.
  a,

  /// `.a3-sec`: margin-top 24, column gap 12; head min-height 28; title 18/700.
  a3,
}

/// Titled section. [trailing] replaces the default link (e.g. a `.a-tag` or `.a3-chip`).
class ASection extends StatelessWidget {
  const ASection({
    super.key,
    required this.child,
    this.title,
    this.variant = ASectionVariant.a3,
    this.linkLabel,
    this.onLink,
    this.trailing,
    this.flushTop = false,
  });

  final Widget child;
  final String? title;
  final ASectionVariant variant;

  /// `.a3-link` / `.a-section-link` text; a3 adds ChevronRight 14 (mirrored in RTL).
  final String? linkLabel;
  final VoidCallback? onLink;
  final Widget? trailing;

  /// No top margin (`.a3-sheet-body .a3-sec { margin-top: 0 }`, or first child).
  final bool flushTop;

  @override
  Widget build(BuildContext context) {
    final x = context.aText;
    final a3 = variant == ASectionVariant.a3;
    Widget? trail = trailing;
    if (trail == null && linkLabel != null) {
      trail = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onLink,
        child: a3
            ? ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 32),
                child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                  Text(linkLabel!, style: x.a3Link),
                  const SizedBox(width: 2),
                  AIcon(AIcons.chevronRight, size: 14, color: x.a3Link.color, mirrorInRtl: true),
                ]),
              )
            : Text(linkLabel!, style: x.aSectionLink),
      );
    }
    final head = title == null && trail == null
        ? null
        : a3
            ? ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 28),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: <Widget>[
                    if (title != null) Flexible(child: Text(title!, style: x.a3SecTitle)),
                    if (trail != null) ...<Widget>[const SizedBox(width: 12), trail],
                  ],
                ),
              )
            : Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: <Widget>[
                    if (title != null) Flexible(child: Text(title!, style: x.aSectionTitle)),
                    ?trail,
                  ],
                ),
              );
    return Padding(
      padding: EdgeInsets.only(top: flushTop ? 0 : (a3 ? 24 : 22)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          ?head,
          if (head != null && a3) const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
