// Ported from: src/components/moderation/ModeratorEnforcement.test.tsx
import 'dart:async';

import 'package:anacan/core/cache/cache.dart';
import 'package:anacan/features/community/data/community_backend.dart';
import 'package:anacan/features/community/moderation/moderator_enforcement.dart';
import 'package:anacan/features/moderation/moderator.dart';
import 'package:anacan/features/moderation/my_moderation_decisions.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/community_fakes.dart';

const id = '10000000-0000-4000-8000-000000000001';
const warningId = '20000000-0000-4000-8000-000000000002';
const token = '30000000-0000-4000-8000-000000000003';
const warning = {'id': warningId, 'claim_id': token, 'reason': 'spam', 'detail': 'Please stop repeated posts.', 'created_at': '2026-09-28T12:00:00Z', 'language': 'en'};

class _Audio implements WhiteNoiseAudio {
  int stops = 0;
  @override
  void play(WhiteNoiseSound sound, double gain) {}
  @override
  void stop() => stops++;
  @override
  void setGain(double gain) {}
}

void main() {
  late Map<String, dynamic> status;
  late bool acknowledged;
  late bool offline;
  late FakeModerationBackend moderation;
  late LocalStore store;
  late _Audio audio;
  Future<Object?> Function(String name)? pendingAll;

  setUp(() {
    status = {'user_id': id, 'full': false, 'pending_warnings': 1, 'restrictions': <Object>[]};
    acknowledged = false;
    offline = false;
    pendingAll = null;
    store = LocalStore.memory();
    audio = _Audio();
    moderation = FakeModerationBackend((name, args) async {
      if (name == 'get_my_moderation_status_v1') return {...status, 'user_id': args?['p_actor']};
      if (pendingAll != null) return pendingAll!(name);
      if (name == 'ack_my_moderator_warning_v1') {
        if (offline) throw const CommunityBackendError(message: 'offline');
        acknowledged = true;
        return true;
      }
      if (name == 'my_moderator_decisions_v1') return <Object>[];
      return acknowledged ? null : warning;
    });
  });

  Widget tree() => const ModeratorEnforcement(child: Text('Private application'));

  Future<void> mount(WidgetTester tester, {bool userFromState = false}) async {
    await pumpCommunity(
      tester,
      tree(),
      language: 'en',
      overrides: [
        ...communityOverrides(
          backend: FakeCommunityBackend(),
          userId: id,
          userFromState: userFromState,
          store: store,
          moderation: moderation,
          backendUrl: 'https://backend.example.test',
          client: QueryClient(defaults: const QueryDefaults(retry: noRetry)),
          language: 'en',
        ),
        whiteNoiseAudioProvider.overrideWithValue(audio),
      ],
    );
    for (var i = 0; i < 6; i++) {
      await tester.pump();
    }
  }

  Finder warningDialog() => find.byKey(const ValueKey('moderator-warning'));

  group('account-bound one-time moderator warnings', () {
    testWidgets('closes with ×, acknowledges the authenticated account and does not reappear after remount', (tester) async {
      await mount(tester);
      expect(find.text(warning['detail']!), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(moderatorText('close', 'en')));
      for (var i = 0; i < 4; i++) {
        await tester.pump();
      }
      expect(acknowledged, isTrue);
      final ack = moderation.calls.firstWhere((c) => c.name == 'ack_my_moderator_warning_v1');
      expect(ack.args[0], {'p_actor': id, 'p_warning': warningId, 'p_claim': token});
      await tester.pumpWidget(const SizedBox());
      await mount(tester);
      expect(warningDialog(), findsNothing);
      await flushCommunity(tester);
    });

    testWidgets('persists only a pending acknowledgement while offline and retries without showing the message again', (tester) async {
      offline = true;
      await mount(tester);
      expect(find.text(warning['detail']!), findsOneWidget);
      await tester.tap(find.bySemanticsLabel(moderatorText('close', 'en')));
      for (var i = 0; i < 4; i++) {
        await tester.pump();
      }
      expect(warningDialog(), findsNothing);
      final key = 'anacan-moderator-warning-acks-v1:${encodeUriComponentJs('https://backend.example.test:$id')}';
      expect(store.getItem(key), contains(warningId));
      expect(store.getItem(key), isNot(contains(warning['detail'])));
      await tester.pumpWidget(const SizedBox());
      offline = false;
      await mount(tester);
      expect(acknowledged, isTrue);
      expect(warningDialog(), findsNothing);
      await flushCommunity(tester);
    });

    testWidgets('discards a claim response that arrives after switching accounts', (tester) async {
      final finish = Completer<Object?>();
      pendingAll = (name) => finish.future;
      await pumpCommunity(
        tester,
        tree(),
        language: 'en',
        overrides: communityOverrides(
          backend: FakeCommunityBackend(),
          userFromState: true,
          store: store,
          moderation: moderation,
          backendUrl: 'https://backend.example.test',
          client: QueryClient(defaults: const QueryDefaults(retry: noRetry)),
        ),
      );
      final container = ProviderScope.containerOf(tester.element(find.byType(ModeratorEnforcement)));
      container.read(testUserProvider.notifier).set(id);
      for (var i = 0; i < 6; i++) {
        await tester.pump();
      }
      await until(() => moderation.calls.any((c) => c.name == 'claim_my_moderator_warning_v1'));
      status = {'user_id': '40000000-0000-4000-8000-000000000004', 'pending_warnings': 0, 'full': false, 'restrictions': <Object>[]};
      container.read(testUserProvider.notifier).set('40000000-0000-4000-8000-000000000004');
      await tester.pump();
      finish.complete(warning);
      for (var i = 0; i < 4; i++) {
        await tester.pump();
      }
      expect(warningDialog(), findsNothing);
      await flushCommunity(tester);
    });

    testWidgets('removes the full application and stops background audio while retaining appeal access', (tester) async {
      status = {
        'user_id': id,
        'full': true,
        'pending_warnings': 0,
        'restrictions': [
          {'id': warningId, 'scope': 'full', 'reason': 'spam', 'detail': 'Repeated abuse', 'expires_at': null},
        ],
      };
      await mount(tester);
      expect(find.text('Private application'), findsNothing);
      expect(find.byKey(const ValueKey('moderator-full-block')), findsOneWidget);
      expect(audio.stops, greaterThan(0));
      await tester.tap(find.text(moderatorText('appeals', 'en')));
      await tester.pump();
      expect(find.byType(MyModerationDecisions), findsOneWidget);
      await flushCommunity(tester);
    });
  });
}
