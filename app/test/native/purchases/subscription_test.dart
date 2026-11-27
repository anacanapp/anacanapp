// Ported from: src/hooks/useSubscription.test.ts (usage cases; the entitlement cases are in premium_entitlement_test.dart)
import 'package:anacan/core/data/data.dart' show DbResult;
import 'package:anacan/domain/billing/usage_limits.dart';
import 'package:anacan/domain/js_compat.dart' show DomainClock;
import 'package:anacan/native/purchases/purchases.dart';
import 'package:flutter_test/flutter_test.dart';

class FakeBackend implements SubscriptionBackend {
  final List<(String, Object?)> calls = [];
  DbResult<Object?> Function(String name, Map<String, dynamic> args) onRpc = (_, _) => const DbResult(data: null);
  Map<String, dynamic>? row;
  Object? usageRowError;
  int photos = 0;

  @override
  Future<Map<String, dynamic>?> fetchSubscription(String userId) async => null;
  @override
  Future<List<Map<String, dynamic>>> fetchUsage(String userId, String day) async => [];
  @override
  Future<bool> fetchHouseholdPremium() async => false;
  @override
  Future<DbResult<Object?>> rpc(String name, Map<String, dynamic> args) async {
    calls.add(('rpc:$name', args));
    return onRpc(name, args);
  }

  @override
  Future<Map<String, dynamic>?> usageRow(String userId, String feature, String day) async {
    calls.add(('usageRow', day));
    if (usageRowError != null) throw usageRowError!;
    return row;
  }

  @override
  Future<void> updateUsage(String id, Map<String, dynamic> values) async => calls.add(('update', values));
  @override
  Future<void> upsertUsage(Map<String, dynamic> row) async => calls.add(('upsert', row));
  @override
  Future<void> insertUsage(Map<String, dynamic> row) async => calls.add(('insert', row));
  @override
  Future<int> countPhotos(String userId) async => photos;
  @override
  Future<void> insertCancellation(Map<String, dynamic> row) async => calls.add(('cancellation', row));
}

SubscriptionUsage usage(FakeBackend b, {bool premium = false, String? user = 'user-a', Map<String, Object?>? limits, List<Map<String, dynamic>> rows = const []}) =>
    SubscriptionUsage(backend: b, userId: user, isPremium: premium, freeLimits: limits ?? mergeFreeLimits(null), usage: rows, flags: LegacyUsageFlags());

void main() {
  setUp(() => DomainClock.setSystemTime(DateTime(2026, 9, 10, 12)));
  tearDown(DomainClock.reset);

  test('refreshes daily free usage without fabricating unlimited access', () async {
    final b = FakeBackend()..onRpc = (_, _) => const DbResult(data: null);
    final u = usage(b, limits: mergeFreeLimits({'white_noise_seconds_per_day': 100}), rows: [
      {'id': 'usage-a', 'user_id': 'user-a', 'feature_type': 'white_noise', 'usage_seconds': 40},
    ]);
    final now = u.canUseWhiteNoiseNow();
    expect((now.allowed, now.remainingSeconds), (true, 60.0));
    await u.trackWhiteNoiseUsage(5);
    expect(b.calls.first.$1, 'rpc:usage_add_seconds_v1');
    expect(b.calls.first.$2, {'p_seconds': 5, 'p_time_zone': deviceTimeZone()});
    expect(b.calls.where((c) => c.$1 == 'update'), isEmpty);
  });

  test('adds white noise seconds through the legacy table path on an old server', () async {
    final b = FakeBackend()..onRpc = (_, _) => const DbResult(error: {'code': 'PGRST202', 'message': 'Could not find the function'}, status: 404);
    final u = usage(b, rows: [
      {'id': 'usage-a', 'feature_type': 'white_noise', 'usage_seconds': 40},
    ]);
    await u.trackWhiteNoiseUsage(5);
    expect(b.calls.last.$1, 'update');
    expect(b.calls.last.$2, {'usage_seconds': 45});
  });

  test('has no paid capability or backend requests while signed out', () async {
    final b = FakeBackend();
    final decision = await usage(b, user: null).checkAndConsume('ai_chat');
    expect(decision.allowed, isFalse);
    expect(b.calls, isEmpty);
  });

  test('consumes a free daily use atomically on the server with the phone time zone', () async {
    final b = FakeBackend()..onRpc = (_, _) => const DbResult(data: {'allowed': true, 'used': 2, 'limit': 3, 'usage_date': '2026-09-10'});
    final d = await usage(b).checkAndConsume('cry_translator');
    expect((d.allowed, d.remaining, d.limit), (true, 1.0, 3.0));
    expect(b.calls.single.$2, {'p_feature': 'cry_translator', 'p_time_zone': deviceTimeZone()});
  });

  test('reports the server refusal without writing the counter', () async {
    final b = FakeBackend()..onRpc = (_, _) => const DbResult(data: {'allowed': false, 'used': 2, 'limit': 2});
    final d = await usage(b).checkAndConsume('horoscope');
    expect((d.allowed, d.remaining, d.limit), (false, 0.0, 2.0));
    expect(b.calls.where((c) => c.$1 == 'update' || c.$1 == 'upsert'), isEmpty);
  });

  test('keeps the premium bypass without any usage call', () async {
    final b = FakeBackend();
    final d = await usage(b, premium: true).checkAndConsume('ai_chat');
    expect(d.allowed, isTrue);
    expect(d.remaining, double.infinity);
    expect(b.calls, isEmpty);
  });

  test('falls back to the old table path with the local day when the server has no RPC', () async {
    DomainClock.setSystemTime(DateTime(2026, 9, 11, 1, 30)); // 01:30 local on 11 Sep
    final flags = LegacyUsageFlags();
    final b = FakeBackend()..onRpc = (_, _) => const DbResult(error: {'code': 'PGRST202', 'message': 'Could not find the function public.usage_consume_v1'}, status: 404);
    final u = SubscriptionUsage(backend: b, userId: 'user-a', isPremium: false, freeLimits: mergeFreeLimits(null), flags: flags);
    final d = await u.checkAndConsume('poop_scanner');
    expect(d.allowed, isTrue);
    expect(d.limit, 3);
    final upsert = b.calls.firstWhere((c) => c.$1 == 'upsert').$2! as Map;
    expect(upsert, {'user_id': 'user-a', 'feature_type': 'poop_scanner', 'usage_date': '2026-09-11', 'usage_count': 1});
    // the missing RPC is remembered for the session
    b.calls.clear();
    await u.checkAndConsume('poop_scanner');
    expect(b.calls.where((c) => c.$1 == 'rpc:usage_consume_v1'), isEmpty);
  });

  test('does not block the user when the server cannot be reached', () async {
    final b = FakeBackend()..onRpc = (_, _) => const DbResult(error: {'message': 'Failed to fetch'}, status: 0);
    final d = await usage(b).checkAndConsume('ai_chat');
    expect(d.allowed, isTrue);
    expect(b.calls.where((c) => c.$1 == 'upsert'), isEmpty);
  });

  test('keys the daily usage read by the local calendar day, not UTC', () async {
    DomainClock.setSystemTime(DateTime(2026, 9, 11, 0, 30));
    final b = FakeBackend()..row = {'usage_count': 1};
    final peek = await usage(b).peekRemainingDaily('ai_chat');
    expect(b.calls.single.$2, '2026-09-11');
    expect((peek.remaining, peek.limit), (9.0, 10.0));
  });

  for (final (status, active, cancelledActive) in [('active', true, false), ('cancelled', true, true), ('cancelled', false, false), ('expired', false, false)]) {
    test('represents $status with live access $active', () {
      final s = SubscriptionState(subscription: {'status': status, 'plan_type': 'premium'}, ownPremium: active, isPremium: active);
      expect(s.ownPremium, active);
      expect(s.cancelledButActive, cancelledActive);
    });
  }

  test('records an in-app cancellation reason apart from the store-reported one', () async {
    final b = FakeBackend();
    await submitCancellationReason(b, userId: 'user-a', reasonCode: 'too_expensive', reasonText: '  pricey ', planType: 'premium');
    expect(b.calls.single.$2, {
      'user_id': 'user-a',
      'reason_code': 'too_expensive',
      'reason_text': 'pricey',
      'plan_type': 'premium',
      'was_trial': false,
      'cancel_flow': 'in_app',
    });
    expect(() => submitCancellationReason(b, userId: null, reasonCode: 'other'), throwsStateError);
  });
}
