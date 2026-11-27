// Ported from: src/index.css (@layer base body / body:lang(ar) / html), tailwind.config.ts (fontFamily),
//              src/styles/anacan-design.css (.a-scope, .a-scope:lang(ar), .a-heading, a-/a3- type rules),
//              Tailwind preflight (html line-height 1.5, headings/buttons inherit font)
import 'package:flutter/material.dart';

import 'tokens/anacan_tokens.dart';

export 'tokens/anacan_tokens.dart';

/// Bundled font families (pubspec.yaml; app/tool/design/fetch_fonts.sh).
abstract final class AFonts {
  static const String nunito = 'Nunito';
  static const String inter = 'Inter';
  static const String notoArabic = 'Noto Sans Arabic';

  /// `body` (`font-nunito`): Nunito, system-ui.
  static const List<String> bodyFallback = <String>[];

  /// `body:lang(ar)`: 'Noto Sans Arabic', 'Nunito', system-ui.
  static const List<String> bodyArabicFallback = <String>[nunito];

  /// `.a-scope`: 'Inter', 'Nunito', ui-sans-serif, system-ui.
  static const List<String> scopeFallback = <String>[nunito];

  /// `.a-scope:lang(ar)`: 'Noto Sans Arabic', 'Inter', 'Nunito', …
  static const List<String> scopeArabicFallback = <String>[inter, nunito];

  static bool isArabic(Locale locale) => locale.languageCode == 'ar';
}

/// CSS letter-spacing in `em` → Flutter logical px.
double em(double value, double fontSize) => value * fontSize;

/// Text styles of the `.a-*` / `.a3-*` classes. Sizes are CSS px (1:1 logical px).
///
/// Colours are only set where the CSS rule sets them; everything else inherits from
/// [AScope]'s [DefaultTextStyle] (`--a-ink`). Line height defaults to Tailwind preflight's
/// inherited `line-height: 1.5` with CSS half-leading ([TextLeadingDistribution.even]).
/// `text-transform: uppercase` rules (a3-eyebrow, a3-tl-date span) must upper-case the
/// string at the call site (`s.toUpperCase()`), Flutter has no text-transform.
class ATextStyles {
  const ATextStyles(this.t);
  final ATokens t;

  static TextStyle _s(double size, FontWeight w, {double? ls, double height = 1.5, Color? color}) => TextStyle(
        fontSize: size,
        fontWeight: w,
        letterSpacing: ls == null ? null : em(ls, size),
        height: height,
        leadingDistribution: TextLeadingDistribution.even,
        color: color,
      );

  // ── a3 (redesign v3) ──
  /// `.a3-wordmark`
  TextStyle get a3Wordmark => _s(22, FontWeight.w800, ls: -0.045, color: t.coral);
  /// `.a3-title`
  TextStyle get a3Title => _s(26, FontWeight.w700, ls: -0.035, color: t.ink);
  /// `.a3-sec-title`
  TextStyle get a3SecTitle => _s(18, FontWeight.w700, ls: -0.025, color: t.ink);
  /// `.a3-link`
  TextStyle get a3Link => _s(14, FontWeight.w600, color: t.coralText);
  /// `.a3-meta`
  TextStyle get a3Meta => _s(12.5, FontWeight.w500, height: 1.35, color: t.inkSoft);
  /// `.a3-eyebrow` (upper-case the string yourself)
  TextStyle get a3Eyebrow => _s(11.5, FontWeight.w700, ls: 0.06, color: t.inkSoft);
  /// `.a3-chip`
  TextStyle get a3Chip => _s(11.5, FontWeight.w600);
  /// `.a3-btn`
  TextStyle get a3Btn => _s(15, FontWeight.w600);
  /// `.a3-btn.sm`
  TextStyle get a3BtnSm => _s(13.5, FontWeight.w600);
  /// `.a3-seg button` (selected: w600)
  TextStyle get a3Seg => _s(13.5, FontWeight.w500);
  /// `.a3-sheet-head h2`
  TextStyle get a3SheetTitle => _s(18, FontWeight.w700, ls: -0.025);
  /// `.a3-hero-line`
  TextStyle get a3HeroLine => _s(17, FontWeight.w600, ls: -0.02);
  /// `.a3-ring .core b` (`.core` sets line-height 1)
  TextStyle get a3RingValue => _s(44, FontWeight.w800, ls: -0.05, height: 1);
  /// `.a3-ring .core span`
  TextStyle get a3RingLabel => _s(12, FontWeight.w600, height: 1, color: t.inkSoft);
  /// `.a3-tk b`
  TextStyle get a3TkValue => _s(19, FontWeight.w700, ls: -0.03, height: 1.05);
  /// `.a3-tk .lbl`
  TextStyle get a3TkLabel => _s(12, FontWeight.w500, ls: -0.01, height: 1.2, color: t.inkSoft);
  /// `.a3-stats b`
  TextStyle get a3StatValue => _s(16, FontWeight.w700, ls: -0.02);
  /// `.a3-stats span`
  TextStyle get a3StatLabel => _s(11.5, FontWeight.w500, color: t.inkSoft);
  /// `.a3-count`
  TextStyle get a3Count => _s(10.5, FontWeight.w700, color: const Color(0xFFFFFFFF));
  /// `.a3-field > span`
  TextStyle get a3FieldLabel => _s(13, FontWeight.w600, color: t.inkSoft);
  /// `.a3-field input` (16px keeps iOS from zooming on web; kept for parity)
  TextStyle get a3FieldInput => _s(16, FontWeight.w400, color: t.ink);

  // ── a- (redesign v1/v2) ──
  /// `.a-heading` modifier: weight 700, letter-spacing -0.02em.
  TextStyle heading(TextStyle base) =>
      base.copyWith(fontWeight: FontWeight.w700, letterSpacing: em(-0.02, base.fontSize ?? 16));
  /// `.a-section-title.a-heading`
  TextStyle get aSectionTitle => heading(_s(17, FontWeight.w400, color: t.onBg));
  /// `.a-section-link`
  TextStyle get aSectionLink => _s(12, FontWeight.w700, color: t.onBgSoft);
  /// `.a-card-title`
  TextStyle get aCardTitle => _s(14.5, FontWeight.w700, color: t.ink);
  /// `.a-list-title`
  TextStyle get aListTitle => _s(13.5, FontWeight.w700, color: t.ink);
  /// `.a-list-sub`
  TextStyle get aListSub => _s(11.5, FontWeight.w500, color: t.inkSoft);
  /// `.a-list-value`
  TextStyle get aListValue => _s(11, FontWeight.w700, color: t.inkSoft);
  /// `.a-list-time`
  TextStyle get aListTime => _s(10, FontWeight.w600, color: t.inkFaint);
  /// `.a-cta-badge`
  TextStyle get aCtaBadge => _s(11, FontWeight.w800, ls: 0.03, color: t.accentInk);
  /// `.a-cta-title.a-heading`
  TextStyle get aCtaTitle => heading(_s(20, FontWeight.w400, color: t.ink));
  /// `.a-cta-text`
  TextStyle get aCtaText => _s(13, FontWeight.w400, height: 1.7, color: t.bodyText);
  /// `.a-cta-btn`
  TextStyle get aCtaBtn => _s(12.5, FontWeight.w700, color: const Color(0xFFFFFFFF));
  /// `.a-btn-soft` / `.a-btn-solid`
  TextStyle get aPillBtn => _s(12, FontWeight.w700);
  /// `.a-tab`
  TextStyle get aTab => _s(11.5, FontWeight.w700);
  /// `.a-tool-tab` (line-height 1)
  TextStyle get aToolTab => _s(12.5, FontWeight.w700, height: 1);
  /// `.a-ring-inner b`
  TextStyle get aRingValue => _s(19, FontWeight.w800, height: 1, color: t.ink);
  /// `.a-ring-inner span`
  TextStyle get aRingLabel => _s(9.5, FontWeight.w700, color: t.inkSoft);
}

/// `.a-scope`: switches the subtree to Inter (Noto Sans Arabic first for `ar`) and `--a-ink`.
///
/// Everything outside an [AScope] uses the body defaults from [buildAnacanTheme] (Nunito,
/// `hsl(var(--foreground))`), exactly like markup without the `a-scope` class.
class AScope extends StatelessWidget {
  const AScope({super.key, required this.child});
  final Widget child;

  static TextStyle scopeStyle(AnacanTokens tokens) => TextStyle(
        fontFamily: tokens.arabic ? AFonts.notoArabic : AFonts.inter,
        fontFamilyFallback: tokens.arabic ? AFonts.scopeArabicFallback : AFonts.scopeFallback,
        color: tokens.a.ink,
      );

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    return DefaultTextStyle.merge(
      style: scopeStyle(tokens),
      child: IconTheme.merge(
        data: IconThemeData(color: tokens.a.ink),
        child: child,
      ),
    );
  }
}

/// Convenience accessors.
extension AnacanThemeContext on BuildContext {
  AnacanTokens get tokens => AnacanTokens.of(this);
  ATokens get a => AnacanTokens.of(this).a;
  ATextStyles get aText => ATextStyles(AnacanTokens.of(this).a);
}

/// ThemeData whose defaults match the web `body`:
/// `bg-background text-foreground font-nunito`, 16px, preflight `line-height: 1.5`.
ThemeData buildAnacanTheme(
  Brightness brightness, {
  required Locale locale,
  required bool lite,
  bool noBlur = false,
}) {
  final arabic = AFonts.isArabic(locale);
  final tokens = AnacanTokens.resolve(brightness, lite: lite, noBlur: noBlur, arabic: arabic);
  final s = tokens.shadcn;
  final family = arabic ? AFonts.notoArabic : AFonts.nunito;
  final fallback = arabic ? AFonts.bodyArabicFallback : AFonts.bodyFallback;

  final body = TextStyle(
    fontFamily: family,
    fontFamilyFallback: fallback,
    fontSize: 16,
    height: 1.5,
    leadingDistribution: TextLeadingDistribution.even,
    color: s.foreground,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
  );
  // Preflight: h1–h6, p, button, input all inherit size/weight from the body.
  final textTheme = TextTheme(
    displayLarge: body,
    displayMedium: body,
    displaySmall: body,
    headlineLarge: body,
    headlineMedium: body,
    headlineSmall: body,
    titleLarge: body,
    titleMedium: body,
    titleSmall: body,
    bodyLarge: body,
    bodyMedium: body,
    bodySmall: body,
    labelLarge: body,
    labelMedium: body,
    labelSmall: body,
  );

  final scheme = ColorScheme(
    brightness: brightness,
    primary: s.primary,
    onPrimary: s.primaryForeground,
    secondary: s.secondary,
    onSecondary: s.secondaryForeground,
    error: s.destructive,
    onError: s.destructiveForeground,
    surface: s.card,
    onSurface: s.cardForeground,
    surfaceContainerHighest: s.muted,
    onSurfaceVariant: s.mutedForeground,
    outline: s.border,
    outlineVariant: s.input,
    tertiary: s.accent,
    onTertiary: s.accentForeground,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: s.background,
    canvasColor: s.background,
    fontFamily: family,
    fontFamilyFallback: fallback,
    textTheme: textTheme,
    primaryTextTheme: textTheme,
    dividerColor: s.border,
    // `-webkit-tap-highlight-color: transparent`, no ripples on the web.
    splashFactory: NoSplash.splashFactory,
    splashColor: Colors.transparent,
    highlightColor: Colors.transparent,
    hoverColor: Colors.transparent,
    iconTheme: IconThemeData(color: s.foreground, size: 24),
    textSelectionTheme: TextSelectionThemeData(cursorColor: s.primary),
    extensions: <ThemeExtension<dynamic>>[tokens],
  );
}
