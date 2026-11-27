// Ported from: src/components/ui/dropdown-menu.tsx (Radix DropdownMenu: content `align="end"`, `sideOffset=4`,
//              `bg-popover rounded-md border p-1 shadow-md`, items `px-2 py-1.5 text-sm rounded-sm`, separator
//              `-mx-1 my-1 h-px bg-muted`), src/styles/anacan-design.css (.community-post-menu [role=menuitem])
import 'package:flutter/widgets.dart';
import 'package:material_ui/material_ui.dart' show Material, MaterialType;

import '../../../design/design.dart';
import 'community_widgets.dart';

class CommunityMenuItem {
  const CommunityMenuItem({required this.label, required this.onSelect, this.icon, this.color, this.separatorBefore = false, this.minHeight = 40, this.fontSize = 14});
  final String label;
  final VoidCallback onSelect;
  final AIconData? icon;
  final Color? color;
  final bool separatorBefore;
  final double minHeight;
  final double fontSize;
}

/// Opens a dropdown anchored at the end edge below [anchor] (the trigger's context).
Future<void> showCommunityMenu(BuildContext anchor, List<CommunityMenuItem> items, {double minWidth = 150, double radius = 12}) {
  final box = anchor.findRenderObject() as RenderBox?;
  final overlay = Navigator.of(anchor, rootNavigator: true).overlay?.context.findRenderObject() as RenderBox?;
  if (box == null || overlay == null || items.isEmpty) return Future.value();
  final topLeft = box.localToGlobal(Offset.zero, ancestor: overlay);
  final rect = topLeft & box.size;
  final rtl = Directionality.of(anchor) == TextDirection.rtl;
  return Navigator.of(anchor, rootNavigator: true).push(_MenuRoute(rect: rect, rtl: rtl, items: items, minWidth: minWidth, radius: radius));
}

class _MenuRoute extends PopupRoute<void> {
  _MenuRoute({required this.rect, required this.rtl, required this.items, required this.minWidth, required this.radius});
  final Rect rect;
  final bool rtl;
  final List<CommunityMenuItem> items;
  final double minWidth;
  final double radius;

  @override
  Color? get barrierColor => null;
  @override
  bool get barrierDismissible => true;
  @override
  String? get barrierLabel => 'menu';
  @override
  Duration get transitionDuration => const Duration(milliseconds: 150);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) {
    final size = MediaQuery.sizeOf(context);
    final top = rect.bottom + 4;
    final s = context.tokens.shadcn;
    final menu = Container(
      constraints: BoxConstraints(minWidth: minWidth, maxWidth: size.width - 24),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: s.popover,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: s.border.withValues(alpha: 0.2)),
        boxShadow: const [
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 20), blurRadius: 25, spreadRadius: -5),
          BoxShadow(color: Color(0x1A000000), offset: Offset(0, 8), blurRadius: 10, spreadRadius: -6),
        ],
      ),
      child: IntrinsicWidth(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          for (final item in items) ...[
            if (item.separatorBefore) Container(height: 1, margin: const EdgeInsets.symmetric(vertical: 4), color: s.border.withValues(alpha: 0.1)),
            Semantics(
              button: true,
              label: item.label,
              excludeSemantics: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  Navigator.of(context).pop();
                  item.onSelect();
                },
                child: Container(
                  constraints: BoxConstraints(minHeight: item.minHeight),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  alignment: AlignmentDirectional.centerStart,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (item.icon != null) ...[AIcon(item.icon!, size: 12, color: item.color ?? s.popoverForeground), const SizedBox(width: 8)],
                    Flexible(child: Text(item.label, style: px(item.fontSize, color: item.color ?? s.popoverForeground, height: 1.4))),
                  ]),
                ),
              ),
            ),
          ],
        ]),
      ),
    );
    return Material(
      type: MaterialType.transparency,
      child: Stack(children: [
        Positioned(
          top: top,
          left: rtl ? rect.left.clamp(12.0, size.width - 12) : null,
          right: rtl ? null : (size.width - rect.right).clamp(12.0, size.width - 12),
          child: FadeTransition(
            opacity: animation,
            child: ScaleTransition(scale: Tween<double>(begin: 0.95, end: 1).animate(animation), alignment: rtl ? Alignment.topLeft : Alignment.topRight, child: menu),
          ),
        ),
      ]),
    );
  }
}
