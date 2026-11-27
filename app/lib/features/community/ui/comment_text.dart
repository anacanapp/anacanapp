// Ported from: src/components/community/CommentText.tsx, src/lib/in-app-links.ts (inAppDeeplink, openInAppDeeplink),
//              src/lib/blog-links.ts (openAppBlog)
//
// User text stays plain text; only links become tappable: app blog links open the in-app article, app links the
// router knows open in the app, staff-authored (allowLinks) http(s) links open in the browser.
import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../design/design.dart';
import '../../../shell/links/blog_links.dart';
import '../../../shell/links/deeplink.dart';
import '../../../shell/links/js_url.dart';
import '../../../shell/nav/shell_controller.dart';

/// Where tapped links go (`openAppBlog`, `openInAppDeeplink`, `<a target="_blank">`).
class CommunityLinkOpener {
  const CommunityLinkOpener({required this.openBlog, required this.openDeeplink, required this.openExternal});
  final void Function(String href) openBlog;
  final void Function(ParsedDeeplink parsed) openDeeplink;
  final void Function(String href) openExternal;
}

final communityLinkOpenerProvider = Provider<CommunityLinkOpener>((ref) => CommunityLinkOpener(
      openBlog: (href) => ref.read(shellProvider.notifier).openAppBlogLink(href),
      openDeeplink: (parsed) => ref.read(shellProvider.notifier).applyDeeplink(parsed),
      openExternal: (href) =>
          unawaited(launchUrl(Uri.parse(href), mode: LaunchMode.externalApplication).then((_) {}, onError: (Object _) {})),
    ));

/// `inAppDeeplink(href)`: the in-app route of an app link (`anacan://…`, `https://app.anacan.az/…`), else null.
ParsedDeeplink? inAppDeeplink(String href) {
  final url = JsUrl.parse(href);
  if (url == null || url.username.isNotEmpty || url.password.isNotEmpty || url.port.isNotEmpty) return null;
  final ours = url.protocol == 'anacan:' || (url.protocol == 'https:' && url.origin == 'https://app.anacan.az');
  return ours ? parseDeeplink(url.href) : null;
}

enum CommentLinkKind { text, blog, inApp, external }

/// One rendered piece of a comment: plain text, or a link ([text] shown, [href] target) followed by [trail].
class CommentSegment {
  const CommentSegment.text(this.text)
      : kind = CommentLinkKind.text,
        href = null,
        trail = '',
        deeplink = null;
  const CommentSegment.link(this.kind, this.text, this.href, this.trail, [this.deeplink]);
  final CommentLinkKind kind;
  final String text;
  final String? href;
  final String trail;
  final ParsedDeeplink? deeplink;
}

final RegExp _split = RegExp(r'((?:https?:\/\/|anacan:\/\/|www\.)[^\s<>]+)', caseSensitive: false);
final RegExp _start = RegExp(r'^(?:https?:\/\/|anacan:\/\/|www\.)', caseSensitive: false);

/// The segments of `<CommentText content allowLinks />`.
List<CommentSegment> commentSegments(String content, {required bool allowLinks}) {
  final out = <CommentSegment>[];
  var last = 0;
  for (final match in _split.allMatches(content)) {
    if (match.start > last) out.add(CommentSegment.text(content.substring(last, match.start)));
    last = match.end;
    final chunk = match[0]!;
    if (!_start.hasMatch(chunk)) {
      out.add(CommentSegment.text(chunk));
      continue;
    }
    final trailing = RegExp(r'^(.*?)([.,!?;:)\]}]*)$', dotAll: true).firstMatch(chunk)!;
    final text = trailing[1]!;
    final trail = trailing[2]!;
    final url = JsUrl.parse(RegExp(r'^www\.', caseSensitive: false).hasMatch(text) ? 'https://$text' : text);
    if (url == null) {
      out.add(CommentSegment.text(chunk));
      continue;
    }
    if (appBlogSlug(url.href) != null) {
      out.add(CommentSegment.link(CommentLinkKind.blog, text, url.href, trail));
      continue;
    }
    if (!allowLinks && !isWebsiteBlogLink(url.href)) {
      out.add(CommentSegment.text(chunk));
      continue;
    }
    final inApp = inAppDeeplink(url.href);
    if (inApp != null) {
      out.add(CommentSegment.link(CommentLinkKind.inApp, text, url.href, trail, inApp));
      continue;
    }
    if (!(url.protocol == 'http:' || url.protocol == 'https:') || url.username.isNotEmpty || url.password.isNotEmpty) {
      out.add(CommentSegment.text(chunk));
      continue;
    }
    out.add(CommentSegment.link(CommentLinkKind.external, text, url.href, trail));
  }
  if (last < content.length) out.add(CommentSegment.text(content.substring(last)));
  return out;
}

/// `<CommentText content allowLinks />` as inline spans (the caller provides the surrounding text style).
class CommentText extends ConsumerStatefulWidget {
  const CommentText({super.key, required this.content, required this.allowLinks, this.style, this.prefix = const []});
  final String content;
  final bool allowLinks;
  final TextStyle? style;

  /// Spans rendered before the content (`@Name ` mentions).
  final List<InlineSpan> prefix;

  @override
  ConsumerState<CommentText> createState() => _CommentTextState();
}

class _CommentTextState extends ConsumerState<CommentText> {
  final List<TapGestureRecognizer> _recognizers = [];

  void _dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _dispose();
    final opener = ref.watch(communityLinkOpenerProvider);
    final linkStyle = TextStyle(color: context.tokens.shadcn.primary, decoration: TextDecoration.underline);
    final spans = <InlineSpan>[...widget.prefix];
    for (final s in commentSegments(widget.content, allowLinks: widget.allowLinks)) {
      if (s.kind == CommentLinkKind.text) {
        spans.add(TextSpan(text: s.text));
        continue;
      }
      final recognizer = TapGestureRecognizer()
        ..onTap = () => switch (s.kind) {
              CommentLinkKind.blog => opener.openBlog(s.href!),
              CommentLinkKind.inApp => opener.openDeeplink(s.deeplink!),
              _ => opener.openExternal(s.href!),
            };
      _recognizers.add(recognizer);
      spans.add(TextSpan(text: s.text, style: linkStyle, recognizer: recognizer, semanticsLabel: s.text));
      if (s.trail.isNotEmpty) spans.add(TextSpan(text: s.trail));
    }
    return Text.rich(TextSpan(children: spans), style: widget.style);
  }
}

/// [chatTextBuilderProvider] override: ConversationScreen renders message text as `<CommentText allowLinks />`.
Widget communityChatTextBuilder(BuildContext context, String content, TextStyle style) =>
    CommentText(content: content, allowLinks: true, style: style);
