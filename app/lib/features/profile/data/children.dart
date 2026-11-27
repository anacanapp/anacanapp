// Ported from: src/hooks/useChildren.ts
//
// `useChildren()` on the query cache: query key `['user-children', userId]` (shared with any other port of the
// hook), 5 min stale, 30 min gc, no retry, seeded from the offline cache `children_v1`, first-child backfill from
// the profile's baby fields. Mutations refetch the query. NOTE for wiring: if the home feature ports useChildren
// into core, this file should re-export that one (same key and shapes).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart';
import '../../../core/i18n/i18n.dart';
import '../../../core/offline/offline.dart';
import '../../../domain/pregnancy/pregnancy_utils.dart';
import '../../../state/state.dart' show childStoreProvider;

const String childrenCacheKey = 'children_v1';

/// One `user_children` row (snake_case keys kept).
class Child {
  const Child(this.row);
  final Map<String, dynamic> row;
  String get id => row.str('id') ?? '';
  String get name => row.str('name') ?? '';
  String get birthDate => row.str('birth_date') ?? '';
  String? get dueDate => row.str('due_date');
  String get gender => row.str('gender') ?? 'unknown';
  String get avatarEmoji => row.str('avatar_emoji') ?? '👶';
  Map<String, dynamic> toRow() => row;
}

/// Data access of the hook (overridable in tests).
abstract interface class ChildrenRepository {
  Future<List<Map<String, dynamic>>> loadActive(String userId);
  Future<Map<String, dynamic>?> profileBabyFields(String userId);
  Future<bool> insert(Map<String, dynamic> row);
  Future<Map<String, dynamic>?> insertReturning(Map<String, dynamic> row);
  Future<bool> update(String userId, String childId, Map<String, dynamic> updates);
}

class SupabaseChildrenRepository implements ChildrenRepository {
  SupabaseChildrenRepository(this._db);
  final Db _db;

  @override
  Future<List<Map<String, dynamic>>> loadActive(String userId) async =>
      asRows(await _db.from('user_children').select().eq('user_id', userId).eq('is_active', true).order('sort_order'));

  @override
  Future<Map<String, dynamic>?> profileBabyFields(String userId) async =>
      asRow(await _db.from('profiles').select('baby_name, baby_birth_date, baby_gender, due_date').eq('user_id', userId).maybeSingle());

  @override
  Future<bool> insert(Map<String, dynamic> row) async {
    final res = await _db.query(() => _db.from('user_children').insert(row));
    return res.ok;
  }

  @override
  Future<Map<String, dynamic>?> insertReturning(Map<String, dynamic> row) async {
    final res = await _db.query(() => _db.from('user_children').insert(row).select().maybeSingle());
    return res.ok ? asRow(res.data) : null;
  }

  @override
  Future<bool> update(String userId, String childId, Map<String, dynamic> updates) async {
    final res = await _db.query(() => _db.from('user_children').update(updates).eq('id', childId).eq('user_id', userId));
    return res.ok;
  }
}

final childrenRepositoryProvider = Provider<ChildrenRepository>((ref) => SupabaseChildrenRepository(ref.watch(dbProvider)));

final Set<String> _seedAttemptedUsers = <String>{};

/// `useChildren().children` query.
final childrenQuery = queryProvider<List<Child>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final cache = ref.watch(offlineCacheProvider);
  final cached = userId == null ? null : cache.readCache<List<dynamic>>(childrenCacheKey, userId);
  return QueryOptions<List<Child>>(
    queryKey: ['user-children', userId],
    enabled: userId != null,
    staleTime: const Duration(minutes: 5),
    gcTime: const Duration(minutes: 30),
    retry: noRetry,
    initialData: cached != null && cached.isNotEmpty ? asRows(cached).map(Child.new).toList() : null,
    initialDataUpdatedAt: 0,
    codec: QueryCodecs.models<Child>((c) => c.toRow(), Child.new),
    queryFn: (_) async {
      final uid = userId!;
      final repo = ref.read(childrenRepositoryProvider);
      var rows = await repo.loadActive(uid);
      if (rows.isEmpty && !_seedAttemptedUsers.contains(uid)) {
        final profile = await repo.profileBabyFields(uid);
        if (profile != null && (profile.str('baby_name') ?? '').isNotEmpty && (profile.str('baby_birth_date') ?? '').isNotEmpty) {
          _seedAttemptedUsers.add(uid);
          final g = profile.str('baby_gender');
          final gender = g == 'girl' || g == 'boy' ? g! : 'boy';
          final ok = await repo.insert({
            'user_id': uid,
            'name': profile.str('baby_name'),
            'birth_date': profile.str('baby_birth_date'),
            'due_date': profile.str('due_date'),
            'gender': gender,
            'avatar_emoji': gender == 'girl' ? '👧' : '👦',
            'is_active': true,
            'sort_order': 0,
          });
          if (ok) {
            final reread = await repo.loadActive(uid);
            if (reread.isNotEmpty) rows = reread;
          }
        }
      }
      cache.writeCache(childrenCacheKey, uid, rows);
      return rows.map(Child.new).toList();
    },
  );
});

/// `getChildAge(child).displayText` (chronological, like the profile list).
String childAgeText(Child child) => getRealCalendarAge(child.birthDate, tr: tr).displayText;

/// `useChildren()` actions + derived values.
class ChildrenController {
  ChildrenController(this._ref);
  final Ref _ref;

  List<Child> get children => _ref.read(childrenQuery).data ?? const <Child>[];

  Child? get selectedChild {
    final id = _ref.read(childStoreProvider).selectedChildId;
    final list = children;
    return list.where((c) => c.id == id).firstOrNull ?? list.firstOrNull;
  }

  Future<void> _refetch() async {
    final userId = _ref.read(authUserProvider)?.id;
    await _ref.read(queryClientProvider).invalidateQueries(queryKey: ['user-children', userId]);
  }

  Future<Child?> addChild({required String name, required String birthDate, String? gender, String? avatarEmoji, String? dueDate}) async {
    final user = _ref.read(authUserProvider);
    if (user == null) return null;
    final g = gender == 'girl' || gender == 'boy' ? gender! : 'boy';
    try {
      final row = await _ref.read(childrenRepositoryProvider).insertReturning({
        'user_id': user.id,
        'name': name,
        'birth_date': birthDate,
        'due_date': dueDate,
        'gender': g,
        'avatar_emoji': avatarEmoji ?? (g == 'girl' ? '👧' : '👦'),
        'is_active': true,
        'sort_order': children.length,
      });
      if (row != null) {
        await _refetch();
        return Child(row);
      }
    } catch (_) {}
    return null;
  }

  Future<bool> updateChild(String childId, Map<String, dynamic> updates) async {
    final user = _ref.read(authUserProvider);
    if (user == null) return false;
    try {
      final ok = await _ref
          .read(childrenRepositoryProvider)
          .update(user.id, childId, {...updates, 'updated_at': DateTime.now().toUtc().toIso8601String()});
      if (ok) {
        await _refetch();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<bool> deleteChild(String childId) async {
    final user = _ref.read(authUserProvider);
    if (user == null) return false;
    try {
      final ok = await _ref.read(childrenRepositoryProvider).update(user.id, childId, {'is_active': false});
      if (ok) {
        if (selectedChild?.id == childId) _ref.read(childStoreProvider.notifier).setSelectedChildId(null);
        await _refetch();
        return true;
      }
    } catch (_) {}
    return false;
  }
}

final childrenControllerProvider = Provider<ChildrenController>((ref) => ChildrenController(ref));
