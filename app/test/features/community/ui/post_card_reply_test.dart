// Ported from: src/components/community/PostCard.reply.test.tsx
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/ui/comment_reply.dart';
import 'package:anacan/features/community/ui/post_card.dart';
import 'dart:ui' show Tristate;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show TextField;

import '../support/community_fakes.dart';

final CRow post = {
  'id': 'post', 'user_id': 'author', 'group_id': null, 'content': 'Discussion', 'media_urls': <String>[], //
  'likes_count': 0, 'comments_count': 7, 'is_pinned': false, 'is_anonymous': false,
  'created_at': '2026-09-14T00:00:00Z', 'language': 'az', 'author': {'name': 'Author', 'avatar_url': null},
};
CRow comment(int index) => {
      'id': 'comment-$index', 'post_id': 'post', 'user_id': 'author-$index', //
      'parent_comment_id': index == 0 ? null : 'comment-${index - 1}',
      'content': 'Reply $index', 'likes_count': 0, 'created_at': '2026-09-14T00:0$index:00Z',
      'author': {'name': 'Author $index', 'avatar_url': null},
    };

void main() {
  late FakeCommunityBackend backend;
  late QueryClient client;
  late List<CRow> comments;
  late List<CRow> inserts;
  late bool failNext;

  setUp(() {
    comments = [for (var i = 0; i < 7; i++) comment(i)];
    inserts = [];
    failNext = false;
    client = QueryClient(defaults: const QueryDefaults(retry: noRetry, staleTime: Duration(days: 365000)));
    backend = FakeCommunityBackend();
    backend.onGetUser = () async => 'viewer';
    backend.onRpc = (fn, params) async {
      if (fn != 'community_comments_v2') return null;
      return [
        for (final c in comments) {for (final e in c.entries) if (e.key != 'author') e.key: e.value},
      ];
    };
    backend.onProfileCards = (ids) async => {
          for (final c in comments) '${c['user_id']}': {'user_id': c['user_id'], 'name': (c['author'] as Map)['name']},
        };
    backend.onInsert = (table, values, columns) async {
        if (table == 'post_comments') {
          if (failNext) {
            failNext = false;
            throw const CommunityBackendError(message: 'offline');
          }
          inserts.add(values);
          return {'id': 'new-comment', 'post_id': 'post', 'parent_comment_id': values['parent_comment_id']};
        }
        return {'id': 'row'};
      };
  });

  Future<void> mount(WidgetTester tester, {void Function(String)? onUserClick}) async {
    client.setQueryDataValue(['post-comments', 'post'], comments);
    await pumpCommunity(
      tester,
      Center(child: SingleChildScrollView(child: PostCard(post: post, forceShowComments: true, onUserClick: onUserClick))),
      overrides: communityOverrides(
        backend: backend,
        client: client,
        userId: 'viewer',
        profile: Profile({'id': 'p-viewer', 'user_id': 'viewer', 'name': 'Reader'}),
      ),
    );
    await tester.pump();
  }

  Finder input() => find.byType(TextField);
  Finder commentRow(int index) => find.byWidgetPredicate((w) => w is CommentReply && w.comment['id'] == 'comment-$index');

  Future<void> reply(WidgetTester tester, int index) async {
    if (commentRow(index).evaluate().isEmpty) {
      final toggle = find.textContaining('cavab göstər');
      if (toggle.evaluate().isNotEmpty) {
        await tester.tap(toggle.first);
        await tester.pump();
      }
    }
    final button = find.descendant(of: commentRow(index), matching: find.text('Cavab')).first;
    await tester.ensureVisible(button);
    await tester.tap(button);
    await tester.pump();
  }

  bool focused(WidgetTester tester) => tester.widget<TextField>(input()).focusNode!.hasFocus;

  group('shared full-width comment composer', () {
    testWidgets('opens comments as a sheet with replies folded until "N cavab göstər" is tapped', (tester) async {
      await mount(tester);
      expect(find.text('Şərhlər'), findsOneWidget);
      expect(find.textContaining(RegExp(r'Reply 0$')), findsOneWidget);
      expect(find.textContaining(RegExp(r'Reply 3$')), findsNothing);
      await tester.tap(find.text('6 cavab göstər'));
      await tester.pump();
      expect(find.textContaining(RegExp(r'Reply 3$')), findsOneWidget);
      await flushCommunity(tester);
    });

    testWidgets('uses the same editor through six reply levels and sends the exact selected parent', (tester) async {
      await mount(tester);
      final editor = tester.widget<TextField>(input());
      for (var depth = 0; depth <= 6; depth++) {
        await reply(tester, depth);
        expect(identical(tester.widget<TextField>(input()).controller, editor.controller), isTrue);
        expect(focused(tester), isTrue);
        expect(input(), findsOneWidget);
        expect(find.ancestor(of: input(), matching: find.byType(CommentReply)), findsNothing);
      }
      await tester.enterText(input(), 'A reply to the sixth reply\nwith a second line');
      await tester.pump();
      await tester.tap(find.bySemanticsLabel('Göndər'));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump();
      await tester.pump();
      expect(inserts.single, allOf(containsPair('post_id', 'post'), containsPair('parent_comment_id', 'comment-6'),
          containsPair('content', 'A reply to the sixth reply\nwith a second line')));
      expect(tester.widget<TextField>(input()).controller!.text, '');
      expect(find.bySemanticsLabel('Cavabı ləğv et'), findsNothing);
      await flushCommunity(tester);
    });

    testWidgets('keeps a failed reply draft, anonymity and parent available for retry', (tester) async {
      failNext = true;
      await mount(tester);
      await reply(tester, 5);
      await tester.enterText(input(), 'Do not lose my draft');
      await tester.tap(find.bySemanticsLabel('Anonim olaraq yaz').first);
      await tester.pump();
      await tester.tap(find.bySemanticsLabel('Göndər'));
      await tester.pump();
      await tester.pump();
      expect(tester.widget<TextField>(input()).controller!.text, 'Do not lose my draft');
      expect(find.text('Author 5 üçün cavab'), findsOneWidget);
      expect(tester.getSemantics(find.bySemanticsLabel('Anonim olaraq yaz').first).flagsCollection.isSelected, Tristate.isTrue);
      await tester.tap(find.bySemanticsLabel('Göndər'));
      await tester.pump();
      await tester.pump();
      expect(inserts.last,
          allOf(containsPair('parent_comment_id', 'comment-5'), containsPair('is_anonymous', true), containsPair('content', 'Do not lose my draft')));
      await flushCommunity(tester);
    });

    testWidgets('does not send ordinary Enter or IME composition; Ctrl+Enter sends', (tester) async {
      await mount(tester);
      await tester.tap(input());
      await tester.enterText(input(), 'Multiline comment');
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      final controller = tester.widget<TextField>(input()).controller!;
      controller.value = controller.value.copyWith(composing: const TextRange(start: 0, end: 9));
      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
      await tester.pump();
      expect(inserts, isEmpty);
      controller.value = controller.value.copyWith(composing: TextRange.empty);
      await tester.sendKeyDownEvent(LogicalKeyboardKey.controlLeft);
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.sendKeyUpEvent(LogicalKeyboardKey.controlLeft);
      await tester.pump();
      await tester.pump();
      expect(inserts, hasLength(1));
      await flushCommunity(tester);
    });

    testWidgets('keeps replies visible when an ancestor was removed and does not expose anonymous profiles', (tester) async {
      comments = [
        {...comment(5), 'parent_comment_id': 'deleted', 'is_anonymous': true, 'author': {'name': 'Anonim', 'avatar_url': null}},
      ];
      final clicks = <String>[];
      await mount(tester, onUserClick: clicks.add);
      expect(find.textContaining(RegExp(r'Reply 5$')), findsOneWidget);
      await tester.tap(find.text('Anonim'));
      await tester.pump();
      expect(clicks, isEmpty);
      await reply(tester, 5);
      expect(find.text('Anonim üçün cavab'), findsOneWidget);
      await flushCommunity(tester);
    });
  });
}
