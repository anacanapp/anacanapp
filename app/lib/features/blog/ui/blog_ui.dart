// Ported from: src/styles/anacan-design.css (.a-tag, .a-tag.on, .a-search, .a-section, .a-section-head,
//              .a-section-title, .a-section-link, .a-article-meta, .a-rank-tag, .a-cta-badge, .a-cta-btn, .a-input),
//              src/components/ads/AdExperienceProvider.tsx (AdSurface / AdInlineAnchor / useAdExit call sites),
//              src/lib/native.ts (nativeShare), src/lib/blog-links.ts (copyBlogLink)
//
// Small widgets of the blog screens and the seams to features that are not ported yet (ads).
import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';

import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show px;

/// `<AdSurface id />`, `<AdInlineAnchor id />` and `useAdExit(placement, onLeave)` of the blog screens (ads, phase 9).
/// Default: no ad, leaving goes back at once.
@immutable
class BlogAdSlots {
  const BlogAdSlots({this.surface, this.inlineAnchor, this.exit});

  /// `<AdSurface id="blog_list_banner" | "blog_article_banner" />`.
  final Widget Function(BuildContext context, String id)? surface;

  /// `<AdInlineAnchor id />`.
  final Widget Function(BuildContext context, String id)? inlineAnchor;

  /// `useAdExit('article_exit_interstitial', onBack)`: may show an interstitial, then calls [onLeave].
  final Future<void> Function(BuildContext context, String placement, VoidCallback onLeave)? exit;
}

final blogAdSlotsProvider = Provider<BlogAdSlots>((ref) => const BlogAdSlots(), name: 'blogAdSlotsProvider');

/// `nativeShare({ title, url })` and `copyBlogLink(url)` (tests override).
class BlogSharePlatform {
  const BlogSharePlatform();
  Future<bool> share({required String title, required String url}) async {
    try {
      await SharePlus.instance.share(ShareParams(title: title, subject: title, uri: Uri.tryParse(url), text: Uri.tryParse(url) == null ? url : null));
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> copy(String value) => Clipboard.setData(ClipboardData(text: value));
}

final blogSharePlatformProvider = Provider<BlogSharePlatform>((ref) => const BlogSharePlatform(), name: 'blogSharePlatformProvider');

/// `.a-tag` (`.on`): pill, padding 7×12, gap 6, 11.5/600, 1px transparent border; on = tag-on bg, peach-2 border,
/// accent ink.
class BlogTag extends StatelessWidget {
  const BlogTag({super.key, required this.children, this.on = false, this.onTap});
  final List<Widget> children;
  final bool on;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final color = on ? a.accentInk : a.inkSoft;
    final body = AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      curve: ACurves.cssEase,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: on ? a.tagOnBg : a.surfaceSoft,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: on ? a.peach2 : const Color(0x00000000)),
      ),
      child: IconTheme.merge(
        data: IconThemeData(color: color, size: 12),
        child: DefaultTextStyle.merge(
          style: px(11.5, weight: FontWeight.w600, color: color),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(width: 6), children[i]],
          ]),
        ),
      ),
    );
    if (onTap == null) return body;
    return Semantics(button: true, selected: on, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: body));
  }
}

/// `.a-section` (margin-top 22) with `.a-section-head` (baseline, space-between, margin-bottom 12).
class BlogSection extends StatelessWidget {
  const BlogSection({super.key, required this.title, this.trailing, required this.child, this.titleSize = 17, this.top = 22});
  final String title;
  final Widget? trailing;
  final Widget child;
  final double titleSize;
  final double top;

  @override
  Widget build(BuildContext context) {
    final x = context.aText;
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(child: Text(title, style: x.aSectionTitle.copyWith(fontSize: titleSize, letterSpacing: -0.02 * titleSize))),
                ?trailing,
              ],
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// `.a-article-meta` item: icon (10) + text, gap 3; items gap 9, 10.5/600 ink-soft.
class BlogMeta extends StatelessWidget {
  const BlogMeta({super.key, required this.items, this.top = 5});
  final List<(AIconData, String)> items;
  final double top;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = px(10.5, weight: FontWeight.w600, color: a.inkSoft);
    return Padding(
      padding: EdgeInsets.only(top: top),
      child: Row(children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(width: 9),
          AIcon(items[i].$1, size: 10, color: a.inkSoft),
          const SizedBox(width: 3),
          Text(items[i].$2, style: style),
        ],
      ]),
    );
  }
}

/// `.a-search`: surface pill, 1px line, card shadow, padding 12×16, gap 10, search icon + borderless 13px input
/// (16px on phones: keyboard.css `max(16px, 1em)` for text inputs below 768px wins over `.a-search input`).
class BlogSearchField extends StatelessWidget {
  const BlogSearchField({super.key, required this.controller, required this.placeholder, required this.onChanged});
  final TextEditingController controller;
  final String placeholder;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = px(MediaQuery.sizeOf(context).width <= 767 ? 16 : 13, color: a.ink);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: a.line), boxShadow: a.cardShadow),
      child: Row(children: [
        AIcon(AIcons.search, size: 15, color: a.inkFaint),
        const SizedBox(width: 10),
        Expanded(
          child: Material(
            type: MaterialType.transparency,
            child: TextField(
              key: const ValueKey('blog-search'),
              controller: controller,
              onChanged: onChanged,
              style: style,
              cursorColor: a.peach2,
              decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
            ),
          ),
        ),
      ]),
    );
  }
}

/// `.a-input` textarea (padding 10×14, radius 12, 1px line-strong, surface, 13px; peach-2 border on focus).
class BlogTextArea extends StatelessWidget {
  const BlogTextArea({super.key, required this.controller, required this.placeholder, this.minHeight = 50, this.enabled = true, this.fontSize = 13, this.onChanged, this.fieldKey});
  final TextEditingController controller;
  final String placeholder;
  final double minHeight;
  final bool enabled;
  final double fontSize;
  final ValueChanged<String>? onChanged;
  final Key? fieldKey;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final style = px(fontSize, color: a.ink);
    Widget box = Container(
      constraints: BoxConstraints(minHeight: minHeight),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: a.lineStrong)),
      child: Material(
        type: MaterialType.transparency,
        child: TextField(
          key: fieldKey,
          controller: controller,
          enabled: enabled,
          onChanged: onChanged,
          minLines: 1,
          maxLines: null,
          style: style,
          cursorColor: a.peach2,
          decoration: InputDecoration(isCollapsed: true, border: InputBorder.none, hintText: placeholder, hintStyle: style.copyWith(color: a.inkFaint)),
        ),
      ),
    );
    if (!enabled) box = Opacity(opacity: 0.6, child: box);
    return box;
  }
}

/// `.a-cta-btn` square send button (peach-2, white icon) with an inline size.
class BlogSendButton extends StatelessWidget {
  const BlogSendButton({super.key, required this.size, this.onTap, this.opacity = 1, this.buttonKey});
  final double size;
  final VoidCallback? onTap;
  final double opacity;
  final Key? buttonKey;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        enabled: onTap != null,
        child: GestureDetector(
          key: buttonKey,
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Opacity(
            opacity: opacity,
            child: Container(
              width: size,
              height: size,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: context.a.peach2, borderRadius: BorderRadius.circular(999)),
              child: const AIcon(AIcons.send, size: 16, color: Color(0xFFFFFFFF)),
            ),
          ),
        ),
      );
}

/// `overflow-y-auto` page body: scrolls itself when it has a bounded height (sub-screen, article overlay); inside
/// the Tools tab (a box in the shell's single scroll view) it lays out in the flow and the shell scrolls it.
class BlogPageScroll extends StatelessWidget {
  const BlogPageScroll({super.key, required this.child, this.controller, this.padding = EdgeInsets.zero, this.scrollKey});
  final Widget child;
  final ScrollController? controller;
  final EdgeInsets padding;
  final Key? scrollKey;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, c) => c.hasBoundedHeight
            ? SingleChildScrollView(key: scrollKey, controller: controller, padding: padding, child: child)
            : Padding(key: scrollKey, padding: padding, child: child),
      );
}

/// `min-h-screen`: the viewport height when the parent does not bound the height.
class BlogMinScreen extends StatelessWidget {
  const BlogMinScreen({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, c) => c.hasBoundedHeight ? child : SizedBox(height: MediaQuery.sizeOf(context).height, child: child),
      );
}

/// Starts [action] without awaiting it (button handlers).
void fireAndForget(Future<void> Function() action) => unawaited(action());
