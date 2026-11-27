// Ported from: src/lib/kickSession.test.ts
import 'package:anacan/features/tools/kick/kick_session.dart';
import 'package:anacan/state/local_store.dart';
import 'package:flutter_test/flutter_test.dart';

final int now = DateTime(2026, 11, 8, 12).millisecondsSinceEpoch;

void main() {
  group('kick session', () {
    late LocalStore store;
    setUp(() => store = LocalStore.memory());

    test('every start is a fresh session: count 0 and a new start time', () {
      final s = newKickSession(now);
      expect(s, ActiveKickSession(startedAt: now, kicks: 0));
      expect(newKickSession(now + 5000).startedAt, now + 5000);
    });

    test('elapsed time comes from the start timestamp (survives a locked screen)', () {
      final s = newKickSession(now);
      // 10 minutes pass with no timer ticks at all
      expect(kickElapsedSeconds(s, now + 10 * 60 * 1000), 600);
      expect(kickElapsedSeconds(s, now - 1000), 0);
      expect(kickElapsedSeconds(null, now), 0);
    });

    test('persists an unfinished session per user and clears it', () {
      saveActiveKickSession(store, 'u1', ActiveKickSession(startedAt: now, kicks: 4, position: 'left'));
      expect(loadActiveKickSession(store, 'u1', now + 1000), ActiveKickSession(startedAt: now, kicks: 4, position: 'left'));
      expect(loadActiveKickSession(store, 'u2', now + 1000), isNull);
      saveActiveKickSession(store, 'u1', null);
      expect(loadActiveKickSession(store, 'u1', now + 1000), isNull);
    });

    test('drops stale or corrupt stored sessions', () {
      saveActiveKickSession(store, 'u1', ActiveKickSession(startedAt: now, kicks: 2));
      expect(loadActiveKickSession(store, 'u1', now + kickSessionMaxAgeMs + 1), isNull);
      store.setItem('anacan_kick_active_v1:u1', '{"startedAt":"x","kicks":1}');
      expect(loadActiveKickSession(store, 'u1', now), isNull);
      store.setItem('anacan_kick_active_v1:u1', 'not json');
      expect(loadActiveKickSession(store, 'u1', now), isNull);
    });

    test('groups saved sessions by the local day of created_at', () {
      // 01:30 local in Baku (UTC+4) is the previous day in UTC; it must count as today.
      final createdLocal = DateTime(2026, 11, 8, 1, 30);
      expect(kickSessionDayKey(createdAt: createdLocal.toUtc().toIso8601String(), sessionDate: '2026-11-07'), '2026-11-08');
      expect(kickSessionDayKey(createdAt: 'bad', sessionDate: '2026-11-07'), '2026-11-07');
    });
  });
}
