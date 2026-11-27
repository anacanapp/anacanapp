// Ported from: src/components/baby-chat/BabyChatCard.tsx
//
// Pregnancy dashboard: today's message from the baby (or that it is still on its way).
import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import '../../shell/nav/ids.dart' show ScreenId;
import '../../shell/nav/shell_controller.dart' show shellProvider;
import '../home/widgets/home_widgets.dart' show AHomeSection;
import 'baby_chat_notifications.dart';
import 'baby_chat_widgets.dart';
import 'use_baby_chat.dart';

class BabyChatCard extends ConsumerStatefulWidget {
  const BabyChatCard({super.key, this.onOpen});

  /// Default: Dashboard `onNavigate('baby-chat')` (Index navigateScreen).
  final VoidCallback? onOpen;

  @override
  ConsumerState<BabyChatCard> createState() => _BabyChatCardState();
}

class _BabyChatCardState extends ConsumerState<BabyChatCard> {
  String? _scheduledFor;

  @override
  Widget build(BuildContext context) {
    final chat = ref.watch(babyChatProvider);
    // Keeps the next week of on-device notifications scheduled (never prompts here).
    final key = '${chat.text.language}:${chat.userId}';
    if (_scheduledFor != key) {
      _scheduledFor = key;
      unawaited(scheduleBabyChatNotifications(ref.read(babyChatNotificationPlannerProvider), chat.text, chat.userId).catchError((Object _) {}));
    }
    final a = context.a;
    final u = chat.text.u;
    final unread = chat.unread;
    String? lastBaby;
    for (final m in chat.thread.reversed) {
      if (m.from == 'baby') {
        lastBaby = m.text;
        break;
      }
    }
    final preview = unread ? chat.dailyMessage : (lastBaby ?? (chat.arrived ? chat.dailyMessage : null));

    Widget previewBubble(String text) {
      final bubble = LayoutBuilder(
        builder: (context, c) => Align(
          alignment: AlignmentDirectional.centerStart,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: c.maxWidth * 0.92),
            child: DecoratedBox(
              decoration: babyBubbleDecoration(a, mom: false, background: a.surfaceSoft, shadow: false),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Text(text, style: TextStyle(fontSize: 15, height: 1.4, color: a.ink)),
              ),
            ),
          ),
        ),
      );
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: unread ? ImageFiltered(imageFilter: ui.ImageFilter.blur(sigmaX: 3, sigmaY: 3), child: bubble) : bubble,
      );
    }

    return AHomeSection(
      child: Semantics(
        button: true,
        label: unread ? u('card_new') : u('title'),
        child: PressScale(
          scale: 0.99,
          onTap: widget.onOpen ?? () => ref.read(shellProvider.notifier).navigateScreen(ScreenId.babyChat.id),
          child: FadeRiseIn(
            child: ACard(
              key: const ValueKey('baby-chat-card'),
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Row(children: [
                  BabyChatAvatar(unread: unread),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text('${u('title')} 💛', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: a.ink, height: 1.5)),
                      Text(
                        unread ? u('card_new') : u('week').replaceAll('{n}', '${chat.facts.week}'),
                        style: TextStyle(fontSize: 12, height: 1.5, fontWeight: unread ? FontWeight.w700 : FontWeight.w500, color: unread ? a.coral : a.inkSoft),
                      ),
                    ]),
                  ),
                  const SizedBox(width: 12),
                  AIcon(AIcons.messageCircleHeart, size: 20, color: a.coral),
                ]),
                if (preview != null)
                  previewBubble(preview)
                else
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(u('card_wait'), style: TextStyle(fontSize: 13, color: a.inkSoft, height: 1.5)),
                  ),
                if (unread || chat.arrived)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Row(children: [
                      Container(
                        height: 40,
                        padding: const EdgeInsets.symmetric(horizontal: 18),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(999)),
                        child: Text(u('card_cta'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF))),
                      ),
                    ]),
                  ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

/// framer `initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}` (default spring / tween).
class FadeRiseIn extends StatefulWidget {
  const FadeRiseIn({super.key, required this.child, this.dy = 16});
  final Widget child;
  final double dy;

  @override
  State<FadeRiseIn> createState() => _FadeRiseInState();
}

class _FadeRiseInState extends State<FadeRiseIn> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (animationsDisabled(context)) {
      _c.value = 1;
    } else {
      _c.forward();
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
        builder: (context, child) {
          final t = Curves.easeOut.transform(_c.value);
          return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, widget.dy * (1 - t)), child: child));
        },
        child: widget.child,
      );
}
