// Ported from: src/components/dashboard/WaterWidget.tsx (both variants), src/styles/anacan-design.css
//              (.a-water-row, .a-water-main, .a-water-count, .a-water-bar, .a-water-add)
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/i18n/app_languages.dart' show appLanguageLocale;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../data/daily_logs.dart';
import '../widgets/home_widgets.dart';

/// Fallback targets for the life stages.
const Map<String, int> waterFallbackTargets = {'bump': 10, 'mommy': 12, 'flow': 8};

enum WaterWidgetVariant { standard, anacan }

String _percent(double fraction, String language) {
  try {
    return NumberFormat.percentPattern(appLanguageLocale(language).replaceAll('-', '_')).format(fraction);
  } catch (_) {
    return '${(fraction * 100).round()}%';
  }
}

class WaterWidget extends ConsumerWidget {
  const WaterWidget({super.key, this.variant = WaterWidgetVariant.standard});
  final WaterWidgetVariant variant;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(dailyLogsProvider);
    final controller = ref.read(dailyLogsProvider.notifier);
    final glasses = controller.waterToday();
    final stage = ref.watch(userStoreProvider.select((s) => s.lifeStage)) ?? 'flow';
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final target = waterFallbackTargets[stage] ?? 8;
    final percentage = (glasses / target * 100).clamp(0, 100).toDouble();
    final t = context.a;

    void add() => controller.updateWaterIntake(1);

    if (variant == WaterWidgetVariant.anacan) {
      // Compact one-row tracker: icon, count + thin progress bar, add button.
      return AFadeIn(
        child: ACard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(children: [
            AGradIcon(gradient: t.gradBlue, foreground: t.blueInk, child: const AIcon(AIcons.droplets, size: 17)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Expanded(child: Text(tr('common_su_water', 'Su'), style: context.aText.aListTitle)),
                  const SizedBox(width: 8),
                  Text.rich(
                    TextSpan(children: [
                      TextSpan(text: '$glasses/$target'),
                      TextSpan(text: ' ${tr('waterwidget_glass_unit', 'stəkan')} · '),
                      TextSpan(
                        text: _percent(percentage / 100, language),
                        style: TextStyle(fontWeight: FontWeight.w700, color: t.ink),
                      ),
                    ]),
                    key: const ValueKey('water-count'),
                    softWrap: false,
                    style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: t.inkSoft, height: 1.5),
                  ),
                ]),
                const SizedBox(height: 7),
                Semantics(
                  value: '${glasses.clamp(0, target)}',
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: Container(
                      height: 6,
                      color: t.surfaceSoft,
                      alignment: AlignmentDirectional.centerStart,
                      child: AnimatedFractionallySizedBox(
                        duration: const Duration(milliseconds: 400),
                        curve: ACurves.cssEase,
                        widthFactor: percentage / 100,
                        heightFactor: 1,
                        child: DecoratedBox(decoration: BoxDecoration(color: t.blue2, borderRadius: BorderRadius.circular(999))),
                      ),
                    ),
                  ),
                ),
              ]),
            ),
            const SizedBox(width: 12),
            Semantics(
              button: true,
              label: tr('waterwidget_add_glass', '1 stəkan əlavə et'),
              child: GestureDetector(
                key: const ValueKey('water-add'),
                behavior: HitTestBehavior.opaque,
                onTap: add,
                child: PressScale(
                  scale: 0.9,
                  child: Container(
                    width: 34,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: t.ink, shape: BoxShape.circle),
                    child: AIcon(AIcons.plus, size: 16, strokeWidth: 2.6, color: t.bg),
                  ),
                ),
              ),
            ),
          ]),
        ),
      );
    }

    // Default (pre-redesign) variant: Tailwind cyan card.
    return Container(
      constraints: const BoxConstraints(minHeight: 80),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xCCECFEFF), // bg-cyan-50/80
        border: Border.all(color: const Color(0x80CFFAFE)), // border-cyan-100/50
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(offset: Offset(0, 1), blurRadius: 2, color: Color(0x0D000000))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Opacity(
                opacity: 0.8,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const AIcon(AIcons.droplets, size: 12, color: Color(0xFF0E7490)),
                  const SizedBox(width: 4),
                  Text(tr('common_su_water', 'Su'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: Color(0xFF0E7490))),
                ]),
              ),
              const SizedBox(height: 2),
              Text.rich(TextSpan(children: [
                TextSpan(text: '$glasses '),
                TextSpan(text: '/ $target', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: Color(0x80083344))),
              ]), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, height: 1, color: Color(0xFF083344))),
            ]),
          ),
          GestureDetector(
            onTap: add,
            child: PressScale(
              scale: 0.9,
              child: Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: const BoxDecoration(color: Color(0xFFCFFAFE), shape: BoxShape.circle),
                child: const AIcon(AIcons.plus, size: 14, color: Color(0xFF0E7490)),
              ),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: Container(
            height: 6,
            color: const Color(0xFFCFFAFE),
            alignment: AlignmentDirectional.centerStart,
            child: FractionallySizedBox(widthFactor: percentage / 100, heightFactor: 1, child: const ColoredBox(color: Color(0xFF06B6D4))),
          ),
        ),
      ]),
    );
  }
}
