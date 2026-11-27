// GENERATED — do not edit; run node app/tool/design/gen_tokens.mjs
// ignore_for_file: lines_longer_than_80_chars, constant_identifier_names



/// Counts written by the generator; test/design/tokens_test.dart checks them against the CSS.
abstract final class TokenManifest {
  static const List<String> sources = <String>['src/index.css', 'src/styles/anacan-design.css', 'src/styles/onboarding.css'];
  /// Every `--*` declaration found by postcss in [sources] (including repeats across themes).
  static const int declarationsFound = 277;
  /// Declarations mapped to a token group/theme/variant.
  static const int declarationsMapped = 277;
  /// Declarations whose scope (selector/at-rule) is not mapped — listed in token_report.md.
  static const int declarationsUnmappedScope = 0;
  /// Distinct custom properties per mapped group.
  static const int uniqueTokens = 151;
  /// Tokens emitted as Dart fields (excluding generated `*Inset` companions).
  static const int emittedTokens = 151;
  /// Tokens that could not be converted (value) — listed in token_report.md.
  static const int unconvertedTokens = 0;
  static const Map<String, List<String>> namesByGroup = <String, List<String>>{
    'shadcn': <String>['--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground', '--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--muted', '--muted-foreground', '--accent', '--accent-foreground', '--destructive', '--destructive-foreground', '--border', '--input', '--ring', '--radius', '--flow', '--flow-light', '--flow-dark', '--bump', '--bump-light', '--bump-dark', '--mommy', '--mommy-light', '--mommy-dark', '--partner', '--partner-light', '--partner-dark', '--beige', '--beige-light', '--beige-dark', '--gradient-primary', '--gradient-secondary', '--gradient-flow', '--gradient-bump', '--gradient-mommy', '--gradient-partner', '--gradient-sunset', '--gradient-warm', '--gradient-beige', '--shadow-soft', '--shadow-card', '--shadow-button', '--shadow-glow', '--shadow-elevated', '--sidebar-background', '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground', '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-ring'],
    'a': <String>['--a-bg', '--a-surface', '--a-surface-soft', '--a-ink', '--a-ink-soft', '--a-ink-faint', '--a-on-bg', '--a-on-bg-soft', '--a-on-bg-faint', '--a-line', '--a-line-strong', '--a-peach-1', '--a-peach-2', '--a-pink-1', '--a-pink-2', '--a-lav-1', '--a-lav-2', '--a-blue-1', '--a-blue-2', '--a-green-1', '--a-green-2', '--a-yellow-1', '--a-yellow-2', '--a-grad-peach', '--a-grad-pink', '--a-grad-lav', '--a-grad-blue', '--a-grad-green', '--a-grad-yellow', '--a-grad-cta', '--a-chart-line', '--a-accent-ink', '--a-blue-ink', '--a-pink-ink', '--a-berry-ink', '--a-green-ink', '--a-yellow-ink', '--a-lav-ink', '--a-cta-ink', '--a-chip-overlay', '--a-body-text', '--a-tag-on-bg', '--a-illus-grad', '--a-btn-border', '--a-nav-bg', '--a-nav-border', '--a-disclaimer-bg', '--a-disclaimer-border', '--a-disclaimer-ink', '--a-disclaimer-strong', '--a-alert-bg', '--a-alert-ink', '--a-alert-soft', '--a-warn-ink', '--a-warn-soft', '--a-shadow', '--a-card-shadow', '--a-radius-lg', '--a-radius-md', '--a-radius-sm', '--a-coral', '--a-coral-strong', '--a-coral-text', '--a-coral-soft', '--a-on-coral', '--a-peach-ink', '--a-deep', '--a-on-deep', '--a-ok', '--a-warn', '--a-bad', '--a-nav-solid', '--a-lift-shadow', '--a-coral-shadow', '--a-radius-xl', '--a-ease', '--a-spring', '--a-bounce'],
    'aRing': <String>['--pct'],
    'navCapsule': <String>['--nav-glass', '--nav-glass-edge', '--nav-glass-shadow', '--nav-icon', '--nav-icon-on', '--nav-bubble', '--nav-bubble-shadow'],
    'onboarding': <String>['--onb-bg', '--onb-surface', '--onb-ink', '--onb-muted', '--onb-line', '--onb-soft', '--onb-accent', '--onb-ok'],
  };
}
