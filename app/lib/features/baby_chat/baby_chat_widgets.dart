// Ported from: src/components/baby-chat/baby-chat.css (.bc-avatar, .bc-bubble, .bc-typing, .bc-share-row button,
//              .bc-sheet*, .bc-preview), the bubble / sheet markup of src/components/baby-chat/BabyChatScreen.tsx
import 'dart:typed_data';

import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

import '../../core/i18n/tr.dart';
import '../../design/design.dart';
import 'baby_chat.dart';

/// `.bc-avatar` (44 px lavender circle with 👶), optional unread dot (BabyChatCard).
class BabyChatAvatar extends StatelessWidget {
  const BabyChatAvatar({super.key, this.unread = false});
  final bool unread;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return SizedBox.square(
      dimension: 44,
      child: Stack(clipBehavior: Clip.none, children: [
        Container(
          decoration: BoxDecoration(color: a.lav1, shape: BoxShape.circle),
          alignment: Alignment.center,
          child: const ExcludeSemantics(child: Text('👶', style: TextStyle(fontSize: 24, height: 1))),
        ),
        if (unread)
          PositionedDirectional(
            top: 0,
            end: 0,
            child: Container(
              key: const ValueKey('bc-unread-dot'),
              width: 12,
              height: 12,
              decoration: BoxDecoration(color: a.coral, shape: BoxShape.circle, border: Border.all(color: a.surface, width: 2)),
            ),
          ),
      ]),
    );
  }
}

/// `.bc-bubble` box: max 78 % wide, radius 20 with the tail corner 6, 15 / 1.4.
BoxDecoration babyBubbleDecoration(ATokens a, {required bool mom, Color? background, bool shadow = true}) => BoxDecoration(
      color: background ?? (mom ? a.coral : a.surface),
      borderRadius: BorderRadiusDirectional.only(
        topStart: const Radius.circular(20),
        topEnd: const Radius.circular(20),
        bottomStart: Radius.circular(mom ? 20 : 6),
        bottomEnd: Radius.circular(mom ? 6 : 20),
      ),
      // `0 2px 8px rgba(160, 80, 80, 0.08)` (one-off literal of baby-chat.css).
      boxShadow: shadow ? const [BoxShadow(color: Color.fromRGBO(160, 80, 80, 0.08), offset: Offset(0, 2), blurRadius: 8)] : null,
    );

/// One message with framer's pop-in (`scale 0.85 → 1, y 8 → 0`, spring 420 / 28).
class BabyChatBubble extends StatefulWidget {
  const BabyChatBubble({super.key, required this.message});
  final BabyChatMessage message;

  @override
  State<BabyChatBubble> createState() => _BabyChatBubbleState();
}

class _BabyChatBubbleState extends State<BabyChatBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController.unbounded(vsync: this, value: 0);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else {
      _c.animateWith(SpringSimulation(const SpringDescription(mass: 1, stiffness: 420, damping: 28), 0, 1, 0));
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final mom = widget.message.from == 'mom';
    return LayoutBuilder(builder: (context, c) {
      final bubble = ConstrainedBox(
        constraints: BoxConstraints(maxWidth: c.maxWidth * 0.78),
        child: DecoratedBox(
          decoration: babyBubbleDecoration(a, mom: mom),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Text(widget.message.text,
                style: TextStyle(fontSize: 15, height: 1.4, color: mom ? const Color(0xFFFFFFFF) : a.ink)),
          ),
        ),
      );
      return Align(
        alignment: mom ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
        child: AnimatedBuilder(
          animation: _c,
          builder: (context, child) {
            final t = _c.value;
            return Opacity(
              opacity: t.clamp(0.0, 1.0),
              child: Transform.translate(
                offset: Offset(0, 8 * (1 - t)),
                child: Transform.scale(scale: 0.85 + 0.15 * t, child: child),
              ),
            );
          },
          child: bubble,
        ),
      );
    });
  }
}

/// `.bc-bubble.baby.bc-typing`: three bouncing dots (`bc-dot` 1.1 s, 0.15 s steps).
class BabyChatTypingBubble extends StatefulWidget {
  const BabyChatTypingBubble({super.key, required this.label});
  final String label;

  @override
  State<BabyChatTypingBubble> createState() => _BabyChatTypingBubbleState();
}

class _BabyChatTypingBubbleState extends State<BabyChatTypingBubble> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (infiniteAnimationsAllowed(context)) {
      if (!_c.isAnimating) _c.repeat();
    } else {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// `0%, 80%, 100% { translateY(0); opacity .45 } 40% { translateY(-4px); opacity 1 }` (ease-in-out).
  static ({double y, double o}) _frame(double p) {
    double k;
    if (p < 0.4) {
      k = Curves.easeInOut.transform(p / 0.4);
    } else if (p < 0.8) {
      k = 1 - Curves.easeInOut.transform((p - 0.4) / 0.4);
    } else {
      k = 0;
    }
    return (y: -4 * k, o: 0.45 + 0.55 * k);
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Semantics(
        label: widget.label,
        child: DecoratedBox(
          decoration: babyBubbleDecoration(a, mom: false),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) => Row(mainAxisSize: MainAxisSize.min, children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: 5),
                  Builder(builder: (context) {
                    final f = _frame(((_c.value - i * 0.15 / 1.1) % 1 + 1) % 1);
                    return Transform.translate(
                      offset: Offset(0, f.y),
                      child: Opacity(
                        opacity: f.o,
                        child: Container(width: 7, height: 7, decoration: BoxDecoration(color: a.inkFaint, shape: BoxShape.circle)),
                      ),
                    );
                  }),
                ],
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// `.bc-share-row button` (42 high pill; `.primary` coral).
class BabyChatPillButton extends StatelessWidget {
  const BabyChatPillButton({super.key, required this.label, required this.icon, this.onTap, this.primary = false, this.disabledLook = false});
  final String label;
  final Widget icon;
  final VoidCallback? onTap;
  final bool primary;
  final bool disabledLook;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fg = primary ? const Color(0xFFFFFFFF) : a.ink;
    return Semantics(
      button: true,
      enabled: onTap != null,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Opacity(
          opacity: onTap == null || disabledLook ? 0.7 : 1,
          child: Container(
            height: 42,
            decoration: BoxDecoration(color: primary ? a.coral : a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
            alignment: Alignment.center,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              icon,
              const SizedBox(width: 6),
              Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: fg))),
            ]),
          ),
        ),
      ),
    );
  }
}

/// `.bc-sheet-backdrop` + `.bc-sheet` with the rendered preview and the share button (native: one button,
/// "Paylaş · Yadda saxla").
class BabyChatShareSheet extends StatelessWidget {
  const BabyChatShareSheet({super.key, required this.bytes, required this.title, required this.shareLabel, required this.onClose, required this.onShare});
  final Uint8List bytes;
  final String title;
  final String shareLabel;
  final VoidCallback onClose;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final media = MediaQuery.of(context);
    return SizedBox.expand(
      child: GestureDetector(
        key: const ValueKey('bc-sheet-backdrop'),
        behavior: HitTestBehavior.opaque,
        onTap: onClose,
        child: ColoredBox(
          // `rgba(20, 12, 14, 0.45)` (one-off literal of baby-chat.css).
          color: const Color.fromRGBO(20, 12, 14, 0.45),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: GestureDetector(
              onTap: () {},
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Semantics(
                  scopesRoute: true,
                  explicitChildNodes: true,
                  label: title,
                  child: Container(
                    key: const ValueKey('bc-sheet'),
                    width: double.infinity,
                    padding: EdgeInsets.fromLTRB(16, 16, 16, 20 + media.padding.bottom),
                    decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(24))),
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Row(children: [
                        Expanded(child: Text(title, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: a.ink))),
                        GestureDetector(
                          onTap: onClose,
                          child: Semantics(
                            button: true,
                            label: tr('common_bagla', 'Bağla'),
                            child: Container(
                              width: 34,
                              height: 34,
                              decoration: BoxDecoration(color: a.surfaceSoft, shape: BoxShape.circle),
                              child: Center(child: AIcon(AIcons.x, size: 18, color: a.ink)),
                            ),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 12),
                      Center(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxHeight: media.size.height * 0.52),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: ColoredBox(color: const Color(0xFF000000), child: Image.memory(bytes, fit: BoxFit.contain, gaplessPlayback: true)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      BabyChatPillButton(
                        key: const ValueKey('bc-share-now'),
                        label: shareLabel,
                        primary: true,
                        icon: const AIcon(AIcons.share2, size: 16, color: Color(0xFFFFFFFF)),
                        onTap: onShare,
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
