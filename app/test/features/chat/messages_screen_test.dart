// Ported from: src/components/MessagesScreen.test.tsx
import 'dart:async';

import 'package:anacan/core/auth/auth.dart';
import 'package:anacan/features/chat/messages_screen.dart';
import 'package:anacan/features/chat/ui/chat_widgets.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, User;

import 'support/chat_fakes.dart';

const profileId = '01234567-89ab-4cde-8fab-0123456789ab';
const partnerUser = '11234567-89ab-4cde-8fab-0123456789ab';
const nextProfile = '21234567-89ab-4cde-8fab-0123456789ab';
const nextUser = '31234567-89ab-4cde-8fab-0123456789ab';

class _User extends Notifier<User?> {
  @override
  User? build() => chatUser('current-user');
  void set(User? user) => state = user;
}

final _userProvider = NotifierProvider<_User, User?>(_User.new);
final _partnerProfile = ValueNotifier<String?>(null);

Widget _button(String text, VoidCallback onTap) => GestureDetector(onTap: onTap, child: Text(text));

/// The vi.mock'ed child screens of the vitest file.
MessagesScreenParts fakeParts() => MessagesScreenParts(
      // Centred, so the Radix toast at the top never covers the buttons.
      list: (context, {required onBack, required onOpenChat, partnerId, onOpenGroup}) => Center(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text('conversations partner:${partnerId ?? ''}'),
        _button('Partner conversation', () => onOpenChat(partnerUser, 'Partner', null)),
        _button('DM conversation', () => onOpenChat('other-dm-user', 'Other user', '/other.png')),
        _button('Group conversation', () => onOpenGroup!('joined-group')),
        _button('Back', onBack),
      ])),
      direct: (context, {required userId, required userName, userAvatar, required onBack}) => Column(children: [
        Text('dm user:$userId name:$userName avatar:${userAvatar ?? ''}'),
        _button('Close chat', onBack),
      ]),
      partner: (context, {required onBack}) => Column(children: [const Text('partner-chat'), _button('Close chat', onBack)]),
    );

late FakeChatBackend backend;

Future<void> mount(WidgetTester tester, String? partnerProfileId) async {
  _partnerProfile.value = partnerProfileId;
  await pumpChat(
    tester,
    ValueListenableBuilder<String?>(
      valueListenable: _partnerProfile,
      builder: (context, id, _) => MessagesScreen(onBack: () {}, partnerProfileId: id),
    ),
    overrides: [
      ...chatOverrides(backend: backend, userId: 'current-user', overrideUser: false),
      authUserProvider.overrideWith((ref) => ref.watch(_userProvider)),
      messagesScreenPartsProvider.overrideWithValue(fakeParts()),
      chatGroupScreenProvider.overrideWithValue((context, groupId, onBack) => Column(children: [
            Text('group-chat:$groupId'),
            _button('Close group', onBack),
          ])),
    ],
  );
  await tester.pump();
}

Finder conversationsWith(String partner) => find.text('conversations partner:$partner');

void main() {
  setUp(() {
    backend = FakeChatBackend()..onMaybeSingle = (table, columns, column, value) async => {'user_id': partnerUser};
  });

  group('MessagesScreen partner identity', () {
    testWidgets('opens a group independently of a failed partner lookup and returns to Messages', (tester) async {
      backend.onMaybeSingle = (table, columns, column, value) async => throw PostgrestException(message: 'denied', code: '42501');
      await mount(tester, profileId);
      await tester.tap(find.text('Group conversation'));
      await tester.pump();
      expect(find.text('group-chat:joined-group'), findsOneWidget);
      await tester.tap(find.text('Close group'));
      await tester.pump();
      expect(find.textContaining('conversations partner:'), findsOneWidget);
      await flushChat(tester);
    });

    testWidgets('resolves the linked profile via RLS and uses the user ID for both the list and partner-chat comparison', (tester) async {
      await mount(tester, profileId);
      expect(conversationsWith(partnerUser), findsOneWidget);
      expect(backend.named('maybeSingle').single.args, ['profiles', 'user_id', 'id', profileId]);
      await tester.tap(find.text('Partner conversation'));
      await tester.pump();
      expect(find.text('partner-chat'), findsOneWidget);
      expect(find.textContaining('dm user:'), findsNothing);

      await tester.tap(find.text('Close chat'));
      await tester.pump();
      await tester.tap(find.text('DM conversation'));
      await tester.pump();
      expect(find.text('dm user:other-dm-user name:Other user avatar:/other.png'), findsOneWidget);
      await flushChat(tester);
    });

    testWidgets('does not expose a selectable conversation before partner resolution finishes', (tester) async {
      final pending = Completer<Map<String, dynamic>?>();
      backend.onMaybeSingle = (table, columns, column, value) => pending.future;
      await mount(tester, profileId);
      expect(find.textContaining('conversations partner:'), findsNothing);
      expect(find.textContaining('dm user:'), findsNothing);
      pending.complete({'user_id': partnerUser});
      await tester.pump();
      await tester.pump();
      await tester.tap(find.text('Partner conversation'));
      await tester.pump();
      expect(find.text('partner-chat'), findsOneWidget);
      await flushChat(tester);
    });

    for (final failure in ['denied', 'missing', 'network']) {
      testWidgets('never misclassifies a partner as a DM after a $failure lookup', (tester) async {
        backend.onMaybeSingle = (table, columns, column, value) async {
          if (failure == 'network') throw Exception('Offline');
          if (failure == 'denied') throw PostgrestException(message: 'denied', code: '42501');
          return null;
        };
        await mount(tester, profileId);
        expect(conversationsWith(''), findsOneWidget);
        await tester.tap(find.text('Partner conversation'));
        await tester.pump();
        expect(find.textContaining('dm user:'), findsNothing);
        expect(find.text('partner-chat'), findsNothing);
        expect(find.text('Could not load partner details'), findsOneWidget);
        expect(find.textContaining('conversations partner:'), findsOneWidget);
        await flushChat(tester);
      });
    }

    testWidgets('retries a failed identity lookup without opening a guessed DM', (tester) async {
      var calls = 0;
      backend.onMaybeSingle = (table, columns, column, value) async {
        calls++;
        if (calls == 1) throw PostgrestException(message: 'denied', code: '42501');
        return {'user_id': partnerUser};
      };
      await mount(tester, profileId);
      expect(conversationsWith(''), findsOneWidget);
      await tester.tap(find.text('Partner conversation'));
      await tester.pump();
      expect(find.textContaining('dm user:'), findsNothing);
      await tester.pump();
      await tester.pump();
      expect(conversationsWith(partnerUser), findsOneWidget);
      expect(calls, 2);
      await tester.tap(find.text('Partner conversation'));
      await tester.pump();
      expect(find.text('partner-chat'), findsOneWidget);
      await flushChat(tester);
    });

    for (final label in ['null', 'undefined']) {
      testWidgets('keeps ordinary DMs working without a linked partner ($label)', (tester) async {
        await mount(tester, null);
        await tester.tap(find.text('DM conversation'));
        await tester.pump();
        expect(find.textContaining('dm user:other-dm-user'), findsOneWidget);
        expect(backend.named('maybeSingle'), isEmpty);
        await flushChat(tester);
      });
    }

    testWidgets('ignores an old profile lookup after the linked profile changes', (tester) async {
      final first = Completer<Map<String, dynamic>?>();
      backend.onMaybeSingle = (table, columns, column, value) async => value == profileId ? first.future : {'user_id': nextUser};
      await mount(tester, profileId);
      _partnerProfile.value = nextProfile;
      await tester.pump();
      await tester.pump();
      expect(conversationsWith(nextUser), findsOneWidget);
      first.complete({'user_id': partnerUser});
      await tester.pump();
      expect(conversationsWith(nextUser), findsOneWidget);
      await flushChat(tester);
    });

    testWidgets('clears a selected chat when the linked partner changes', (tester) async {
      await mount(tester, profileId);
      await tester.tap(find.text('Partner conversation'));
      await tester.pump();
      expect(find.text('partner-chat'), findsOneWidget);
      backend.onMaybeSingle = (table, columns, column, value) async => {'user_id': nextUser};
      _partnerProfile.value = nextProfile;
      await tester.pump();
      await tester.pump();
      expect(conversationsWith(nextUser), findsOneWidget);
      expect(find.text('partner-chat'), findsNothing);
      await flushChat(tester);
    });

    testWidgets('does not reuse another account\'s cached partner mapping', (tester) async {
      await mount(tester, profileId);
      expect(conversationsWith(partnerUser), findsOneWidget);
      backend.onMaybeSingle = (table, columns, column, value) async => throw PostgrestException(message: 'denied', code: '42501');
      final container = ProviderScope.containerOf(tester.element(find.byType(MessagesScreen)));
      container.read(_userProvider.notifier).set(chatUser('different-user'));
      await tester.pump();
      await tester.pump();
      expect(conversationsWith(''), findsOneWidget);
      expect(backend.named('maybeSingle'), hasLength(2));
      await tester.tap(find.text('Partner conversation'));
      await tester.pump();
      expect(find.textContaining('dm user:'), findsNothing);
      await flushChat(tester);
    });
  });
}
