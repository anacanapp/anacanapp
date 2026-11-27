// Ported from: src/lib/premium-grant-cache.test.ts
import 'dart:convert';

import 'package:anacan/native/purchases/premium_grant_cache.dart';
import 'package:flutter_test/flutter_test.dart';

const backend = 'https://api.anacan.az', userId = 'user-a';
final t0 = DateTime.parse('2026-11-25T10:00:00Z').millisecondsSinceEpoch;
ServerGrant grant(bool active, [String? expiresAt = '2026-12-25T10:00:00Z']) => ServerGrant(active: active, expiresAt: expiresAt, source: 'subscription');
PremiumGrantRecord record([ServerGrant? own, ServerGrant? household, int? now]) => recordFromServer(
      backend: backend,
      userId: userId,
      partner: null,
      checkedAt: DateTime.fromMillisecondsSinceEpoch(t0, isUtc: true).toIso8601String(),
      own: own ?? grant(true),
      household: household ?? grant(false),
      now: now ?? t0,
    );
GrantEvaluation eval(PremiumGrantRecord? r, num now, {String? user = userId, String b = backend, String? partner}) =>
    evaluateGrant(r, backend: b, userId: user, partner: partner, now: now);

void main() {
  late MemoryGrantStorage storage;
  setUp(() => storage = MemoryGrantStorage());

  group('offline premium grant', () {
    test('extends a confirmed grant to min(real expiry, confirmation + 72h)', () {
      final r = record();
      expect(eval(r, t0 + premiumOfflineGraceMs - 1).own, isTrue);
      expect(eval(r, t0 + premiumOfflineGraceMs + 1).own, isFalse);
      final soon = record(grant(true, DateTime.fromMillisecondsSinceEpoch(t0 + 3600000, isUtc: true).toIso8601String()));
      expect(eval(soon, t0 + 3599000).own, isTrue);
      expect(eval(soon, t0 + 3601000).own, isFalse);
    });
    test('uses server-relative expiry so a wrong device clock cannot lengthen it', () {
      final r = recordFromServer(
        backend: backend,
        userId: userId,
        partner: null,
        checkedAt: DateTime.fromMillisecondsSinceEpoch(t0, isUtc: true).toIso8601String(),
        own: grant(true, DateTime.fromMillisecondsSinceEpoch(t0 + 3600000, isUtc: true).toIso8601String()),
        household: grant(false),
        now: t0 + 10 * 86400000,
      );
      expect(eval(r, t0 + 10 * 86400000 + 3601000).own, isFalse);
    });
    test('never grants without a confirmed active answer', () {
      expect(eval(record(grant(false)), t0).own, isFalse);
      final none = eval(null, t0);
      expect([none.own, none.household, none.hadGrant], [false, false, false]);
      expect(eval(record(), t0, user: 'user-b').own, isFalse);
      expect(eval(record(), t0, b: 'https://source.example').own, isFalse);
    });
    test('drops the household part after the partner link changes', () {
      final r = recordFromServer(
          backend: backend, userId: userId, partner: 'p1', checkedAt: DateTime.fromMillisecondsSinceEpoch(t0, isUtc: true).toIso8601String(), own: grant(false), household: grant(true), now: t0);
      expect(eval(r, t0 + 1, partner: 'p1').household, isTrue);
      expect(eval(r, t0 + 1).household, isFalse);
    });
    test('treats a clock moved back before the confirmation as invalid', () {
      final e = eval(record(), t0 - 24 * 3600000);
      expect(e.own, isFalse);
      expect(e.hadGrant, isTrue);
    });
    test('an explicit inactive answer removes the stored grant', () {
      writeGrantRecord(storage, record());
      expect(readGrantRecord(storage, backend, userId)!.ownUntil, greaterThan(t0));
      writeGrantRecord(storage, record(grant(false)));
      expect(readGrantRecord(storage, backend, userId), isNull);
    });
    test('picks the newest record', () {
      final older = record(grant(true), grant(false), t0), newer = record(grant(false), grant(false), t0 + 1000);
      expect(newestRecord([older, newer]), same(newer));
      expect(newestRecord([null, older]), same(older));
    });
  });

  test('stores the Capacitor key and JSON shape', () {
    writeGrantRecord(storage, record());
    final raw = storage.values['anacan_premium_grant_v1:https://api.anacan.az:user-a']!;
    final json = jsonDecode(raw) as Map;
    expect(json.keys, ['backend', 'userId', 'partner', 'confirmedAt', 'ownUntil', 'householdUntil', 'ownSource']);
    expect(json['confirmedAt'], t0);
    expect(json['ownSource'], 'subscription');
  });
}
