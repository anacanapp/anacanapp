// Ported from: the supabase-js calls of src/hooks/{useCommunity.ts,useCommunitySocial.ts,useUnreadCommunityPosts.ts,
//              useCommunityModeration.ts,useBlogAttachment.ts,useModerator.ts (useModeratorContent)},
//              src/components/community/{PostCard,CreatePostScreen,CommunityBlogCard,GroupPostTags}.tsx,
//              src/components/moderation/{BlockUserDialog,ModeratorEnforcement}.tsx, src/lib/public-profile-cards.ts
//              (through the chat port)
//
// Every backend access of the community feature goes through [CommunityBackend], so tests swap in an in-memory
// fake that records the query shape (table, filters, order, limit) like the vitest builder mocks.
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, SupabaseClient;

import '../../../core/data/data.dart';
import '../../chat/data/chat_backend.dart' show chatBackendProvider, getPublicProfileCards;

typedef CRow = Map<String, dynamic>;

/// One PostgREST filter (`.eq(column, value)`, `.neq`, `.is`, `.gt`, `.in`, `.ilike`).
@immutable
class CFilter {
  const CFilter(this.op, this.column, this.value);
  final String op;
  final String column;
  final Object? value;
  @override
  String toString() => '$op:$column=$value';
}

/// `from(table).select(columns)` + filters / order / limit, recorded so fakes can answer and tests can assert.
class CQuery {
  CQuery(this.table, [this.columns = '*']);
  final String table;
  final String columns;
  final List<CFilter> filters = [];
  final List<(String, bool)> orders = [];
  int? limitValue;

  CQuery eq(String column, Object? value) => this..filters.add(CFilter('eq', column, value));
  CQuery neq(String column, Object? value) => this..filters.add(CFilter('neq', column, value));
  CQuery isNull(String column) => this..filters.add(CFilter('is', column, null));
  CQuery gt(String column, Object? value) => this..filters.add(CFilter('gt', column, value));
  CQuery inList(String column, List<Object?> values) => this..filters.add(CFilter('in', column, values));
  CQuery ilike(String column, String pattern) => this..filters.add(CFilter('ilike', column, pattern));
  CQuery order(String column, {bool ascending = true}) => this..orders.add((column, ascending));
  CQuery limit(int value) => this..limitValue = value;

  /// The value of the first filter `op:column` (tests).
  Object? filter(String op, String column) => filters.where((f) => f.op == op && f.column == column).firstOrNull?.value;
  bool has(String op, String column) => filters.any((f) => f.op == op && f.column == column);
}

/// A realtime `postgres_changes` payload.
@immutable
class CommunityChange {
  const CommunityChange({required this.eventType, this.newRecord = const {}, this.oldRecord = const {}});

  /// `INSERT` | `UPDATE` | `DELETE`.
  final String eventType;
  final CRow newRecord;
  final CRow oldRecord;
}

/// A backend error with a PostgREST-like `code` / `message` (fakes; real calls throw [PostgrestException]).
class CommunityBackendError implements Exception {
  const CommunityBackendError({this.code, this.message = ''});
  final String? code;
  final String message;
  @override
  String toString() => 'CommunityBackendError($code, $message)';
}

/// `error.code` of a thrown backend error.
String? errorCode(Object? error) {
  if (error == null) return null;
  if (error is PostgrestException) return error.code;
  if (error is CommunityBackendError) return error.code;
  if (error is Map) return error['code']?.toString();
  try {
    final code = (error as dynamic).code;
    return code?.toString();
  } catch (_) {
    return null;
  }
}

/// `error.message` of a thrown error (`Error.message` for plain errors).
String errorMessage(Object? error) {
  if (error == null) return '';
  if (error is PostgrestException) return error.message;
  if (error is CommunityBackendError) return error.message;
  if (error is StateError) return error.message;
  if (error is Map) return '${error['message'] ?? ''}';
  try {
    final message = (error as dynamic).message;
    return message?.toString() ?? '';
  } catch (_) {
    return error.toString();
  }
}

abstract interface class CommunityBackend {
  /// `supabase.auth.getUser()` → the user id (null when signed out).
  Future<String?> getUserId();

  /// `supabase.rpc(fn, params)`; throws on `error`.
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]);

  /// `await query` (the rows); throws on `error`.
  Future<List<CRow>> select(CQuery query);

  /// `query.maybeSingle()`; throws on `error`.
  Future<CRow?> maybeSingle(CQuery query);

  /// `from(table).insert(values).select(columns).single()`; throws on `error`.
  Future<CRow> insertSingle(String table, CRow values, {String columns = '*'});

  /// `from(table).delete().<filters>[.select(returning)]`; returns the deleted rows when [returning] is given.
  Future<List<CRow>> delete(String table, List<CFilter> filters, {String? returning});

  /// `from(table).update(values).<filters>`; throws on `error`.
  Future<void> update(String table, CRow values, List<CFilter> filters);

  /// `from(table).upsert(rows, { onConflict })`; throws on `error`.
  Future<void> upsert(String table, List<CRow> rows, {required String onConflict});

  /// `supabase.functions.invoke(fn, { body })` as `{data, error}`.
  Future<DbResult<Object?>> invoke(String fn, Object? body);

  /// `storage.from(bucket).upload(path, bytes, { cacheControl: '3600', upsert: false })`.
  Future<UploadResult> upload(String bucket, String path, Uint8List bytes, String contentType);

  /// `storage.from(bucket).getPublicUrl(path)`.
  String publicUrl(String bucket, String path);

  /// `getPublicProfileCards(userIds)` → `{user_id: card}`.
  Future<Map<String, CRow>> profileCards(List<String> userIds);

  /// `channel(prefix:uuid).on('postgres_changes', {event, table, filter}, cb).subscribe()`; returns the
  /// `removeChannel` cleanup.
  void Function() subscribe({required String channelPrefix, required String table, String event = '*', String? filter,
      required void Function(CommunityChange change) onChange});
}

class SupabaseCommunityBackend implements CommunityBackend {
  SupabaseCommunityBackend(this.db, this.cards);
  final Db db;
  final Future<Map<String, CRow>> Function(List<String> userIds) cards;
  SupabaseClient get _client => db.client;

  dynamic _apply(dynamic builder, List<CFilter> filters) {
    var b = builder;
    for (final f in filters) {
      b = switch (f.op) {
        'eq' => b.eq(f.column, f.value as Object),
        'neq' => b.neq(f.column, f.value as Object),
        'is' => b.isFilter(f.column, f.value),
        'gt' => b.gt(f.column, f.value as Object),
        'in' => b.inFilter(f.column, f.value as List),
        'ilike' => b.ilike(f.column, f.value as Object),
        _ => throw UnsupportedError(f.op),
      };
    }
    return b;
  }

  dynamic _build(CQuery q) {
    dynamic b = _apply(db.from(q.table).select(q.columns), q.filters);
    for (final (column, ascending) in q.orders) {
      b = b.order(column, ascending: ascending);
    }
    if (q.limitValue != null) b = b.limit(q.limitValue!);
    return b;
  }

  @override
  Future<String?> getUserId() async => (await _client.auth.getUser()).user?.id;

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) => db.rpc<Object?>(fn, params: params);

  @override
  Future<List<CRow>> select(CQuery query) async => asRows(await (_build(query) as Future<Object?>));

  @override
  Future<CRow?> maybeSingle(CQuery query) async => asRow(await (_build(query).maybeSingle() as Future<Object?>));

  @override
  Future<CRow> insertSingle(String table, CRow values, {String columns = '*'}) async =>
      asRow(await db.from(table).insert(values).select(columns).single())!;

  @override
  Future<List<CRow>> delete(String table, List<CFilter> filters, {String? returning}) async {
    final b = _apply(db.from(table).delete(), filters);
    if (returning == null) {
      await (b as Future<Object?>);
      return const [];
    }
    return asRows(await (b.select(returning) as Future<Object?>));
  }

  @override
  Future<void> update(String table, CRow values, List<CFilter> filters) async =>
      await (_apply(db.from(table).update(values), filters) as Future<Object?>);

  @override
  Future<void> upsert(String table, List<CRow> rows, {required String onConflict}) async =>
      await db.from(table).upsert(rows, onConflict: onConflict);

  @override
  Future<DbResult<Object?>> invoke(String fn, Object? body) => db.invoke(fn, body: body);

  @override
  Future<UploadResult> upload(String bucket, String path, Uint8List bytes, String contentType) =>
      db.upload(bucket, path, bytes, contentType: contentType);

  @override
  String publicUrl(String bucket, String path) => db.publicUrl(bucket, path);

  @override
  Future<Map<String, CRow>> profileCards(List<String> userIds) => cards(userIds);

  @override
  void Function() subscribe({required String channelPrefix, required String table, String event = '*', String? filter,
      required void Function(CommunityChange change) onChange}) {
    final channel = _client
        .channel('$channelPrefix:${DateTime.now().microsecondsSinceEpoch}')
        .onPostgresChanges(
          event: postgresEvent(event),
          schema: 'public',
          table: table,
          filter: parsePostgresFilter(filter),
          callback: (payload) => onChange(CommunityChange(
            eventType: payload.eventType.name.toUpperCase(),
            newRecord: Map<String, dynamic>.from(payload.newRecord),
            oldRecord: Map<String, dynamic>.from(payload.oldRecord),
          )),
        )
        .subscribe();
    return () => unawaited(_client.removeChannel(channel).then((_) {}, onError: (Object _) {}));
  }
}

/// The community data access. Tests override it with a fake.
final communityBackendProvider = Provider<CommunityBackend>((ref) => SupabaseCommunityBackend(
      ref.watch(dbProvider),
      (ids) => getPublicProfileCards(ref.read(chatBackendProvider), ids),
    ));

/// `getPublicProfileCard(userId)` (one card or null).
Future<CRow?> getPublicProfileCard(CommunityBackend backend, String userId) async {
  if (userId.isEmpty) return null;
  final cards = await backend.profileCards([userId]);
  return cards[userId];
}
