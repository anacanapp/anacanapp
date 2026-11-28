// Ported from: src/components/blog/BlogPostDetail.tsx, src/styles/blog-content.css (.blog-article, .blog-article-actions,
//              ≤360px card padding), src/components/blog/BlogSeo.tsx (document head only; nothing to do natively)
//
// Hero, title card with like / save / comment count, table of contents, article body, editorial sections, tags,
// author, comments with replies, share dialog and related posts.
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_widget_from_html/flutter_widget_from_html.dart' show HtmlWidgetState;
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../../settings/ui/settings_ui.dart' show AIconBtn, FadeRise, Tw, px, toasts;
import '../../tools/health_common/health_ui.dart' show LucideFilled;
import '../copy/blog_copy.dart';
import '../data/blog_backend.dart';
import '../data/blog_editorial.dart';
import '../data/blog_interactions.dart';
import '../data/use_blog.dart';
import 'blog_prose.dart';
import 'blog_sections.dart';
import 'blog_share_dialog.dart';
import 'blog_ui.dart';

/// `format(date, pattern, { locale })` of an ISO timestamp ('' when unparsable).
String blogDate(Object? iso, String pattern) {
  final d = iso is String ? DateTime.tryParse(iso) : null;
  return d == null ? '' : formatDatePattern(d.toLocal(), pattern);
}

String _categoryLabel(BlogPost post, List<Map<String, dynamic>> categories) {
  Map<String, dynamic>? category;
  for (final c in categories) {
    if (c['slug'] == post['category']) category = c;
  }
  final icon = category?['icon'];
  final name = category?['name'];
  return '${icon ?? ''} ${name is String && name.isNotEmpty ? name : post['category'] ?? ''}';
}

class BlogPostDetail extends ConsumerStatefulWidget {
  const BlogPostDetail({super.key, required this.post, required this.categories, required this.allPosts, required this.onBack, required this.onSelectPost});
  final BlogPost post;
  final List<Map<String, dynamic>> categories;
  final List<BlogPost> allPosts;
  final VoidCallback onBack;
  final void Function(BlogPost post) onSelectPost;

  @override
  ConsumerState<BlogPostDetail> createState() => _BlogPostDetailState();
}

class _BlogPostDetailState extends ConsumerState<BlogPostDetail> {
  late final BlogInteractions _i = BlogInteractions(
    backend: ref.read(blogBackendProvider),
    postId: widget.post['id'] as String?,
    userId: ref.read(authUserProvider)?.id,
  )..addListener(_changed);
  final TextEditingController _newComment = TextEditingController();
  final TextEditingController _reply = TextEditingController();
  final GlobalKey<HtmlWidgetState> _html = GlobalKey<HtmlWidgetState>();
  String? _replyingTo;
  final List<String> _expanded = [];
  bool _submitting = false;

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    fireAndForget(_i.load);
  }

  @override
  void dispose() {
    _i
      ..removeListener(_changed)
      ..dispose();
    _newComment.dispose();
    _reply.dispose();
    super.dispose();
  }

  bool get _signedIn => ref.read(authUserProvider) != null;

  Future<void> _addComment() async {
    final toast = toasts(context);
    if (!_signedIn) {
      toast.show(
        title: tr('blogpostdetail_giris_edin_3be3d2', 'Giriş edin'),
        description: tr('blogpostdetail_serh_yazmaq_ucun_hesabiniza_daxil_olun_409134', 'Şərh yazmaq üçün hesabınıza daxil olun'),
      );
      return;
    }
    if (_newComment.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    final error = await _i.addComment(_newComment.text);
    if (!mounted) return;
    setState(() => _submitting = false);
    if (error == null) {
      _newComment.clear();
      toast.show(title: tr('blogpostdetail_serh_elave_edildi_192ac0', 'Şərh əlavə edildi!'));
    }
  }

  Future<void> _addReply(String parentId) async {
    final toast = toasts(context);
    if (!_signedIn) {
      toast.show(
        title: tr('blogpostdetail_giris_edin_3be3d2', 'Giriş edin'),
        description: tr('blogpostdetail_cavab_yazmaq_ucun_hesabiniza_daxil_olun_04a03d', 'Cavab yazmaq üçün hesabınıza daxil olun'),
      );
      return;
    }
    if (_reply.text.trim().isEmpty) return;
    setState(() => _submitting = true);
    final error = await _i.addComment(_reply.text, parentId);
    if (!mounted) return;
    setState(() => _submitting = false);
    if (error == null) {
      _reply.clear();
      setState(() => _replyingTo = null);
      toast.show(title: tr('blogpostdetail_cavab_elave_edildi_b44ba8', 'Cavab əlavə edildi!'));
    }
  }

  void _leave() {
    final exit = ref.read(blogAdSlotsProvider).exit;
    if (exit == null) {
      widget.onBack();
    } else {
      fireAndForget(() => exit(context, 'article_exit_interstitial', widget.onBack));
    }
  }

  @override
  Widget build(BuildContext context) {
    final post = widget.post;
    final a = context.a;
    final x = context.aText;
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final locale = blogLocale(post['editorial_metadata'], language);
    final user = ref.watch(authUserProvider);
    final ads = ref.watch(blogAdSlotsProvider);
    final narrow = MediaQuery.sizeOf(context).width <= 360;
    final cardPad = EdgeInsets.all(narrow ? 14 : 18);
    final content = '${post['content'] ?? ''}';
    final headings = blogHeadings(content);
    final cover = post['cover_image_url'];
    final tags = post['tags'] is List ? [for (final t in post['tags'] as List) '$t'] : const <String>[];
    final canSend = !_submitting && _newComment.text.trim().isNotEmpty;

    Widget card(Widget child, {Color? color, bool border = true}) => Container(
          padding: cardPad,
          decoration: BoxDecoration(
            color: color ?? a.surface,
            borderRadius: BorderRadius.circular(narrow ? 20 : a.radiusLg),
            border: border ? Border.all(color: a.line) : null,
            boxShadow: a.cardShadow,
          ),
          child: child,
        );

    final hero = Stack(clipBehavior: Clip.none, children: [
      if (cover is String && cover.isNotEmpty)
        SizedBox(
          height: 256,
          width: double.infinity,
          child: Stack(fit: StackFit.expand, children: [
            Semantics(
              image: true,
              label: locale?.coverAlt.isNotEmpty == true ? locale!.coverAlt : '${post['title'] ?? ''}',
              child: CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover, errorWidget: (_, _, _) => const SizedBox()),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(begin: Alignment.bottomCenter, end: Alignment.topCenter, colors: [a.bg, a.bg.withValues(alpha: 0)], stops: const [0, 0.6]),
              ),
            ),
          ]),
        )
      else
        Container(height: 160, decoration: BoxDecoration(gradient: a.gradPeach)),
      PositionedDirectional(start: 16, top: 12, child: _HeroButton(icon: AIcons.arrowLeft, mirror: true, label: tr('common_geri', 'Geri'), onTap: _leave)),
      PositionedDirectional(
        end: 16,
        top: 12,
        child: _HeroButton(
          icon: AIcons.share2,
          label: blogFollowupText('share_blog', language),
          onTap: () => fireAndForget(() => showBlogShareDialog(context, slug: '${post['slug']}', title: '${post['title'] ?? ''}', blog: {
                'id': post['id'],
                'slug': post['slug'],
                'title': post['title'],
                'excerpt': post['excerpt'],
                'cover_image_url': post['cover_image_url'],
              })),
        ),
      ),
    ]);

    final mainCard = FadeRise(
      child: card(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
          decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
          child: Text(_categoryLabel(post, widget.categories), style: px(10.5, weight: FontWeight.w800, color: a.accentInk)),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text('${post['title'] ?? ''}', style: x.heading(px(24, color: a.ink, height: 1.25))),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Wrap(spacing: 12, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
            _metaItem(context, AIcons.clock, '${post['reading_time']} ${tr('blogpostdetail_deq_780a5c', 'dəq')}'),
            _metaItem(context, AIcons.eye, '${post['view_count']} ${tr('blogpostdetail_baxis_d4da3e', 'baxış')}'),
            Text(blogDate(post['created_at'], 'd MMMM yyyy'), style: Tw.sm.copyWith(color: a.inkSoft)),
          ]),
        ),
        Container(
          padding: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: a.line))),
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Expanded(
                flex: 10,
                child: _ActionPill(
                  key: const ValueKey('blog-like'),
                  active: _i.isLiked,
                  activeColor: a.pink2,
                  activeInk: const Color(0xFFFFFFFF),
                  // `0 8px 18px -8px rgba(255, 138, 164, 0.8)` (BlogPostDetail.tsx like button)
                  activeShadow: const BoxShadow(color: Color(0xCCFF8AA4), offset: Offset(0, 8), blurRadius: 18, spreadRadius: -8),
                  icon: AIcons.heart,
                  label: '${_i.likesCount}',
                  onTap: () => fireAndForget(_i.toggleLike),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 16,
                child: _ActionPill(
                  key: const ValueKey('blog-save'),
                  active: _i.isSaved,
                  activeColor: a.yellow2,
                  // `color: '#5a3d00'`, `0 8px 18px -8px rgba(255, 201, 77, 0.8)` (BlogPostDetail.tsx save button)
                  activeInk: const Color(0xFF5A3D00),
                  activeShadow: const BoxShadow(color: Color(0xCCFFC94D), offset: Offset(0, 8), blurRadius: 18, spreadRadius: -8),
                  icon: AIcons.bookmark,
                  label: _i.isSaved ? tr('blogpostdetail_saxlanildi_66ffe7', 'Saxlanıldı') : tr('blogpostdetail_saxla_d9cfd1', 'Saxla'),
                  onTap: () => fireAndForget(_i.toggleSave),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                constraints: const BoxConstraints(minHeight: 44),
                padding: EdgeInsets.symmetric(horizontal: narrow ? 10 : 16, vertical: 12),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(AIcons.messageCircle, size: 20, color: a.inkSoft),
                  const SizedBox(width: 8),
                  Text('${_i.commentsCount}', style: px(narrow ? 13 : 14, weight: FontWeight.w700, color: a.inkSoft)),
                ]),
              ),
            ]),
          ),
        ),
      ])),
    );

    final children = <Widget>[
      mainCard,
      BlogContents(headings: headings, onOpen: (id) => fireAndForget(() => scrollToBlogHeading(_html, id))),
      Padding(
        padding: const EdgeInsets.only(top: 12),
        child: FadeRise(delay: const Duration(milliseconds: 100), child: card(BlogProse(content: content, htmlKey: _html))),
      ),
      BlogEditorialSections(post: post),
      if (tags.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: FadeRise(
            delay: const Duration(milliseconds: 150),
            child: Wrap(spacing: 8, runSpacing: 8, children: [for (final tag in tags) BlogTag(children: [Flexible(child: Text('#$tag'))])]),
          ),
        ),
      Padding(
        padding: const EdgeInsets.only(top: 12),
        child: FadeRise(
          delay: const Duration(milliseconds: 200),
          child: card(
            color: a.peach1,
            border: false,
            Row(children: [
              Container(
                width: 56,
                height: 56,
                alignment: Alignment.center,
                decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(16)),
                child: AIcon(AIcons.user, size: 28, color: a.accentInk),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${post['author_name'] ?? ''}', style: px(16, weight: FontWeight.w700, color: a.accentInk)),
                  Opacity(opacity: 0.75, child: Text(tr('blogpostdetail_meqale_muellifi_1bf996', 'Məqalə müəllifi'), style: Tw.sm.copyWith(color: a.accentInk))),
                ]),
              ),
            ]),
          ),
        ),
      ),
      if (ads.inlineAnchor != null) ads.inlineAnchor!(context, 'blog_article_banner'),
      Padding(
        padding: const EdgeInsets.only(top: 12),
        child: FadeRise(
          delay: const Duration(milliseconds: 250),
          child: card(Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(children: [
                Container(
                  width: 32,
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(8)),
                  child: AIcon(AIcons.messageCircle, size: 16, color: a.accentInk),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('${tr('blogpostdetail_serhler_8b3fc3', 'Şərhlər (')}${_i.commentsCount})', style: x.heading(px(16, color: a.ink))),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 24),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _Avatar(size: 40, child: AIcon(AIcons.user, size: 16, color: a.accentInk)),
                const SizedBox(width: 12),
                Expanded(
                  child: BlogTextArea(
                    fieldKey: const ValueKey('blog-new-comment'),
                    controller: _newComment,
                    minHeight: 50,
                    enabled: user != null,
                    onChanged: (_) => setState(() {}),
                    placeholder: user != null
                        ? tr('blogpostdetail_serhinizi_yazin_9d6066', 'Şərhinizi yazın...')
                        : tr('blogpostdetail_serh_yazmaq_ucun_giris_edin_d02910', 'Şərh yazmaq üçün giriş edin'),
                  ),
                ),
                const SizedBox(width: 8),
                BlogSendButton(
                  buttonKey: const ValueKey('blog-send-comment'),
                  size: 42,
                  opacity: canSend ? 1 : 0.5,
                  onTap: canSend ? () => fireAndForget(_addComment) : null,
                ),
              ]),
            ),
            if (_i.comments.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 32),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(16)),
                child: Column(children: [
                  Container(
                    width: 56,
                    height: 56,
                    margin: const EdgeInsets.only(bottom: 12),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(gradient: a.gradPeach, borderRadius: BorderRadius.circular(16)),
                    child: AIcon(AIcons.messageCircle, size: 28, color: a.accentInk),
                  ),
                  Text(tr('blogpostdetail_hele_serh_yoxdur_1dfc90', 'Hələ şərh yoxdur'), style: x.aListTitle, textAlign: TextAlign.center),
                  Text(tr('blogpostdetail_ilk_serhi_siz_yazin_00a364', 'İlk şərhi siz yazın!'), style: x.aListSub, textAlign: TextAlign.center),
                ]),
              )
            else
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                for (var i = 0; i < _i.comments.length; i++) Padding(padding: EdgeInsets.only(top: i == 0 ? 0 : 16), child: _comment(context, _i.comments[i])),
              ]),
          ])),
        ),
      ),
      RelatedPosts(currentPost: post, allPosts: widget.allPosts, onSelectPost: widget.onSelectPost),
    ];

    return ColoredBox(
      color: a.bg,
      child: BlogPageScroll(
        scrollKey: ValueKey('blog-post-${post['id']}'),
        padding: const EdgeInsets.only(bottom: 96),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (ads.surface != null) ads.surface!(context, 'blog_article_banner'),
          hero,
          Transform.translate(
            offset: const Offset(0, -32),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: (MediaQuery.sizeOf(context).width * 0.04).clamp(12, 20).toDouble()),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 864),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _metaItem(BuildContext context, AIconData icon, String text) {
    final a = context.a;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      AIcon(icon, size: 16, color: a.inkSoft),
      const SizedBox(width: 4),
      Text(text, style: Tw.sm.copyWith(color: a.inkSoft)),
    ]);
  }

  Widget _comment(BuildContext context, BlogComment comment, {bool isReply = false}) {
    final a = context.a;
    final userId = ref.watch(authUserProvider)?.id;
    final expanded = _expanded.contains(comment.id);
    final badge = comment.userBadge;
    final initial = comment.userName.isNotEmpty ? String.fromCharCode(comment.userName.runes.first) : '?';
    return Padding(
      key: ValueKey('comment-${comment.id}'),
      padding: isReply ? const EdgeInsetsDirectional.only(start: 40, top: 12) : EdgeInsets.zero,
      child: FadeRise(
        dy: 10,
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _Avatar(
            size: 40,
            image: comment.userAvatar,
            child: Text(initial, style: px(14, color: a.accentInk, height: 20 / 14)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: a.surfaceSoft,
                  borderRadius: const BorderRadiusDirectional.only(topEnd: Radius.circular(16), bottomStart: Radius.circular(16), bottomEnd: Radius.circular(16))
                      .resolve(Directionality.of(context)),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Wrap(spacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                      Text(comment.userName, style: px(14, weight: FontWeight.w700, color: a.ink, height: 20 / 14)),
                      if (badge != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6),
                          decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(999)),
                          child: Text(
                              trInline('BlogPostDetail.tsx', badge == 'admin' ? '👑 Admin' : badge == 'premium' ? '⭐ Premium' : '🛡️ Mod'),
                              style: px(10, weight: FontWeight.w700, color: a.lavInk)),
                        ),
                    ]),
                  ),
                  Text(comment.content, style: px(14, color: a.ink, height: 20 / 14)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                child: Row(children: [
                  GestureDetector(
                    key: ValueKey('comment-like-${comment.id}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => fireAndForget(() => _i.toggleCommentLike(comment.id)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      comment.isLiked ? LucideFilled(AIcons.heart, size: 14, color: a.pink2) : AIcon(AIcons.heart, size: 14, color: a.inkSoft),
                      const SizedBox(width: 4),
                      Text(comment.likesCount > 0 ? '${comment.likesCount}' : '', style: px(12, weight: FontWeight.w600, color: comment.isLiked ? a.pink2 : a.inkSoft, height: 16 / 12)),
                    ]),
                  ),
                  if (!isReply) ...[
                    const SizedBox(width: 8),
                    GestureDetector(
                      key: ValueKey('comment-reply-${comment.id}'),
                      behavior: HitTestBehavior.opaque,
                      onTap: () => setState(() => _replyingTo = _replyingTo == comment.id ? null : comment.id),
                      child: Text(tr('blogpostdetail_cavab_yaz_2cd434', 'Cavab yaz'), style: px(12, weight: FontWeight.w600, color: a.accentInk, height: 16 / 12)),
                    ),
                  ],
                  const SizedBox(width: 8),
                  Text(blogDate(comment.createdAt, 'd MMM'), style: px(12, color: a.inkFaint, height: 16 / 12)),
                  const Spacer(),
                  if (userId == comment.userId)
                    GestureDetector(
                      key: ValueKey('comment-delete-${comment.id}'),
                      behavior: HitTestBehavior.opaque,
                      onTap: () => fireAndForget(() => _i.deleteComment(comment.id)),
                      child: AIcon(AIcons.trash2, size: 14, color: a.pinkInk),
                    ),
                ]),
              ),
              if (_replyingTo == comment.id)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(
                      child: BlogTextArea(
                        fieldKey: const ValueKey('blog-reply'),
                        controller: _reply,
                        minHeight: 60,
                        fontSize: 14,
                        placeholder: tr('blogpostdetail_cavabinizi_yazin_2cda33', 'Cavabınızı yazın...'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(children: [
                      BlogSendButton(size: 38, opacity: _submitting ? 0.6 : 1, onTap: _submitting ? null : () => fireAndForget(() => _addReply(comment.id))),
                      const SizedBox(height: 4),
                      AIconBtn(size: 38, onTap: () => setState(() => _replyingTo = null), icon: Text('✕', style: px(14, color: a.ink))),
                    ]),
                  ]),
                ),
              if (comment.replies.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
                  child: GestureDetector(
                    key: ValueKey('comment-replies-${comment.id}'),
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() => expanded ? _expanded.remove(comment.id) : _expanded.add(comment.id)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      AIcon(expanded ? AIcons.chevronUp : AIcons.chevronDown, size: 14, color: a.accentInk),
                      const SizedBox(width: 4),
                      Text(
                        expanded ? tr('blogpostdetail_cavablari_gizle_bc19d3', 'Cavabları gizlə') : '${comment.replies.length} ${tr('blogpostdetail_cavab_goster_faef92', 'cavab göstər')}',
                        style: px(12, weight: FontWeight.w700, color: a.accentInk, height: 16 / 12),
                      ),
                    ]),
                  ),
                ),
              if (expanded)
                for (final reply in comment.replies) _comment(context, reply, isReply: true),
            ]),
          ),
        ]),
      ),
    );
  }
}

/// `rounded-full bg-black/30 backdrop-blur-md` 40×40 floating hero button.
class _HeroButton extends StatelessWidget {
  const _HeroButton({required this.icon, required this.label, required this.onTap, this.mirror = false});
  final AIconData icon;
  final String label;
  final VoidCallback onTap;
  final bool mirror;

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: label,
        child: PressScale(
          onTap: onTap,
          child: ClipOval(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
              child: Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                color: const Color(0x4D000000),
                child: AIcon(icon, size: 20, color: const Color(0xFFFFFFFF), mirrorInRtl: mirror),
              ),
            ),
          ),
        ),
      );
}

/// Like / save pill of `.blog-article-actions`.
class _ActionPill extends StatelessWidget {
  const _ActionPill({super.key, required this.active, required this.activeColor, required this.activeInk, required this.activeShadow, required this.icon, required this.label, required this.onTap});
  final bool active;
  final Color activeColor;
  final Color activeInk;
  final BoxShadow activeShadow;
  final AIconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final narrow = MediaQuery.sizeOf(context).width <= 360;
    final ink = active ? activeInk : a.ink;
    return Semantics(
      button: true,
      toggled: active,
      child: PressScale(
        scale: 0.98,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
          decoration: BoxDecoration(color: active ? activeColor : a.surfaceSoft, borderRadius: BorderRadius.circular(999), boxShadow: active ? [activeShadow] : null),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            active ? LucideFilled(icon, size: 20, color: ink) : AIcon(icon, size: 20, color: ink),
            const SizedBox(width: 8),
            Flexible(child: Text(label, textAlign: TextAlign.center, style: px(narrow ? 13 : 16, weight: FontWeight.w700, color: ink, height: 1.25))),
          ]),
        ),
      ),
    );
  }
}

/// shadcn Avatar (circle, 2px `--a-line` border) with an image or a `--a-grad-peach` fallback.
class _Avatar extends StatelessWidget {
  const _Avatar({required this.size, required this.child, this.image});
  final double size;
  final Widget child;
  final String? image;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final fallback = Container(alignment: Alignment.center, decoration: BoxDecoration(gradient: a.gradPeach), child: child);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: a.line, width: 2)),
      child: ClipOval(
        child: image == null ? fallback : CachedNetworkImage(imageUrl: image!, fit: BoxFit.cover, placeholder: (_, _) => fallback, errorWidget: (_, _, _) => fallback),
      ),
    );
  }
}
