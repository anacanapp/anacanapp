// Ported from: src/lib/water-intake-rpc.ts, src/lib/daily-log-rpc.ts, `sendRow` in src/lib/offline-outbox.ts
//
// Network senders used by the offline outbox. Each returns {data, error, status} instead of
// throwing (supabase-js shape); status 0 = no response (transport failure or the 15 s bound).

import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

/// Outcome of one send.
class SendResult {
  const SendResult({this.data, this.error, this.status});
  final Object? data;
  final Object? error;

  /// HTTP status when known (0 = no response).
  final int? status;
}

/// Outbox token of a water tap (a delta, not a total).
const String waterOutboxTable = 'water_intake';
const String waterRpc = 'increment_water_intake_v1';
const Duration waterSendTimeout = Duration(milliseconds: 15000);

/// Outbox token of a daily-log patch (the real table is `daily_logs`).
const String dailyLogOutboxTable = 'daily_logs';
const Duration dailyLogSendTimeout = Duration(milliseconds: 15000);

/// Request bound of a row insert.
const Duration outboxSendTimeout = Duration(milliseconds: 15000);

/// Same bounds as the server column clamp.
int clampWater(num value) => value.round().clamp(0, 20000);

/// HTTP status inferred from a PostgREST error: postgrest-dart puts the status in `code` when the
/// body had no code of its own.
int? statusOfPostgrestError(PostgrestException error) {
  final code = error.code;
  if (code != null && RegExp(r'^\d{3}$').hasMatch(code)) return int.parse(code);
  return null;
}

/// The server has no such function yet (old backend): PGRST202 / 42883 / 404 mentioning a function.
bool isMissingRpc(Object? error, [int? status]) {
  if (error == null) return false;
  String? code;
  String message = '';
  if (error is PostgrestException) {
    code = error.code;
    message = error.message;
  } else if (error is Map) {
    code = error['code']?.toString();
    message = error['message']?.toString() ?? '';
  }
  if (code == 'PGRST202' || code == '42883') return true;
  return status == 404 && RegExp('function|rpc', caseSensitive: false).hasMatch(message);
}

SendResult _failure(Object error) {
  if (error is PostgrestException) return SendResult(error: error, status: statusOfPostgrestError(error));
  return SendResult(error: error, status: 0);
}

/// Columns a client may patch for a day; water is excluded on purpose (own atomic path).
const Set<String> dailyLogPatchColumns = {
  'mood', 'symptoms', 'bleeding', 'temperature', 'notes', 'sleep_hours', 'sleep_quality',
};

/// The merge-upsert row of a daily-log patch: natural key + patch columns only (entry id and
/// water dropped). Returns a 400-style [SendResult] for an invalid or empty patch.
(Map<String, Object?>?, SendResult?) dailyLogPatchRow(Map<String, Object?> raw) {
  final userId = raw['user_id'];
  final logDate = raw['log_date'];
  if (userId is! String || logDate is! String || logDate.isEmpty) {
    return (null, const SendResult(error: {'code': '22023', 'message': 'invalid daily log patch'}, status: 400));
  }
  final row = <String, Object?>{'user_id': userId, 'log_date': logDate};
  var hasField = false;
  for (final entry in raw.entries) {
    if (!dailyLogPatchColumns.contains(entry.key)) continue;
    row[entry.key] = entry.value;
    hasField = true;
  }
  if (!hasField) {
    return (null, const SendResult(error: {'code': '22023', 'message': 'empty daily log patch'}, status: 400));
  }
  return (row, null);
}

/// Server calls of the outbox.
class SupabaseOutboxSender {
  SupabaseOutboxSender(this.client);
  final SupabaseClient client;

  /// `sendRow(table, row)`.
  Future<SendResult> call(String table, Map<String, Object?> row) {
    if (table == waterOutboxTable) return sendWaterDelta(row);
    if (table == dailyLogOutboxTable) return sendDailyLogPatch(row);
    return _insert(table, row);
  }

  /// Idempotent insert: an already stored id is ignored rather than duplicated.
  Future<SendResult> _insert(String table, Map<String, Object?> row) async {
    try {
      final data = await client
          .from(table)
          .upsert(row, onConflict: 'id', ignoreDuplicates: true)
          .select()
          .maybeSingle()
          .timeout(outboxSendTimeout);
      return SendResult(data: data, status: 201);
    } catch (error) {
      return _failure(error);
    }
  }

  /// Old backend only: read the stored total and upsert total + delta (not idempotent).
  Future<SendResult> _legacyAddWater(String userId, String logDate, num delta) async {
    try {
      final current = await client
          .from('daily_logs')
          .select('water_intake')
          .eq('user_id', userId)
          .eq('log_date', logDate)
          .maybeSingle();
      final total = clampWater(((current?['water_intake'] as num?) ?? 0) + delta);
      final saved = await client
          .from('daily_logs')
          .upsert({'user_id': userId, 'log_date': logDate, 'water_intake': total}, onConflict: 'user_id,log_date')
          .select('water_intake')
          .maybeSingle();
      return SendResult(
        data: {'water_intake': saved?['water_intake'] ?? total, 'applied': true, 'log_date': logDate},
        status: 200,
      );
    } catch (error) {
      return _failure(error);
    }
  }

  /// One queued water delta. `data` is `{water_intake, applied, log_date}` on success.
  Future<SendResult> sendWaterDelta(Map<String, Object?> row) async {
    final logDate = row['log_date'], delta = row['delta'];
    if (logDate is! String || delta is! num || delta == 0) {
      return const SendResult(error: {'code': '22023', 'message': 'invalid water delta'}, status: 400);
    }
    try {
      final data = await client
          .rpc(waterRpc, params: {'p_log_date': logDate, 'p_delta': delta, 'p_op_id': row['id']})
          .timeout(waterSendTimeout);
      return SendResult(data: data, status: 200);
    } on PostgrestException catch (error) {
      final status = statusOfPostgrestError(error);
      if (isMissingRpc(error, status)) {
        final userId = row['user_id'];
        if (userId is String) return _legacyAddWater(userId, logDate, delta);
      }
      return SendResult(error: error, status: status);
    } catch (error) {
      return _failure(error);
    }
  }

  /// One queued daily-log patch, merge-upserted on (user_id, log_date).
  Future<SendResult> sendDailyLogPatch(Map<String, Object?> raw) async {
    final (row, invalid) = dailyLogPatchRow(raw);
    if (row == null) return invalid!;
    try {
      final data = await client
          .from('daily_logs')
          .upsert(row, onConflict: 'user_id,log_date')
          .select()
          .maybeSingle()
          .timeout(dailyLogSendTimeout);
      return SendResult(data: data, status: 200);
    } catch (error) {
      return _failure(error);
    }
  }
}
