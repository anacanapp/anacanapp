// Ported from: src/hooks/useNotifications.ts
//
// The in-app inbox: last 50 `notifications` rows of the user (`['notifications', uid]`), refetched on every
// realtime change of the user's rows; mark read / mark all read / delete refetch afterwards.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';

class AppNotification {
  const AppNotification(this.row);
  final Map<String, dynamic> row;
  String get id => row.str('id') ?? '';
  String get title => row.str('title') ?? '';
  String get message => row.str('message') ?? '';
  String get type => row.str('notification_type') ?? '';
  bool get isRead => row['is_read'] == true;
  String get createdAt => row.str('created_at') ?? '';
  Map<String, dynamic> get actionData => row['action_data'] is Map ? Map<String, dynamic>.from(row['action_data'] as Map) : const <String, dynamic>{};
  String? get actionType => row.str('action_type');
  Map<String, dynamic> toRow() => row;
}

abstract interface class NotificationsRepository {
  Future<List<Map<String, dynamic>>> list(String userId);
  Future<void> markRead(String userId, String id);
  Future<void> markAllRead(String userId);
  Future<void> delete(String userId, String id);
  Future<Map<String, dynamic>?> add(String userId, Map<String, dynamic> notification);

  /// Realtime `postgres_changes` on the user's rows; returns a cancel function.
  void Function() subscribe(Ref ref, String userId, void Function() onChange);
}

class SupabaseNotificationsRepository implements NotificationsRepository {
  SupabaseNotificationsRepository(this._db);
  final Db _db;
  @override
  Future<List<Map<String, dynamic>>> list(String userId) async =>
      asRows(await _db.from('notifications').select().eq('user_id', userId).order('created_at', ascending: false).limit(50));
  @override
  Future<void> markRead(String userId, String id) async => _db.from('notifications').update({'is_read': true}).eq('id', id).eq('user_id', userId);
  @override
  Future<void> markAllRead(String userId) async => _db.from('notifications').update({'is_read': true}).eq('user_id', userId).eq('is_read', false);
  @override
  Future<void> delete(String userId, String id) async => _db.from('notifications').delete().eq('id', id).eq('user_id', userId);
  @override
  Future<Map<String, dynamic>?> add(String userId, Map<String, dynamic> notification) async =>
      asRow(await _db.from('notifications').insert({'user_id': userId, ...notification}).select().single());
  @override
  void Function() subscribe(Ref ref, String userId, void Function() onChange) {
    subscribePostgresChanges(ref, _db.client, channelPrefix: 'notifications_changes', table: 'notifications', filter: 'user_id=eq.$userId', onChange: (_) => onChange());
    return () {};
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>((ref) => SupabaseNotificationsRepository(ref.watch(dbProvider)));

final notificationsQuery = queryProvider<List<AppNotification>>((ref) {
  final uid = ref.watch(authUserProvider)?.id;
  final repo = ref.watch(notificationsRepositoryProvider);
  if (uid != null) {
    repo.subscribe(ref, uid, () => unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: ['notifications', uid])));
  }
  return QueryOptions<List<AppNotification>>(
    queryKey: ['notifications', uid],
    enabled: uid != null,
    meta: const {'persist': false},
    retry: noRetry,
    queryFn: (_) async => (await repo.list(uid!)).map(AppNotification.new).toList(),
  );
});

/// `useNotifications()` actions (errors are logged and swallowed, like the hook).
class NotificationsActions {
  NotificationsActions(this._ref);
  final Ref _ref;
  String? get _uid => _ref.read(authUserProvider)?.id;
  NotificationsRepository get _repo => _ref.read(notificationsRepositoryProvider);
  Future<void> _refetch() => _ref.read(queryClientProvider).invalidateQueries(queryKey: ['notifications', _uid]);

  Future<void> markAsRead(String id) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.markRead(uid, id);
      await _refetch();
    } catch (_) {}
  }

  Future<void> markAllAsRead() async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.markAllRead(uid);
      await _refetch();
    } catch (_) {}
  }

  Future<void> deleteNotification(String id) async {
    final uid = _uid;
    if (uid == null) return;
    try {
      await _repo.delete(uid, id);
      await _refetch();
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> addNotification({required String title, required String message, String? type}) async {
    final uid = _uid;
    if (uid == null) return null;
    try {
      final row = await _repo.add(uid, {'title': title, 'message': message, 'notification_type': ?type});
      await _refetch();
      return row;
    } catch (_) {
      return null;
    }
  }
}

final notificationsActionsProvider = Provider<NotificationsActions>((ref) => NotificationsActions(ref));
