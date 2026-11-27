// Ported from: src/components/community/CommunityBlogCard.tsx, src/components/community/BlogAttachmentPicker.tsx,
//              src/hooks/useBlogAttachment.ts (the composer state: caret, selection, debounced search, choose)
//
// A post can carry one first-party blog article (`/blog <search>` in the composer). The card opens the article in the
// app (the blog reader itself belongs to the blog feature; [communityBlogOpenerProvider] defaults to the shell's
// BlogLinkHost overlay).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/nav/shell_controller.dart';
import '../../settings/ui/settings_ui.dart' show cssUpper;
import '../copy/community_copy.dart';
import '../data/community_blog.dart';
import 'community_widgets.dart';

/// `openAppBlog(url)` (blog feature not ported: the shell opens its article overlay).
final communityBlogOpenerProvider = Provider<void Function(String url)>((ref) => (url) => ref.read(shellProvider.notifier).openAppBlogLink(url));

/// `<BlogCardPreview blog onRemove onSelect />`.
class BlogCardPreview extends ConsumerWidget {
  const BlogCardPreview({super.key, required this.blog, this.onRemove, this.onSelect});
  final SharedBlog blog;
  final VoidCallback? onRemove;
  final VoidCallback? onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = context.a;
    final language = currentLanguage();
    final image = blogImageUrl(blog.coverImageUrl);
    return Container(
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: a.line)),
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        CommunityButton(
          label: blog.title,
          onTap: () => onSelect != null ? onSelect!() : ref.read(communityBlogOpenerProvider)(blogCardUrl(blog)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (image != null)
              AspectRatio(aspectRatio: 1.91, child: Image.network(image, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox()))
            else
              Container(height: 96, color: a.lav1, alignment: Alignment.center, child: AIcon(AIcons.bookOpen, size: 28, color: a.ink)),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(cssUpper(communityFeature37Text('blog_label', language)), style: px(11, weight: FontWeight.w700, color: a.onBgSoft, ls: 0.1)),
                const SizedBox(height: 4),
                Semantics(header: true, child: Text(blog.title, style: aListTitle(context))),
                if ((blog.excerpt ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(blog.excerpt!, maxLines: 2, overflow: TextOverflow.ellipsis, style: aListSub(context)),
                ],
              ]),
            ),
          ]),
        ),
        if (onRemove != null)
          PositionedDirectional(
            end: 8,
            top: 8,
            child: CommunityButton(
              label: communityFeature37Text('blog_remove', language),
              onTap: onRemove,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(color: Color(0xBF000000), shape: BoxShape.circle), // bg-black/75
                child: const AIcon(AIcons.x, size: 16, color: Color(0xFFFFFFFF)),
              ),
            ),
          ),
      ]),
    );
  }
}

/// `<CommunityBlogCard id />`.
class CommunityBlogCard extends ConsumerWidget {
  const CommunityBlogCard({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final q = ref.watch(communityBlogCardQuery(id));
    final data = q.data;
    if (data == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Semantics(
          liveRegion: true,
          child: Text(communityFeature37Text(q.isLoading ? 'blog_searching' : 'blog_unavailable'), style: aListSub(context)),
        ),
      );
    }
    return Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: BlogCardPreview(blog: data));
  }
}

/// `useBlogAttachment(content, setContent, textarea)`: the `/blog` command at the caret searches articles (150 ms
/// debounce); choosing one removes the command text and attaches the card.
class BlogAttachment extends ChangeNotifier {
  BlogAttachment({required this.controller, this.enabled = true}) {
    controller.addListener(_changed);
  }
  final TextEditingController controller;
  final bool enabled;
  SharedBlog? _selected;
  String _search = '';
  Timer? _debounce;
  String? _lastCommandSearch;

  SharedBlog? get selected => _selected;
  String get search => _search;

  set selected(SharedBlog? value) {
    _selected = value;
    notifyListeners();
  }

  int get _cursor {
    final sel = controller.selection;
    return sel.isValid ? sel.baseOffset.clamp(0, controller.text.length) : controller.text.length;
  }

  ({int start, int end, String search})? get command => enabled ? blogCommand(controller.text, _cursor) : null;

  void _changed() {
    final next = command?.search;
    if (next != _lastCommandSearch) {
      _lastCommandSearch = next;
      _debounce?.cancel();
      _debounce = Timer(const Duration(milliseconds: 150), () {
        _search = next ?? '';
        notifyListeners();
      });
    }
    notifyListeners();
  }

  void choose(SharedBlog blog) {
    final c = command;
    if (c == null || !validSharedBlog(blog)) return;
    final text = controller.text;
    final next = text.substring(0, c.start) + text.substring(c.end);
    _selected = blog;
    controller.value = TextEditingValue(text: next, selection: TextSelection.collapsed(offset: c.start));
    notifyListeners();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    controller.removeListener(_changed);
    super.dispose();
  }
}

/// `<BlogAttachmentPicker attachment />`.
class BlogAttachmentPicker extends ConsumerWidget {
  const BlogAttachmentPicker({super.key, required this.attachment});
  final BlogAttachment attachment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = currentLanguage();
    String t(String key) => communityFeature37Text(key, language);
    return ListenableBuilder(
      listenable: attachment,
      builder: (context, _) {
        final command = attachment.command;
        final selected = attachment.selected;
        Widget? results;
        if (command != null) {
          final q = ref.watch(shareBlogSearchQuery(attachment.search));
          results = Semantics(
            container: true,
            label: t('blog_search'),
            child: Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: context.a.surface,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: context.a.line),
                boxShadow: context.a.cardShadow,
              ),
              child: VGap(gap: 8, children: [
                Text(t('blog_search'), style: aListTitle(context)),
                if (q.isLoading || (q.isPending && !q.isError))
                  Semantics(liveRegion: true, child: Text(t('blog_searching')))
                else if (q.isError)
                  CommunityButton(onTap: () => ref.read(shareBlogSearchQuery(attachment.search).notifier).refetch(), child: Text(t('blog_search_failed')))
                else
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 320),
                    child: SingleChildScrollView(
                      child: VGap(gap: 8, children: [
                        if ((q.data ?? const []).isEmpty) Semantics(liveRegion: true, child: Text(t('blog_no_results'))),
                        for (final blog in q.data ?? const <SharedBlog>[]) BlogCardPreview(blog: blog, onSelect: () => attachment.choose(blog)),
                      ]),
                    ),
                  ),
              ]),
            ),
          );
        }
        return VGap(gap: 12, children: [
          ?results,
          if (selected != null) BlogCardPreview(blog: selected, onRemove: () => attachment.selected = null),
          Text(t('blog_command_hint'), style: aListSub(context)),
        ]);
      },
    );
  }
}
