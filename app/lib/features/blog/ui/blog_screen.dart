// Ported from: src/components/BlogScreen.tsx, src/hooks/useScreenAnalytics.ts (screen view on mount),
//              src/lib/scrollMemory.ts (saveScroll / restoreScroll of the list, key `blog`)
//
// Blog list (search, saved, categories, featured rail, all articles) and the article reader. With [initialSlug]
// (in-app links, deeplinks, the article overlay) the article is fetched by slug, its view counted once, and its
// back closes the whole screen.
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../shell/shell.dart';
import '../../settings/ui/settings_ui.dart' show AIconBtn, ATopbar, FadeRise, px;
import '../../tools/health_common/health_ui.dart' show LucideFilled;
import '../copy/blog_copy.dart';
import '../data/blog_backend.dart';
import '../data/blog_editorial.dart';
import '../data/blog_interactions.dart';
import '../data/use_blog.dart';
import 'blog_post_detail.dart';
import 'blog_ui.dart';

class BlogScreen extends ConsumerStatefulWidget {
  const BlogScreen({super.key, required this.onBack, this.initialSlug, this.lifeStage});
  final VoidCallback onBack;
  final String? initialSlug;
  final String? lifeStage;

  @override
  ConsumerState<BlogScreen> createState() => _BlogScreenState();
}

class _BlogScreenState extends ConsumerState<BlogScreen> {
  late final SavedPosts _saved = SavedPosts(backend: ref.read(blogBackendProvider), userId: ref.read(authUserProvider)?.id)..addListener(_changed);
  final TextEditingController _search = TextEditingController();
  String? _selectedCategory;
  BlogPost? _selectedPost;
  bool _showSaved = false;
  bool _openedFromHome = false;
  String? _handledSlug;
  late bool _linkLoading = _slug != null;
  bool _linkMissing = false;
  double _listOffset = 0;
  ScrollController _list = ScrollController();
  int _loadSeq = 0;

  String? get _slug => widget.initialSlug != null && widget.initialSlug!.isNotEmpty ? widget.initialSlug : null;

  void _changed() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    ref.read(shellPlatformProvider).logScreenView('Blog', 'Content');
    fireAndForget(_saved.refetch);
    if (_slug != null) fireAndForget(_loadSlug);
  }

  @override
  void didUpdateWidget(BlogScreen old) {
    super.didUpdateWidget(old);
    if (old.initialSlug != widget.initialSlug && _slug != null) fireAndForget(_loadSlug);
  }

  @override
  void dispose() {
    _loadSeq++;
    _saved
      ..removeListener(_changed)
      ..dispose();
    _search.dispose();
    _list.dispose();
    super.dispose();
  }

  Future<void> _incrementView(String postId) async {
    try {
      await ref.read(blogBackendProvider).incrementViewCount(postId);
    } catch (error) {
      debugPrint('Failed to increment view count: $error');
    }
  }

  Future<void> _loadSlug() async {
    final slug = _slug!;
    final seq = ++_loadSeq;
    setState(() {
      _linkLoading = true;
      _linkMissing = false;
    });
    final post = await ref.read(blogProvider).getPostBySlug(slug);
    if (!mounted || seq != _loadSeq) return;
    setState(() {
      _linkLoading = false;
      _linkMissing = post == null;
      if (post == null) {
        _selectedPost = null;
        return;
      }
      if (_handledSlug != slug) {
        _handledSlug = slug;
        fireAndForget(() => _incrementView('${post['id']}'));
      }
      _selectedPost = post;
      _openedFromHome = true;
    });
  }

  void _selectPost(BlogPost post, {bool fromList = true}) {
    if (fromList && _list.hasClients) _listOffset = _list.offset;
    setState(() => _selectedPost = post);
    fireAndForget(() => _incrementView('${post['id']}'));
  }

  void _backFromPost() {
    if (_openedFromHome) {
      widget.onBack();
    } else {
      _list.dispose();
      _list = ScrollController(initialScrollOffset: _listOffset);
      setState(() => _selectedPost = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final blog = ref.watch(blogProvider);
    final user = ref.watch(authUserProvider);
    final a = context.a;
    final posts = blog.posts;
    final categories = blog.categories;

    if (blog.loading || _linkLoading) return _loadingView(context);
    if (_linkMissing) {
      return ColoredBox(
        color: a.bg,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            AIconBtn(onTap: widget.onBack, semanticLabel: tr('common_geri', 'Geri'), icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Semantics(liveRegion: true, child: Text(blogFollowupText('blog_unavailable'), style: context.aText.aListTitle)),
            ),
          ]),
        ),
      );
    }

    var selected = _selectedPost;
    if (selected != null) {
      if (_slug == null) {
        for (final p in posts) {
          if (p['id'] == selected!['id']) selected = p;
        }
      }
      return BlogPostDetail(
        key: ValueKey('post-${selected!['id']}'),
        post: selected,
        categories: categories,
        allPosts: posts,
        onBack: _backFromPost,
        onSelectPost: (post) {
          _selectPost(post, fromList: false);
          setState(() => _openedFromHome = false);
        },
      );
    }

    final savedIds = _saved.savedPosts;
    final savedList = posts.where((p) => savedIds.contains(p['id'])).toList();
    final stage = widget.lifeStage;
    final sorted = stage == null || stage.isEmpty
        ? posts
        : [...posts.where((p) => blogMatchesStage(p, stage)), ...posts.where((p) => !blogMatchesStage(p, stage))];
    final query = _search.text;
    final filtered = _showSaved
        ? savedList
        : query.isNotEmpty
            ? blog.searchPosts(query)
            : _selectedCategory != null
                ? blog.getPostsByCategory(_selectedCategory!)
                : sorted;
    final featured = blog.featuredPosts;
    final ads = ref.watch(blogAdSlotsProvider);
    Map<String, dynamic>? categoryOf(String? slug) {
      for (final c in categories) {
        if (c['slug'] == slug) return c;
      }
      return null;
    }

    final listTitle = _showSaved
        ? tr('blogscreen_saxlanilan_meqaleler_7e3136', 'Saxlanılan Məqalələr')
        : _selectedCategory != null
            ? '${categoryOf(_selectedCategory)?['name'] ?? ''}'
            : query.isNotEmpty
                ? tr('blogscreen_x_ucun_neticeler_b1a2c3', '"{query}" üçün nəticələr').replaceFirst('{query}', query)
                : tr('blogscreen_butun_meqaleler_df9384', 'Bütün Məqalələr');

    return ColoredBox(
      color: a.bg,
      child: BlogPageScroll(
        scrollKey: const ValueKey('blog-list'),
        controller: _list,
        padding: const EdgeInsets.only(bottom: 96),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (ads.surface != null) ads.surface!(context, 'blog_list_banner'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              ATopbar(
                onBack: widget.onBack,
                backScale: 0.9,
                eyebrow: formatCount(CountNoun.articles, posts.length),
                title: tr('blogscreen_ana_bloqu_28124b', 'Qadın Bloqları'),
              ),
              BlogSearchField(
                controller: _search,
                placeholder: tr('blogscreen_meqale_axtar_0441c1', 'Məqalə axtar...'),
                onChanged: (_) => setState(() => _showSaved = false),
              ),
              FadeRise(
                delay: const Duration(milliseconds: 150),
                child: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    clipBehavior: Clip.none,
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(children: [
                      BlogTag(
                        key: const ValueKey('blog-filter-all'),
                        on: _selectedCategory == null && !_showSaved,
                        onTap: () => setState(() {
                          _selectedCategory = null;
                          _showSaved = false;
                        }),
                        children: [const AIcon(AIcons.sparkles, size: 12), Text(tr('blogscreen_all_filter', 'Hamısı'))],
                      ),
                      if (user != null) ...[
                        const SizedBox(width: 8),
                        BlogTag(
                          key: const ValueKey('blog-filter-saved'),
                          on: _showSaved,
                          onTap: () => setState(() {
                            _showSaved = true;
                            _selectedCategory = null;
                            _search.clear();
                          }),
                          children: [
                            const AIcon(AIcons.bookmark, size: 12),
                            Text(tr('blogscreen_saxlanilanlar_8882c1', 'Saxlanılanlar')),
                            if (savedIds.isNotEmpty) Text('· ${savedIds.length}', style: const TextStyle(fontWeight: FontWeight.w800)),
                          ],
                        ),
                      ],
                      for (final category in categories) ...[
                        const SizedBox(width: 8),
                        BlogTag(
                          key: ValueKey('blog-category-${category['slug']}'),
                          on: _selectedCategory == category['slug'] && !_showSaved,
                          onTap: () => setState(() {
                            _selectedCategory = '${category['slug']}';
                            _showSaved = false;
                          }),
                          children: [Text('${category['icon'] ?? ''}'), Text('${category['name'] ?? ''}')],
                        ),
                      ],
                    ]),
                  ),
                ),
              ),
              if (ads.inlineAnchor != null) ads.inlineAnchor!(context, 'blog_list_banner'),
              if (_selectedCategory == null && query.isEmpty && !_showSaved && featured.isNotEmpty)
                FadeRise(
                  delay: const Duration(milliseconds: 200),
                  child: BlogSection(
                    title: '⭐ ${tr('blogscreen_one_cixan_648e68', 'Önə Çıxan')}',
                    child: SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      clipBehavior: Clip.none,
                      padding: const EdgeInsets.fromLTRB(2, 2, 2, 6),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        for (var i = 0; i < featured.length && i < 3; i++) ...[
                          if (i > 0) const SizedBox(width: 12),
                          FadeRise(dy: 0, dx: 30, delay: Duration(milliseconds: 250 + i * 80), child: _FeaturedCard(post: featured[i], onTap: () => _selectPost(featured[i]))),
                        ],
                      ]),
                    ),
                  ),
                ),
              FadeRise(
                delay: const Duration(milliseconds: 300),
                child: BlogSection(
                  title: listTitle,
                  trailing: Text(formatCount(CountNoun.articles, filtered.length), style: context.aText.aSectionLink),
                  child: filtered.isEmpty
                      ? _emptyCard(context, query)
                      : Container(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
                          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusLg), border: Border.all(color: a.line), boxShadow: a.cardShadow),
                          child: Column(children: [
                            for (var i = 0; i < filtered.length; i++)
                              FadeRise(
                                dy: 10,
                                delay: Duration(milliseconds: ((0.35 + i * 0.03).clamp(0, 0.6) * 1000).round()),
                                child: _ArticleRow(
                                  post: filtered[i],
                                  first: i == 0,
                                  saved: savedIds.contains(filtered[i]['id']),
                                  category: categoryOf('${filtered[i]['category']}'),
                                  onTap: () => _selectPost(filtered[i]),
                                ),
                              ),
                          ]),
                        ),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _emptyCard(BuildContext context, String query) {
    final a = context.a;
    final x = context.aText;
    return ACard(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
      child: Column(children: [
        Container(
          width: 64,
          height: 64,
          margin: const EdgeInsets.only(bottom: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(16)),
          child: AIcon(AIcons.bookOpen, size: 26, color: a.lavInk),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Text(
            _showSaved ? tr('blogscreen_saxlanilmis_meqale_yoxdur_a9cc59', 'Saxlanılmış məqalə yoxdur') : tr('blogscreen_meqale_tapilmadi_746d12', 'Məqalə tapılmadı'),
            textAlign: TextAlign.center,
            style: x.aListTitle,
          ),
        ),
        Text(
          _showSaved
              ? tr('blogscreen_beyendiyiniz_meqaleleri_saxlay_a35db1', 'Bəyəndiyiniz məqalələri saxlayın')
              : query.isNotEmpty
                  ? tr('blogscreen_ferqli_acar_sozlerle_axtarin_cb3a83', 'Fərqli açar sözlərlə axtarın')
                  : tr('blogscreen_tezlikle_yeni_meqaleler_elave__20524a', 'Tezliklə yeni məqalələr əlavə olunacaq'),
          textAlign: TextAlign.center,
          style: x.aListSub.copyWith(height: 1.5),
        ),
      ]),
    );
  }

  Widget _loadingView(BuildContext context) {
    final a = context.a;
    return BlogMinScreen(
      child: ColoredBox(
        color: a.bg,
        child: Stack(children: [
          Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _Pulse(
                child: Container(
                  width: 64,
                  height: 64,
                  margin: const EdgeInsets.only(bottom: 16),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: a.gradLav, borderRadius: BorderRadius.circular(16)),
                  child: AIcon(AIcons.bookOpen, size: 28, color: a.lavInk),
                ),
              ),
              Text(tr('blogscreen_meqaleler_yuklenir_3f3d01', 'Məqalələr yüklənir...'), style: context.aText.aListSub),
            ]),
          ),
          PositionedDirectional(
            start: 16,
            top: 16,
            child: AIconBtn(onTap: widget.onBack, semanticLabel: tr('common_geri', 'Geri'), icon: const AIcon(AIcons.arrowLeft, size: 18, mirrorInRtl: true)),
          ),
        ]),
      ),
    );
  }
}

/// Tailwind `animate-pulse` (opacity 1 → .5 → 1, 2 s, cubic-bezier(.4,0,.6,1)).
class _Pulse extends StatefulWidget {
  const _Pulse({required this.child});
  final Widget child;
  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 2));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
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
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final t = const Cubic(0.4, 0, 0.6, 1).transform(_c.value < 0.5 ? _c.value * 2 : (1 - _c.value) * 2);
          return Opacity(opacity: 1 - 0.5 * t, child: child);
        },
        child: widget.child,
      );
}

/// `.a-hscroll-card` featured article (240 wide, cover 120).
class _FeaturedCard extends StatelessWidget {
  const _FeaturedCard({required this.post, required this.onTap});
  final BlogPost post;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final cover = post['cover_image_url'];
    final excerpt = post['excerpt'];
    return Semantics(
      button: true,
      child: GestureDetector(
        key: ValueKey('featured-${post['id']}'),
        onTap: onTap,
        child: Container(
          width: 240,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), border: Border.all(color: a.line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            SizedBox(
              height: 120,
              child: Stack(fit: StackFit.expand, children: [
                if (cover is String && cover.isNotEmpty)
                  CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover, errorWidget: (_, _, _) => const SizedBox())
                else
                  DecoratedBox(
                    decoration: BoxDecoration(gradient: a.gradLav),
                    child: Center(child: AIcon(AIcons.bookOpen, size: 32, color: a.lavInk.withValues(alpha: 0.5))),
                  ),
                PositionedDirectional(
                  top: 8,
                  start: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                    child: Text('⭐ ${tr('blogscreen_secilmis_1fa6ef', 'Seçilmiş')}', style: px(9.5, weight: FontWeight.w800, color: a.accentInk, ls: 0.03)),
                  ),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text('${post['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: px(13, weight: FontWeight.w700, color: a.ink)),
                ),
                if (excerpt is String) Text(excerpt, maxLines: 2, overflow: TextOverflow.ellipsis, style: px(11.5, color: a.inkSoft)),
                BlogMeta(top: 8, items: [
                  (AIcons.clock, '${post['reading_time']} ${tr('blogscreen_deq_780a5c', 'dəq')}'),
                  (AIcons.eye, '${post['view_count']}'),
                ]),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}

/// `.a-article-row`.
class _ArticleRow extends StatelessWidget {
  const _ArticleRow({required this.post, required this.first, required this.saved, required this.category, required this.onTap});
  final BlogPost post;
  final bool first;
  final bool saved;
  final Map<String, dynamic>? category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final cover = post['cover_image_url'];
    final name = category?['name'];
    return Semantics(
      button: true,
      child: GestureDetector(
        key: ValueKey('blog-row-${post['id']}'),
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.only(top: first ? 2 : 13, bottom: 13),
          decoration: BoxDecoration(border: first ? null : Border(top: BorderSide(color: a.line))),
          child: Row(children: [
            SizedBox(
              width: 52,
              height: 52,
              child: Stack(children: [
                Positioned.fill(
                  child: Container(
                    clipBehavior: Clip.antiAlias,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: a.lav1, borderRadius: BorderRadius.circular(15)),
                    child: cover is String && cover.isNotEmpty
                        ? CachedNetworkImage(imageUrl: cover, width: 52, height: 52, fit: BoxFit.cover, errorWidget: (_, _, _) => const SizedBox())
                        : AIcon(AIcons.bookOpen, size: 20, color: a.lavInk),
                  ),
                ),
                if (saved)
                  PositionedDirectional(
                    top: 3,
                    end: 3,
                    child: Container(
                      width: 18,
                      height: 18,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.yellow2, shape: BoxShape.circle),
                      child: const LucideFilled(AIcons.bookmark, size: 9, color: Color(0xFFFFFFFF)),
                    ),
                  ),
              ]),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    '${category?['icon'] ?? ''} ${name is String && name.isNotEmpty ? name : post['category'] ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.aText.aListValue.copyWith(color: a.peach2),
                  ),
                ),
                Text('${post['title'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: px(12.5, weight: FontWeight.w700, color: a.ink, height: 1.35)),
                BlogMeta(items: [
                  (AIcons.clock, '${post['reading_time']} ${tr('blogscreen_deq_780a5c', 'dəq')}'),
                  (AIcons.eye, '${post['view_count']}'),
                ]),
              ]),
            ),
            const SizedBox(width: 13),
            AIcon(AIcons.chevronRight, size: 15, color: a.inkFaint, mirrorInRtl: true),
          ]),
        ),
      ),
    );
  }
}
