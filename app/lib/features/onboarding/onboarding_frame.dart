// Ported from: src/components/onboarding/OnboardingFrame.tsx, src/styles/onboarding.css
//
// `.onboarding` scope: its own palette (`--onb-*` → OnboardingTokens), Inter 15px / 1.55, max width 480,
// header (back or brand mark, progress bar, n/total), scrolling content and an optional bordered footer.
// The content scroll resets to the top and the heading takes focus on every step change.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import 'onboarding_i18n.dart';

/// onboarding.css values that are not tokens.
abstract final class OnbStyle {
  /// `.onb-primary` text colour (`color: #302624`, onboarding.css).
  static const Color primaryInk = Color(0xFF302624);

  /// `.onb-error` border (`#b54b51`, onboarding.css).
  static const Color errorBorder = Color(0xFFB54B51);

  /// `--onb-*` palette of the current theme.
  static OnboardingTokens of(BuildContext context) => AnacanTokens.of(context).onboarding;

  /// `.onboarding` base text: Inter (Noto Sans Arabic for ar), 15px, line-height 1.55.
  static TextStyle base(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    return TextStyle(
      fontFamily: tokens.arabic ? AFonts.notoArabic : AFonts.inter,
      fontFamilyFallback: tokens.arabic ? const [AFonts.inter] : const <String>[],
      fontSize: 15,
      height: 1.55,
      leadingDistribution: TextLeadingDistribution.even,
      color: tokens.onboarding.ink,
      fontWeight: FontWeight.w400,
    );
  }

  /// `h1`: clamp(22px, 6vw, 28px) / 850 / -.035em / 1.23.
  static TextStyle h1(BuildContext context, {double vw = 6, double max = 28}) {
    final width = MediaQuery.sizeOf(context).width;
    final size = (width * vw / 100).clamp(22.0, max);
    return TextStyle(fontSize: size, fontWeight: FontWeight.w800, letterSpacing: em(-0.035, size), height: 1.23, color: of(context).ink);
  }

  /// `.onb-sub`.
  static TextStyle sub(BuildContext context) => TextStyle(fontSize: 14, height: 1.7, color: of(context).muted);

  /// `.onb-note`.
  static TextStyle note(BuildContext context) => TextStyle(fontSize: 11, height: 1.7, color: of(context).muted);

  /// `@media (max-width: 360px)`.
  static bool narrow(BuildContext context) => MediaQuery.sizeOf(context).width <= 360;

  /// `@media (max-height: 700px)`.
  static bool short(BuildContext context) => MediaQuery.sizeOf(context).height <= 700;

  static double inline(BuildContext context) => narrow(context) ? 18 : 24;
}

/// `.onb-spinner` (lucide Loader2, 1 s linear rotation).
class OnbSpinner extends StatefulWidget {
  const OnbSpinner({super.key, this.size = 18, this.color});
  final double size;
  final Color? color;
  @override
  State<OnbSpinner> createState() => _OnbSpinnerState();
}

class _OnbSpinnerState extends State<OnbSpinner> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (animationsDisabled(context)) {
      _c.stop();
    } else if (!_c.isAnimating) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      RotationTransition(turns: _c, child: AIcon(AIcons.loaderCircle, size: widget.size, color: widget.color));
}

/// `OnboardingButton`: `.onb-primary` / `.onb-secondary`.
class OnboardingButton extends StatelessWidget {
  const OnboardingButton({super.key, required this.label, required this.onPressed, this.disabled = false, this.busy = false, this.secondary = false, this.testId});
  final String label;
  final VoidCallback onPressed;
  final bool disabled;
  final bool busy;
  final bool secondary;

  /// `data-testid` (kept as the widget key for tests).
  final String? testId;

  @override
  Widget build(BuildContext context) {
    final t = OnbStyle.of(context);
    final off = disabled || busy;
    final fg = secondary ? t.ink : OnbStyle.primaryInk;
    Widget body = Container(
      width: double.infinity,
      constraints: BoxConstraints(minHeight: secondary ? 46 : 52),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
      decoration: BoxDecoration(color: secondary ? null : t.accent, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (busy) ...[OnbSpinner(color: fg), const SizedBox(width: 8)],
          Flexible(
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: secondary ? 13 : 15, fontWeight: FontWeight.w800, color: fg, height: 1.55),
            ),
          ),
        ],
      ),
    );
    if (off) body = Opacity(opacity: 0.5, child: body);
    return Semantics(
      key: testId == null ? null : ValueKey(testId),
      button: true,
      enabled: !off,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: off ? null : onPressed, child: body),
    );
  }
}

/// `OnboardingFrame`.
class OnboardingFrame extends ConsumerStatefulWidget {
  const OnboardingFrame({
    super.key,
    required this.language,
    required this.step,
    required this.child,
    this.footer,
    this.current = 0,
    this.total = 0,
    this.onBack,
    this.busy = false,
  });
  final String language;

  /// `data-onboarding-step`.
  final String step;
  final Widget child;
  final Widget? footer;
  final int current;
  final int total;
  final VoidCallback? onBack;
  final bool busy;

  @override
  ConsumerState<OnboardingFrame> createState() => _OnboardingFrameState();
}

class _OnboardingFrameState extends ConsumerState<OnboardingFrame> {
  final ScrollController _scroll = ScrollController();

  @override
  void didUpdateWidget(OnboardingFrame old) {
    super.didUpdateWidget(old);
    if (old.step != widget.step && _scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = OnbStyle.of(context);
    final padding = MediaQuery.paddingOf(context);
    final inline = OnbStyle.inline(context);
    final rtl = widget.language == 'ar';
    final paywallStep = widget.step == 'paywall' || widget.step == 'offer';
    final header = Container(
      constraints: const BoxConstraints(minHeight: 60),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          if (widget.onBack != null)
            Semantics(
              button: true,
              label: onboardingText(widget.language, 'back'),
              child: GestureDetector(
                onTap: widget.busy ? null : widget.onBack,
                behavior: HitTestBehavior.opaque,
                child: Opacity(
                  opacity: widget.busy ? 0.5 : 1,
                  child: SizedBox(width: 44, height: 44, child: Center(child: AIcon(AIcons.arrowLeft, size: 21, color: t.ink, mirrorInRtl: true))),
                ),
              ),
            )
          else
            Image.asset('assets/images/brand-mark.png', width: 44, height: 44, fit: BoxFit.contain, semanticLabel: 'Anacan'),
          if (widget.total > 0) ...[
            const SizedBox(width: 14),
            Expanded(
              child: Semantics(
                label: onboardingText(widget.language, 'step', {
                  'current': onboardingNumber(widget.language, widget.current),
                  'total': onboardingNumber(widget.language, widget.total),
                }),
                value: '${widget.current}/${widget.total}',
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    height: 5,
                    color: t.line,
                    alignment: AlignmentDirectional.centerStart,
                    child: AnimatedFractionallySizedBox(
                      key: const ValueKey('onb-progress'),
                      duration: animationsDisabled(context) ? Duration.zero : const Duration(milliseconds: 250),
                      curve: ACurves.cssEase,
                      widthFactor: (widget.current / widget.total).clamp(0.0, 1.0),
                      child: Container(decoration: BoxDecoration(color: t.accent, borderRadius: BorderRadius.circular(20))),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Text(
              '${onboardingNumber(widget.language, widget.current)}/${onboardingNumber(widget.language, widget.total)}',
              style: TextStyle(fontSize: 11, color: t.muted, fontFeatures: const [FontFeature.tabularFigures()]),
            ),
          ],
        ],
      ),
    );
    final content = Expanded(
      child: SingleChildScrollView(
        key: ValueKey('onb-content-${widget.step}'),
        controller: _scroll,
        padding: EdgeInsetsDirectional.fromSTEB(inline, 0, inline, paywallStep ? (padding.bottom > 16 ? padding.bottom : 16) : 20),
        child: widget.child,
      ),
    );
    final footer = widget.footer == null
        ? null
        : Container(
            decoration: BoxDecoration(color: t.surface, border: Border(top: BorderSide(color: t.line))),
            padding: EdgeInsetsDirectional.fromSTEB(inline, 12, inline, padding.bottom > 16 ? padding.bottom : 16),
            child: widget.footer,
          );
    return Directionality(
      textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
      child: Material(
        type: MaterialType.canvas,
        color: t.surface,
        child: DefaultTextStyle(
          style: OnbStyle.base(context),
          child: Padding(
            padding: EdgeInsets.only(top: padding.top),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 480),
                child: Column(
                  key: ValueKey('onboarding-step-${widget.step}'),
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [header, content, ?footer],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// `<h1>` + optional `.onb-sub`.
class OnbTitle extends StatelessWidget {
  const OnbTitle(this.heading, {super.key, this.subtitle, this.summary = false});
  final String heading;
  final String? subtitle;

  /// Inside `.onb-summary-heading` (clamp(22, 5.8vw, 25), margin 0 0 7; sub 13/1.55, margin 0).
  final bool summary;

  @override
  Widget build(BuildContext context) {
    final style = summary ? OnbStyle.h1(context, vw: 5.8, max: 25) : OnbStyle.h1(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.only(top: summary ? 0 : 4, bottom: summary ? 7 : 10),
          child: Semantics(header: true, child: Text(heading, style: style)),
        ),
        if (subtitle != null)
          Padding(
            padding: EdgeInsets.only(bottom: summary ? 0 : 20),
            child: Text(subtitle!, style: summary ? OnbStyle.sub(context).copyWith(fontSize: 13, height: 1.55) : OnbStyle.sub(context)),
          ),
      ],
    );
  }
}

/// `.onb-list` with check icons (`--onb-ok`, 19px).
class OnbCheckList extends StatelessWidget {
  const OnbCheckList(this.items, {super.key, this.done, this.iconSize = 19, this.muted = false});
  final List<String> items;

  /// `.onb-save-steps li[data-done]`: done items in ink, others muted.
  final List<bool>? done;
  final double iconSize;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final t = OnbStyle.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(padding: const EdgeInsets.only(top: 3), child: AIcon(AIcons.check, size: iconSize, color: t.ok)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(items[i],
                      style: TextStyle(fontSize: 14, color: done == null ? t.ink : (done![i] ? t.ink : t.muted))),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// `.onb-note` paragraph.
class OnbNote extends StatelessWidget {
  const OnbNote(this.text, {super.key, this.tight = false});
  final String text;

  /// `.onb-payment-disclosure .onb-note` (line-height 1.5, margin 6).
  final bool tight;
  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.symmetric(vertical: tight ? 6 : 10),
        child: Text(text, textAlign: TextAlign.center, style: OnbStyle.note(context).copyWith(height: tight ? 1.5 : 1.7)),
      );
}

/// `.onb-feedback`.
class OnbFeedback extends StatelessWidget {
  const OnbFeedback(this.text, {super.key, this.compact = false});
  final String text;

  /// `.onb-paywall .onb-feedback` (padding 10 12).
  final bool compact;
  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: OnbStyle.of(context).soft, borderRadius: BorderRadius.circular(14)),
        padding: compact ? const EdgeInsets.symmetric(horizontal: 12, vertical: 10) : const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
        child: Text(text, style: const TextStyle(fontSize: 13)),
      );
}

/// `.onb-error` (role=alert).
class OnbError extends StatelessWidget {
  const OnbError(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: true,
        child: Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: OnbStyle.of(context).soft,
            border: Border.all(color: OnbStyle.errorBorder),
            borderRadius: BorderRadius.circular(13),
          ),
          child: Text(text, style: const TextStyle(fontSize: 13)),
        ),
      );
}

/// `.onb-legal` link row.
class OnbLegalLinks extends StatelessWidget {
  const OnbLegalLinks({super.key, required this.links, this.disabled = false});
  final List<(String label, VoidCallback onTap)> links;
  final bool disabled;
  @override
  Widget build(BuildContext context) => Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 18,
        runSpacing: 6,
        children: [
          for (final (label, onTap) in links)
            Semantics(
              button: true,
              enabled: !disabled,
              label: label,
              excludeSemantics: true,
              child: GestureDetector(
                onTap: disabled ? null : onTap,
                behavior: HitTestBehavior.opaque,
                child: Opacity(
                  opacity: disabled ? 0.5 : 1,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 44),
                    child: Center(
                      widthFactor: 1,
                      child: Text(label, style: const TextStyle(fontSize: 12, decoration: TextDecoration.underline)),
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
}

/// `currentLanguage()` for widgets that are not given one.
String onboardingLanguageOf(WidgetRef ref) => ref.watch(appLanguageProvider);
