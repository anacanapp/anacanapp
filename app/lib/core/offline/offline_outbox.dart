// Ported from: src/lib/offline-outbox.ts
//
// Offline outbox for small health log writes. A write is put in a per-user persisted queue
// BEFORE the network call; every row carries a client UUID as its primary key and is sent with
// `upsert(..., onConflict: 'id', ignoreDuplicates: true)`, so a retry of a row the server already
// stored is a no-op instead of a duplicate. The queue format is byte-compatible with the
// Capacitor app (`anacan_outbox_v1:<userId>` = `[{id, table, payload, createdAt, attempts,
// rejects?}]`), so entries imported from the 53.0 export (MigrationImport → LocalStore) replay
// with their original ids.
//
// - Confirmed write: the entry is removed.
// - Network/timeout/5xx failure: the entry stays and is flushed later (login, `online`, resume,
//   token refresh after an offline open).
// - Real server rejection: the direct caller gets `error`; during a background flush it is retried
//   a few times and then dropped, so a poisoned row never blocks the queue forever.
// - Entries are not deleted on logout (keyed by user id).

import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;
import 'dart:math';

import 'package:flutter/foundation.dart' show debugPrint;
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, AuthException;

import '../../state/local_store.dart';
import 'connectivity.dart';
import 'outbox_senders.dart';

export 'outbox_senders.dart' show SendResult, waterOutboxTable, dailyLogOutboxTable;

/// Append-only row tables.
const List<String> outboxRowTables = [
  'baby_logs', 'kick_sessions', 'weight_entries', 'meal_logs', 'exercise_logs',
  'cycle_history', 'vitamin_intake_logs', 'appointments',
];

/// Every table token the outbox accepts.
const List<String> outboxTables = [...outboxRowTables, waterOutboxTable, dailyLogOutboxTable];

/// Server rejections tolerated in background flushes before an entry is dropped.
const int outboxMaxRejects = 5;

/// Hard ceiling for any entry (also network failures), roughly weeks of resumes.
const int outboxMaxAttempts = 200;

const String outboxKeyPrefix = 'anacan_outbox_v1:';
String outboxKeyFor(String userId) => '$outboxKeyPrefix$userId';

class OutboxEntry {
  const OutboxEntry({
    required this.id,
    required this.table,
    required this.payload,
    required this.createdAt,
    required this.attempts,
    this.rejects,
  });

  /// Client generated UUID, also the row's primary key.
  final String id;
  final String table;
  final Map<String, Object?> payload;
  final num createdAt;

  /// Failed send attempts (any reason).
  final int attempts;

  /// Attempts the server answered with a real (non-transient) rejection.
  final int? rejects;

  OutboxEntry copyWith({Map<String, Object?>? payload, int? attempts, int? rejects}) => OutboxEntry(
        id: id,
        table: table,
        payload: payload ?? this.payload,
        createdAt: createdAt,
        attempts: attempts ?? this.attempts,
        rejects: rejects ?? this.rejects,
      );

  /// Same key order as the React writer.
  Map<String, Object?> toJson() => {
        'id': id,
        'table': table,
        'payload': payload,
        'createdAt': createdAt,
        'attempts': attempts,
        if (rejects != null) 'rejects': rejects,
      };

  static OutboxEntry? tryParse(Object? value) {
    if (value is! Map) return null;
    final id = value['id'], table = value['table'], payload = value['payload'];
    final createdAt = value['createdAt'], attempts = value['attempts'];
    if (id is! String || table is! String || !outboxTables.contains(table)) return null;
    if (payload is! Map || createdAt is! num || attempts is! num) return null;
    final rejects = value['rejects'];
    return OutboxEntry(
      id: id,
      table: table,
      payload: Map<String, Object?>.from(payload),
      createdAt: createdAt,
      attempts: attempts.toInt(),
      rejects: rejects is num ? rejects.toInt() : null,
    );
  }
}

typedef OutboxSender = Future<SendResult> Function(String table, Map<String, Object?> row);

enum SaveStatus { saved, queued, error }

class SaveOutcome {
  const SaveOutcome._(this.status, {this.data, this.error});
  final SaveStatus status;
  final Map<String, Object?>? data;
  final Object? error;
}

class FlushResult {
  FlushResult({this.sent = 0, this.failed = 0, this.dropped = 0, List<String>? tables}) : tables = tables ?? [];
  int sent;
  int failed;
  int dropped;
  final List<String> tables;
}

/// `{userId, sentTables}` given to listeners (invalidate the matching queries).
class OutboxChange {
  const OutboxChange(this.userId, this.sentTables);
  final String userId;
  final List<String> sentTables;
}

final Random _random = Random.secure();

/// RFC 4122 v4 (`crypto.randomUUID()`).
String newClientId() {
  final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

final RegExp _transientText = RegExp(
  r'failed to fetch|load failed|network|fetch failed|timed? ?out|timeout|aborted|offline|connection|econn|enotfound|socket',
);

/// True for failures that may succeed later: offline, timeout, no response, 5xx, 408/429, expired auth.
bool isTransientError(Object? error, {int? status, bool? online}) {
  if (online == false) return true;
  if (status != null && (status == 0 || status == 401 || status == 408 || status == 429 || status >= 500)) return true;
  if (error == null) return false;
  // Dart counterparts of AbortError / TimeoutError / TypeError ("Failed to fetch").
  if (error is TimeoutException || error is SocketException || error is http.ClientException) return true;
  String? name, message, code, details;
  if (error is PostgrestException) {
    message = error.message;
    code = error.code;
    details = error.details?.toString();
  } else if (error is AuthException) {
    message = error.message;
    code = error.code;
  } else if (error is Map) {
    name = error['name']?.toString();
    message = error['message']?.toString();
    code = error['code']?.toString();
    details = error['details']?.toString();
  } else if (error is! String) {
    message = error.toString();
  }
  if (name == 'AbortError' || name == 'TimeoutError' || name == 'TypeError') return true;
  if (code == 'PGRST301' || code == 'PGRST303') return true; // JWT expired/invalid: retry after refresh
  final text = '${message ?? ''} ${details ?? ''} ${error is String ? error : ''}'.toLowerCase();
  return _transientText.hasMatch(text);
}

/// The per-user outbox (React: module state of offline-outbox.ts).
class OfflineOutbox {
  OfflineOutbox({
    required this.store,
    required this.sender,
    ConnectivitySource? connectivity,
    this.resumes,
    int Function()? now,
    void Function(String message)? log,
  })  : connectivity = connectivity ?? ManualConnectivitySource(),
        _now = now ?? (() => DateTime.now().millisecondsSinceEpoch),
        _log = log ?? debugPrint;

  final LocalStore store;
  OutboxSender sender;
  final ConnectivitySource connectivity;
  /// App resume events (the shell passes an AppLifecycleListener stream).
  final Stream<void>? resumes;
  final int Function() _now;
  final void Function(String message) _log;

  final Set<void Function(OutboxChange)> _listeners = {};
  final Map<String, Future<FlushResult>> _inflight = {};
  final Map<String, int> _activeUsers = {};
  final List<StreamSubscription<Object?>> _triggers = [];
  bool _triggersInstalled = false;

  bool get _offline => !connectivity.isOnline;

  List<OutboxEntry> readOutbox(String? userId) {
    if (userId == null || userId.isEmpty) return [];
    final parsed = store.readJson(outboxKeyFor(userId));
    if (parsed is! List) return [];
    return [for (final value in parsed) ?OutboxEntry.tryParse(value)];
  }

  void Function() subscribe(void Function(OutboxChange change) listener) {
    _listeners.add(listener);
    return () => _listeners.remove(listener);
  }

  void _notify(String userId, [List<String> sentTables = const []]) {
    for (final listener in List.of(_listeners)) {
      try {
        listener(OutboxChange(userId, sentTables));
      } catch (error) {
        _log('outbox listener failed');
      }
    }
  }

  bool _write(String userId, List<OutboxEntry> entries) {
    try {
      if (entries.isEmpty) {
        store.removeItem(outboxKeyFor(userId));
      } else {
        store.setItem(outboxKeyFor(userId), jsonEncode([for (final e in entries) e.toJson()]));
      }
      return true;
    } catch (_) {
      _log('outbox write failed');
      return false;
    }
  }

  /// Adds (or replaces, same id) an entry. Returns false when storage refused it.
  bool enqueue(String userId, {required String id, required String table, required Map<String, Object?> payload}) {
    final current = readOutbox(userId);
    OutboxEntry? existing;
    for (final e in current) {
      if (e.id == id) existing = e;
    }
    final next = existing != null
        ? existing.copyWith(payload: {...payload, 'id': id})
        : OutboxEntry(id: id, table: table, payload: {...payload, 'id': id}, createdAt: _now(), attempts: 0);
    final ok = _write(userId, [...current.where((e) => e.id != id), next]);
    if (ok) _notify(userId);
    return ok;
  }

  void remove(String userId, String id) {
    final current = readOutbox(userId);
    if (!current.any((e) => e.id == id)) return;
    _write(userId, current.where((e) => e.id != id).toList());
    _notify(userId);
  }

  /// Queued rows of one table (payload incl. id), oldest first, for optimistic display.
  List<Map<String, Object?>> pendingRows(String? userId, String table) {
    final entries = readOutbox(userId).where((e) => e.table == table).toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return [for (final e in entries) e.payload];
  }

  String _bump(String userId, String id, bool rejected) {
    final current = readOutbox(userId);
    OutboxEntry? entry;
    for (final e in current) {
      if (e.id == id) entry = e;
    }
    if (entry == null) return 'kept';
    final attempts = entry.attempts + 1;
    final rejects = (entry.rejects ?? 0) + (rejected ? 1 : 0);
    if (rejects >= outboxMaxRejects || attempts >= outboxMaxAttempts) {
      _log('outbox: dropping entry after repeated failures (${entry.table}, attempts $attempts, rejects $rejects)');
      _write(userId, current.where((e) => e.id != id).toList());
      return 'dropped';
    }
    _write(userId, [for (final e in current) e.id == id ? e.copyWith(attempts: attempts, rejects: rejects) : e]);
    return 'kept';
  }

  /// Persist-then-send for one row.
  Future<SaveOutcome> saveWithOutbox(String userId, String table, Map<String, Object?> row, [OutboxSender? send]) async {
    final rowId = row['id'];
    final id = rowId is String && rowId.isNotEmpty ? rowId : newClientId();
    final payload = {...row, 'id': id};
    final persisted = enqueue(userId, id: id, table: table, payload: payload);
    final result = await (send ?? sender)(table, payload);
    if (result.error == null) {
      remove(userId, id);
      final data = result.data;
      return SaveOutcome._(SaveStatus.saved, data: data is Map ? Map<String, Object?>.from(data) : payload);
    }
    if (isTransientError(result.error, status: result.status, online: _offline ? false : null) && persisted) {
      _bump(userId, id, false);
      return SaveOutcome._(SaveStatus.queued, data: payload);
    }
    remove(userId, id);
    return SaveOutcome._(SaveStatus.error, error: result.error);
  }

  /// Sends queued entries oldest first; stops at the first transient failure. Deduped per user.
  Future<FlushResult> flush(String? userId, [OutboxSender? send]) {
    if (userId == null || userId.isEmpty) return Future.value(FlushResult());
    final running = _inflight[userId];
    if (running != null) return running;
    if (readOutbox(userId).isEmpty) return Future.value(FlushResult());
    final run = () async {
      final result = FlushResult();
      final entries = readOutbox(userId)..sort((a, b) => a.createdAt.compareTo(b.createdAt));
      for (final entry in entries) {
        // Removed meanwhile (a direct save confirmed it).
        if (!readOutbox(userId).any((e) => e.id == entry.id)) continue;
        final sent = await (send ?? sender)(entry.table, {...entry.payload, 'id': entry.id});
        if (sent.error == null) {
          remove(userId, entry.id);
          result.sent++;
          if (!result.tables.contains(entry.table)) result.tables.add(entry.table);
          continue;
        }
        final transient = isTransientError(sent.error, status: sent.status, online: _offline ? false : null);
        result.failed++;
        if (_bump(userId, entry.id, !transient) == 'dropped') result.dropped++;
        if (transient) break; // still offline: keep the rest for the next trigger
      }
      _notify(userId, result.tables);
      return result;
    }();
    final tracked = run.whenComplete(() {
      _inflight.remove(userId);
    });
    _inflight[userId] = tracked;
    return tracked;
  }

  void _flushActiveUsers() {
    for (final userId in _activeUsers.keys.toList()) {
      unawaited(flush(userId));
    }
  }

  void _installTriggers() {
    if (_triggersInstalled) return;
    _triggersInstalled = true;
    _triggers.add(connectivity.onlineChanges.listen((online) {
      if (online) _flushActiveUsers();
    }));
    final resumed = resumes;
    if (resumed != null) _triggers.add(resumed.listen((_) => _flushActiveUsers()));
  }

  /// Keeps the outbox of a signed-in user flushing: now, and again on `online` and app resume.
  /// Reference counted. Returns a release function.
  void Function() retainUser(String userId) {
    _installTriggers();
    _activeUsers[userId] = (_activeUsers[userId] ?? 0) + 1;
    unawaited(flush(userId));
    return () {
      final count = (_activeUsers[userId] ?? 1) - 1;
      if (count <= 0) {
        _activeUsers.remove(userId);
      } else {
        _activeUsers[userId] = count;
      }
    };
  }

  /// Test helper (`__resetOutboxForTests`).
  void resetForTests() {
    _inflight.clear();
    _activeUsers.clear();
    _listeners.clear();
  }

  Future<void> dispose() async {
    for (final sub in _triggers) {
      await sub.cancel();
    }
  }
}
