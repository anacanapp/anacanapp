// Ported from: src/hooks/useBlog.ts (useBlog, passesCountryFilter, localizeBlogPost, compactBlogPost)
//
// `useBlog()` = [blogProvider]: published posts (country filter, row translation, editorial tags, category slugs,
// compacted to the active language) and active categories, plus the slug / category / search helpers.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../core/i18n/i18n.dart';
import '../../../state/shell_bindings.dart' show backendUrlProvider;
import '../../../state/user_store.dart';
import 'blog_backend.dart';
import 'blog_editorial.dart';

typedef BlogPost = Map<String, dynamic>;

/// `passesCountryFilter(post, country)`: a non-empty include list must hold the country; an exclude list must not.
bool passesCountryFilter(Map<String, dynamic> post, String? country) {
  final inc = post['countries_include'] is List ? [for (final c in post['countries_include'] as List) '$c'] : const <String>[];
  final exc = post['countries_exclude'] is List ? [for (final c in post['countries_exclude'] as List) '$c'] : const <String>[];
  if (inc.isNotEmpty && (country == null || country.isEmpty || !inc.contains(country))) return false;
  if (exc.isNotEmpty && country != null && country.isNotEmpty && exc.contains(country)) return false;
  return true;
}

/// `localizeBlogPost(post, language)`.
BlogPost localizeBlogPost(BlogPost post, String language) {
  final localized = mapRowTranslation(post, language, const ['title', 'content', 'excerpt'])!;
  final locale = blogLocale(post['editorial_metadata'], language);
  final author = post['author_name'];
  final reading = post['reading_time'];
  final views = post['view_count'];
  return {
    ...localized,
    'tags': locale?.tags ?? (post['tags'] is List ? post['tags'] : const <String>[]),
    'author_name': author is String && author.isNotEmpty ? author : 'Anacan',
    'reading_time': reading is num && reading != 0 ? reading : 5,
    'view_count': views is num && views != 0 ? views : 0,
    'cover_image_url': blogCoverUrl(post['cover_image_url']),
  };
}

final RegExp _translationColumn = RegExp(r'^(?:content|title|excerpt)_[a-z]{2}$');

/// `compactBlogPost(post, language)`: drops the per-language columns and other locales' editorial data (the cached
/// list stays small).
Map<String, dynamic> compactBlogPost(Map<String, dynamic> post, String language) {
  final out = <String, dynamic>{
    for (final e in post.entries)
      if (!_translationColumn.hasMatch(e.key)) e.key: e.value,
  };
  final meta = post['editorial_metadata'];
  if (meta is Map && meta['locales'] is Map) {
    final all = meta['locales'] as Map;
    final locales = <String, dynamic>{
      for (final code in [language, 'az'])
        if (all.containsKey(code)) code: all[code],
    };
    out['editorial_metadata'] = {...meta.cast<String, dynamic>(), 'locales': locales};
  }
  return out;
}

/// `getBackendConfig().url` ('' before the backend opened).
final blogBackendUrlProvider = Provider<String>((ref) {
  try {
    return ref.watch(backendUrlProvider);
  } catch (_) {
    return '';
  }
});

/// `useLanguage().language`.
final blogLanguageProvider = Provider<String>((ref) => ref.watch(appLanguageProvider));

/// `profile?.country_code || countryCode || null`.
final blogUserCountryProvider = Provider<String?>((ref) {
  final profile = ref.watch(authProfileProvider)?.countryCode;
  if (profile != null && profile.isNotEmpty) return profile;
  final stored = ref.watch(userStoreProvider.select((s) => s.countryCode));
  return stored != null && stored.isNotEmpty ? stored : null;
});

final blogPostsQuery = queryProvider<Rows>((ref) {
  final backend = ref.watch(blogBackendProvider);
  final language = ref.watch(blogLanguageProvider);
  final country = ref.watch(blogUserCountryProvider);
  return QueryOptions<Rows>(
    queryKey: ['blog-posts-v2', ref.watch(blogBackendUrlProvider), language, country],
    staleTime: const Duration(seconds: 60),
    codec: QueryCodecs.rows,
    queryFn: (_) async {
      final data = await backend.publishedPosts();
      return [
        for (final post in data)
          if (passesCountryFilter(post, country))
            compactBlogPost({
              ...localizeBlogPost(post, language),
              'category_slugs': <String>{
                if (post['category'] != null) '${post['category']}',
                for (final item in (post['blog_post_categories'] is List ? post['blog_post_categories'] as List : const []))
                  if (item is Map && item['blog_categories'] is Map && (item['blog_categories'] as Map)['slug'] is String && ((item['blog_categories'] as Map)['slug'] as String).isNotEmpty)
                    (item['blog_categories'] as Map)['slug'] as String,
              }.toList(),
            }, language),
      ];
    },
  );
}, name: 'blogPostsQuery');

final blogCategoriesQuery = queryProvider<Rows>((ref) {
  final backend = ref.watch(blogBackendProvider);
  final language = ref.watch(blogLanguageProvider);
  return QueryOptions<Rows>(
    queryKey: ['blog-categories-v2', ref.watch(blogBackendUrlProvider), language],
    staleTime: const Duration(seconds: 300),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(await backend.activeCategories(), language, const ['name', 'description']),
  );
}, name: 'blogCategoriesQuery');

/// `useBlog()`.
class BlogData {
  BlogData({required this.posts, required this.categories, required this.loading, required this.error, required this.getPostBySlug, required this.refetch});
  final Rows posts;
  final Rows categories;
  final bool loading;
  final Object? error;

  /// The published post (country-filtered, localized; not compacted) or null.
  final Future<BlogPost?> Function(String slug) getPostBySlug;
  final Future<void> Function() refetch;

  Rows get featuredPosts => posts.where((p) => p['is_featured'] == true).toList();

  Rows getPostsByCategory(String categorySlug) => posts
      .where((p) => p['category'] == categorySlug || (p['category_slugs'] is List && (p['category_slugs'] as List).contains(categorySlug)))
      .toList();

  /// Case-insensitive title / excerpt / tag search.
  Rows searchPosts(String query) {
    final q = query.toLowerCase();
    return posts.where((p) {
      final title = '${p['title'] ?? ''}'.toLowerCase();
      final excerpt = p['excerpt'];
      final tags = p['tags'] is List ? p['tags'] as List : const [];
      return title.contains(q) || (excerpt is String && excerpt.isNotEmpty && excerpt.toLowerCase().contains(q)) || tags.any((t) => '$t'.toLowerCase().contains(q));
    }).toList();
  }
}

final blogProvider = Provider<BlogData>((ref) {
  final posts = ref.watch(blogPostsQuery);
  final categories = ref.watch(blogCategoriesQuery);
  final backend = ref.watch(blogBackendProvider);
  final language = ref.watch(blogLanguageProvider);
  final country = ref.watch(blogUserCountryProvider);
  return BlogData(
    posts: posts.data ?? const [],
    categories: categories.data ?? const [],
    loading: posts.isLoading || categories.isLoading,
    error: posts.error ?? categories.error,
    getPostBySlug: (slug) async {
      try {
        final data = await backend.postBySlug(slug);
        if (!passesCountryFilter(data, country)) return null;
        return localizeBlogPost(data, language);
      } catch (_) {
        return null;
      }
    },
    refetch: () async {
      await Future.wait([ref.read(blogPostsQuery.notifier).refetch(), ref.read(blogCategoriesQuery.notifier).refetch()]);
    },
  );
}, name: 'blogProvider');
