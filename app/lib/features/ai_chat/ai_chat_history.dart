// Ported from: src/hooks/useAIChatHistory.ts
//
// `ai_chat_messages` of the user and chat type ('woman' | 'partner'): the last 100 rows in order, inserts and
// a full clear. Errors are swallowed (logged in React); the chat keeps working without history.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/data/db.dart';

typedef AiHistoryRow = Map<String, dynamic>;

abstract interface class AiChatHistoryStore {
  /// `select('*').eq(user_id).eq(chat_type).order(created_at asc).limit(100)`.
  Future<List<AiHistoryRow>> fetch(String userId, String chatType);

  /// Insert (`image_url` only when set); returns the row.
  Future<AiHistoryRow> insert(Map<String, Object?> row);

  Future<void> clear(String userId, String chatType);
}

class SupabaseAiChatHistoryStore implements AiChatHistoryStore {
  SupabaseAiChatHistoryStore(this.db);
  final Db db;

  @override
  Future<List<AiHistoryRow>> fetch(String userId, String chatType) async => List<AiHistoryRow>.from(
        await db.from('ai_chat_messages').select().eq('user_id', userId).eq('chat_type', chatType).order('created_at', ascending: true).limit(100),
      );

  @override
  Future<AiHistoryRow> insert(Map<String, Object?> row) async => Map<String, dynamic>.from(await db.from('ai_chat_messages').insert(row).select().single());

  @override
  Future<void> clear(String userId, String chatType) async => db.from('ai_chat_messages').delete().eq('user_id', userId).eq('chat_type', chatType);
}

final aiChatHistoryStoreProvider = Provider<AiChatHistoryStore>((ref) => SupabaseAiChatHistoryStore(ref.watch(dbProvider)));

/// `useAIChatHistory(chatType)` for one user.
class AiChatHistory {
  AiChatHistory(this.store, {required this.userId, required this.chatType});
  final AiChatHistoryStore store;
  final String? userId;
  final String chatType;

  List<AiHistoryRow> messages = [];
  bool loading = true;

  Future<void> load() async {
    final uid = userId;
    if (uid == null) {
      loading = false;
      return;
    }
    try {
      messages = await store.fetch(uid, chatType);
    } catch (_) {
      // Error fetching AI chat history
    } finally {
      loading = false;
    }
  }

  Future<AiHistoryRow?> addMessage(String role, String content, [String? imageUrl]) async {
    final uid = userId;
    if (uid == null || (content.trim().isEmpty && (imageUrl == null || imageUrl.isEmpty))) return null;
    try {
      final row = await store.insert({
        'user_id': uid,
        'role': role,
        'content': content,
        'chat_type': chatType,
        if (imageUrl != null && imageUrl.isNotEmpty) 'image_url': imageUrl,
      });
      messages = [...messages, row];
      return row;
    } catch (_) {
      return null;
    }
  }

  Future<void> clearHistory() async {
    final uid = userId;
    if (uid == null) return;
    try {
      await store.clear(uid, chatType);
      messages = [];
    } catch (_) {}
  }
}
