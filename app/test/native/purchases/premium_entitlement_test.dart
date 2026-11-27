// Ported from: src/hooks/usePremiumEntitlement.test.tsx
//
// The hook's query/timer plumbing is Riverpod + the shared QueryClient here; these cases drive the same
// sequence of query outcomes (success / error keeping the last data) through `fetchPremiumAccess` and
// `evaluatePremiumEntitlement` with a controllable wall clock and monotonic clock.
import 'dart:async';

import 'package:anacan/native/purchases/purchases.dart';
import 'package:flutter_test/flutter_test.dart';

const nowIso = '2026-09-25T12:00:00.000Z';
final t0 = DateTime.parse(nowIso).millisecondsSinceEpoch;

Map<String, Object?> access(String actor, bool own, {bool household = false, String expiry = '2026-10-25T12:00:00Z', String validUntil = '2026-09-25T12:00:30Z'}) => {
      'protocol': 'anacan-premium-access-v1',
      'userId': actor,
      'own': {'active': own, 'expiresAt': expiry, 'source': 'subscription'},
      'household': {'active': household, 'expiresAt': expiry, 'source': 'subscription'},
      'checkedAt': nowIso,
      'validUntil': validUntil,
    };

class Sim {
  int wall = t0;
  double mono = 1000;
  late final PremiumClock clock = PremiumClock(wall: () => wall, mono: () => mono);
  final MemoryGrantStorage storage = MemoryGrantStorage();
  String actor = 'a';
  String backend = 'https://api.anacan.az';
  PremiumAccessResult? data;
  bool success = false, error = false, loading = false;
  int rpcCalls = 0;

  void advance(int ms) {
    wall += ms;
    mono += ms;
  }

  /// A fresh query (new account/backend/cold start): no in-memory data.
  void reset() {
    data = null;
    success = false;
    error = false;
  }

  Future<void> fetch(FutureOr<Object?> Function() answer) async {
    rpcCalls++;
    try {
      data = await fetchPremiumAccess(rpc: (_) async => answer(), backend: backend, actor: actor, partner: null, storage: storage, clock: clock);
      success = true;
      error = false;
    } catch (_) {
      error = true;
      success = false; // react-query keeps the last data on a failed refetch
    }
  }

  PremiumEntitlement get view => evaluatePremiumEntitlement(
        actor: actor.isEmpty ? null : actor,
        backend: backend,
        partner: null,
        data: data,
        isSuccess: success,
        isError: error,
        isLoading: loading,
        storage: storage,
        clock: clock,
      );
}

void main() {
  test('shares a bounded server grant and ignores stale local/profile Premium booleans', () async {
    final s = Sim();
    s.storage.setItem('anacan_ocache_v1:subscription', '{"userId":"a","data":{"plan_type":"premium"}}');
    await s.fetch(() => access('a', false));
    expect(s.view.isPremium, isFalse);
    expect(s.view.ready, isTrue);
    expect(s.rpcCalls, 1);
  });

  test('locks at exact own expiry without navigation or another network response', () async {
    final s = Sim();
    await s.fetch(() => access('a', true, expiry: '2026-09-25T12:00:01Z'));
    expect(s.view.isPremium, isTrue);
    expect(s.view.nextChangeInMs, closeTo(1000, 1));
    s.advance(1001);
    expect(s.view.isPremium, isFalse);
    expect(s.view.revoked, isTrue);
    expect(s.rpcCalls, 1);
  });

  test('keeps a confirmed household grant past the short lease but never beyond the 72h offline window', () async {
    final s = Sim();
    await s.fetch(() => access('a', false, household: true));
    expect(s.view.householdPremium, isTrue);
    s.advance(30001);
    expect(s.view.householdPremium, isTrue);
    s.advance(72 * 3600 * 1000);
    expect(s.view.isPremium, isFalse);
  });

  test('uses a monotonic deadline even if the device clock moves backwards', () async {
    final s = Sim();
    await s.fetch(() => access('a', true, expiry: '2026-09-25T12:00:01Z'));
    expect(s.view.isPremium, isTrue);
    s.wall = DateTime.parse('2020-01-01').millisecondsSinceEpoch;
    s.mono += 1001;
    expect(s.view.isPremium, isFalse);
  });

  test('applies a confirmed refund immediately and a later network error cannot restore it', () async {
    final s = Sim();
    await s.fetch(() => access('a', true));
    expect(s.view.isPremium, isTrue);
    await s.fetch(() => access('a', false));
    expect(s.view.isPremium, isFalse);
    await s.fetch(() => throw StateError('NETWORK'));
    expect(s.view.isPremium, isFalse);
  });

  test('a failed refresh keeps a confirmed grant offline until min(expiry, last confirmation + 72h) and never beyond', () async {
    final s = Sim();
    await s.fetch(() => access('a', true));
    await s.fetch(() => throw StateError('offline'));
    s.advance(30001);
    expect(s.view.isPremium, isTrue);
    expect(s.view.error, isTrue);
    expect(s.view.revoked, isFalse);
    s.advance(72 * 3600 * 1000);
    expect(s.view.isPremium, isFalse);
  });

  test('a cold start offline uses the stored confirmed grant; an explicit inactive answer revokes it', () async {
    final s = Sim();
    await s.fetch(() => access('a', true));
    expect(s.view.isPremium, isTrue);
    s.reset();
    await s.fetch(() => throw StateError('offline'));
    expect(s.view.isPremium, isTrue);
    expect(s.view.revoked, isFalse);
    s.reset();
    await s.fetch(() => access('a', false));
    expect(s.view.isPremium, isFalse);
    s.reset();
    await s.fetch(() => throw StateError('offline'));
    expect(s.view.isPremium, isFalse);
  });

  test('never creates a grant from storage that the server did not confirm for this account and backend', () async {
    final s = Sim();
    final far = t0 + 1000000000;
    s.storage.setItem('anacan_premium_grant_v1:https://api.anacan.az:a',
        '{"backend":"https://source.example","userId":"a","partner":null,"confirmedAt":$t0,"ownUntil":$far,"householdUntil":0,"ownSource":null}');
    s.storage.setItem('anacan_premium_grant_v1:https://api.anacan.az:b',
        '{"backend":"https://api.anacan.az","userId":"b","partner":null,"confirmedAt":$t0,"ownUntil":$far,"householdUntil":0,"ownSource":null}');
    await s.fetch(() => throw StateError('offline'));
    expect(s.view.isPremium, isFalse);
  });

  for (final boundary in ['actor', 'backend']) {
    test('does not reuse cached entitlements across a $boundary change', () async {
      final s = Sim();
      await s.fetch(() => access('a', true));
      expect(s.view.isPremium, isTrue);
      if (boundary == 'actor') {
        s.actor = 'b';
      } else {
        s.backend = 'https://source.example';
      }
      s.reset();
      s.loading = true; // the new query is still loading
      expect(s.view.isPremium, isFalse);
    });
  }

  test('rejects grants belonging to another account or with an unbounded lease', () async {
    final s = Sim();
    await s.fetch(() => access('someone-else', true));
    expect(s.view.isPremium, isFalse);
    await s.fetch(() => access('a', true, validUntil: '2027-01-01T00:00:00Z'));
    expect(s.view.isPremium, isFalse);
  });

  test('never requests or grants access when signed out', () {
    final s = Sim()..actor = '';
    expect(s.view.isPremium, isFalse);
    expect(s.view.ready, isFalse);
    expect(s.rpcCalls, 0);
  });

  for (final reason in ['expiry', 'refund']) {
    test('stops global background white noise on $reason even when its tool is not mounted', () async {
      // PremiumEntitlementMonitor stops playback when `revoked` turns true.
      final s = Sim();
      await s.fetch(() => access('a', true, expiry: '2026-09-25T12:00:01Z'));
      expect(s.view.revoked, isFalse);
      if (reason == 'expiry') {
        s.advance(1001);
      } else {
        await s.fetch(() => access('a', false));
      }
      expect(s.view.revoked, isTrue);
    });
  }

  test('does not stop background white noise on a network error while a confirmed grant is valid', () async {
    final s = Sim();
    await s.fetch(() => access('a', true));
    await s.fetch(() => throw StateError('timeout'));
    s.advance(30001);
    expect(s.view.revoked, isFalse);
  });

  test('does not poll the lease: the monitor re-reads on resume, explicit invalidation and every 10 minutes', () {
    expect(premiumAccessPoll, const Duration(minutes: 10));
    expect(resumeCoalesce, const Duration(seconds: 2));
    expect(entitlementRoots, {'premium-access-v1', 'subscription', 'household-premium'});
    expect(premiumContentRoots, {'community-feed', 'community-profile-card', 'stories', 'chat-authors-v2', 'banners'});
  });

  testWidgets('turns a hung entitlement request into an error instead of an endless loading state', (tester) async {
    final s = Sim();
    s.loading = true;
    final pending = s.fetch(() => Completer<Object?>().future).then((_) => s.loading = false);
    expect(s.view.loading, isTrue);
    await tester.pump(const Duration(milliseconds: 15001));
    await pending;
    expect(s.view.loading, isFalse);
    expect(s.view.error, isTrue);
  });
}
