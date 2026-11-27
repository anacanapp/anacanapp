// Ported from: src/components/blog/BlogEditorialSections.tsx (BlogContents, BlogEditorialSections),
//              src/components/blog/RelatedPosts.tsx, src/components/blog/ModuleArticles.tsx
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../shell/shell.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, px;
import '../content/blog_content.dart';
import '../copy/blog_copy.dart';
import '../data/blog_editorial.dart';
import '../data/use_blog.dart';
import 'blog_ui.dart';

/// `text-sm underline text-primary` link.
class _PrimaryLink extends StatelessWidget {
  const _PrimaryLink({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final primary = context.tokens.shadcn.primary;
    return Semantics(
      link: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Text(text, style: px(14, color: primary, height: 20 / 14).copyWith(decoration: TextDecoration.underline, decorationColor: primary)),
      ),
    );
  }
}

/// `.a-list-title mb-3` heading of an editorial card.
Widget _cardTitle(BuildContext context, String text) =>
    Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(text, style: context.aText.aListTitle));

/// `BlogContents`: the article's table of contents (only when it has `<h2>` headings).
class BlogContents extends ConsumerWidget {
  const BlogContents({super.key, required this.headings, required this.onOpen});
  final List<BlogHeading> headings;
  final void Function(String id) onOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (headings.isEmpty) return const SizedBox.shrink();
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final a = context.a;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Semantics(
        container: true,
        label: blogText('toc', language),
        child: ACard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _cardTitle(context, blogText('toc', language)),
              for (var i = 0; i < headings.length; i++)
                Padding(
                  padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 20,
                        child: Text('${i + 1}.', textAlign: rtl ? TextAlign.left : TextAlign.right, style: px(14, color: a.ink, height: 20 / 14)),
                      ),
                      const SizedBox(width: 6),
                      Expanded(child: _PrimaryLink(text: headings[i].title, onTap: () => onOpen(headings[i].id))),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `<details>` FAQ item (`py-3 border-b last:border-0`).
class _FaqItem extends StatefulWidget {
  const _FaqItem({super.key, required this.faq, required this.last});
  final BlogFaq faq;
  final bool last;
  @override
  State<_FaqItem> createState() => _FaqItemState();
}

class _FaqItemState extends State<_FaqItem> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: widget.last ? null : Border(bottom: BorderSide(color: a.line))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: _open,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => setState(() => _open = !_open),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: AnimatedRotation(
                    turns: _open ? 0.25 : 0,
                    duration: Duration.zero,
                    child: CustomPaint(size: const Size(8, 8), painter: _DisclosurePainter(a.ink, Directionality.of(context))),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(child: Text(widget.faq.question, style: px(14, weight: FontWeight.w600, color: a.ink, height: 20 / 14))),
              ]),
            ),
          ),
          if (_open)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(widget.faq.answer, style: px(14, color: a.ink, height: 1.625)),
            ),
        ],
      ),
    );
  }
}

/// The `<summary>` disclosure triangle.
class _DisclosurePainter extends CustomPainter {
  _DisclosurePainter(this.color, this.direction);
  final Color color;
  final TextDirection direction;
  @override
  void paint(Canvas canvas, Size size) {
    final p = Path();
    if (direction == TextDirection.rtl) {
      p
        ..moveTo(size.width, 0)
        ..lineTo(0, size.height / 2)
        ..lineTo(size.width, size.height);
    } else {
      p
        ..moveTo(0, 0)
        ..lineTo(size.width, size.height / 2)
        ..lineTo(0, size.height);
    }
    canvas.drawPath(p..close(), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_DisclosurePainter old) => old.color != color || old.direction != direction;
}

/// `BlogEditorialSections`: related app modules (feeding / sleep / diaper only for mommy), FAQ, references.
class BlogEditorialSections extends ConsumerWidget {
  const BlogEditorialSections({super.key, required this.post});
  final BlogPost post;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final stage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final metadata = blogEditorial(post['editorial_metadata']);
    final locale = blogLocale(post['editorial_metadata'], language);
    if (metadata == null || locale == null) return const SizedBox.shrink();
    final modules = metadata.modules.where((m) => !const ['feeding', 'sleep', 'diaper'].contains(m) || stage == 'mommy').toList();
    final references = locale.references ?? const <BlogReference>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (modules.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                _cardTitle(context, blogText('modules', language)),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final module in modules)
                    BlogTag(
                      key: ValueKey('blog-module-$module'),
                      onTap: () => ref.read(shellProvider.notifier).openBlogModule(module),
                      children: [Flexible(child: Text(blogText(module, language)))],
                    ),
                ]),
              ]),
            ),
          ),
        if (locale.faq.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                _cardTitle(context, blogText('faq', language)),
                for (var i = 0; i < locale.faq.length; i++) _FaqItem(key: ValueKey(locale.faq[i].question), faq: locale.faq[i], last: i == locale.faq.length - 1),
              ]),
            ),
          ),
        if (references.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: ACard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                _cardTitle(context, blogText('references', language)),
                for (var i = 0; i < references.length; i++)
                  Padding(
                    padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: _PrimaryLink(
                        text: references[i].title,
                        onTap: () {
                          final uri = Uri.tryParse(references[i].url);
                          if (uri != null) launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) => false);
                        },
                      ),
                    ),
                  ),
              ]),
            ),
          ),
      ],
    );
  }
}

/// RelatedPosts scoring: explicit related slugs +20, shared modules +2 each, same category +3, shared tags +1 each,
/// same author +1; best 4 with a positive score, topped up with recent posts to 3.
List<BlogPost> relatedBlogPosts(BlogPost current, List<BlogPost> all) {
  final editorial = blogEditorial(current['editorial_metadata']);
  List<String> tags(BlogPost p) => p['tags'] is List ? [for (final t in p['tags'] as List) '$t'] : const [];
  final scored = <({BlogPost post, int score, int index})>[];
  var index = 0;
  for (final post in all) {
    if (post['id'] == current['id'] || post['is_published'] != true) continue;
    var score = 0;
    final other = blogEditorial(post['editorial_metadata']);
    if (editorial != null && editorial.relatedSlugs.contains(post['slug'])) score += 20;
    if (editorial != null && other != null) score += editorial.modules.where(other.modules.contains).length * 2;
    if (post['category'] == current['category']) score += 3;
    final postTags = tags(post);
    score += tags(current).where((tag) => postTags.any((t) => t.toLowerCase() == tag.toLowerCase())).length;
    if (post['author_name'] == current['author_name']) score += 1;
    if (score > 0) scored.add((post: post, score: score, index: index++));
  }
  scored.sort((a, b) => b.score != a.score ? b.score - a.score : a.index - b.index);
  final top = [for (final s in scored.take(4)) s.post];
  if (top.length < 3) {
    final recent = all
        .where((post) => post['id'] != current['id'] && post['is_published'] == true && !top.any((s) => s['id'] == post['id']))
        .take(3 - top.length);
    return [...top, ...recent];
  }
  return top;
}

/// `RelatedPosts`.
class RelatedPosts extends StatelessWidget {
  const RelatedPosts({super.key, required this.currentPost, required this.allPosts, required this.onSelectPost});
  final BlogPost currentPost;
  final List<BlogPost> allPosts;
  final void Function(BlogPost post) onSelectPost;

  @override
  Widget build(BuildContext context) {
    final related = relatedBlogPosts(currentPost, allPosts);
    if (related.isEmpty) return const SizedBox.shrink();
    final a = context.a;
    final x = context.aText;
    return Padding(
      padding: const EdgeInsets.only(top: 24 + 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(tr('relatedposts_oxsar_meqaleler_c3c8cf', '📚 Oxşar Məqalələr'), style: x.aSectionTitle.copyWith(fontSize: 15, letterSpacing: -0.3)),
          ),
          Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
            child: Column(children: [
              for (var i = 0; i < related.length; i++)
                FadeRise(
                  dy: 10,
                  delay: Duration(milliseconds: i * 100),
                  child: PressScale(
                    scale: 0.98,
                    onTap: () => onSelectPost(related[i]),
                    child: Container(
                      key: ValueKey('related-${related[i]['id']}'),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(border: i == 0 ? null : Border(top: BorderSide(color: a.line))),
                      child: Row(children: [
                        _relatedThumb(context, related[i]),
                        const SizedBox(width: 13),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('${related[i]['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: x.aListTitle),
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Row(children: [
                                AIcon(AIcons.clock, size: 12, color: a.inkSoft),
                                const SizedBox(width: 6),
                                Text('${related[i]['reading_time']} ${tr('relatedposts_deq_780a5c', 'dəq')}', style: x.aListSub),
                                const SizedBox(width: 6),
                                Text('•', style: x.aListSub),
                                const SizedBox(width: 6),
                                Flexible(child: Text('${related[i]['view_count']} ${tr('relatedposts_baxis_d4da3e', 'baxış')}', style: x.aListSub, overflow: TextOverflow.ellipsis)),
                              ]),
                            ),
                          ]),
                        ),
                        AIcon(AIcons.chevronRight, size: 16, color: a.inkFaint, mirrorInRtl: true),
                      ]),
                    ),
                  ),
                ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _relatedThumb(BuildContext context, BlogPost post) {
    final a = context.a;
    final cover = post['cover_image_url'];
    if (cover is String && cover.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(width: 56, height: 56, child: CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover, errorWidget: (_, _, _) => const SizedBox())),
      );
    }
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(gradient: a.illusGrad, borderRadius: BorderRadius.circular(13)),
      child: const Text('📖', style: TextStyle(fontSize: 20)),
    );
  }
}

/// `ModuleArticles`: up to three articles of an app module for the current stage (HospitalBag `hospitalBag`).
class ModuleArticles extends ConsumerWidget {
  const ModuleArticles({super.key, required this.module});
  final String module;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final posts = ref.watch(blogProvider.select((b) => b.posts));
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final stage = ref.watch(userStoreProvider.select((s) => s.lifeStage)) ?? '';
    final relevant = posts.where((p) => (blogEditorial(p['editorial_metadata'])?.modules.contains(module) ?? false) && blogMatchesStage(p, stage)).take(3).toList();
    if (relevant.isEmpty) return const SizedBox.shrink();
    final a = context.a;
    return Padding(
      key: ValueKey('module-articles-$module'),
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(blogText('related', language), style: context.aText.aListTitle.copyWith(fontSize: 14, height: 20 / 14))),
          for (var i = 0; i < relevant.length; i++)
            Padding(
              padding: EdgeInsets.only(top: i == 0 ? 0 : 8),
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => ref.read(shellProvider.notifier).openAppBlogLink(blogLinks('${relevant[i]['slug']}', language).app),
                child: Row(children: [
                  const ExcludeSemantics(child: Text('📖', style: TextStyle(fontSize: 14, height: 20 / 14))),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('${relevant[i]['title'] ?? ''}',
                        style: px(14, color: a.ink, height: 20 / 14).copyWith(decoration: TextDecoration.underline, decorationColor: a.ink)),
                  ),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}
