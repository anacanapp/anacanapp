// Ported from: src/components/baby/TrackerAIInsight.tsx
//
// One tracker's AI row: request button (or the Premium CTA after the daily limit), spinner, result with a status
// pill and a refresh button when stale / loading / failed. The limit CTA opens the PremiumModal through
// [MommyHomeSlots.showPremiumModal].
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/language_controller.dart';
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../home_mommy/copy/mommy_copy.dart';
import '../../home_mommy/mommy_home_slots.dart';
import '../hooks/use_baby_insight.dart';

class _Status {
  const _Status(this.color, this.bg, this.key, this.az);
  final Color Function(ATokens t) color;
  final Color bg;
  final String key;
  final String az;
}

final Map<String, _Status> _statusConf = {
  'normal': _Status((t) => t.greenInk, const Color(0x1F1C7A4D), 'babyai_status_normal', 'Normal'),
  'low': _Status((t) => t.yellowInk, const Color(0x1F946200), 'babyai_status_low', 'Az'),
  'high': _Status((t) => t.yellowInk, const Color(0x1F946200), 'babyai_status_high', 'Çox'),
  // `color: '#b3261e', bg: 'rgba(179, 38, 30, 0.12)'` (TrackerAIInsight.tsx:15)
  'watch': _Status((_) => const Color(0xFFB3261E), const Color(0x1FB3261E), 'babyai_status_watch', 'Diqqət'),
};

class TrackerAIInsight extends ConsumerWidget {
  const TrackerAIInsight({super.key, required this.section, required this.controller});
  final String section;
  final BabyInsightController controller;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(appLanguageProvider);
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final api = controller.section(section);
        final data = api.insight;
        final meta = _statusConf[data?.status ?? 'normal']!;
        final t = context.a;
        void tap() {
          if (api.limitReached) {
            ref.read(mommyHomeSlotsProvider).showPremiumModal?.call(context, 'baby_insight');
          } else {
            controller.request(section);
          }
        }

        Widget content;
        if (data == null && !api.loading) {
          content = GestureDetector(
            key: ValueKey('ai-insight-request-$section'),
            behavior: HitTestBehavior.opaque,
            onTap: tap,
            child: Row(children: [
              api.limitReached
                  ? const AIcon(AIcons.crown, size: 13, color: Color(0xFFB8860B))
                  : AIcon(AIcons.sparkles, size: 13, color: t.accentInk),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  api.limitReached
                      ? tr('babyai_limit_cta', 'Gündəlik pulsuz analiz bitdi — Premium ilə limitsiz')
                      : api.error
                          ? tr('babyai_error_retry', 'AI analiz alınmadı — yenidən cəhd et')
                          : followupText('ai_$section'),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: t.accentInk, height: 1.5),
                ),
              ),
            ]),
          );
        } else if (api.loading && data == null) {
          content = Semantics(
            liveRegion: true,
            child: Row(children: [
              const _Spin(child: AIcon(AIcons.loaderCircle, size: 13)),
              const SizedBox(width: 8),
              Text(tr('babyai_loading', 'AI analiz edir...'), style: TextStyle(fontSize: 12, color: t.inkSoft, height: 1.5)),
            ]),
          );
        } else {
          content = _FadeInOnce(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(children: [
                  const AIcon(AIcons.sparkles, size: 12),
                  const SizedBox(width: 8),
                  Text(tr('babyai_title', 'AI Analiz'), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: t.inkSoft)),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: meta.bg, borderRadius: BorderRadius.circular(999)),
                    child: Text(tr(meta.key, meta.az), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: meta.color(t))),
                  ),
                  if (api.stale || api.loading || api.error) ...[
                    const Spacer(),
                    Semantics(
                      button: true,
                      label: tr('babyai_refresh', 'Yenilə'),
                      child: GestureDetector(
                        onTap: api.loading ? null : tap,
                        child: Padding(
                          padding: const EdgeInsets.all(2),
                          child: api.loading ? const _Spin(child: AIcon(AIcons.loaderCircle, size: 12)) : const AIcon(AIcons.refreshCw, size: 12),
                        ),
                      ),
                    ),
                  ],
                ]),
              ),
              Text(data!.note, style: TextStyle(fontSize: 12, height: 1.45, color: t.ink)),
            ]),
          );
        }
        return Container(
          margin: const EdgeInsets.only(top: 10),
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
          decoration: BoxDecoration(color: t.surfaceSoft, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.line)),
          child: content,
        );
      },
    );
  }
}

class _Spin extends StatefulWidget {
  const _Spin({required this.child});
  final Widget child;
  @override
  State<_Spin> createState() => _SpinState();
}

class _SpinState extends State<_Spin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: widget.child);
}

/// framer `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` (300 ms default tween).
class _FadeInOnce extends StatelessWidget {
  const _FadeInOnce({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 300),
        curve: ACurves.framerDefault,
        child: child,
        builder: (context, v, child) => Opacity(opacity: v, child: child),
      );
}
