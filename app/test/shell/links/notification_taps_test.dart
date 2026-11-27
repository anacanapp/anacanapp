// Ported from: src/lib/notification-taps.test.ts (plugin registration cases are native-side and not ported)
import 'package:anacan/shell/links/notification_taps.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late NotificationTapQueue q;
  setUp(() => q = NotificationTapQueue());

  group('early tap queue', () {
    test('queues a tap that arrives before the router and delivers it when the router attaches', () {
      q.deliver({'type': 'direct_message', 'sender_id': 'x'}, nowMs: 1);
      final calls = <Map<String, Object?>>[];
      q.attach(calls.add);
      expect(calls, [{'type': 'direct_message', 'sender_id': 'x'}]);
      // Later taps go straight to the router.
      q.deliver(localTapData({'type': 'baby_chat'}), nowMs: 5000);
      expect(calls.last, {'type': 'baby_chat'});
    });

    test('keeps only the latest queued tap and ignores the same tap reported twice', () {
      q.deliver({'type': 'a'}, nowMs: 1000);
      q.deliver({'type': 'b'}, nowMs: 1100);
      q.deliver({'type': 'b'}, nowMs: 1200); // second plugin, same tap
      final calls = <Map<String, Object?>>[];
      q.attach(calls.add);
      expect(calls, [{'type': 'b'}]);
      q.deliver({'type': 'b'}, nowMs: 1300);
      expect(calls, hasLength(1));
      q.deliver({'type': 'b'}, nowMs: 9000); // a new tap on the same kind later
      expect(calls, hasLength(2));
    });

    test('queues again after the router detaches, and logout drops the queued tap', () {
      final first = <Map<String, Object?>>[];
      final detach = q.attach(first.add);
      detach();
      q.deliver({'type': 'community'}, nowMs: 1);
      expect(first, isEmpty);
      q.clearQueued();
      final second = <Map<String, Object?>>[];
      q.attach(second.add);
      expect(second, isEmpty);
    });

    test('routes only local reminders that carry a route', () {
      expect(localTapData({'type': 'vaccine_reminder', 'deeplink': 'anacan://tool/vaccine-calendar'}),
          {'type': 'vaccine_reminder', 'deeplink': 'anacan://tool/vaccine-calendar'});
      expect(localTapData({'deeplink': 'anacan://tool/x'}), {'deeplink': 'anacan://tool/x'});
      expect(localTapData({'dose': 'x'}), isNull);
      expect(localTapData(null), isNull);
      final calls = <Map<String, Object?>>[];
      q.attach(calls.add);
      q.deliver(localTapData({'id': 5}), nowMs: 1); // a timer: nothing to route
      expect(calls, isEmpty);
    });

    test('a router error does not break later taps', () {
      var n = 0;
      q.attach((_) {
        n++;
        if (n == 1) throw StateError('boom');
      });
      q.deliver({'type': 'a'}, nowMs: 1);
      q.deliver({'type': 'b'}, nowMs: 2);
      expect(n, 2);
    });
  });
}
