// Ported from: src/components/blog/BlogShareDialog.tsx
//
// Website / app link choice, copy, native share and "share in Community" (composer with the blog card).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../design/design.dart';
import '../../../shell/shell.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant, ShadDialogFrame, Tw, px, shadDescription, shadTitle, showShadDialog, toasts;
import '../copy/blog_copy.dart';
import 'blog_ui.dart';

/// Opens the share dialog of an article. [blog] is the community card payload (`{id, slug, title, excerpt,
/// cover_image_url}`).
Future<void> showBlogShareDialog(BuildContext context, {required String slug, required String title, Map<String, dynamic>? blog}) {
  if (!validBlogSlug(slug)) return Future.value();
  return showShadDialog<void>(context, builder: (_) => BlogShareDialog(slug: slug, title: title, blog: blog));
}

class BlogShareDialog extends ConsumerStatefulWidget {
  const BlogShareDialog({super.key, required this.slug, required this.title, this.blog});
  final String slug;
  final String title;
  final Map<String, dynamic>? blog;
  @override
  ConsumerState<BlogShareDialog> createState() => _BlogShareDialogState();
}

class _BlogShareDialogState extends ConsumerState<BlogShareDialog> {
  String _kind = 'app';
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    String t(String key) => blogFollowupText(key, language);
    final links = blogLinks(widget.slug, language);
    final url = _kind == 'website' ? links.website : links.app;
    final a = context.a;

    Future<void> copy() async {
      final toast = toasts(context);
      final navigator = Navigator.of(context);
      setState(() => _busy = true);
      try {
        await ref.read(blogSharePlatformProvider).copy(url);
        toast.show(title: t('link_copied'));
        navigator.maybePop();
      } catch (_) {
        toast.show(title: t('copy_failed'), destructive: true);
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }

    Widget option(String value) {
      final on = _kind == value;
      return Expanded(
        child: Semantics(
          button: true,
          selected: on,
          child: GestureDetector(
            key: ValueKey('share-kind-$value'),
            behavior: HitTestBehavior.opaque,
            onTap: () => setState(() => _kind = value),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: on ? a.peach1 : a.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: on ? a.accentInk : a.line),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                AIcon(value == 'website' ? AIcons.globe : AIcons.smartphone, size: 20, color: a.ink),
                const SizedBox(height: 8),
                Text(t(value == 'website' ? 'share_website' : 'share_app'), style: Tw.sm.copyWith(fontWeight: FontWeight.w700, color: a.ink)),
                const SizedBox(height: 4),
                Text(t(value == 'website' ? 'share_website_description' : 'share_app_description'), style: Tw.xs.copyWith(color: a.ink)),
              ]),
            ),
          ),
        ),
      );
    }

    final s = context.tokens.shadcn;
    return ShadDialogFrame(
      maxWidth: 448,
      inset: 16,
      children: [
        Stack(clipBehavior: Clip.none, children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(t('share_blog'), style: shadTitle(context)),
              const SizedBox(height: 6),
              Text(widget.title, style: shadDescription(context)),
            ]),
          ),
          PositionedDirectional(
            end: -8,
            top: -8,
            child: Semantics(
              button: true,
              label: 'Close',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => Navigator.of(context).maybePop(),
                child: Padding(padding: const EdgeInsets.all(8), child: AIcon(AIcons.x, size: 16, color: s.foreground.withValues(alpha: 0.7))),
              ),
            ),
          ),
        ]),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [option('website'), const SizedBox(width: 12), option('app')]),
        Directionality(textDirection: TextDirection.ltr, child: Text(url, key: const ValueKey('share-url'), style: Tw.xs.copyWith(color: s.foreground))),
        if (widget.blog != null)
          ShadButton(
            variant: ShadButtonVariant.outline,
            expand: true,
            onPressed: () {
              Navigator.of(context).maybePop();
              ref.read(shellProvider.notifier).dispatchPushEvent(PushNavIntent(tab: 'community', communityTarget: CommunityDeepLinkTarget(composeBlog: widget.blog)));
            },
            child: Text(blogFeature37Text('blog_community_share', language)),
          ),
        ShadButton(
          expand: true,
          onPressed: _busy ? null : () => fireAndForget(copy),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(AIcons.copy, size: 16, color: s.primaryForeground),
            const SizedBox(width: 8),
            Flexible(child: Text(t('copy_link'))),
          ]),
        ),
        ShadButton(
          variant: ShadButtonVariant.outline,
          expand: true,
          onPressed: () => fireAndForget(() async {
            await ref.read(blogSharePlatformProvider).share(title: widget.title, url: url);
          }),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            AIcon(AIcons.share2, size: 16, color: s.foreground),
            const SizedBox(width: 8),
            Flexible(child: Text(t('share_send'), style: px(14, weight: FontWeight.w500, height: 20 / 14))),
          ]),
        ),
      ],
    );
  }
}
