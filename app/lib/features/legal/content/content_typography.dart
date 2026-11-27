// Ported from: src/components/MarkdownContent.tsx (element classes), src/components/ui/HtmlContent.tsx (`[&_x]:…`
//              classes), src/lib/legalProse.ts (LEGAL_PROSE_CLASS overrides)
//
// Typography of rendered rich text. Note: the React wrappers carry `prose prose-sm` classes, but
// tailwind.config.ts does not register @tailwindcss/typography, so those classes are inert — only the explicit
// utility classes listed per element apply (preflight resets margins/list styles otherwise).
import 'package:flutter/widgets.dart';

import '../../../design/design.dart';

/// Which React renderer the content mimics.
enum ContentVariant {
  /// MarkdownContent `variant="default"` / `"blog"` (no wrapper typography; inherits the parent text style).
  markdown,

  /// MarkdownContent `variant="chat"` (`text-sm leading-relaxed`).
  chat,

  /// HtmlContent (rich-text editor output: bigger headings, relaxed paragraphs).
  html,
}

/// Per-element text sizes; colours come from the theme. Values are Tailwind sizes (px, line height px).
class ContentTypography {
  const ContentTypography({
    required this.h1,
    required this.h2,
    required this.h3,
    this.p,
    this.li = const (14, 20),
    this.h1Margin = const (16, 8),
    this.h2Margin = const (12, 8),
    this.h3Margin = const (8, 4),
    this.pMargin = 6,
    this.pRelaxed = false,
    this.listMargin = 8,
    this.listIndent = 16,
  });

  /// (font size, line height) — h1 is also bold (700), h3 semibold (600) per the React classes.
  final (double, double) h1;
  final (double, double) h2;
  final (double, double) h3;

  /// Paragraph size; null inherits the parent (MarkdownContent `<p className="my-1.5">`).
  final (double, double)? p;
  final (double, double) li;

  /// (top, bottom) margins.
  final (double, double) h1Margin;
  final (double, double) h2Margin;
  final (double, double) h3Margin;
  final double pMargin;

  /// `leading-relaxed` (1.625) on paragraphs (HtmlContent).
  final bool pRelaxed;
  final double listMargin;
  final double listIndent;

  /// MarkdownContent: `text-xl` / `text-lg` / `text-base`, `ps-4`, `my-1.5`.
  static const ContentTypography markdown = ContentTypography(h1: (20, 28), h2: (18, 28), h3: (16, 24));

  /// HtmlContent: `text-2xl mt-6 mb-3` / `text-xl mt-5 mb-2` / `text-lg mt-4 mb-2`, `p my-2 leading-relaxed`,
  /// `ul ps-5 my-3`.
  static const ContentTypography html = ContentTypography(
    h1: (24, 32),
    h2: (20, 28),
    h3: (18, 28),
    h1Margin: (24, 12),
    h2Margin: (20, 8),
    h3Margin: (16, 8),
    pMargin: 8,
    pRelaxed: true,
    listMargin: 12,
    listIndent: 20,
  );

  /// LEGAL_PROSE_CLASS overrides (`[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm`),
  /// applied on top of [base].
  static ContentTypography legal(ContentTypography base) => ContentTypography(
        h1: (18, 28),
        h2: (16, 24),
        h3: (14, 20),
        p: (14, 20),
        li: (14, 20),
        h1Margin: base.h1Margin,
        h2Margin: base.h2Margin,
        h3Margin: base.h3Margin,
        pMargin: base.pMargin,
        pRelaxed: base.pRelaxed,
        listMargin: base.listMargin,
        listIndent: base.listIndent,
      );
}

/// Resolved colours (shadcn: `text-foreground`, `text-primary`, `text-muted-foreground`, `bg-muted`, `border-border`).
class ContentColors {
  const ContentColors({required this.foreground, required this.primary, required this.muted, required this.mutedBg, required this.border});
  final Color foreground;
  final Color primary;
  final Color muted;
  final Color mutedBg;
  final Color border;

  factory ContentColors.of(BuildContext context) {
    final s = AnacanTokens.of(context).shadcn;
    return ContentColors(foreground: s.foreground, primary: s.primary, muted: s.mutedForeground, mutedBg: s.muted, border: s.border);
  }
}

TextStyle sizeStyle((double, double) s, {FontWeight? weight, Color? color}) =>
    TextStyle(fontSize: s.$1, height: s.$2 / s.$1, fontWeight: weight, color: color, leadingDistribution: TextLeadingDistribution.even);
