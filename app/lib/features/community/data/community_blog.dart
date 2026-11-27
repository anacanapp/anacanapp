// Ported from: src/lib/community-blog.ts, src/hooks/useBlogAttachment.ts (the search query; the composer state lives
//              in BlogAttachment), src/components/community/CommunityBlogCard.tsx (its query)
import 'package:flutter/foundation.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../shell/links/blog_links.dart';
import '../../../shell/links/js_url.dart';
import 'community_backend.dart';
import 'community_env.dart';

/// `SharedBlog { id, slug, title, excerpt, cover_image_url }`.
@immutable
class SharedBlog {
  const SharedBlog({required this.id, required this.slug, required this.title, this.excerpt, this.coverImageUrl});
  final String id;
  final String slug;
  final String title;
  final String? excerpt;
  final String? coverImageUrl;

  static SharedBlog? tryParse(Object? value) {
    if (!validSharedBlog(value)) return null;
    final map = value is SharedBlog ? value.toJson() : Map<String, dynamic>.from(value as Map);
    return SharedBlog(
      id: map['id'] as String,
      slug: map['slug'] as String,
      title: map['title'] as String,
      excerpt: map['excerpt'] is String ? map['excerpt'] as String : null,
      coverImageUrl: map['cover_image_url'] is String ? map['cover_image_url'] as String : null,
    );
  }

  Map<String, dynamic> toJson() => {'id': id, 'slug': slug, 'title': title, 'excerpt': excerpt, 'cover_image_url': coverImageUrl};

  @override
  bool operator ==(Object other) => other is SharedBlog && other.id == id && other.slug == slug && other.title == title;
  @override
  int get hashCode => Object.hash(id, slug, title);
}

/// `blogCommand(text, cursor)`: the `/blog <search>` command ending at the caret.
({int start, int end, String search})? blogCommand(String text, [int? cursor]) {
  final at = (cursor ?? text.length).clamp(0, text.length);
  final before = text.substring(0, at);
  final match = RegExp(r'(?:^|\s)\/blog(?:[ \t]+([^\n]*))?$', caseSensitive: false).firstMatch(before);
  if (match == null) return null;
  final start = match.start + (RegExp(r'^\s').hasMatch(match.group(0)!) ? 1 : 0);
  final search = (match.group(1) ?? '').trim();
  return (start: start, end: at, search: search.length > 200 ? search.substring(0, 200) : search);
}

final RegExp _blogId = RegExp(r'^[a-f0-9-]{36}$', caseSensitive: false);

/// `validSharedBlog(value)`.
bool validSharedBlog(Object? value) {
  if (value is SharedBlog) return _blogId.hasMatch(value.id) && validBlogSlug(value.slug) && value.title.trim().isNotEmpty;
  if (value is! Map) return false;
  final id = value['id'], title = value['title'];
  return id is String && _blogId.hasMatch(id) && validBlogSlug(value['slug']) && title is String && title.trim().isNotEmpty;
}

/// `blogCardUrl(blog)` = the app hand-off link.
String blogCardUrl(SharedBlog blog) => blogLinks(blog.slug).app;

/// `blogImageUrl(value)`: only http(s) URLs without credentials.
String? blogImageUrl(String? value) {
  final url = JsUrl.parse(value ?? '');
  if (url == null) return null;
  return (url.protocol == 'https:' || url.protocol == 'http:') && url.username.isEmpty && url.password.isEmpty ? url.href : null;
}

/// `useBlogAttachment` search: `['share-blog-search', backend, user, language, search]`.
final shareBlogSearchQuery = queryProviderFamily<List<SharedBlog>, String>((ref, search) {
  final user = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(communityBackendProvider);
  final language = ref.watch(communityLanguageProvider);
  return QueryOptions<List<SharedBlog>>(
    queryKey: ['share-blog-search', ref.watch(communityBackendUrlProvider), user, language, search],
    enabled: user != null,
    staleTime: const Duration(seconds: 30),
    queryFn: (_) async {
      final data = await backend.rpc('search_share_blogs_v1', {'p_language': language, 'p_search': search, 'p_limit': 12});
      if (data is! List || data.any((item) => !validSharedBlog(item))) throw const CommunityBackendError(message: 'BLOG_SEARCH_INVALID');
      return [for (final item in data) SharedBlog.tryParse(item)!];
    },
  );
}, name: 'shareBlogSearchQuery');

/// `CommunityBlogCard` query: `['community-blog-card', backend, user, language, id]`.
final communityBlogCardQuery = queryProviderFamily<SharedBlog?, String>((ref, id) {
  final user = ref.watch(authUserProvider)?.id;
  final backend = ref.watch(communityBackendProvider);
  final language = ref.watch(communityLanguageProvider);
  return QueryOptions<SharedBlog?>(
    queryKey: ['community-blog-card', ref.watch(communityBackendUrlProvider), user, language, id],
    enabled: user != null && id.isNotEmpty,
    staleTime: const Duration(seconds: 30),
    queryFn: (_) async {
      final data = await backend.rpc('search_share_blogs_v1', {'p_language': language, 'p_search': '', 'p_ids': [id], 'p_limit': 1});
      return data is List && data.isNotEmpty ? SharedBlog.tryParse(data.first) : null;
    },
  );
}, name: 'communityBlogCardQuery');
