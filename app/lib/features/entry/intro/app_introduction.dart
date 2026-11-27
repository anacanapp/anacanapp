// Ported from: src/components/AppIntroduction.tsx, src/components/onboarding/OnboardingFrame.tsx (frame + primary
//              button, `introduction` step), src/components/onboarding/OnboardingCompanion.tsx (OnboardingFamily),
//              src/lib/onboarding-i18n.ts (onboardingText), src/lib/stage-names.ts (lifeStageName),
//              src/styles/onboarding.css (.onboarding, .onb-* rules used here)
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/i18n.dart' hide rtlX;
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../data/intro_copy.g.dart';
import '../widgets/entry_widgets.dart';

/// `onboardingText(language, key, values)` for the keys the introduction uses.
String introText(String language, String key, [Map<String, Object?> values = const {}]) {
  final index = kOnboardingLanguages.indexOf(language);
  final copy = I18nRuntime.instance.store.lookup('onboarding.$key', language) ?? kIntroCopy[key]![index < 0 ? 0 : index];
  return copy.replaceAllMapped(RegExp(r'\{(\w+)\}'), (m) => values.containsKey(m[1]) ? '${values[m[1]]}' : m[0]!);
}

/// `lifeStageName(stage, language)`.
String lifeStageName(String stage, String language) =>
    kStageNames[normalizeAppLanguage(language)]![stage == 'flow' ? 0 : stage == 'bump' ? 1 : 2];

/// `COMPANIONS[stage].file` → welcome pose asset.
String companionWelcomeAsset(String stage) =>
    'assets/images/entry/onboarding/${const {'flow': 'cycle', 'bump': 'pregnancy', 'mommy': 'mother'}[stage]}-welcome.webp';

class AppIntroduction extends ConsumerWidget {
  const AppIntroduction({super.key, required this.onComplete});
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final o = context.tokens.onboarding;
    final mq = MediaQuery.of(context);
    String t(String key) => introText(language, key);
    final arabic = language == 'ar';
    // `.onboarding`: Inter / Noto Sans Arabic, 15px, line-height 1.55.
    final base = TextStyle(
      fontFamily: arabic ? AFonts.notoArabic : AFonts.inter,
      fontFamilyFallback: arabic ? const [AFonts.inter] : const [AFonts.notoArabic],
      fontSize: 15,
      height: 1.55,
      leadingDistribution: TextLeadingDistribution.even,
      color: o.ink,
    );
    final companionHeight = mq.size.height <= 700 ? 140.0 : (mq.size.width <= 360 ? 145.0 : 180.0);
    final h1Size = (mq.size.width * 0.06).clamp(22.0, 28.0);
    final inset = mq.size.width <= 360 ? 18.0 : 24.0;

    Widget feature(AIconData icon, String label) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 5),
            decoration: BoxDecoration(color: o.bg, borderRadius: BorderRadius.circular(14)),
            child: Column(children: [
              AIcon(icon, size: 22, color: o.ink),
              const SizedBox(height: 8),
              Text(label, textAlign: TextAlign.center, style: base.copyWith(fontSize: 11)),
            ]),
          ),
        );

    return Material(
      type: MaterialType.transparency,
      child: Directionality(
        textDirection: language == 'ar' ? TextDirection.rtl : TextDirection.ltr,
        child: DefaultTextStyle(
          style: base,
          child: ColoredBox(
            color: o.surface,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Padding(
                  padding: EdgeInsets.only(top: mq.padding.top),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    // .onb-header
                    Container(
                      constraints: const BoxConstraints(minHeight: 60),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      alignment: AlignmentDirectional.centerStart,
                      child: const BrandMark(size: 44),
                    ),
                    // .onb-content
                    Expanded(
                      child: SingleChildScrollView(
                        padding: EdgeInsets.fromLTRB(inset, 0, inset, 20),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                          // .onb-family
                          Padding(
                            padding: const EdgeInsets.only(top: 18, bottom: 20),
                            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              for (final (i, stage) in const ['flow', 'bump', 'mommy'].indexed) ...[
                                if (i > 0) const SizedBox(width: 5),
                                Expanded(
                                  child: Padding(
                                    padding: EdgeInsets.only(bottom: i == 1 ? 14 : 0),
                                    child: Column(children: [
                                      SizedBox(
                                        height: companionHeight,
                                        child: Image.asset(
                                          companionWelcomeAsset(stage),
                                          fit: BoxFit.contain,
                                          semanticLabel: introText(language, 'companion', {'name': lifeStageName(stage, language)}),
                                        ),
                                      ),
                                      const SizedBox(height: 9),
                                      Text(lifeStageName(stage, language),
                                          textAlign: TextAlign.center, style: base.copyWith(fontSize: 10, color: o.muted)),
                                    ]),
                                  ),
                                ),
                              ],
                            ]),
                          ),
                          // .onb-center
                          Text(t('welcome_eyebrow').toUpperCase(),
                              textAlign: TextAlign.center,
                              style: base.copyWith(
                                  fontSize: 10, letterSpacing: 1.1, height: 1.7, color: o.muted, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 10 + 4),
                          Semantics(
                            header: true,
                            child: Text(t('welcome_title'),
                                textAlign: TextAlign.center,
                                style: base.copyWith(
                                    fontSize: h1Size, fontWeight: FontWeight.w800, letterSpacing: -0.035 * h1Size, height: 1.23)),
                          ),
                          const SizedBox(height: 10),
                          Text(t('welcome_sub'), textAlign: TextAlign.center, style: base.copyWith(fontSize: 14, height: 1.7, color: o.muted)),
                          const SizedBox(height: 20),
                          // .onb-feature-grid (margin 20px 0, collapses with the 20px above)
                          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            feature(AIcons.calendarDays, t('feature_tracking')),
                            const SizedBox(width: 8),
                            feature(AIcons.layoutGrid, t('feature_tools')),
                            const SizedBox(width: 8),
                            feature(AIcons.heartHandshake, t('feature_community')),
                          ]),
                          const SizedBox(height: 20),
                          Text(t('own_pace'), textAlign: TextAlign.center, style: base.copyWith(fontSize: 11, height: 1.7, color: o.muted)),
                        ]),
                      ),
                    ),
                    // .onb-footer
                    Container(
                      padding: EdgeInsets.fromLTRB(inset, 12, inset, mq.padding.bottom > 16 ? mq.padding.bottom : 16),
                      decoration: BoxDecoration(color: o.surface, border: Border(top: BorderSide(color: o.line))),
                      child: OnboardingPrimaryButton(onTap: onComplete, label: t('start')),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// `.onb-primary`: full width, min-height 52, padding 13/18, weight 800, pill, `--onb-accent` / #302624.
class OnboardingPrimaryButton extends StatelessWidget {
  const OnboardingPrimaryButton({super.key, required this.onTap, required this.label});
  final VoidCallback onTap;
  final String label;

  @override
  Widget build(BuildContext context) {
    final o = context.tokens.onboarding;
    return Semantics(
      button: true,
      child: GestureDetector(
        key: const ValueKey('intro-start'),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 18),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: o.accent, borderRadius: BorderRadius.circular(999)),
          // onboarding.css:31 `.onb-primary { color: #302624 }`
          child: Text(label,
              textAlign: TextAlign.center,
              style: DefaultTextStyle.of(context).style.copyWith(fontWeight: FontWeight.w800, color: const Color(0xFF302624))),
        ),
      ),
    );
  }
}
