// Ported from: src/components/OfflineSyncIndicator.tsx
import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/i18n/language_controller.dart' show appLanguageProvider;
import '../../core/i18n/tr.dart' show tr;
import '../../core/offline/offline_providers.dart' show offlineSyncIndicatorVisibleProvider;
import '../../design/a_icon.dart';
import '../../design/icons.g.dart' show AIcons;
import '../../design/theme.dart';

/// Small, non-blocking "offline, will sync" pill for a signed-in account (z-60, touch passes through).
class OfflineSyncIndicator extends ConsumerWidget {
  const OfflineSyncIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appLanguageProvider); // re-render on language change
    if (!ref.watch(offlineSyncIndicatorVisibleProvider)) return const SizedBox.shrink();
    return OfflineSyncPill(text: tr('netsync_offline_indicator', 'Oflayn · internet gələndə sinxronlanacaq'));
  }
}

/// The pill itself: `pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4`,
/// `top: calc(env(safe-area-inset-top) + 6px)`.
class OfflineSyncPill extends StatelessWidget {
  const OfflineSyncPill({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final s = tokens.shadcn;
    final top = MediaQuery.viewPaddingOf(context).top + 6;
    // bg-foreground/80, text-background, shadow-sm, backdrop-blur (8px; dropped in lite / noBlur like the CSS).
    final pill = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: s.foreground.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(9999),
        boxShadow: const [BoxShadow(color: Color(0x0D000000), offset: Offset(0, 1), blurRadius: 2)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          AIcon(AIcons.cloudOff, size: 12, color: s.background),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                height: 1.25,
                fontWeight: FontWeight.w500,
                color: s.background,
                decoration: TextDecoration.none,
              ),
            ),
          ),
        ],
      ),
    );
    return Positioned(
      top: top,
      left: 0,
      right: 0,
      child: IgnorePointer(
        child: Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(
              child: tokens.blurEnabled
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(9999),
                      child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8), child: pill),
                    )
                  : pill,
            ),
          ),
        ),
      ),
    );
  }
}
