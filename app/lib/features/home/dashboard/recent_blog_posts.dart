// Ported from: src/components/dashboard/RecentBlogPosts.tsx (variant "anacan": BlogCarousel, loading card,
//              stage filter), src/lib/blog-editorial.ts (blogEditorial, blogMatchesStage),
//              src/styles/anacan-design.css (.a-blog-rail, .a-blog-card, .a-blog-cover, .a-blog-chip, .a-blog-cap,
//              .a-blog-title, .a-blog-excerpt, .a-blog-dots)
import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' hide Row;
import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../state/user_store.dart';
import '../data/home_repository.dart';
import '../widgets/home_widgets.dart';

/// `useBlog()` → `{posts, loading}`. Default: published posts with title / excerpt translated (stand-in until the
/// blog feature, which owns country filtering and editorial localisation, overrides [homeBlogPostsProvider]).
typedef HomeBlogPosts = ({Rows posts, bool loading});

final _defaultBlogPostsQuery = queryProvider<Rows>((ref) {
  final language = ref.watch(userStoreProvider.select((s) => s.language));
  return QueryOptions<Rows>(
    queryKey: ['home-recent-blog-posts', language],
    staleTime: const Duration(seconds: 60),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await ref.read(homeRepositoryProvider).blogPosts(), language, const ['title', 'excerpt']),
  );
});

final homeBlogPostsProvider = Provider<HomeBlogPosts>((ref) {
  final q = ref.watch(_defaultBlogPostsQuery);
  return (posts: q.data ?? const <Map<String, dynamic>>[], loading: q.isLoading);
});

/// `blogMatchesStage(post, stage)`.
bool blogMatchesStage(Map<String, dynamic> post, String stage) {
  final meta = post['editorial_metadata'];
  List<Object?>? stages;
  if (meta is Map &&
      meta['schema'] == 'anacan-blog-editorial-v1' &&
      meta['locales'] is Map &&
      meta['lifeStages'] is List &&
      meta['modules'] is List &&
      meta['relatedSlugs'] is List) {
    stages = meta['lifeStages'] as List<Object?>;
  }
  if (stages != null && stages.isNotEmpty) return stages.contains(stage);
  return post['life_stage'] == stage || post['life_stage'] == 'all';
}

const Duration blogAutoplay = Duration(milliseconds: 5000);
const Duration blogResumeAfterTouch = Duration(milliseconds: 8000);

class RecentBlogPosts extends ConsumerWidget {
  const RecentBlogPosts({super.key, required this.onNavigate, this.lifeStage});
  final void Function(String screen) onNavigate;
  final String? lifeStage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blog = ref.watch(homeBlogPostsProvider);
    final filtered = lifeStage == null ? blog.posts : blog.posts.where((p) => blogMatchesStage(p, lifeStage!)).toList();
    if (blog.loading) {
      return AHomeSection(
        child: APulse(
          child: ACard(child: const SizedBox(height: 230 - 36)),
        ),
      );
    }
    if (filtered.isEmpty) return const SizedBox.shrink();
    return BlogCarousel(posts: filtered.take(9).toList(), onNavigate: onNavigate);
  }
}

/// Swipeable, auto-advancing article cards; autoplay pauses after a touch and under reduced motion.
class BlogCarousel extends StatefulWidget {
  const BlogCarousel({super.key, required this.posts, required this.onNavigate, this.now});
  final Rows posts;
  final void Function(String screen) onNavigate;
  final DateTime Function()? now;

  @override
  State<BlogCarousel> createState() => _BlogCarouselState();
}

class _BlogCarouselState extends State<BlogCarousel> {
  final ScrollController _rail = ScrollController();
  int _active = 0;
  DateTime _pausedUntil = DateTime.fromMillisecondsSinceEpoch(0);
  Timer? _timer;
  double _step = 1;

  DateTime _now() => (widget.now ?? DateTime.now)();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _timer?.cancel();
    _timer = null;
    if (widget.posts.length < 2 || animationsDisabled(context)) return;
    _timer = Timer.periodic(blogAutoplay, (_) {
      if (!mounted || _now().isBefore(_pausedUntil)) return;
      _goTo((_active + 1) % widget.posts.length);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _rail.dispose();
    super.dispose();
  }

  void _goTo(int index) {
    if (!_rail.hasClients) return;
    _active = index;
    unawaited(_rail.animateTo(index * _step, duration: const Duration(milliseconds: 400), curve: ACurves.cssEaseInOut));
  }

  void _pause() => _pausedUntil = _now().add(blogResumeAfterTouch);

  bool _onScroll(ScrollNotification n) {
    if (n.metrics.axis != Axis.horizontal) return false;
    final i = (n.metrics.pixels.abs() / _step).round().clamp(0, widget.posts.length - 1);
    if (i != _active) setState(() => _active = i);
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final x = context.aText;
    return AHomeSection(
      title: tr('recentblogposts_son_meqaleler_0618a6', 'Son Məqalələr'),
      trailing: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => widget.onNavigate('blog'),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(tr('blogscreen_all_filter', 'Hamısı'), style: x.aSectionLink),
            const SizedBox(width: 2),
            AIcon(AIcons.chevronRight, size: 13, color: t.onBgSoft, mirrorInRtl: true),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          LayoutBuilder(
            builder: (context, c) {
              // `.a-blog-rail`: margin-inline -20px, padding 2 20 10; cards `calc(100% - 40px)` of the rail's
              // content box (railW - 40), so the next card peeks in.
              final railW = c.maxWidth + 40;
              final cardW = railW - 40 - 40;
              _step = cardW + 12;
              final coverH = cardW * 21 / 40;
              final rtl = Directionality.of(context) == TextDirection.rtl;
              return Transform.translate(
                offset: Offset(rtl ? 20 : -20, 0),
                child: SizedBox(
                  width: railW,
                  child: Listener(
                    onPointerDown: (_) => _pause(),
                    onPointerSignal: (_) => _pause(),
                    child: NotificationListener<ScrollNotification>(
                      onNotification: _onScroll,
                      child: SizedBox(
                        height: 4 + coverH + 12 + 2 * 14.5 * 1.3 + 5 + 2 * 12.5 * 1.45 + 14 + 10,
                        child: ListView.separated(
                          key: const ValueKey('blog-rail'),
                          controller: _rail,
                          scrollDirection: Axis.horizontal,
                          physics: _SnapPhysics(step: _step),
                          padding: const EdgeInsets.fromLTRB(20, 2, 20, 10),
                          itemCount: widget.posts.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 12),
                          itemBuilder: (context, i) => _BlogCard(
                            post: widget.posts[i],
                            width: cardW,
                            coverHeight: coverH,
                            onTap: () => widget.onNavigate('blog/${widget.posts[i]['slug']}'),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          if (widget.posts.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: ExcludeSemantics(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < widget.posts.length; i++) ...[
                      if (i > 0) const SizedBox(width: 5),
                      AnimatedContainer(
                        key: ValueKey('blog-dot-$i'),
                        duration: const Duration(milliseconds: 200),
                        curve: ACurves.cssEase,
                        width: i == _active ? 16 : 6,
                        height: 6,
                        decoration: BoxDecoration(color: i == _active ? t.peach2 : t.lineStrong, borderRadius: BorderRadius.circular(999)),
                      ),
                    ],
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _BlogCard extends StatelessWidget {
  const _BlogCard({required this.post, required this.width, required this.coverHeight, required this.onTap});
  final Map<String, dynamic> post;
  final double width;
  final double coverHeight;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = AnacanTokens.of(context);
    final t = tokens.a;
    final cover = post.str('cover_image_url');
    final excerpt = post.str('excerpt');
    return GestureDetector(
      onTap: onTap,
      child: PressScale.css(
        scale: 0.98,
        duration: ADurations.press,
        child: Container(
          width: width,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(t.radiusLg), boxShadow: t.cardShadow),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: coverHeight,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(color: tokens.isDark ? t.surfaceSoft : t.peach1),
                    if (cover != null && cover.isNotEmpty)
                      CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover, errorWidget: (_, _, _) => const SizedBox())
                    else
                      Center(child: AIcon(AIcons.bookOpen, size: 28, color: t.accentInk)),
                    PositionedDirectional(
                      top: 10,
                      start: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(999)),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            AIcon(AIcons.clock, size: 11, color: t.ink),
                            const SizedBox(width: 4),
                            Text(
                              '${post['reading_time'] ?? ''} ${tr('recentblogposts_deq_780a5c', 'dəq')}',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: t.ink, height: 1.5),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ClipRect(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          post.str('title') ?? '',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, height: 1.3, color: t.ink),
                        ),
                        if (excerpt != null && excerpt.isNotEmpty) ...[
                          const SizedBox(height: 5),
                          Text(
                            excerpt,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(fontSize: 12.5, height: 1.45, color: t.inkSoft),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// `scroll-snap-type: x mandatory` with `scroll-padding-inline: 20px`: settles on a card start.
class _SnapPhysics extends ScrollPhysics {
  const _SnapPhysics({required this.step, super.parent});
  final double step;

  @override
  _SnapPhysics applyTo(ScrollPhysics? ancestor) => _SnapPhysics(step: step, parent: buildParent(ancestor));

  @override
  Simulation? createBallisticSimulation(ScrollMetrics position, double velocity) {
    if ((velocity <= 0 && position.pixels <= position.minScrollExtent) || (velocity >= 0 && position.pixels >= position.maxScrollExtent)) {
      return super.createBallisticSimulation(position, velocity);
    }
    var page = position.pixels / step;
    if (velocity < -toleranceFor(position).velocity) {
      page = page.floorToDouble();
    } else if (velocity > toleranceFor(position).velocity) {
      page = page.ceilToDouble();
    } else {
      page = page.roundToDouble();
    }
    final target = (page * step).clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((target - position.pixels).abs() < toleranceFor(position).distance) return null;
    return ScrollSpringSimulation(spring, position.pixels, target, velocity, tolerance: toleranceFor(position));
  }

  @override
  bool get allowImplicitScrolling => false;
}
