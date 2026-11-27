// Ported from: src/pages/Index.tsx (`blog` / `blog/<slug>` screen with `lifeStage`), src/components/ToolsHub.tsx
//              (`case 'blog'`), src/components/blog/BlogLinkHost.tsx (the article reader over the current layer),
//              src/pages/BlogLink.tsx (native: remember + `/`, done by the shell router), src/hooks/useBlog.ts
//              (RecentBlogPosts' `useBlog().posts`), src/components/tools/HospitalBag.tsx (`<ModuleArticles
//              module="hospitalBag" />`)
//
// Registration and wiring of the blog feature (docs/flutter/WIRING.md):
//   registry: registerBlogFeature
//   featureWiringOverrides(): ...blogWiringOverrides()
//   PregnancyToolSlots(hospitalBagArticles: blogHospitalBagArticles, …)
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/shell.dart';
import '../../state/user_store.dart';
import '../home/dashboard/recent_blog_posts.dart' show homeBlogPostsProvider;
import 'data/use_blog.dart';
import 'ui/blog_screen.dart';
import 'ui/blog_sections.dart' show ModuleArticles;

/// Builds the article reader of the overlay (tests replace it, like the React test mocks BlogScreen).
typedef BlogArticleBuilder = Widget Function(BuildContext context, {required String slug, required String? lifeStage, required VoidCallback onBack});

final blogArticleBuilderProvider = Provider<BlogArticleBuilder>(
  (ref) => (context, {required slug, required lifeStage, required onBack}) => BlogScreen(initialSlug: slug, lifeStage: lifeStage, onBack: onBack),
  name: 'blogArticleBuilderProvider',
);

/// BlogLinkHost dialog content: `<BlogScreen initialSlug lifeStage onBack={close} />` keyed by the slug.
class BlogArticleOverlay extends ConsumerWidget {
  const BlogArticleOverlay({super.key, required this.slug, required this.onClose});
  final String slug;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final top = MediaQuery.paddingOf(context).top;
    return Padding(
      // Full-screen layer: keep the article below the status bar like the sub-screens (`.a-subscreen`).
      padding: EdgeInsets.only(top: top),
      child: MediaQuery.removePadding(
        context: context,
        removeTop: true,
        child: KeyedSubtree(key: ValueKey('blog-overlay:$slug'), child: ref.watch(blogArticleBuilderProvider)(context, slug: slug, lifeStage: lifeStage, onBack: onClose)),
      ),
    );
  }
}

/// Index `blog` / `blog/<slug>`: `<BlogScreen onBack initialSlug lifeStage />`.
class _BlogScreenRoute extends ConsumerWidget {
  const _BlogScreenRoute({required this.onBack, this.initialSlug});
  final VoidCallback onBack;
  final String? initialSlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      BlogScreen(onBack: onBack, initialSlug: initialSlug, lifeStage: ref.watch(userStoreProvider.select((s) => s.lifeStage)));
}

void registerBlogFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.blog, (context, a) => _BlogScreenRoute(onBack: a.onBack, initialSlug: a.screen.initialParam));
  r.registerTool(ToolId.blog, (context, a) => BlogScreen(onBack: a.onBack));
  r.registerOverlay(ShellOverlayId.blogArticle, (context, a) => BlogArticleOverlay(slug: a.slug ?? '', onClose: a.onClose));
}

/// HospitalBag `<ModuleArticles module="hospitalBag" />` for `PregnancyToolSlots.hospitalBagArticles`.
Widget blogHospitalBagArticles(BuildContext context) => const ModuleArticles(module: 'hospitalBag');

/// `featureWiringOverrides()` entries of the blog.
List<Override> blogWiringOverrides() => [
      // RecentBlogPosts: `useBlog()` (country filter, editorial localisation, compacted list).
      homeBlogPostsProvider.overrideWith((ref) {
        final blog = ref.watch(blogProvider);
        return (posts: blog.posts, loading: blog.loading);
      }),
    ];
