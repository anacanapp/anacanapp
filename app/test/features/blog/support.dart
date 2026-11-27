// Ported from: (test support for the blog port — no React counterpart)
import 'package:anacan/core/data/data.dart';
import 'package:anacan/features/blog/data/blog_backend.dart';
import 'package:anacan/features/blog/ui/blog_ui.dart';
import 'package:anacan/shell/shell.dart';
import 'package:anacan/state/state.dart' show LocalStore;
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/nav/shell_test_support.dart' show FakePlatform;
import '../settings/support/harness.dart';

Map<String, dynamic> blogPost(String id, {String? slug, String category = 'baby', bool featured = false, String lifeStage = 'all', Map<String, dynamic> extra = const {}}) => {
      'id': id,
      'slug': slug ?? 'post-$id',
      'title': 'Title $id',
      'excerpt': 'Excerpt $id',
      'content': '## Heading $id\n\nBody of **$id**.',
      'category': category,
      'tags': <String>['tag$id'],
      'author_name': 'Anacan',
      'reading_time': 4,
      'view_count': 10,
      'is_featured': featured,
      'is_published': true,
      'life_stage': lifeStage,
      'created_at': '2026-05-01T10:00:00Z',
      'cover_image_url': null,
      ...extra,
    };

class FakeBlogBackend implements BlogBackend {
  FakeBlogBackend({this.posts = const [], this.categories = const []});
  Rows posts;
  Rows categories;
  final List<String> calls = [];
  final Map<String, Rows> commentsByPost = {};
  final Set<String> likes = {};
  final Set<String> saves = {};
  int likesCount = 3;

  @override
  Future<Rows> publishedPosts() async => [for (final p in posts) Map<String, dynamic>.from(p)];
  @override
  Future<Rows> activeCategories() async => categories;
  @override
  Future<Row> postBySlug(String slug) async {
    calls.add('slug:$slug');
    return Map<String, dynamic>.from(posts.firstWhere((p) => p['slug'] == slug));
  }

  @override
  Future<void> incrementViewCount(String postId) async => calls.add('view:$postId');
  @override
  Future<Row?> postStats(String postId) async => {'likes_count': likesCount, 'saves_count': 0, 'comments_count': commentsByPost[postId]?.length ?? 0};
  @override
  Future<bool> hasLike(String postId, String userId) async => likes.contains(postId);
  @override
  Future<bool> hasSave(String postId, String userId) async => saves.contains(postId);
  @override
  Future<void> like(String postId, String userId) async {
    calls.add('like:$postId');
    likes.add(postId);
  }

  @override
  Future<void> unlike(String postId, String userId) async {
    calls.add('unlike:$postId');
    likes.remove(postId);
  }

  @override
  Future<void> save(String postId, String userId) async {
    calls.add('save:$postId');
    saves.add(postId);
  }

  @override
  Future<void> unsave(String postId, String userId) async {
    calls.add('unsave:$postId');
    saves.remove(postId);
  }

  @override
  Future<Rows> comments(String postId) async => [...?commentsByPost[postId]];
  @override
  Future<Rows> profileCards(List<String> userIds) async => [
        for (final id in userIds) {'user_id': id, 'name': id == 'user-1' ? 'Leyla' : 'Aynur', 'avatar_url': null, 'badge_type': id == 'user-1' ? null : 'premium'},
      ];
  @override
  Future<List<String>> likedCommentIds(String userId, List<String> commentIds) async => const [];
  @override
  Future<Row?> addComment({required String postId, required String userId, required String content, String? parentCommentId}) async {
    calls.add('comment:$postId:$content:${parentCommentId ?? '-'}');
    final list = commentsByPost.putIfAbsent(postId, () => []);
    final row = {'id': 'c${list.length + 1}', 'user_id': userId, 'content': content, 'parent_comment_id': parentCommentId, 'likes_count': 0, 'created_at': '2026-05-02T10:00:00Z'};
    list.add(row);
    return row;
  }

  @override
  Future<void> likeComment(String commentId, String userId) async => calls.add('likeComment:$commentId');
  @override
  Future<void> unlikeComment(String commentId, String userId) async => calls.add('unlikeComment:$commentId');
  @override
  Future<void> deactivateComment(String commentId, String userId) async => calls.add('delete:$commentId');
  @override
  Future<List<String>> savedPostIds(String userId) async => saves.toList();
}

class FakeShare extends BlogSharePlatform {
  final List<String> copied = [];
  final List<String> shared = [];
  @override
  Future<void> copy(String value) async => copied.add(value);
  @override
  Future<bool> share({required String title, required String url}) async {
    shared.add(url);
    return true;
  }
}

List<Override> blogOverrides(FakeBlogBackend backend, {FakePlatform? platform, FakeShare? share, bool signedIn = true, LocalStore? store}) => [
      ...baseOverrides(signedIn: signedIn, store: store),
      blogBackendProvider.overrideWithValue(backend),
      shellPlatformProvider.overrideWithValue(platform ?? FakePlatform()),
      blogSharePlatformProvider.overrideWithValue(share ?? FakeShare()),
    ];
