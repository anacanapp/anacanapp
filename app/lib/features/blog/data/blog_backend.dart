// Ported from: src/hooks/useBlog.ts (the blog_posts / blog_categories reads), src/hooks/useBlogInteractions.ts (likes,
//              saves, comments, profiles), src/components/BlogScreen.tsx (increment_blog_view_count),
//              src/lib/supabaseFetchAll.ts (fetchAllRows: pages of 1000)
//
// The app reads the normal blog projection (never the admin `X-Anacan-Blog-Format: source-v1` raw format).
// Tests override [blogBackendProvider] with a fake.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestTransformBuilder;

import '../../../core/data/data.dart';

abstract interface class BlogBackend {
  /// Published posts with their category slugs, newest first, at most 200.
  Future<Rows> publishedPosts();

  /// Active categories by `sort_order` (all pages).
  Future<Rows> activeCategories();

  /// `select('*').eq('slug').eq('is_published', true).single()`: throws when there is no single row.
  Future<Row> postBySlug(String slug);

  /// `rpc('increment_blog_view_count', { post_id })`.
  Future<void> incrementViewCount(String postId);

  /// `likes_count, saves_count, comments_count` of a post (null when not found).
  Future<Row?> postStats(String postId);
  Future<bool> hasLike(String postId, String userId);
  Future<bool> hasSave(String postId, String userId);
  Future<void> like(String postId, String userId);
  Future<void> unlike(String postId, String userId);
  Future<void> save(String postId, String userId);
  Future<void> unsave(String postId, String userId);

  /// Active comments of a post, oldest first (all pages).
  Future<Rows> comments(String postId);

  /// `public_profile_cards` (`user_id, name, avatar_url, badge_type`) of the users.
  Future<Rows> profileCards(List<String> userIds);

  /// Comment ids among [commentIds] the user liked.
  Future<List<String>> likedCommentIds(String userId, List<String> commentIds);

  /// Inserts a comment; throws on error.
  Future<Row?> addComment({required String postId, required String userId, required String content, String? parentCommentId});
  Future<void> likeComment(String commentId, String userId);
  Future<void> unlikeComment(String commentId, String userId);

  /// Soft delete (`is_active: false`) of the user's own comment.
  Future<void> deactivateComment(String commentId, String userId);

  /// Post ids the user saved (all pages).
  Future<List<String>> savedPostIds(String userId);
}

/// `fetchAllRows((from, to) => query.range(from, to))`.
Future<Rows> fetchAllBlogRows(PostgrestTransformBuilder<List<Map<String, dynamic>>> Function(int from, int to) page) async {
  const size = 1000;
  final out = <Row>[];
  for (var from = 0;; from += size) {
    final rows = asRows(await page(from, from + size - 1));
    out.addAll(rows);
    if (rows.length < size) return out;
  }
}

class SupabaseBlogBackend implements BlogBackend {
  SupabaseBlogBackend(this.db);
  final Db db;

  @override
  Future<Rows> publishedPosts() async => asRows(await db
      .from('blog_posts')
      .select('*, blog_post_categories(category_id, blog_categories(slug))')
      .eq('is_published', true)
      .order('created_at', ascending: false)
      .limit(200));

  @override
  Future<Rows> activeCategories() =>
      fetchAllBlogRows((from, to) => db.from('blog_categories').select().eq('is_active', true).order('sort_order', ascending: true).range(from, to));

  @override
  Future<Row> postBySlug(String slug) async => Map<String, dynamic>.from(await db.from('blog_posts').select().eq('slug', slug).eq('is_published', true).single());

  @override
  Future<void> incrementViewCount(String postId) async => db.rpc<Object?>('increment_blog_view_count', params: {'post_id': postId});

  @override
  Future<Row?> postStats(String postId) async =>
      asRow(await db.from('blog_posts').select('likes_count, saves_count, comments_count').eq('id', postId).maybeSingle());

  @override
  Future<bool> hasLike(String postId, String userId) async =>
      await db.from('blog_post_likes').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle() != null;

  @override
  Future<bool> hasSave(String postId, String userId) async =>
      await db.from('blog_post_saves').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle() != null;

  @override
  Future<void> like(String postId, String userId) async => db.from('blog_post_likes').insert({'post_id': postId, 'user_id': userId});

  @override
  Future<void> unlike(String postId, String userId) async => db.from('blog_post_likes').delete().eq('post_id', postId).eq('user_id', userId);

  @override
  Future<void> save(String postId, String userId) async => db.from('blog_post_saves').insert({'post_id': postId, 'user_id': userId});

  @override
  Future<void> unsave(String postId, String userId) async => db.from('blog_post_saves').delete().eq('post_id', postId).eq('user_id', userId);

  @override
  Future<Rows> comments(String postId) => fetchAllBlogRows((from, to) =>
      db.from('blog_comments').select().eq('post_id', postId).eq('is_active', true).order('created_at', ascending: true).range(from, to));

  @override
  Future<Rows> profileCards(List<String> userIds) => fetchAllBlogRows(
      (from, to) => db.from('public_profile_cards').select('user_id, name, avatar_url, badge_type').inFilter('user_id', userIds).range(from, to));

  @override
  Future<List<String>> likedCommentIds(String userId, List<String> commentIds) async {
    final rows = await fetchAllBlogRows(
        (from, to) => db.from('blog_comment_likes').select('comment_id').eq('user_id', userId).inFilter('comment_id', commentIds).range(from, to));
    return [for (final r in rows) '${r['comment_id']}'];
  }

  @override
  Future<Row?> addComment({required String postId, required String userId, required String content, String? parentCommentId}) async =>
      asRow(await db
          .from('blog_comments')
          .insert({'post_id': postId, 'user_id': userId, 'content': content, 'parent_comment_id': parentCommentId})
          .select()
          .single());

  @override
  Future<void> likeComment(String commentId, String userId) async => db.from('blog_comment_likes').insert({'comment_id': commentId, 'user_id': userId});

  @override
  Future<void> unlikeComment(String commentId, String userId) async =>
      db.from('blog_comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);

  @override
  Future<void> deactivateComment(String commentId, String userId) async =>
      db.from('blog_comments').update({'is_active': false}).eq('id', commentId).eq('user_id', userId);

  @override
  Future<List<String>> savedPostIds(String userId) async {
    final rows = await fetchAllBlogRows((from, to) => db.from('blog_post_saves').select('post_id').eq('user_id', userId).range(from, to));
    return [for (final r in rows) '${r['post_id']}'];
  }
}

final blogBackendProvider = Provider<BlogBackend>((ref) => SupabaseBlogBackend(ref.watch(dbProvider)), name: 'blogBackendProvider');
