// Covers src/lib/chat-notifications.ts (no vitest file in React): silent hours, the foreground check, the id range.
import 'dart:convert';

import 'package:anacan/services/notifications/chat_notifications.dart';
import 'package:anacan/services/notifications/local_notification_scheduler.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_local_notifications.dart';

void main() {
  late FakeLocalNotificationBackend os;
  late LocalStore store;
  late bool visible;
  late DateTime now;
  late ChatNotifications chat;

  setUp(() {
    os = FakeLocalNotificationBackend();
    store = LocalStore.memory();
    visible = false;
    now = DateTime(2026, 11, 25, 23, 30);
    final scheduler = LocalNotificationScheduler(store: store, backend: os, clock: () => now);
    chat = ChatNotifications(store: store, scheduler: scheduler, isVisible: () => visible, clock: () => now);
  });

  void silent(Map<String, Object?> settings) => store.setItem('silent_hours_u1', jsonEncode(settings));

  test('silent hours wrap overnight and use the 22:00–08:00 defaults', () {
    silent({'enabled': true});
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 23, 0)), isTrue);
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 7, 59)), isTrue);
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 8, 0)), isFalse);
    silent({'enabled': true, 'startTime': '13:00', 'endTime': '14:00'});
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 13, 30)), isTrue);
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 14, 0)), isFalse);
    silent({'enabled': false});
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 23, 0)), isFalse);
    expect(isInChatSilentHours(store, null, DateTime(2026, 1, 1, 23, 0)), isFalse);
    store.setItem('silent_hours_u1', 'not json');
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 23, 0)), isFalse);
  });

  test('a malformed time never counts as silent (NaN comparisons)', () {
    silent({'enabled': true, 'startTime': 'ab:cd', 'endTime': '08:00'});
    expect(isInChatSilentHours(store, 'u1', DateTime(2026, 1, 1, 23, 0)), isFalse);
  });

  test('shows the message at once in its own id range, without asking for permission', () async {
    await chat.notifyIncomingChatMessage(title: 'Partner', body: 'Salam', idSeed: 1732567890123, userId: 'u1');
    final n = os.pending.values.single;
    expect(n.id, chatNotificationIdBase + 1732567890123 % chatNotificationIdSpan);
    expect(n.schedule, isNull);
    expect(os.requestCalls, 0);
  });

  test('skips during silent hours, while the app is in front, and without the plugin', () async {
    silent({'enabled': true});
    await chat.notifyIncomingChatMessage(title: 't', body: 'b', idSeed: 1, userId: 'u1');
    expect(os.pending, isEmpty);
    store.removeItem('silent_hours_u1');
    visible = true;
    await chat.notifyIncomingChatMessage(title: 't', body: 'b', idSeed: 1, userId: 'u1');
    expect(os.pending, isEmpty);
    visible = false;
    os.native = false;
    await chat.notifyIncomingChatMessage(title: 't', body: 'b', idSeed: 1, userId: 'u1');
    expect(os.scheduleCalls, isEmpty);
  });

  test('a negative seed stays in range', () => expect(chatNotificationId(-250000007), chatNotificationIdBase + 50000007));
}
