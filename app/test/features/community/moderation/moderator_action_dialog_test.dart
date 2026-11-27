// Ported from: src/components/moderation/ModeratorActionDialog.test.tsx
import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/moderation/moderator_content.dart';
import 'package:anacan/features/community/moderation/moderator_widgets.dart';
import 'package:anacan/features/moderation/moderator.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart' show TextField;

import '../support/community_fakes.dart';

void main() {
  late String role;
  late bool fail;
  late FakeModerationBackend moderation;
  late int done;
  late int closed;

  setUp(() {
    role = 'moderator';
    fail = false;
    done = 0;
    closed = 0;
    moderation = FakeModerationBackend((name, args) async {
      if (name == 'get_moderator_access_v1') return {'allowed': true, 'role': role, 'user_id': 'staff'};
      if (name == 'moderator_content_detail_v1') {
        return {'id': 'post-fixture', 'user_id': 'author', 'version': 7, 'content': 'Original fixture', 'media_urls': <String>[], 'created_at': '2026-09-28T00:00:00Z'};
      }
      if (fail && name.endsWith('_action_v1')) throw const CommunityBackendError(code: '40001', message: 'MODERATOR_CONTENT_CONFLICT');
      return {'id': 'action-fixture'};
    });
  });

  Future<void> mount(WidgetTester tester, String action) async {
    await pumpCommunity(
      tester,
      SingleChildScrollView(
        child: ModeratorActionDialog(
          target: ModeratorTarget(kind: action == 'edit' ? 'post' : 'user', id: 'post-fixture', userId: 'author'),
          action: action,
          onClose: () => closed++,
          onDone: () => done++,
        ),
      ),
      overrides: communityOverrides(
        backend: FakeCommunityBackend(),
        userId: 'staff',
        isModerator: true,
        isAdmin: role == 'admin',
        moderation: moderation,
        client: QueryClient(defaults: const QueryDefaults(retry: noRetry)),
        language: 'en',
      ),
      size: const Size(600, 1400),
      language: 'en',
    );
    await tester.pump();
    await tester.pump();
    await tester.pump();
  }

  testWidgets('edits the loaded exact content version and keeps a failed draft/request ID for retry', (tester) async {
    fail = true;
    await mount(tester, 'edit');
    final field = find.byType(TextField).first;
    expect(tester.widget<TextField>(field).controller!.text, 'Original fixture');
    await tester.enterText(field, 'Updated fixture');
    await tester.pump();
    final submit = find.byKey(const ValueKey('moderator-submit'));
    await tester.tap(submit);
    await tester.pump();
    await tester.pump();
    expect(find.text(moderatorError(const CommunityBackendError(code: '40001', message: 'MODERATOR_CONTENT_CONFLICT'), 'en')), findsWidgets);
    final first = [for (final c in moderation.calls) if (c.name == 'moderator_content_action_v1') c.args[0] as Map<String, dynamic>].first;
    expect(first, allOf(containsPair('p_kind', 'post'), containsPair('p_id', 'post-fixture'), containsPair('p_version', 7), containsPair('p_content', 'Updated fixture')));
    expect(tester.widget<TextField>(field).controller!.text, 'Updated fixture');
    expect(closed, 0);
    fail = false;
    await tester.tap(submit);
    await tester.pump();
    await tester.pump();
    expect(done, 1);
    final calls = [for (final c in moderation.calls) if (c.name == 'moderator_content_action_v1') c.args[0] as Map<String, dynamic>];
    expect(calls[1]['p_request'], first['p_request']);
    await flushCommunity(tester);
  });

  for (final r in ['moderator', 'admin']) {
    testWidgets('offers permanent restrictions only to the actual admin role ($r)', (tester) async {
      role = r;
      await mount(tester, 'restrict');
      await tester.tap(find.byKey(const ValueKey('moderator-duration')));
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text(moderatorText('duration_permanent', 'en')).evaluate().isNotEmpty, r == 'admin');
      await flushCommunity(tester);
    });
  }
}
