// Ported from: src/lib/notification-taps.test.ts (the plugin registration cases; the queue cases are ported in
// test/shell/links/notification_taps_test.dart)
import 'dart:async';

import 'package:anacan/services/push/notification_tap_listeners.dart';
import 'package:anacan/shell/links/notification_taps.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeTapSources implements NotificationTapSources {
  bool native = true;
  final fcm = StreamController<Object?>.broadcast(sync: true);
  final push = StreamController<Object?>.broadcast(sync: true);
  final local = StreamController<Object?>.broadcast(sync: true);

  Set<String> get listening => {
        if (fcm.hasListener) 'fcm:notificationActionPerformed',
        if (local.hasListener) 'local:localNotificationActionPerformed',
        if (push.hasListener) 'push:pushNotificationActionPerformed',
      };

  @override
  bool get isNative => native;
  @override
  Stream<Object?> get messagingTaps => fcm.stream;
  @override
  Stream<Object?> get pushFallbackTaps => push.stream;
  @override
  Stream<Object?> get localTaps => local.stream;
}

void main() {
  late NotificationTapQueue queue;
  late NotificationTapListeners listeners;
  late FakeTapSources cap;

  setUp(() {
    queue = NotificationTapQueue();
    listeners = NotificationTapListeners(queue);
    cap = FakeTapSources();
  });
  tearDown(() => listeners.reset());

  group('early tap queue', () {
    test('registers every tap listener synchronously at install (before any await)', () {
      listeners.install(cap);
      expect(cap.listening, {
        'fcm:notificationActionPerformed',
        'local:localNotificationActionPerformed',
        'push:pushNotificationActionPerformed',
      });
      listeners.install(cap); // idempotent
      expect(cap.listening, hasLength(3));
    });

    test('queues a tap that arrives before the router and delivers it when the router attaches', () {
      listeners.install(cap);
      cap.fcm.add({'type': 'direct_message', 'sender_id': 'x'});
      final calls = <NotificationTapData>[];
      queue.attach(calls.add);
      expect(calls, [
        {'type': 'direct_message', 'sender_id': 'x'}
      ]);
      // Later taps go straight to the router.
      cap.local.add({'type': 'baby_chat'});
      expect(calls.last, {'type': 'baby_chat'});
    });

    test('routes only local reminders that carry a route', () {
      listeners.install(cap);
      final calls = <NotificationTapData>[];
      queue.attach(calls.add);
      cap.local.add({'id': 5}); // a timer: nothing to route
      expect(calls, isEmpty);
      cap.push.add(const ['not', 'a', 'record']);
      expect(calls, isEmpty);
    });

    test('registers nothing on the web', () {
      cap.native = false;
      listeners.install(cap);
      expect(cap.listening, isEmpty);
      expect(listeners.installed, isFalse);
    });
  });
}
