// Ported from: src/lib/ads/brandMeasurement.test.ts
import 'package:anacan/features/banners/brand_measurement.dart';
import 'package:flutter_test/flutter_test.dart';

/// A clock that advances with the fake-async timers of [WidgetTester.pump].
class Clock {
  int now = DateTime.parse('2026-10-22T09:00:00Z').millisecondsSinceEpoch;
  Future<void> advance(WidgetTester tester, int ms) async {
    for (var left = ms; left > 0; left -= 50) {
      final step = left < 50 ? left : 50;
      now += step;
      await tester.pump(Duration(milliseconds: step));
    }
  }
}

int _seq = 0;
String newId() => 'exposure-${++_seq}';

({List<(String, Map<String, Object?>)> calls, BrandExposure exposure}) setup(Clock clock, {String issue = 'issue_brand_ad_delivery_v1', int version = 2, String language = 'en', String platform = 'ios', String actor = 'owned-actor', String banner = 'owned-banner'}) {
  final calls = <(String, Map<String, Object?>)>[];
  Future<BrandRpcResult> rpc(String name, Map<String, Object?> args) async {
    calls.add((name, args));
    if (name == issue) {
      return (data: {'id': args['p_exposure'], 'expires_at': DateTime.fromMillisecondsSinceEpoch(clock.now + 900000, isUtc: true).toIso8601String()}, error: null);
    }
    return (data: true, error: null);
  }

  return (
    calls: calls,
    exposure: BrandExposure(rpc: rpc, actor: actor, banner: banner, language: language, platform: platform, version: version, now: () => clock.now, newId: newId),
  );
}

void main() {
  testWidgets('counts a continuous visible second once, and restarting visibility resets the clock', (tester) async {
    final clock = Clock();
    final s = setup(clock);
    int events() => s.calls.where((c) => c.$1 == 'record_brand_ad_event_v1').length;
    s.exposure.visible(true);
    await clock.advance(tester, 600);
    s.exposure.visible(false);
    await clock.advance(tester, 1200);
    expect(events(), 0);
    s.exposure.visible(true);
    await clock.advance(tester, 1100);
    expect(events(), 1);
    s.exposure.visible(false);
    s.exposure.visible(true);
    await clock.advance(tester, 2000);
    expect(events(), 1);
    s.exposure.dispose();
  });

  testWidgets('cancels impressions on unmount but completes an account-bound click after navigation', (tester) async {
    final clock = Clock();
    final s = setup(clock);
    s.exposure.visible(true);
    await clock.advance(tester, 500);
    final click = s.exposure.click();
    s.exposure.dispose();
    await click;
    await clock.advance(tester, 2000);
    final events = s.calls.where((c) => c.$1 == 'record_brand_ad_event_v1').toList();
    expect(events, hasLength(1));
    expect(events.single.$2['p_actor'], 'owned-actor');
    expect(events.single.$2['p_event'], 'click');
  });

  testWidgets('does not fabricate events when the server refuses the delivery ticket', (tester) async {
    final clock = Clock();
    var calls = 0;
    final exposure = BrandExposure(
      rpc: (name, args) async {
        calls++;
        return (data: null, error: null);
      },
      actor: 'owner',
      banner: 'banner',
      language: 'en',
      platform: 'web',
      now: () => clock.now,
      newId: newId,
    );
    exposure.visible(true);
    await clock.advance(tester, 3000);
    await exposure.click();
    expect(calls, 1);
    exposure.dispose();
  });

  testWidgets('routes v3 creatives to the audience-aware receipt RPCs and returns the click ticket for lead attribution', (tester) async {
    final clock = Clock();
    final s = setup(clock, issue: 'issue_brand_ad_delivery_v2', version: 3, language: 'ar', platform: 'android', actor: 'owner', banner: 'banner');
    s.exposure.visible(true);
    await clock.advance(tester, 1200);
    final ticket = await s.exposure.click();
    final names = s.calls.map((c) => c.$1).toList();
    expect(names, ['issue_brand_ad_delivery_v2', 'record_brand_ad_event_v2', 'record_brand_ad_event_v2']);
    expect(names.any((n) => n.endsWith('_v1')), isFalse);
    expect(ticket, s.calls.first.$2['p_exposure']);
    s.exposure.dispose();
  });
}
