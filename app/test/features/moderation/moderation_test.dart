// Ported from: (no vitest suite for MyModerationDecisions / moderator.ts) — cases follow the branches of
//              src/lib/moderator.ts, src/lib/moderator-i18n.ts, src/hooks/useModerator.ts and
//              src/components/moderation/MyModerationDecisions.tsx
import 'package:anacan/features/moderation/moderation_queries.dart';
import 'package:anacan/features/moderation/moderator.dart';
import 'package:anacan/features/moderation/my_moderation_decisions.dart';
import 'package:anacan/state/shell_bindings.dart' show backendUrlProvider;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException;

import '../settings/support/harness.dart';

class FakeModeration implements ModerationBackend {
  List<Map<String, dynamic>> decisions = [];
  final List<(String, Map<String, dynamic>?)> calls = [];
  Object? appealError;
  @override
  Future<Object?> rpc(String name, [Map<String, dynamic>? args]) async {
    calls.add((name, args));
    if (name == 'my_moderator_decisions_v1') return decisions;
    if (name == 'submit_moderator_appeal_v1') {
      if (appealError != null) throw appealError!;
      return {'ok': true};
    }
    return null;
  }
}

void main() {
  setUpAll(loadAnacanFonts);

  group('moderator copy', () {
    test('own language, English fallback, then the key', () {
      expect(moderatorText('user_history', 'en'), 'Moderation history');
      expect(moderatorText('user_history', 'az'), isNot('Moderation history'));
      expect(moderatorText('no_such_key', 'az'), 'no_such_key');
    });

    test('reasons: unknown values read as "other"; body variant', () {
      expect(moderatorReason('spam', 'en'), moderatorText('reason_spam', 'en'));
      expect(moderatorReason('nonsense', 'en'), moderatorText('reason_other', 'en'));
      expect(moderatorReason(null, 'en', true), moderatorText('reason_other_body', 'en'));
    });

    test('errors map by code and message', () {
      expect(moderatorError(const PostgrestException(message: 'x', code: 'PGRST202'), 'en'), moderatorText('unavailable', 'en'));
      expect(moderatorError(const PostgrestException(message: 'MODERATOR_PROTECTED_ACCOUNT'), 'en'), moderatorText('protected_account', 'en'));
      expect(moderatorError(const PostgrestException(message: 'could not serialize', code: '40001'), 'en'), moderatorText('conflict', 'en'));
      expect(moderatorError({'message': 'COMMENTS_LOCKED'}, 'en'), moderatorText('comments_closed', 'en'));
      expect(moderatorError(StateError('APP_RESTRICTED'), 'en'), moderatorText('full_restricted', 'en'));
      expect(moderatorError('ACTIVITY_RESTRICTED', 'en'), moderatorText('error', 'en'), reason: 'a plain string has no code/message');
      expect(moderatorError(null, 'en'), moderatorText('error', 'en'));
    });

    test('missing-function detection', () {
      expect(isMissingFunctionError(const PostgrestException(message: '', code: '42883')), isTrue);
      expect(isMissingFunctionError({'code': 'PGRST202'}), isTrue);
      expect(isMissingFunctionError(const PostgrestException(message: '', code: '500')), isFalse);
    });
  });

  group('MyModerationDecisions', () {
    Future<FakeModeration> mount(WidgetTester tester, List<Map<String, dynamic>> decisions) async {
      final fake = FakeModeration()..decisions = decisions;
      await pumpApp(
        tester,
        MyModerationDecisions(onBack: () {}),
        scroll: false,
        overrides: [
          ...baseOverrides(),
          moderationBackendProvider.overrideWithValue(fake),
          backendUrlProvider.overrideWithValue('https://api.anacan.az'),
        ],
      );
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      return fake;
    }

    screenTest('empty state', (tester) async {
      final fake = await mount(tester, []);
      expect(find.text(moderatorText('empty', 'az')), findsOneWidget);
      expect(fake.calls.single.$2, {'p_actor': 'user-1', 'p_limit': 30});
    });

    screenTest('decisions: reason, public detail or default body, pending appeal, answered appeal', (tester) async {
      await mount(tester, [
        {'id': 'a1', 'reason': 'spam', 'public_detail': 'Reklam linkləri'},
        {'id': 'a2', 'reason': 'weird', 'appeal': {'state': 'open'}},
        {'id': 'a3', 'reason': 'harassment', 'appeal': {'state': 'closed', 'response': 'Qərar qüvvədədir'}},
      ]);
      expect(find.text(moderatorReason('spam', 'az')), findsOneWidget);
      expect(find.text('Reklam linkləri'), findsOneWidget);
      expect(find.text(moderatorReason('other', 'az', true)), findsOneWidget);
      expect(find.text(moderatorText('appeal_pending', 'az')), findsOneWidget);
      expect(find.text('Qərar qüvvədədir'), findsOneWidget);
      expect(find.byKey(const ValueKey('moderation-appeal-open-a1')), findsOneWidget);
      expect(find.byKey(const ValueKey('moderation-appeal-open-a2')), findsNothing);
    });

    screenTest('appeal: needs 10 characters, retries keep the same request id, success refetches', (tester) async {
      final fake = await mount(tester, [
        {'id': 'a1', 'reason': 'spam'},
      ]);
      await tester.tap(find.byKey(const ValueKey('moderation-appeal-open-a1')));
      await tester.pump();
      await tester.enterText(find.byKey(const ValueKey('moderation-appeal-a1')), 'qısa');
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('moderation-send-a1')));
      await tester.pump();
      expect(fake.calls.where((c) => c.$1 == 'submit_moderator_appeal_v1'), isEmpty);

      await tester.enterText(find.byKey(const ValueKey('moderation-appeal-a1')), '  Bu, səhv qərardır.  ');
      await tester.pump();
      fake.appealError = const PostgrestException(message: 'network');
      await tester.tap(find.byKey(const ValueKey('moderation-send-a1')));
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      expect(find.text(moderatorText('error', 'az')), findsOneWidget);
      fake.appealError = null;
      await tester.tap(find.byKey(const ValueKey('moderation-send-a1')));
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }
      final appeals = fake.calls.where((c) => c.$1 == 'submit_moderator_appeal_v1').map((c) => c.$2!).toList();
      expect(appeals, hasLength(2));
      expect(appeals[0]['p_body'], 'Bu, səhv qərardır.');
      expect(appeals[0]['p_action'], 'a1');
      expect(appeals[0]['p_actor'], 'user-1');
      expect(appeals[0]['p_id'], appeals[1]['p_id'], reason: 'the same appeal is retried idempotently');
      expect(find.text(moderatorText('saved', 'az')), findsOneWidget);
      expect(fake.calls.where((c) => c.$1 == 'my_moderator_decisions_v1').length, greaterThanOrEqualTo(2));
      expect(find.byKey(const ValueKey('moderation-appeal-a1')), findsNothing);
    });
  });
}
