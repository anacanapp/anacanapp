// Ported from: src/index.css (:root / .dark), src/styles/anacan-design.css (:root / .dark,
//              .a-nav.capsule, html.a-noblur, html.a-lite), src/styles/onboarding.css (.onboarding)
import 'package:material_ui/material_ui.dart';

import 'css_tokens.g.dart';
import 'life_stage.g.dart';

export 'css_tokens.g.dart';
export 'css_types.dart';
export 'life_stage.g.dart';
export 'tailwind.g.dart';

/// All generated CSS tokens for one theme, exposed through [ThemeData.extensions].
///
/// ```dart
/// final t = AnacanTokens.of(context);
/// Container(color: t.a.surface, child: Text('x', style: TextStyle(color: t.a.ink)));
/// ```
@immutable
class AnacanTokens extends ThemeExtension<AnacanTokens> {
  const AnacanTokens({
    required this.brightness,
    required this.shadcn,
    required this.a,
    required this.navCapsule,
    required this.onboarding,
    required this.aRing,
    required this.lifeStages,
    this.lite = false,
    this.noBlur = false,
    this.arabic = false,
  });

  final Brightness brightness;

  /// shadcn/Tailwind colours (`bg-background`, `text-muted-foreground`, `--flow`, `--gradient-*`).
  final ShadcnTokens shadcn;

  /// Redesign `--a-*` tokens (`var(--a-surface)`, `--a-card-shadow`, `--a-ease` …).
  final ATokens a;

  /// `.a-nav.capsule` variables, already resolved for [noBlur].
  final NavCapsuleTokens navCapsule;

  /// `.onboarding` variables.
  final OnboardingTokens onboarding;
  final ARingCssTokens aRing;

  /// `flow` / `bump` / `mommy` / `partner` palettes.
  final Map<String, ALifeStagePalette> lifeStages;

  /// `html.a-lite` (low-end device): no backdrop blur, no decorative infinite animations.
  final bool lite;

  /// `html.a-noblur` (Android): no backdrop blur, near-opaque glass.
  final bool noBlur;

  /// `:lang(ar)` → Noto Sans Arabic first in every font stack.
  final bool arabic;

  bool get isDark => brightness == Brightness.dark;

  /// Backdrop blur allowed (not lite, not noBlur).
  bool get blurEnabled => !lite && !noBlur;

  static const AnacanTokens light = AnacanTokens(
    brightness: Brightness.light,
    shadcn: ShadcnTokens.light,
    a: ATokens.light,
    navCapsule: NavCapsuleTokens.light,
    onboarding: OnboardingTokens.light,
    aRing: ARingCssTokens.light,
    lifeStages: ALifeStagePalettes.light,
  );

  static const AnacanTokens dark = AnacanTokens(
    brightness: Brightness.dark,
    shadcn: ShadcnTokens.dark,
    a: ATokens.dark,
    navCapsule: NavCapsuleTokens.dark,
    onboarding: OnboardingTokens.dark,
    aRing: ARingCssTokens.dark,
    lifeStages: ALifeStagePalettes.dark,
  );

  /// Tokens for [brightness] with the runtime html classes applied.
  factory AnacanTokens.resolve(Brightness brightness, {bool lite = false, bool noBlur = false, bool arabic = false}) {
    final dark = brightness == Brightness.dark;
    final base = dark ? AnacanTokens.dark : AnacanTokens.light;
    // html.a-lite also removes backdrop-filter everywhere, but only html.a-noblur swaps the
    // capsule glass colour (anacan-design.css: html.a-noblur .a-nav.capsule { --nav-glass }).
    final nav = noBlur ? (dark ? NavCapsuleTokens.darkNoBlur : NavCapsuleTokens.lightNoBlur) : base.navCapsule;
    return base.copyWith(navCapsule: nav, lite: lite, noBlur: noBlur, arabic: arabic);
  }

  /// Nearest tokens; falls back to light when no [AnacanTokens] extension is installed.
  static AnacanTokens of(BuildContext context) => Theme.of(context).extension<AnacanTokens>() ?? light;

  @override
  AnacanTokens copyWith({
    Brightness? brightness,
    ShadcnTokens? shadcn,
    ATokens? a,
    NavCapsuleTokens? navCapsule,
    OnboardingTokens? onboarding,
    ARingCssTokens? aRing,
    Map<String, ALifeStagePalette>? lifeStages,
    bool? lite,
    bool? noBlur,
    bool? arabic,
  }) {
    return AnacanTokens(
      brightness: brightness ?? this.brightness,
      shadcn: shadcn ?? this.shadcn,
      a: a ?? this.a,
      navCapsule: navCapsule ?? this.navCapsule,
      onboarding: onboarding ?? this.onboarding,
      aRing: aRing ?? this.aRing,
      lifeStages: lifeStages ?? this.lifeStages,
      lite: lite ?? this.lite,
      noBlur: noBlur ?? this.noBlur,
      arabic: arabic ?? this.arabic,
    );
  }

  /// The web switches themes by toggling `.dark` (no CSS transition on variables), so snap.
  @override
  AnacanTokens lerp(covariant AnacanTokens? other, double t) => (other == null || t < 0.5) ? this : other;
}
