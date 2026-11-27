// Ported from: src/hooks/useBlogInteractions.ts (useBlogInteractions, useSavedPosts)
//
// Component state in React (useState + effects); here a ChangeNotifier the widget owns for its post.
import 'package:flutter/foundation.dart';

import '../../../core/i18n/tr.dart';
import 'blog_backend.dart';

/// `BlogComment` with the joined author card, like state and replies.
class BlogComment {
  BlogComment({
    required this.id,
    required this.userId,
    required this.content,
    required this.parentCommentId,
    required this.likesCount,
    required this.createdAt,
    required this.userName,
    this.userAvatar,
    this.userBadge,
    required this.isLiked,
    List<BlogComment>? replies,
  }) : replies = replies ?? <BlogComment>[];
  final String id;
  final String userId;
  final String content;
  final String? parentCommentId;
  final int likesCount;
  final String createdAt;
  final String userName;
  final String? userAvatar;
  final String? userBadge;
  final bool isLiked;
  final List<BlogComment> replies;
}

class BlogInteractions extends ChangeNotifier {
  BlogInteractions({required this.backend, required this.postId, required this.userId});
  final BlogBackend backend;
  final String? postId;

  /// `useAuth().user?.id`.
  final String? userId;

  bool isLiked = false;
  bool isSaved = false;
  int likesCount = 0;
  List<BlogComment> comments = const [];
  int commentsCount = 0;
  bool loading = true;
  bool _disposed = false;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  /// The mount effect: stats + like/save state, then the comments.
  Future<void> load() async {
    await Future.wait([fetchInteractions(), fetchComments()]);
  }

  Future<void> fetchInteractions() async {
    final id = postId;
    if (id == null) return;
    try {
      final post = await backend.postStats(id);
      if (post != null) {
        likesCount = (post['likes_count'] as num?)?.toInt() ?? 0;
        commentsCount = (post['comments_count'] as num?)?.toInt() ?? 0;
      }
      final uid = userId;
      if (uid != null) {
        final results = await Future.wait([backend.hasLike(id, uid), backend.hasSave(id, uid)]);
        isLiked = results[0];
        isSaved = results[1];
      }
    } catch (error) {
      debugPrint('Error fetching interactions: $error');
    } finally {
      loading = false;
      _notify();
    }
  }

  Future<void> fetchComments() async {
    final id = postId;
    if (id == null) return;
    try {
      final data = await backend.comments(id);
      final userIds = {for (final c in data) '${c['user_id']}'}.toList();
      final profiles = userIds.isNotEmpty ? await backend.profileCards(userIds) : const <Map<String, dynamic>>[];
      final profileMap = {for (final p in profiles) '${p['user_id']}': p};
      var liked = const <String>[];
      final commentIds = [for (final c in data) '${c['id']}'];
      final uid = userId;
      if (uid != null && commentIds.isNotEmpty) liked = await backend.likedCommentIds(uid, commentIds);
      final enriched = [
        for (final c in data)
          () {
            final profile = profileMap['${c['user_id']}'];
            final name = profile?['name'];
            final avatar = profile?['avatar_url'];
            final badge = profile?['badge_type'];
            final parent = c['parent_comment_id'];
            return BlogComment(
              id: '${c['id']}',
              userId: '${c['user_id']}',
              content: '${c['content'] ?? ''}',
              parentCommentId: parent is String && parent.isNotEmpty ? parent : null,
              likesCount: (c['likes_count'] as num?)?.toInt() ?? 0,
              createdAt: '${c['created_at'] ?? ''}',
              userName: name is String && name.isNotEmpty ? name : tr('usebloginteractions_i_stifadeci_b6bdd6', 'İstifadəçi'),
              userAvatar: avatar is String && avatar.isNotEmpty ? avatar : null,
              userBadge: badge is String && badge.isNotEmpty ? badge : null,
              isLiked: liked.contains('${c['id']}'),
            );
          }(),
      ];
      final parents = enriched.where((c) => c.parentCommentId == null).toList();
      for (final reply in enriched.where((c) => c.parentCommentId != null)) {
        for (final p in parents) {
          if (p.id == reply.parentCommentId) {
            p.replies.add(reply);
            break;
          }
        }
      }
      comments = parents;
      _notify();
    } catch (error) {
      debugPrint('Error fetching comments: $error');
    }
  }

  Future<void> toggleLike() async {
    final id = postId, uid = userId;
    if (uid == null || id == null) return;
    try {
      if (isLiked) {
        await backend.unlike(id, uid);
        isLiked = false;
        likesCount -= 1;
      } else {
        await backend.like(id, uid);
        isLiked = true;
        likesCount += 1;
      }
      _notify();
    } catch (error) {
      debugPrint('Error toggling like: $error');
    }
  }

  Future<void> toggleSave() async {
    final id = postId, uid = userId;
    if (uid == null || id == null) return;
    try {
      if (isSaved) {
        await backend.unsave(id, uid);
        isSaved = false;
      } else {
        await backend.save(id, uid);
        isSaved = true;
      }
      _notify();
    } catch (error) {
      debugPrint('Error toggling save: $error');
    }
  }

  /// `addComment(content, parentCommentId)` → `{ error }` (null = added).
  Future<Object?> addComment(String content, [String? parentCommentId]) async {
    final id = postId, uid = userId;
    if (uid == null || id == null || content.trim().isEmpty) return 'Invalid input';
    try {
      await backend.addComment(postId: id, userId: uid, content: content.trim(), parentCommentId: parentCommentId);
      await fetchComments();
      commentsCount += 1;
      _notify();
      return null;
    } catch (error) {
      debugPrint('Error adding comment: $error');
      return error;
    }
  }

  Future<void> toggleCommentLike(String commentId) async {
    final uid = userId;
    if (uid == null) return;
    try {
      BlogComment? comment;
      for (final c in comments) {
        if (c.id == commentId) comment = c;
      }
      comment ??= comments.expand((c) => c.replies).where((r) => r.id == commentId).firstOrNull;
      if (comment == null) return;
      if (comment.isLiked) {
        await backend.unlikeComment(commentId, uid);
      } else {
        await backend.likeComment(commentId, uid);
      }
      await fetchComments();
    } catch (error) {
      debugPrint('Error toggling comment like: $error');
    }
  }

  Future<void> deleteComment(String commentId) async {
    final uid = userId;
    if (uid == null) return;
    try {
      await backend.deactivateComment(commentId, uid);
      await fetchComments();
      commentsCount -= 1;
      _notify();
    } catch (error) {
      debugPrint('Error deleting comment: $error');
    }
  }
}

/// `useSavedPosts()`.
class SavedPosts extends ChangeNotifier {
  SavedPosts({required this.backend, required this.userId});
  final BlogBackend backend;
  final String? userId;
  List<String> savedPosts = const [];
  bool loading = true;
  bool _disposed = false;

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  Future<void> refetch() async {
    final uid = userId;
    if (uid == null) {
      loading = false;
      if (!_disposed) notifyListeners();
      return;
    }
    try {
      savedPosts = await backend.savedPostIds(uid);
    } catch (error) {
      debugPrint('Error fetching saved posts: $error');
    } finally {
      loading = false;
      if (!_disposed) notifyListeners();
    }
  }
}
