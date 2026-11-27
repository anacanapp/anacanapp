// Ported from: src/hooks/useCommunity.push.test.tsx, src/hooks/useCommunity.moderation.test.tsx
import 'dart:async';

import 'package:anacan/features/community/copy/community_copy.dart';
import 'package:anacan/features/community/data/community.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/data/community_env.dart';
import 'package:anacan/features/community/data/community_toasts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

const actorId = '11111111-1111-4111-8111-111111111111';
const authorId = '22222222-2222-4222-8222-222222222222';
const postId = '33333333-3333-4333-8333-333333333333';
const groupId = '44444444-4444-4444-8444-444444444444';
const interactionId = '55555555-5555-4555-8555-555555555555';
const commentId = '66666666-6666-4666-8666-666666666666';

void main() {
  late FakeCommunityBackend backend;
  late FakePushSender push;

  setUp(() {
    backend = FakeCommunityBackend()..onGetUser = () async => actorId;
    push = FakePushSender();
  });

  ProviderContainer make({String user = actorId, bool userFromState = false, List<Override> extra = const []}) {
    final container = communityContainer([
      ...communityOverrides(backend: backend, push: push, userId: user, userFromState: userFromState),
      ...extra,
    ]);
    return container;
  }

  group('community push interaction binding', () {
    test('uses the inserted post-like id and the post row instead of the caller group value', () async {
      backend.onInsert = (table, values, columns) async => {'id': interactionId};
      backend.onMaybeSingle = (q) async => switch (q.table) {
            'community_posts' => {'id': postId, 'user_id': authorId, 'group_id': groupId},
            'public_profile_cards' => {'name': 'Actor'},
            _ => null,
          };
      final c = make();
      listen(c, toggleLikeMutation);
      await c.read(toggleLikeMutation.notifier).mutateAsync(const LikeVars(postId: postId, isLiked: false, groupId: null, viewerId: actorId));
      await until(() => push.payloads.length == 1);
      expect(backend.named('insert').single.args[2], 'id');
      expect(push.payloads.single.userId, authorId);
      expect(push.payloads.single.data,
          {'type': 'community_like', 'context': 'community_post', 'postId': postId, 'groupId': groupId, 'interactionId': interactionId});
    });

    test('binds a comment-like push to the inserted like row', () async {
      backend.onInsert = (table, values, columns) async => {'id': interactionId};
      backend.onMaybeSingle = (q) async => switch (q.table) {
            'post_comments' => {'id': commentId, 'user_id': authorId, 'post_id': postId, 'content': 'Comment'},
            'public_profile_cards' => {'name': 'Actor'},
            _ => null,
          };
      final c = make();
      listen(c, toggleCommentLikeMutation);
      await c.read(toggleCommentLikeMutation.notifier).mutateAsync((commentId: commentId, postId: postId, isLiked: false));
      await until(() => push.payloads.length == 1);
      expect(push.payloads.single.userId, authorId);
      expect(push.payloads.single.data,
          {'type': 'comment_like', 'context': 'post_comment', 'commentId': commentId, 'postId': postId, 'interactionId': interactionId});
    });

    test('resolves a root comment recipient from the post and sends the inserted comment id', () async {
      backend.onInsert = (table, values, columns) async => {'id': interactionId, 'post_id': postId, 'parent_comment_id': null};
      backend.onMaybeSingle = (q) async => q.table == 'community_posts' ? {'user_id': authorId} : null;
      final c = make();
      listen(c, createCommentMutation);
      await c.read(createCommentMutation.notifier).mutateAsync(const CreateCommentVars(
          postId: postId, content: 'New comment', postAuthorId: '77777777-7777-4777-8777-777777777777', commenterName: 'Actor'));
      expect(push.payloads.single.userId, authorId);
      expect(push.payloads.single.data, {'type': 'community_comment', 'context': 'community_post', 'postId': postId, 'interactionId': interactionId});
    });

    test('binds a reply to its inserted row and persisted parent context', () async {
      backend.onInsert = (table, values, columns) async => {'id': interactionId, 'post_id': postId, 'parent_comment_id': commentId};
      backend.onMaybeSingle = (q) async => q.table == 'post_comments' ? {'user_id': authorId, 'post_id': postId} : null;
      final c = make();
      listen(c, createCommentMutation);
      await c.read(createCommentMutation.notifier).mutateAsync(
          const CreateCommentVars(postId: postId, content: 'Reply', parentCommentId: commentId, commenterName: 'Actor'));
      expect(push.payloads.single.userId, authorId);
      expect(push.payloads.single.data,
          {'type': 'community_reply', 'context': 'post_comment', 'commentId': commentId, 'postId': postId, 'interactionId': interactionId});
    });

    test('sends a non-empty body for an image-only reply (empty text)', () async {
      backend.onInsert = (table, values, columns) async => {'id': interactionId, 'post_id': postId, 'parent_comment_id': commentId};
      backend.onMaybeSingle = (q) async => q.table == 'post_comments' ? {'user_id': authorId, 'post_id': postId} : null;
      final c = make();
      listen(c, createCommentMutation);
      await c.read(createCommentMutation.notifier).mutateAsync(const CreateCommentVars(
          postId: postId, content: '', imageUrl: 'https://example.test/photo.jpg', parentCommentId: commentId, commenterName: 'Actor'));
      final payload = push.payloads.single;
      expect(payload.kind, 'community_reply');
      expect(payload.title.trim(), isNot(''));
      expect(payload.body.trim(), isNot(''));
    });
  });

  group('server-held post creation', () {
    const owner = 'c35b3d1e-0f96-4cc0-a8c3-80d651c3f60c';
    const input = CreatePostVars(groupId: null, content: 'SifariÅŸ Ã¼Ã§Ã¼n yazÄ±n', language: 'az', isAnonymous: true);
    late List<(String, String, String)> tracked;
    late int ids;

    setUp(() {
      tracked = [];
      ids = 0;
      backend.onGetUser = () async => owner;
      backend.onRpc = (fn, params) async => {'id': 'post-id', 'state': 'checking', 'revision': 1};
    });

    ProviderContainer makeOwner({bool userFromState = false}) => make(user: owner, userFromState: userFromState, extra: [
          communityPostCreatedTrackerProvider.overrideWithValue((actor, backendUrl, request) => tracked.add((actor, backendUrl, request))),
          communityUuidProvider.overrideWithValue(() => 'request-${++ids}'),
        ]);

    test('keeps anonymous/media/group/blog fields and reports checking instead of publication', () async {
      final c = makeOwner();
      listen(c, createPostMutation);
      await c.read(createPostMutation.notifier).mutateAsync(const CreatePostVars(
        groupId: null, content: 'SifariÅŸ Ã¼Ã§Ã¼n yazÄ±n', language: 'az', isAnonymous: true, //
        mediaUrls: ['https://example.invalid/image.png'], taggedGroupIds: ['group-a', 'group-a'], blogPostId: 'article-a',
      ));
      final args = backend.rpcArgs('submit_community_post_v2').single!;
      expect(args, containsPair('p_actor', owner));
      expect(args, containsPair('p_content', input.content));
      expect(args, containsPair('p_language', 'az'));
      expect(args, containsPair('p_auto_language', false));
      expect(args, containsPair('p_is_anonymous', true));
      expect(args['p_media_urls'], ['https://example.invalid/image.png']);
      expect(args['p_tagged_group_ids'], ['group-a']);
      expect(args, containsPair('p_blog_post_id', 'article-a'));
      expect(args['p_id'], isA<String>());
      expect(backend.named('select'), isEmpty);
      expect(backend.named('insert'), isEmpty);
      final toast = c.read(communityToastsProvider).history.last;
      expect(toast.title, moderationText('checking_title', 'az'));
      expect(toast.description, moderationText('checking_body', 'az'));
      await until(() => tracked.isNotEmpty);
      expect(tracked.single, (owner, 'https://api.anacan.az', args['p_id']));
    });

    test('distinguishes automatic inference from an explicit language chip choice', () async {
      final c = makeOwner();
      listen(c, createPostMutation);
      const text = 'Salam qizlar bir sualim var, nece edim?';
      await c.read(createPostMutation.notifier).mutateAsync(const CreatePostVars(groupId: null, content: text));
      expect(backend.rpcArgs('submit_community_post_v2').last, allOf(containsPair('p_language', 'az'), containsPair('p_auto_language', true)));
      await c.read(createPostMutation.notifier).mutateAsync(const CreatePostVars(groupId: null, content: text, language: 'tr', autoLanguage: false));
      expect(backend.rpcArgs('submit_community_post_v2').last, allOf(containsPair('p_language', 'tr'), containsPair('p_auto_language', false)));
    });

    test('reuses the request ID after a lost response and never falls back to an unmoderated insert', () async {
      var first = true;
      backend.onRpc = (fn, params) async {
        if (first) {
          first = false;
          throw const CommunityBackendError(message: 'network error');
        }
        return {'id': 'post-id', 'state': 'checking', 'revision': 1};
      };
      final c = makeOwner();
      listen(c, createPostMutation);
      await expectLater(c.read(createPostMutation.notifier).mutateAsync(input), throwsA(anything));
      expect(tracked, isEmpty);
      final id = backend.rpcArgs('submit_community_post_v2')[0]!['p_id'];
      await c.read(createPostMutation.notifier).mutateAsync(input);
      expect(backend.rpcArgs('submit_community_post_v2')[1]!['p_id'], id);
      await c.read(createPostMutation.notifier).mutateAsync(input);
      expect(backend.rpcArgs('submit_community_post_v2')[2]!['p_id'], isNot(id));
      expect(backend.named('insert'), isEmpty);
    });

    test('preserves a draft with a clear unavailable message when Source installation is pending', () async {
      backend.onRpc = (fn, params) async => throw const CommunityBackendError(code: 'PGRST202');
      final c = makeOwner();
      listen(c, createPostMutation);
      await expectLater(c.read(createPostMutation.notifier).mutateAsync(input), throwsA(anything));
      expect(backend.named('insert'), isEmpty);
      final toast = c.read(communityToastsProvider).history.last;
      expect(toast.title, moderationText('unavailable', 'az'));
      expect(toast.destructive, isTrue);
    });

    test('does not submit under a changed account while authentication is resolving', () async {
      final resolve = Completer<String?>();
      backend.onGetUser = () => resolve.future;
      final c = makeOwner(userFromState: true);
      c.read(testUserProvider.notifier).set(owner);
      final read = listen(c, createPostMutation);
      c.read(createPostMutation.notifier).mutate(input);
      await until(() => backend.named('getUser').isNotEmpty);
      c.read(testUserProvider.notifier).set('other-user');
      resolve.complete(owner);
      await until(() => read().isError);
      expect(backend.rpcArgs('submit_community_post_v2'), isEmpty);
    });
  });

  test('edits use the guarded RPC with the expected revision, without a direct REST fallback', () async {
    const owner = 'c35b3d1e-0f96-4cc0-a8c3-80d651c3f60c';
    backend.onGetUser = () async => owner;
    backend.onRpc = (fn, params) async => {'id': 'post-id', 'state': 'checking', 'revision': 1};
    final c = make(user: owner);
    listen(c, editPostMutation);
    await c.read(editPostMutation.notifier).mutateAsync(const EditPostVars(postId: 'post-id', content: 'Yeni mÉ™tn', currentLanguage: 'az', expectedRevision: 4));
    final args = backend.rpcArgs('edit_community_post_v1').single!;
    expect(args, allOf(containsPair('p_actor', owner), containsPair('p_post', 'post-id'), containsPair('p_expected_revision', 4)));
    expect(backend.named('select'), isEmpty);
    expect(backend.named('update'), isEmpty);
  });
}
