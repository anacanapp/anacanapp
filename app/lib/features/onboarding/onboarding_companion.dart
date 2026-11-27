// Ported from: src/components/onboarding/OnboardingCompanion.tsx, src/components/onboarding/OnboardingBenefits.tsx,
// src/styles/onboarding.css (.onb-companion*, .onb-family, .onb-benefits)

import 'package:flutter/widgets.dart';

import '../../design/design.dart';
import 'onboarding_features.dart';
import 'onboarding_frame.dart';
import 'onboarding_i18n.dart';

/// `COMPANIONS`: stage → image file prefix and character name.
const Map<String, ({String file, String name})> companions = {
  'flow': (file: 'cycle', name: 'Ritm'),
  'bump': (file: 'pregnancy', name: 'Tumurcuq'),
  'mommy': (file: 'mother', name: 'Qucaq'),
};

/// welcome | mode | name | data | q1…q5 | sproof | privacy | value | analysis | results | proof | paywall | exit | freemode | success
typedef CompanionPose = String;

/// `companionSrc(stage, pose)` — also used by home screens and empty states.
String companionAsset(String stage, CompanionPose pose) => 'assets/images/onboarding/${companions[stage]!.file}-$pose.webp';

/// 'hero' | 'compact' | 'tiny' | 'option'
enum CompanionSize { hero, compact, tiny, option }

class OnboardingCompanion extends StatelessWidget {
  const OnboardingCompanion({super.key, required this.stage, this.pose = 'welcome', required this.language, this.size = CompanionSize.hero, this.inFamily = false, this.inSummary = false});
  final String stage;
  final CompanionPose pose;
  final String language;
  final CompanionSize size;

  /// `.onb-family .onb-companion`: 180 (145 at ≤360 wide, 140 at ≤700 high), no backdrop, no margin.
  final bool inFamily;

  /// `.onb-summary-heading .onb-companion`: 80×72 (64×60 at ≤700 high), centred, no margin.
  final bool inSummary;

  @override
  Widget build(BuildContext context) {
    final short = OnbStyle.short(context), narrow = OnbStyle.narrow(context);
    double height;
    double? width;
    EdgeInsets margin;
    var blob = true;
    var alignStart = false;
    switch (size) {
      case CompanionSize.hero:
        height = short ? 158 : 200;
        margin = const EdgeInsets.only(top: 4, bottom: 20);
      case CompanionSize.compact:
        height = short ? 100 : 126;
        margin = const EdgeInsets.only(top: 4, bottom: 20);
      case CompanionSize.tiny:
        height = 88;
        margin = const EdgeInsets.only(bottom: 12);
        blob = false;
        alignStart = true;
      case CompanionSize.option:
        height = 74;
        width = 64;
        margin = EdgeInsets.zero;
        blob = false;
    }
    if (inFamily) {
      height = short ? 140 : (narrow ? 145 : 180);
      margin = EdgeInsets.zero;
      blob = false;
    }
    if (inSummary) {
      height = short ? 64 : 80;
      width = short ? 60 : 72;
      margin = EdgeInsets.zero;
      alignStart = false;
    }
    final t = OnbStyle.of(context);
    final image = Image.asset(
      companionAsset(stage, pose),
      height: height,
      fit: BoxFit.contain,
      semanticLabel: onboardingText(language, 'companion', {'name': lifeStageName(stage, language)}),
      errorBuilder: (_, _, _) => SizedBox(height: height),
    );
    return Container(
      margin: margin,
      height: height,
      width: width,
      child: Stack(
        alignment: alignStart ? AlignmentDirectional.centerStart : Alignment.center,
        children: [
          if (blob)
            // `::before { inset: 28px 15% 0; border-radius: 120px 120px 22px 22px; background: var(--onb-soft); opacity: .7 }`
            Positioned.fill(
              top: 28,
              child: FractionallySizedBox(
                widthFactor: 0.7,
                child: Opacity(
                  opacity: 0.7,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: t.soft,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(120), bottom: Radius.circular(22)),
                    ),
                  ),
                ),
              ),
            ),
          image,
        ],
      ),
    );
  }
}

/// `OnboardingFamily`: the three characters with their mode names.
class OnboardingFamily extends StatelessWidget {
  const OnboardingFamily({super.key, required this.language});
  final String language;
  @override
  Widget build(BuildContext context) {
    final t = OnbStyle.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 18, bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (final (i, stage) in const ['flow', 'bump', 'mommy'].indexed) ...[
            if (i > 0) const SizedBox(width: 5),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(bottom: i == 1 ? 14 : 0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    OnboardingCompanion(stage: stage, language: language, inFamily: true),
                    const SizedBox(height: 9),
                    Text(lifeStageName(stage, language), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: t.muted)),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// `OnboardingBenefits` (`data-testid="onboarding-benefits"`).
class OnboardingBenefits extends StatelessWidget {
  const OnboardingBenefits({super.key, required this.stage, required this.page, required this.language, this.margin = const EdgeInsets.only(top: 12, bottom: 16)});
  final String stage;
  final OnboardingFeaturePage page;
  final String language;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    final t = OnbStyle.of(context);
    final short = OnbStyle.short(context);
    final items = onboardingFeatures(stage, page, language);
    return Container(
      key: const ValueKey('onboarding-benefits'),
      margin: margin,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(color: t.bg, border: Border.all(color: t.line), borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, item) in items.indexed)
            Container(
              key: ValueKey('feature-${item.key}'),
              constraints: BoxConstraints(minHeight: short ? 34 : 38),
              padding: EdgeInsets.symmetric(vertical: short ? 5 : 7),
              decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: t.line))),
              child: Row(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(color: t.surface, shape: BoxShape.circle),
                    alignment: Alignment.center,
                    child: AIcon(AIcons.check, size: 15, strokeWidth: 2.5, color: t.ok),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(item.label, style: const TextStyle(fontSize: 13, height: 1.45))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
