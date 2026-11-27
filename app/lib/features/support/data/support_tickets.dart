// Ported from: src/hooks/useSupportTickets.ts, src/hooks/useSupportTicketReplies.ts, src/hooks/useDynamicTools.ts
//              (useFaqs, useSupportCategories)
//
// `['support-tickets', uid]`, `['support-ticket-replies', ticketId]` (realtime INSERTs appended to the cache like
// `setReplies(prev => [...prev, row])`), `['faqs', lang]`, `['support-categories', lang]`.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show PostgresChangePayload;

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../state/state.dart';

abstract interface class SupportRepository {
  Future<List<Map<String, dynamic>>> tickets(String userId);
  Future<Map<String, dynamic>> createTicket(Map<String, dynamic> row);
  Future<List<Map<String, dynamic>>> replies(String ticketId);
  Future<Map<String, dynamic>> addReply(Map<String, dynamic> row);
  Future<List<Map<String, dynamic>>> faqs();
  Future<List<Map<String, dynamic>>> categories();

  /// Realtime INSERTs on `support_ticket_replies` for [ticketId].
  void subscribeReplies(Ref ref, String ticketId, void Function(Map<String, dynamic> row) onInsert);
}

class SupabaseSupportRepository implements SupportRepository {
  SupabaseSupportRepository(this._db);
  final Db _db;
  @override
  Future<List<Map<String, dynamic>>> tickets(String userId) async =>
      asRows(await _db.from('support_tickets').select().eq('user_id', userId).order('created_at', ascending: false));
  @override
  Future<Map<String, dynamic>> createTicket(Map<String, dynamic> row) async => asRow(await _db.from('support_tickets').insert(row).select().single())!;
  @override
  Future<List<Map<String, dynamic>>> replies(String ticketId) async =>
      asRows(await _db.from('support_ticket_replies').select().eq('ticket_id', ticketId).order('created_at', ascending: true));
  @override
  Future<Map<String, dynamic>> addReply(Map<String, dynamic> row) async => asRow(await _db.from('support_ticket_replies').insert(row).select().single())!;
  @override
  Future<List<Map<String, dynamic>>> faqs() async => asRows(await _db.from('faqs').select().eq('is_active', true).order('sort_order'));
  @override
  Future<List<Map<String, dynamic>>> categories() async => asRows(await _db.from('support_categories').select().eq('is_active', true).order('sort_order'));
  @override
  void subscribeReplies(Ref ref, String ticketId, void Function(Map<String, dynamic> row) onInsert) {
    subscribePostgresChanges(ref, _db.client,
        channelPrefix: 'ticket-replies-$ticketId',
        table: 'support_ticket_replies',
        event: 'INSERT',
        filter: 'ticket_id=eq.$ticketId',
        onChange: (PostgresChangePayload p) => onInsert(Map<String, dynamic>.from(p.newRecord)));
  }
}

final supportRepositoryProvider = Provider<SupportRepository>((ref) => SupabaseSupportRepository(ref.watch(dbProvider)));

final supportTicketsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['support-tickets', uid],
    enabled: uid != null,
    retry: noRetry,
    meta: const {'persist': false},
    queryFn: (_) => ref.read(supportRepositoryProvider).tickets(uid!),
  );
});

final ticketRepliesQuery = queryProviderFamily<List<Map<String, dynamic>>, String>((ref, ticketId) {
  final uid = ref.watch(authUserProvider)?.id;
  final repo = ref.watch(supportRepositoryProvider);
  final qc = ref.read(queryClientProvider);
  repo.subscribeReplies(ref, ticketId, (row) {
    qc.setQueryData<List<Map<String, dynamic>>>(['support-ticket-replies', ticketId], (old) => [...?old, row]);
  });
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['support-ticket-replies', ticketId],
    enabled: uid != null,
    retry: noRetry,
    meta: const {'persist': false},
    queryFn: (_) => repo.replies(ticketId),
  );
});

final faqsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final lang = ref.watch(userStoreProvider.select((s) => s.language));
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['faqs', lang],
    queryFn: (_) async => mapRowsTranslation(await ref.read(supportRepositoryProvider).faqs(), lang, const ['question', 'answer']),
  );
});

final supportCategoriesQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final lang = ref.watch(userStoreProvider.select((s) => s.language));
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['support-categories', lang],
    queryFn: (_) async => mapRowsTranslation(await ref.read(supportRepositoryProvider).categories(), lang, const ['name']),
  );
});

class SupportActions {
  SupportActions(this._ref);
  final Ref _ref;

  /// `createTicket(ticket)` → error or null.
  Future<Object?> createTicket({required String subject, required String message, String category = 'general', String? priority}) async {
    final uid = _ref.read(authUserProvider)?.id;
    if (uid == null) return 'Not authenticated';
    try {
      await _ref.read(supportRepositoryProvider).createTicket({'subject': subject, 'message': message, 'category': category, 'priority': ?priority, 'user_id': uid, 'status': 'open'});
      await _ref.read(queryClientProvider).invalidateQueries(queryKey: ['support-tickets', uid]);
      return null;
    } catch (e) {
      return e;
    }
  }

  /// `addReply(message)` → error or null.
  Future<Object?> addReply(String ticketId, String message, {bool isAdmin = false}) async {
    final uid = _ref.read(authUserProvider)?.id;
    if (uid == null || message.trim().isEmpty) return 'Invalid request';
    try {
      await _ref.read(supportRepositoryProvider).addReply({'ticket_id': ticketId, 'user_id': uid, 'is_admin': isAdmin, 'message': message.trim()});
      await _ref.read(queryClientProvider).invalidateQueries(queryKey: ['support-ticket-replies', ticketId]);
      return null;
    } catch (e) {
      return e;
    }
  }

  Future<void> refetchTickets() => _ref.read(queryClientProvider).invalidateQueries(queryKey: ['support-tickets', _ref.read(authUserProvider)?.id]);
}

final supportActionsProvider = Provider<SupportActions>((ref) => SupportActions(ref));
