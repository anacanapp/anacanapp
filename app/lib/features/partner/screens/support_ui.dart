// Ported from: the shared pieces of src/components/partner/v2/PostpartumSupportScreen.tsx and
//              src/components/pregnancy-loss/PartnerLossSupportScreen.tsx (low-mood note, tab chips, bullet lists,
//              one-tap phrase rows with the send `.a-icon-btn`, the `tel:` emergency link)
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../../shell/shell_inputs.dart' show shellPlatformProvider;
import '../ui/partner_ui.dart';

/// The pink "she has had a hard week" note (`lowDays >= 3`).
class SupportLowMoodNote extends StatelessWidget {
  const SupportLowMoodNote({super.key, required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      key: const ValueKey('support-low-mood'),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(color: a.pink1, borderRadius: BorderRadius.circular(16)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(top: 2), child: AIcon(AIcons.heart, size: 16, color: a.pinkInk)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: pText(13, weight: FontWeight.w800, color: a.pinkInk)),
            Text(body, style: pText(12, color: a.pinkInk)),
          ]),
        ),
      ]),
    );
  }
}

enum SupportTabStyle {
  /// PostpartumSupportScreen: selected `--a-ink` / `--a-surface`, else surface / ink.
  ink,

  /// `.loss-chip`: surface / ink, selected `--loss-accent` / white.
  loss,
}

/// The `role="tablist"` chip row (scrolls horizontally).
class SupportTabs extends StatelessWidget {
  const SupportTabs({super.key, required this.tabs, required this.selected, required this.onChanged, required this.style, this.keyPrefix = 'tab', this.accent});
  final List<(String, String)> tabs;
  final String selected;
  final ValueChanged<String> onChanged;
  final SupportTabStyle style;
  final String keyPrefix;

  /// `--loss-accent` for [SupportTabStyle.loss].
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        for (final (i, tab) in tabs.indexed) ...[
          if (i > 0) const SizedBox(width: 6),
          () {
            final on = tab.$1 == selected;
            final (bg, fg) = switch (style) {
              SupportTabStyle.ink => on ? (a.ink, a.surface) : (a.surface, a.ink),
              SupportTabStyle.loss => on ? (accent ?? a.lav2, const Color(0xFFFFFFFF)) : (a.surface, a.ink),
            };
            return Semantics(
              selected: on,
              button: true,
              child: GestureDetector(
                key: ValueKey('$keyPrefix-${tab.$1}'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(tab.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
                  child: Text(tab.$2, style: pText(12.5, weight: FontWeight.w800, color: fg)),
                ),
              ),
            );
          }(),
        ],
      ]),
    );
  }
}

/// `<ul>` of `•` bullets (`space-y-1.5`).
class SupportBullets extends StatelessWidget {
  const SupportBullets({super.key, required this.items, required this.style, required this.dotColor});
  final List<String> items;
  final TextStyle style;
  final Color dotColor;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        for (final (i, item) in items.indexed) ...[
          if (i > 0) const SizedBox(height: 6),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            ExcludeSemantics(child: Text('•', style: style.copyWith(color: dotColor))),
            const SizedBox(width: 8),
            Expanded(child: Text(item, style: style)),
          ]),
        ],
      ]);
}

/// A phrase with the 34px send `.a-icon-btn` (check once sent).
class SupportPhraseRow extends StatelessWidget {
  const SupportPhraseRow({super.key, required this.text, required this.sent, required this.disabled, required this.sendLabel, required this.onSend, this.background});
  final String text;
  final bool sent;
  final bool disabled;
  final String sendLabel;
  final VoidCallback onSend;
  final Color? background;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsetsDirectional.fromSTEB(13, 9, 10, 9),
      decoration: BoxDecoration(color: background ?? a.surfaceSoft, borderRadius: BorderRadius.circular(14)),
      child: Row(children: [
        Expanded(child: Text(text, style: pText(13, weight: FontWeight.w600, color: a.ink))),
        const SizedBox(width: 8),
        Semantics(
          button: true,
          enabled: !disabled,
          label: sendLabel,
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: disabled ? null : onSend,
            child: Opacity(
              opacity: disabled ? 0.5 : 1,
              child: Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: a.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: a.btnBorder),
                  // 0 6px 14px -8px rgba(217, 108, 74, .35) (.a-icon-btn)
                  boxShadow: const [BoxShadow(color: Color(0x59D96C4A), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
                ),
                child: AIcon(sent ? AIcons.check : AIcons.send, size: sent ? 15 : 14, color: a.ink),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

/// `<a href="tel:<number>">`: opens the dialer.
class SupportCallButton extends ConsumerWidget {
  const SupportCallButton({super.key, required this.number, required this.label, this.inline = false});
  final String number;
  final String label;

  /// The loss checker's inline pill (`--a-alert-ink` background) instead of the full-width `.a-btn-solid`.
  final bool inline;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    const white = Color(0xFFFFFFFF);
    final button = Container(
      padding: inline ? const EdgeInsets.symmetric(horizontal: 16, vertical: 9) : const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(color: inline ? a.alertInk : a.peach2, borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: inline ? MainAxisSize.min : MainAxisSize.max, mainAxisAlignment: MainAxisAlignment.center, children: [
        AIcon(AIcons.phone, size: inline ? 15 : 16, color: white),
        SizedBox(width: inline ? 8 : 6),
        Text(label, style: pText(inline ? 13.5 : 12, weight: inline ? FontWeight.w800 : FontWeight.w700, color: white)),
      ]),
    );
    return Semantics(
      link: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => unawaited(ref.read(shellPlatformProvider).openExternalUrl(Uri(scheme: 'tel', path: number))),
        child: inline ? Align(alignment: AlignmentDirectional.centerStart, child: button) : button,
      ),
    );
  }
}
