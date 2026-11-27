// Ported from: src/hooks/useChatChrome.ts (useFullScreenChat), src/components/ui/avatar.tsx (Avatar,
//              AvatarImage, AvatarFallback), src/styles/chat.css (.chat-icon-button, .chat-notice, .chat-empty),
//              src/components/community/CommentText.tsx (default text slot), src/components/moderation/
//              RestrictionNote.tsx (default note slot), src/components/PhotoGalleryViewer.tsx (default viewer slot)
//
// Small building blocks of the chat screens and the seams to features that are not ported yet (see README.md).
import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/links/blog_links.dart' show appBlogSlug;
import '../../../shell/links/js_url.dart';
import '../../../shell/feature_registry.dart' show ShellPlaceholder;
import '../../../shell/nav/shell_controller.dart';
import '../../moderation/moderation_queries.dart' show myModerationStatusQuery;
import '../../moderation/moderator.dart' show moderatorText;
import '../../settings/ui/settings_ui.dart' show px, toasts;
import '../data/partner_messages.dart' show ChatToast;

/// `toast({ title, description, variant })` through the Radix toaster.
void showChatToast(BuildContext context, ChatToast toast) {
  try {
    toasts(context).show(title: toast.title, description: toast.description, destructive: toast.destructive);
  } catch (_) {
    // No toast host above (previews).
  }
}

/// `useFullScreenChat()`: holds a [fullScreenChatLeasesProvider] lease while mounted (the shell hides the bottom
/// nav). Leases keep nested profile / group details from prematurely restoring the footer.
class FullScreenChatLease extends ConsumerStatefulWidget {
  const FullScreenChatLease({super.key, required this.child});
  final Widget child;
  @override
  ConsumerState<FullScreenChatLease> createState() => _FullScreenChatLeaseState();
}

class _FullScreenChatLeaseState extends ConsumerState<FullScreenChatLease> {
  late final FullScreenChatLeases _leases = ref.read(fullScreenChatLeasesProvider.notifier);
  bool _held = false, _disposed = false;

  @override
  void initState() {
    super.initState();
    // Providers must not change while the tree builds: take the lease right after this frame's build.
    scheduleMicrotask(() {
      if (_disposed) return;
      _leases.acquire();
      _held = true;
    });
  }

  @override
  void dispose() {
    _disposed = true;
    if (_held) {
      final leases = _leases;
      scheduleMicrotask(() {
        try {
          leases.release();
        } catch (_) {
          // The container is gone.
        }
      });
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

/// shadcn `Avatar` + `AvatarImage` + `AvatarFallback` (rounded-full; fallback `bg-muted`, centred).
class ChatAvatar extends StatelessWidget {
  const ChatAvatar({super.key, required this.size, this.url, required this.fallback, this.fallbackColor, this.border});
  final double size;
  final String? url;
  final Widget fallback;
  final Color? fallbackColor;
  final BoxBorder? border;

  @override
  Widget build(BuildContext context) {
    final fallbackBox = Container(
      color: fallbackColor ?? context.tokens.shadcn.muted,
      alignment: Alignment.center,
      child: fallback,
    );
    final image = url;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, border: border),
      child: ClipOval(
        child: image == null || image.isEmpty
            ? fallbackBox
            : Image.network(image, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, _, _) => fallbackBox),
      ),
    );
  }
}

/// `title.charAt(0)` (one UTF-16 unit, like JS).
String charAt0(String? value) {
  if (value == null || value.isEmpty) return '';
  return String.fromCharCode(value.codeUnitAt(0));
}

/// `.chat-icon-button` (36 round, `--a-ink-soft`, disabled opacity .4); `small` = `.chat-icon-button-small` (26).
class ChatIconButton extends StatelessWidget {
  const ChatIconButton({super.key, required this.icon, required this.label, this.onTap, this.small = false, this.enabled = true, this.color});
  final AIconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool small;
  final bool enabled;
  final Color? color;

  @override
  Widget build(BuildContext context) => ChatIconButtonCustom(
        label: label,
        onTap: onTap,
        small: small,
        enabled: enabled,
        child: AIcon(icon, size: small ? 15 : 21, color: color ?? context.a.inkSoft, mirrorInRtl: icon == AIcons.arrowLeft),
      );
}

/// `.chat-icon-button` with any child.
class ChatIconButtonCustom extends StatelessWidget {
  const ChatIconButtonCustom({super.key, required this.child, required this.label, this.onTap, this.small = false, this.enabled = true});
  final Widget child;
  final String label;
  final VoidCallback? onTap;
  final bool small;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final size = small ? 26.0 : 36.0;
    return Semantics(
      container: true,
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onTap : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: IconTheme.merge(
            data: IconThemeData(color: context.a.inkSoft),
            child: SizedBox(width: size, height: size, child: Center(child: child)),
          ),
        ),
      ),
    );
  }
}

/// `.chat-notice` (8/12 padding, ink-soft 12px, centred).
class ChatNotice extends StatelessWidget {
  const ChatNotice({super.key, required this.child, this.onTap, this.enabled = true, this.textAlign = TextAlign.center});
  final Widget child;
  final VoidCallback? onTap;
  final bool enabled;
  final TextAlign textAlign;

  static TextStyle style(BuildContext context) => px(12, color: context.a.inkSoft);

  @override
  Widget build(BuildContext context) {
    Widget body = Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
      child: DefaultTextStyle.merge(style: style(context), textAlign: textAlign, child: child),
    );
    if (onTap != null) {
      body = Semantics(
        container: true,
        button: true,
        enabled: enabled,
        child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: enabled ? onTap : null, child: body),
      );
    }
    return body;
  }
}

/// `.chat-empty` (grid, centred, gap 10, padding 45/16, ink-soft 13px).
class ChatEmpty extends StatelessWidget {
  const ChatEmpty({super.key, required this.children, this.alert = false});
  final List<Widget> children;
  final bool alert;

  @override
  Widget build(BuildContext context) => Semantics(
        liveRegion: alert,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 45, horizontal: 16),
          child: DefaultTextStyle.merge(
            style: px(13, color: context.a.inkSoft),
            textAlign: TextAlign.center,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              for (var i = 0; i < children.length; i++) ...[if (i > 0) const SizedBox(height: 10), children[i]],
            ]),
          ),
        ),
      );
}

// ── Slots for features that are not ported yet ──

/// `<CommentText content allowLinks />`: renders message text with tappable links.
typedef ChatTextBuilder = Widget Function(BuildContext context, String content, TextStyle style);

/// Default: http(s) / www / anacan:// links underlined in `text-primary`; app blog links and app deeplinks open in
/// the app (shell.openAppBlogLink / openUrl), others in the browser. The community port's CommentText replaces it.
final chatTextBuilderProvider = Provider<ChatTextBuilder>((ref) => (context, content, style) => ChatLinkText(content: content, style: style));

/// `<PhotoGalleryViewer photos={[photo]} isOpen onClose />`.
typedef ChatPhotoViewerBuilder = Widget Function(BuildContext context, String url, VoidCallback onClose);

/// Default: a full-screen black viewer with pinch zoom and a close button. The photo-gallery port replaces it.
final chatPhotoViewerProvider = Provider<ChatPhotoViewerBuilder>((ref) => (context, url, onClose) => _DefaultPhotoViewer(url: url, onClose: onClose));

/// `<GroupChatScreen groupId onBack />` (community groups port, `social.groups`).
typedef ChatGroupScreenBuilder = Widget Function(BuildContext context, String groupId, VoidCallback onBack);

/// Default: a placeholder with a back action until the groups port registers its screen.
final chatGroupScreenProvider = Provider<ChatGroupScreenBuilder>(
    (ref) => (context, groupId, onBack) => ShellPlaceholder(kind: 'screen', id: 'group-chat:$groupId', onBack: onBack));

/// `<RestrictionNote scope="message" />`.
final chatRestrictionNoteProvider = Provider<WidgetBuilder>((ref) => (context) => const _RestrictionNote());

class _RestrictionNote extends ConsumerWidget {
  const _RestrictionNote();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(myModerationStatusQuery).data;
    if (data == null || data['message'] == null || data['message'] == false) return const SizedBox.shrink();
    // amber-200 border / amber-50 background (Tailwind literals of RestrictionNote.tsx)
    return Semantics(
      liveRegion: true,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBEB),
          border: Border.all(color: const Color(0xFFFDE68A)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Padding(padding: EdgeInsets.only(top: 2), child: AIcon(AIcons.shieldAlert, size: 18)),
          const SizedBox(width: 8),
          Expanded(child: Text(moderatorText('message_restricted'), style: px(14, height: 1.625))),
        ]),
      ),
    );
  }
}

final RegExp _linkSplit = RegExp(r'((?:https?:\/\/|anacan:\/\/|www\.)[^\s<>]+)', caseSensitive: false);
final RegExp _linkStart = RegExp(r'^(?:https?:\/\/|anacan:\/\/|www\.)', caseSensitive: false);

/// Default [chatTextBuilderProvider] widget (the `allowLinks` branch of CommentText).
class ChatLinkText extends ConsumerStatefulWidget {
  const ChatLinkText({super.key, required this.content, required this.style});
  final String content;
  final TextStyle style;
  @override
  ConsumerState<ChatLinkText> createState() => _ChatLinkTextState();
}

class _ChatLinkTextState extends ConsumerState<ChatLinkText> {
  final List<TapGestureRecognizer> _recognizers = [];

  @override
  void dispose() {
    for (final r in _recognizers) {
      r.dispose();
    }
    super.dispose();
  }

  void _open(JsUrl url) {
    final shell = ref.read(shellProvider.notifier);
    if (appBlogSlug(url.href) != null) {
      shell.openAppBlogLink(url.href);
    } else if (url.protocol == 'anacan:' || const {'app.anacan.az'}.contains(url.hostname)) {
      shell.openUrl(url.href);
    } else {
      unawaited(launchUrl(Uri.parse(url.href), mode: LaunchMode.externalApplication).catchError((Object _) => false));
    }
  }

  @override
  Widget build(BuildContext context) {
    for (final r in _recognizers) {
      r.dispose();
    }
    _recognizers.clear();
    final spans = <InlineSpan>[];
    final content = widget.content;
    var last = 0;
    for (final match in _linkSplit.allMatches(content)) {
      if (match.start > last) spans.add(TextSpan(text: content.substring(last, match.start)));
      final chunk = match[0]!;
      final trail = RegExp(r'^(.*?)([.,!?;:)\]}]*)$').firstMatch(chunk)!;
      final text = trail[1]!;
      final url = JsUrl.parse(RegExp(r'^www\.', caseSensitive: false).hasMatch(text) ? 'https://$text' : text);
      final linkable = url != null &&
          (url.protocol == 'anacan:' || ((url.protocol == 'http:' || url.protocol == 'https:') && url.username.isEmpty && url.password.isEmpty));
      if (url == null || !_linkStart.hasMatch(chunk) || !linkable) {
        spans.add(TextSpan(text: chunk));
      } else {
        final recognizer = TapGestureRecognizer()..onTap = () => _open(url);
        _recognizers.add(recognizer);
        spans.add(TextSpan(
          text: text,
          recognizer: recognizer,
          style: TextStyle(color: context.tokens.shadcn.primary, decoration: TextDecoration.underline),
        ));
        if (trail[2]!.isNotEmpty) spans.add(TextSpan(text: trail[2]));
      }
      last = match.end;
    }
    if (last < content.length) spans.add(TextSpan(text: content.substring(last)));
    return Text.rich(TextSpan(children: spans), style: widget.style);
  }
}

class _DefaultPhotoViewer extends StatelessWidget {
  const _DefaultPhotoViewer({required this.url, required this.onClose});
  final String url;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ColoredBox(
      color: const Color(0xF2000000), // bg-black/95 (PhotoGalleryViewer)
      child: Stack(children: [
        Positioned.fill(child: InteractiveViewer(maxScale: 4, child: Center(child: Image.network(url, fit: BoxFit.contain)))),
        PositionedDirectional(
          top: top + 12,
          end: 12,
          child: Semantics(
            container: true,
            button: true,
            label: tr('common_bagla', 'Bağla'),
            excludeSemantics: true,
            child: GestureDetector(
              onTap: onClose,
              child: Container(
                width: 40,
                height: 40,
                decoration: const BoxDecoration(color: Color(0x33FFFFFF), shape: BoxShape.circle),
                alignment: Alignment.center,
                child: const AIcon(AIcons.x, size: 22, color: Color(0xFFFFFFFF)),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}
