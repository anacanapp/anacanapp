// Ported from: src/lib/kickSession.ts
//
// Pure helpers for the kick counter session. A session is timed from a stored start timestamp (not timer ticks), so
// a locked screen or a backgrounded app does not stop the clock. An unfinished session survives leaving the screen
// through LocalStore (`anacan_kick_active_v1:<userId|anon>`, same JSON as the WebView's localStorage).
import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../../domain/dates/local_date.dart';
import '../../../domain/js_compat.dart';
import '../../../state/local_store.dart';

@immutable
class ActiveKickSession {
  const ActiveKickSession({required this.startedAt, required this.kicks, this.position});

  /// Epoch ms when this session started.
  final int startedAt;
  final int kicks;

  /// 'left' | 'right' | null.
  final String? position;

  ActiveKickSession copyWith({int? kicks, Object? position = _keep}) => ActiveKickSession(
        startedAt: startedAt,
        kicks: kicks ?? this.kicks,
        position: identical(position, _keep) ? this.position : position as String?,
      );

  /// `JSON.stringify(session)` key order; `position` only when set on the object.
  Map<String, Object?> toJson({bool includePosition = true}) =>
      {'startedAt': startedAt, 'kicks': kicks, if (includePosition) 'position': position};

  @override
  bool operator ==(Object other) =>
      other is ActiveKickSession && other.startedAt == startedAt && other.kicks == kicks && other.position == position;
  @override
  int get hashCode => Object.hash(startedAt, kicks, position);
  @override
  String toString() => 'ActiveKickSession($startedAt, $kicks, $position)';
}

const Object _keep = Object();

/// Unfinished sessions older than this are dropped on restore (forgotten timer).
const int kickSessionMaxAgeMs = 12 * 60 * 60 * 1000;

const String _storagePrefix = 'anacan_kick_active_v1';
String kickSessionStorageKey(String? userId) => '$_storagePrefix:${userId == null || userId.isEmpty ? 'anon' : userId}';

/// A fresh session: count 0, new start time. Every "start" must use this.
ActiveKickSession newKickSession([int? now, int kicks = 0]) => ActiveKickSession(startedAt: now ?? DomainClock.nowMs(), kicks: kicks);

/// Whole seconds since the session started (never negative).
int kickElapsedSeconds(ActiveKickSession? session, [int? now]) =>
    session == null ? 0 : ((now ?? DomainClock.nowMs()) - session.startedAt).clamp(0, 1 << 52) ~/ 1000;

bool _isValid(Object? v, int now) {
  if (v is! Map) return false;
  final s = v['startedAt'], k = v['kicks'];
  return s is num &&
      s.isFinite &&
      s <= now + 60000 &&
      now - s <= kickSessionMaxAgeMs &&
      k is num &&
      jsIsInteger(k) &&
      k >= 0 &&
      k < 10000;
}

ActiveKickSession? loadActiveKickSession(LocalStore store, String? userId, [int? now]) {
  final n = now ?? DomainClock.nowMs();
  try {
    final raw = store.getItem(kickSessionStorageKey(userId));
    if (raw == null || raw.isEmpty) return null;
    final parsed = jsonDecode(raw);
    if (!_isValid(parsed, n)) {
      store.removeItem(kickSessionStorageKey(userId));
      return null;
    }
    final map = parsed as Map;
    final p = map['position'];
    return ActiveKickSession(
      startedAt: (map['startedAt'] as num).toInt(),
      kicks: (map['kicks'] as num).toInt(),
      position: p == 'left' || p == 'right' ? p as String : null,
    );
  } catch (_) {
    return null;
  }
}

void saveActiveKickSession(LocalStore store, String? userId, ActiveKickSession? session) {
  try {
    if (session != null) {
      store.setItem(kickSessionStorageKey(userId), jsonEncode(session.toJson(includePosition: session.position != null)));
    } else {
      store.removeItem(kickSessionStorageKey(userId));
    }
  } catch (_) {
    // storage blocked: the session just will not survive leaving the screen
  }
}

/// Local calendar day of a saved session (from created_at, so old rows with a server-side UTC session_date group
/// correctly).
String kickSessionDayKey({required String createdAt, String? sessionDate}) {
  final d = jsParseDate(createdAt);
  return d == null ? (sessionDate ?? '') : localDateKey(d.toLocal());
}

/// Lock-screen live timer content for a running session, or null when idle.
({int startTime, int count})? kickLiveTimerState(ActiveKickSession? session) =>
    session == null ? null : (startTime: session.startedAt, count: session.kicks);
