// Ported from: the channel-per-subscription pattern of src/hooks (e.g. useNotifications.ts:
// `supabase.channel(\`notifications_changes:${crypto.randomUUID()}\`).on('postgres_changes', {...}).subscribe()`
// and `return () => supabase.removeChannel(channel)` in the effect cleanup).
//
// Unique channel name per subscription; removed automatically when the provider is disposed.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../offline/offline_outbox.dart' show newClientId;

/// `event: '*' | 'INSERT' | 'UPDATE' | 'DELETE'`.
PostgresChangeEvent postgresEvent(String event) => switch (event.toUpperCase()) {
      'INSERT' => PostgresChangeEvent.insert,
      'UPDATE' => PostgresChangeEvent.update,
      'DELETE' => PostgresChangeEvent.delete,
      _ => PostgresChangeEvent.all,
    };

/// Parses a supabase-js filter string `column=op.value` (`user_id=eq.<id>`, `id=in.(a,b)`).
PostgresChangeFilter? parsePostgresFilter(String? filter) {
  if (filter == null || filter.isEmpty) return null;
  final eq = filter.indexOf('=');
  if (eq <= 0) return null;
  final column = filter.substring(0, eq);
  var rest = filter.substring(eq + 1);
  var negate = false;
  if (rest.startsWith('not.')) {
    negate = true;
    rest = rest.substring(4);
  }
  final dot = rest.indexOf('.');
  if (dot <= 0) return null;
  final op = rest.substring(0, dot);
  final raw = rest.substring(dot + 1);
  final type = op == 'in'
      ? PostgresChangeFilterType.inFilter
      : PostgresChangeFilterType.values.where((t) => t.name == op).firstOrNull;
  if (type == null) return null;
  final Object value = type == PostgresChangeFilterType.inFilter
      ? raw.replaceAll(RegExp(r'^\(|\)$'), '').split(',')
      : raw;
  return PostgresChangeFilter(type: type, column: column, value: value, negate: negate);
}

/// supabase-js `channel('prefix:uuid').on('postgres_changes', {event, schema, table, filter}, cb).subscribe()`,
/// removed when [ref] is disposed (the effect cleanup). Returns the channel.
RealtimeChannel subscribePostgresChanges(
  Ref ref,
  SupabaseClient client, {
  required String channelPrefix,
  required String table,
  String event = '*',
  String schema = 'public',
  String? filter,
  required void Function(PostgresChangePayload payload) onChange,
  void Function(RealtimeSubscribeStatus status, Object? error)? onStatus,
}) {
  final channel = client
      .channel('$channelPrefix:${newClientId()}')
      .onPostgresChanges(
        event: postgresEvent(event),
        schema: schema,
        table: table,
        filter: parsePostgresFilter(filter),
        callback: onChange,
      )
      .subscribe(onStatus);
  ref.onDispose(() => unawaited(client.removeChannel(channel).then((_) {}, onError: (Object _) {})));
  return channel;
}
