// Ported from: src/lib/offline-session.ts (no vitest file exists; behaviour cases are new).

import 'dart:convert';

import 'package:anacan/core/session/offline_session.dart';
import 'package:flutter_test/flutter_test.dart';

String stored({Object? refresh = 'r', Object? expiresAt = 1000, Object? user = const {'id': 'u1'}}) => jsonEncode({
      'access_token': 'a',
      'refresh_token': refresh,
      'expires_at': expiresAt,
      'token_type': 'bearer',
      'user': user,
    });

void main() {
  test('parses the supabase_flutter persisted session with an account and refresh token', () {
    final session = parseStoredSession(stored())!;
    expect(session.userId, 'u1');
    expect(session.refreshToken, 'r');
    expect(session.expiresAt, 1000);
  });

  test('rejects sessions that cannot be refreshed or name no account', () {
    for (final raw in [
      null, '', 'not-json', 'null', '[]',
      stored(refresh: ''), stored(refresh: null), stored(expiresAt: null), stored(expiresAt: '1000'),
      stored(user: null), stored(user: const {'id': ''}), stored(user: const {'id': 'u1', '__isUserNotAvailableProxy': true}),
    ]) {
      expect(parseStoredSession(raw), isNull, reason: raw);
    }
  });

  test('reads through a failing store as no session', () async {
    expect(await readStoredSession(null), isNull);
    expect(await readStoredSession(() async => throw Exception('blocked')), isNull);
    expect((await readStoredSession(() async => stored()))!.userId, 'u1');
  });

  test('treats a session as expired 90 s before expires_at', () {
    final now = DateTime.fromMillisecondsSinceEpoch(1000 * 1000);
    expect(isSessionExpired(1000 + 91, now: now), isFalse);
    expect(isSessionExpired(1000 + 89, now: now), isTrue);
    expect(isSessionExpired(null, now: now), isTrue);
    expect(offlineRestoreGrace, const Duration(milliseconds: 2500));
  });
}
