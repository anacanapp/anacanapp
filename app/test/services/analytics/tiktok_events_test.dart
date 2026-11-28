// Ported from: src/lib/tiktok-events.test.ts
import 'package:anacan/services/analytics/tiktok_events.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('tiktok-events', () {
    test('maps only marketing/conversion events and never health records', () {
      expect(kTikTokEventMap['sign_up'], 'Registration');
      expect(kTikTokEventMap['premium_subscribed'], 'Subscribe');
      expect(kTikTokEventMap['books_purchase_confirmed'], 'Purchase');
      for (final health in ['weight_logged', 'mood_logged', 'symptom_logged', 'kick_session_completed', 'period_logged']) {
        expect(kTikTokEventMap[health], isNull);
      }
      // premium_subscribed already carries the value; the paired generic purchase must not double count.
      expect(kTikTokEventMap['purchase'], isNull);
    });

    test('sends value/currency for revenue events and no personal fields', () {
      expect(tiktokProperties('premium_subscribed', {'plan': 'yearly', 'price': 29.99, 'currency': 'USD', 'email': 'x@y.z'}),
          {'value': 29.99, 'currency': 'USD', 'content_id': 'yearly', 'content_type': 'subscription'});
      expect(tiktokProperties('books_purchase_confirmed', {'value': 12, 'currency': 'AZN', 'order_id': 'o1'}), {'value': 12, 'currency': 'AZN', 'content_type': 'product'});
      expect(tiktokProperties('book_viewed', {'book_id': 'b7', 'topic': 'sleep'}), {'content_id': 'b7', 'content_type': 'product'});
      expect(tiktokProperties('premium_subscribed', {'price': 5, 'currency': 'usd'})['currency'], 'USD');
      expect(tiktokProperties('name_searched', {'query': 'Leyla'}), <String, Object>{});
    });

    test('is a silent no-op on web / without consent', () async {
      final events = TikTokEvents(plugin: null, attributionAllowed: () => false, platform: 'web');
      await expectLater(events.logEvent('sign_up', {}), completes);
    });
  });
}
