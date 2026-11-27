// Ported from: the supabase-js calls of src/lib/chat.ts, src/lib/chat-media.ts, src/hooks/{useChatMessages.ts,
//              usePartnerMessages.ts,useDirectMessages.ts,usePartnerConversation.ts}, src/components/MessagesScreen.tsx,
//              src/components/MotherChatScreen.tsx, src/lib/public-profile-cards.ts (getPublicProfileCards,
//              searchPublicProfileCards)
//
// Every backend access of the chat feature goes through [ChatBackend], so tests swap in an in-memory fake.
import 'dart:async';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgrestException, SupabaseClient;

import '../../../core/data/data.dart';
import '../../../state/shell_bindings.dart' show backendUrlProvider;

typedef ChatRow = Map<String, dynamic>;

/// A thrown chat contract error (`throw new Error('CHAT_INVALID_MEDIA')`).
class ChatException implements Exception {
  const ChatException(this.message, {this.code});
  final String message;
  final String? code;
  @override
  String toString() => message;
}

/// A realtime `postgres_changes` payload (`payload.new` / `payload.old`).
class ChatChange {
  const ChatChange({this.newRecord = const {}, this.oldRecord = const {}});
  final ChatRow newRecord;
  final ChatRow oldRecord;
}

abstract interface class ChatBackend {
  /// `supabase.rpc(fn, params)`; throws on `error`.
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]);

  /// `from(table).select(columns).in(column, values)`; throws on `error`.
  Future<List<ChatRow>> selectIn(String table, String column, List<String> values, {String columns = '*'});

  /// `from(table).select(columns).eq(column, value).maybeSingle()`; throws on `error`.
  Future<ChatRow?> maybeSingle(String table, String columns, String column, String value);

  /// `from('partner_messages').select('*').or(sender|receiver = user).order(created_at desc).limit(100)`.
  Future<List<ChatRow>> partnerMessages(String userId);

  /// `from('partner_messages').insert(values).select().single()`.
  Future<ChatRow> insertPartnerMessage(ChatRow values);

  /// `from('partner_messages').update({is_read: true}).eq('id', id).eq('receiver_id', receiverId)`.
  Future<void> markPartnerMessageRead(String id, String receiverId);

  /// `from('direct_messages').select('*').or(sender|receiver = user).order(created_at desc).limit(500)`.
  Future<List<ChatRow>> directInbox(String userId);

  /// The thread between two users, oldest first, limit 200.
  Future<List<ChatRow>> directThread(String userId, String otherUserId);

  /// `from('direct_messages').update({is_read: true}).in('id', ids)`.
  Future<void> markDirectRead(List<String> ids);

  /// `from('direct_messages').insert(values).select().single()`.
  Future<ChatRow> insertDirectMessage(ChatRow values);

  /// `from('public_profile_cards').select(columns).ilike('name', '%term%').limit(limit)`.
  Future<List<ChatRow>> searchProfileCards(String term, int limit);

  /// `storage.from(bucket).upload(path, bytes, { contentType, upsert: false })`.
  Future<UploadResult> upload(String bucket, String path, Uint8List bytes, String contentType);

  /// `storage.from(bucket).remove(paths)`; throws on `error`.
  Future<void> remove(String bucket, List<String> paths);

  /// `storage.from(bucket).createSignedUrl(path, ttl)`; throws on `error`.
  Future<String> signedUrl(String bucket, String path, int ttlSeconds);

  /// `storage.from(bucket).getPublicUrl(path)`.
  String publicUrl(String bucket, String path);

  /// `channel(prefix:uuid).on('postgres_changes', {event, table, filter}, cb).subscribe()`, removed with [ref].
  void subscribe(Ref ref, {required String channelPrefix, required String table, String event = '*', String? filter,
      required void Function(ChatChange change) onChange});
}

class SupabaseChatBackend implements ChatBackend {
  SupabaseChatBackend(this.db);
  final Db db;
  SupabaseClient get _client => db.client;

  @override
  Future<Object?> rpc(String fn, [Map<String, dynamic>? params]) => db.rpc<Object?>(fn, params: params);

  @override
  Future<List<ChatRow>> selectIn(String table, String column, List<String> values, {String columns = '*'}) async =>
      asRows(await db.from(table).select(columns).inFilter(column, values));

  @override
  Future<ChatRow?> maybeSingle(String table, String columns, String column, String value) async =>
      asRow(await db.from(table).select(columns).eq(column, value).maybeSingle());

  @override
  Future<List<ChatRow>> partnerMessages(String userId) async => asRows(await db
      .from('partner_messages')
      .select()
      .or('sender_id.eq.$userId,receiver_id.eq.$userId')
      .order('created_at', ascending: false)
      .limit(100));

  @override
  Future<ChatRow> insertPartnerMessage(ChatRow values) async =>
      asRow(await db.from('partner_messages').insert(values).select().single())!;

  @override
  Future<void> markPartnerMessageRead(String id, String receiverId) async =>
      db.from('partner_messages').update({'is_read': true}).eq('id', id).eq('receiver_id', receiverId);

  @override
  Future<List<ChatRow>> directInbox(String userId) async => asRows(await db
      .from('direct_messages')
      .select()
      .or('sender_id.eq.$userId,receiver_id.eq.$userId')
      .order('created_at', ascending: false)
      .limit(500));

  @override
  Future<List<ChatRow>> directThread(String userId, String otherUserId) async => asRows(await db
      .from('direct_messages')
      .select()
      .or('and(sender_id.eq.$userId,receiver_id.eq.$otherUserId),and(sender_id.eq.$otherUserId,receiver_id.eq.$userId)')
      .order('created_at', ascending: true)
      .limit(200));

  @override
  Future<void> markDirectRead(List<String> ids) async => db.from('direct_messages').update({'is_read': true}).inFilter('id', ids);

  @override
  Future<ChatRow> insertDirectMessage(ChatRow values) async =>
      asRow(await db.from('direct_messages').insert(values).select().single())!;

  @override
  Future<List<ChatRow>> searchProfileCards(String term, int limit) async =>
      asRows(await db.from('public_profile_cards').select('user_id, name, avatar_url').ilike('name', '%$term%').limit(limit));

  @override
  Future<UploadResult> upload(String bucket, String path, Uint8List bytes, String contentType) =>
      db.upload(bucket, path, bytes, contentType: contentType);

  @override
  Future<void> remove(String bucket, List<String> paths) async => _client.storage.from(bucket).remove(paths);

  @override
  Future<String> signedUrl(String bucket, String path, int ttlSeconds) => db.signedUrl(bucket, path, ttlSeconds);

  @override
  String publicUrl(String bucket, String path) => db.publicUrl(bucket, path);

  @override
  void subscribe(Ref ref, {required String channelPrefix, required String table, String event = '*', String? filter,
      required void Function(ChatChange change) onChange}) {
    subscribePostgresChanges(ref, _client,
        channelPrefix: channelPrefix,
        table: table,
        event: event,
        filter: filter,
        onChange: (payload) => onChange(ChatChange(
            newRecord: Map<String, dynamic>.from(payload.newRecord), oldRecord: Map<String, dynamic>.from(payload.oldRecord))));
  }
}

/// The chat data access. Tests override it with a fake.
final chatBackendProvider = Provider<ChatBackend>((ref) => SupabaseChatBackend(ref.watch(dbProvider)));

/// `getBackendConfig().url` (part of every chat query key; '' before the backend opened).
final chatBackendUrlProvider = Provider<String>((ref) {
  try {
    return ref.watch(backendUrlProvider);
  } catch (_) {
    return '';
  }
});

// ── public-profile-cards.ts ──

const String _coreFields = 'user_id, name, avatar_url, badge_type, life_stage, is_premium, created_at';
const String _selectFields = '$_coreFields, is_verified, verified_until';

String? _code(Object error) => error is PostgrestException ? error.code : error is ChatException ? error.code : null;

bool _isMissingVerificationColumn(Object error) {
  if (error is! PostgrestException) return false;
  return (error.code == '42703' || error.code == 'PGRST204') &&
      RegExp(r'\b(is_verified|verified_until)\b', caseSensitive: false).hasMatch('${error.message} ${error.details ?? ''}');
}

Future<List<ChatRow>?> _readEffectiveCards(ChatBackend backend, List<String> userIds) async {
  Object? data;
  try {
    data = await backend.rpc('get_public_community_profiles_v2', {'p_user_ids': userIds});
  } catch (error) {
    if (_code(error) == 'PGRST202') return null;
    rethrow;
  }
  if (data is! List) throw const ChatException('COMMUNITY_PROFILE_RESPONSE_INVALID');
  return asRows(data);
}

/// `getPublicProfileCards(userIds)` → `{user_id: card}`.
Future<Map<String, ChatRow>> getPublicProfileCards(ChatBackend backend, List<String> userIds) async {
  final unique = <String>{...userIds.where((id) => id.isNotEmpty)}.toList();
  if (unique.isEmpty) return {};
  if (unique.length > 100) {
    final result = <String, ChatRow>{};
    for (var offset = 0; offset < unique.length; offset += 100) {
      result.addAll(await getPublicProfileCards(backend, unique.sublist(offset, (offset + 100).clamp(0, unique.length))));
    }
    return result;
  }
  final effective = await _readEffectiveCards(backend, unique);
  if (effective != null) return {for (final card in effective) '${card['user_id']}': card};
  List<ChatRow> rows;
  try {
    rows = await backend.selectIn('public_profile_cards', 'user_id', unique, columns: _selectFields);
  } catch (error) {
    if (!_isMissingVerificationColumn(error)) rethrow;
    rows = await backend.selectIn('public_profile_cards', 'user_id', unique, columns: _coreFields);
  }
  return {for (final row in rows) '${row['user_id']}': row};
}

/// `searchPublicProfileCards(term, limit)`: errors → empty.
Future<List<ChatRow>> searchPublicProfileCards(ChatBackend backend, String term, [int limit = 5]) async {
  final t = term.trim();
  if (t.isEmpty) return const [];
  try {
    return await backend.searchProfileCards(t, limit);
  } catch (_) {
    return const [];
  }
}
