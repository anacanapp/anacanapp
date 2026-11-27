// Ported from: src/hooks/useChildren.ts
//
// React → Dart:
//   useQuery(['user-children', userId], staleTime 5 min, gcTime 30 min, retry false, initialData from the offline
//   cache with initialDataUpdatedAt 0)          → [childrenQuery]
//   const { children, selectedChild, … }       → ref.watch(childrenProvider)   ([ChildrenView])
//   addChild / updateChild / deleteChild / setSelectedChild / refetch → ref.read(childrenActionsProvider)
//   window 'anacan:children-updated' event      → [notifyChildrenUpdated]
//   getChildAge(child)                          → getChildAge (models/child.dart)
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/offline/offline_providers.dart';
import '../../../domain/js_compat.dart';
import '../../../state/child_store.dart';
import '../data/baby_repository.dart';
import '../models/child.dart';

export '../models/child.dart';

const String childrenCacheKey = 'children_v1';

/// Users whose first child was already seeded from the profile (module-level guard, as in React).
final Set<String> seedAttemptedUsers = <String>{};

@visibleForTesting
void resetChildrenSeedGuard() => seedAttemptedUsers.clear();

final _childrenCodec = QueryCodecs.models<Child>((c) => c.toRow(), Child.fromRow);

/// `readCachedChildren(userId)`.
List<Child> readCachedChildren(Ref ref, String userId) {
  final cached = ref.read(offlineCacheProvider).readCache<List<dynamic>>(childrenCacheKey, userId);
  if (cached == null) return const [];
  try {
    return [for (final r in cached) Child.fromRow(Map<String, dynamic>.from(r as Map))];
  } catch (_) {
    return const [];
  }
}

/// `useQuery({ queryKey: ['user-children', userId], … })`.
final childrenQuery = queryProvider<List<Child>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final repo = ref.watch(babyRepositoryProvider);
  final cached = userId == null ? const <Child>[] : readCachedChildren(ref, userId);
  return QueryOptions<List<Child>>(
    queryKey: ['user-children', userId],
    enabled: userId != null,
    staleTime: const Duration(minutes: 5),
    gcTime: const Duration(minutes: 30),
    retry: noRetry,
    initialData: cached.isNotEmpty ? cached : null,
    initialDataUpdatedAt: 0,
    codec: _childrenCodec,
    queryFn: (_) async {
      final uid = userId!;
      var rows = await repo.loadActiveChildren(uid);
      if (rows.isEmpty && !seedAttemptedUsers.contains(uid)) {
        Map<String, dynamic>? profile;
        Object? profileError;
        try {
          profile = await repo.loadProfileBabyFields(uid);
        } catch (e) {
          profileError = e;
        }
        if (profileError == null && _truthy(profile?['baby_name']) && _truthy(profile?['baby_birth_date'])) {
          seedAttemptedUsers.add(uid);
          final g = profile!['baby_gender'];
          final gender = g == 'girl' || g == 'boy' ? g as String : 'boy';
          try {
            await repo.insertChildRow({
              'user_id': uid,
              'name': profile['baby_name'],
              'birth_date': profile['baby_birth_date'],
              'due_date': profile['due_date'],
              'gender': gender,
              'avatar_emoji': gender == 'girl' ? '👧' : '👦',
              'is_active': true,
              'sort_order': 0,
            });
            final reread = await repo.loadActiveChildren(uid);
            if (reread.isNotEmpty) rows = reread;
          } catch (e) {
            debugPrint('Error seeding first child from profile: $e');
          }
        } else if (profileError != null) {
          debugPrint('Error fetching profile for child seeding: $profileError');
        }
      }
      final children = [for (final r in rows) Child.fromRow(r)];
      ref.read(offlineCacheProvider).writeCache(childrenCacheKey, uid, [for (final c in children) c.toRow()]);
      return children;
    },
  );
}, name: 'childrenQuery');

bool _truthy(Object? v) => v != null && v != '' && v != false;

/// What `useChildren()` returns (state part).
class ChildrenView {
  const ChildrenView({
    required this.children,
    required this.selectedChild,
    required this.loading,
    required this.loadError,
  });

  final List<Child> children;
  final Child? selectedChild;

  /// First load with nothing cached yet.
  final bool loading;

  /// Last fetch failed (cached children, if any, are still shown).
  final bool loadError;

  bool get hasChildren => children.isNotEmpty;
  bool get hasMultipleChildren => children.length > 1;
}

/// `useChildren()` state: children + derived selected child (auto-selects the first one).
final childrenProvider = Provider.autoDispose<ChildrenView>((ref) {
  final q = ref.watch(childrenQuery);
  final selectedId = ref.watch(childStoreProvider.select((s) => s.selectedChildId));
  final children = q.data ?? const <Child>[];
  Child? selected;
  for (final c in children) {
    if (c.id == selectedId) selected = c;
  }
  selected ??= children.firstOrNull;
  // Auto-select the first child when none (or an unknown one) is selected (useEffect).
  if (children.isNotEmpty && !children.any((c) => c.id == selectedId)) {
    final first = children.first.id;
    final store = ref.read(childStoreProvider.notifier);
    Future.microtask(() {
      if (!ref.mounted) return;
      if (!children.any((c) => c.id == ref.read(childStoreProvider).selectedChildId)) store.setSelectedChildId(first);
    });
  }
  return ChildrenView(children: children, selectedChild: selected, loading: q.isLoading, loadError: q.isError);
}, name: 'childrenProvider');

/// The selected child from the cached list (no subscription): for actions that run outside a widget.
Child? selectedChildNow(Ref ref) {
  final userId = ref.read(authUserProvider)?.id;
  final children = ref.read(queryClientProvider).getQueryData<List<Child>>(['user-children', userId]) ?? const <Child>[];
  final id = ref.read(childStoreProvider).selectedChildId;
  for (final c in children) {
    if (c.id == id) return c;
  }
  return children.firstOrNull;
}

/// Selected child id (`selectedChild?.id`), cheap to watch.
final selectedChildIdProvider = Provider.autoDispose<String?>((ref) => ref.watch(childrenProvider).selectedChild?.id);

/// `window.dispatchEvent(new Event('anacan:children-updated'))` → refetch the children list.
Future<void> notifyChildrenUpdated(QueryClient client, String? userId) =>
    client.invalidateQueries(queryKey: ['user-children', userId]);

/// `addChild` / `updateChild` / `deleteChild` / `setSelectedChild` / `refetch`.
class ChildrenActions {
  ChildrenActions(this._ref);
  final Ref _ref;

  BabyRepository get _repo => _ref.read(babyRepositoryProvider);
  String? get _userId => _ref.read(authUserProvider)?.id;

  Future<void> refetch() async {
    final userId = _userId;
    await _ref.read(queryClientProvider).refetchQueries(QueryFilters(queryKey: ['user-children', userId]));
  }

  void setSelectedChild(Child? child) => _ref.read(childStoreProvider.notifier).setSelectedChildId(child?.id);

  Future<Child?> addChild({required String name, required String birthDate, String? gender, String? avatarEmoji, String? dueDate}) async {
    final userId = _userId;
    if (userId == null) return null;
    try {
      final g = gender == 'girl' || gender == 'boy' ? gender! : 'boy';
      final count = _ref.read(queryClientProvider).getQueryData<List<Child>>(['user-children', userId])?.length ?? 0;
      final row = await _repo.insertChild({
        'user_id': userId,
        'name': name,
        'birth_date': birthDate,
        'due_date': dueDate,
        'gender': g,
        'avatar_emoji': avatarEmoji ?? (g == 'girl' ? '👧' : '👦'),
        'is_active': true,
        'sort_order': count,
      });
      if (row != null) {
        await refetch();
        return Child.fromRow(row);
      }
    } catch (e) {
      debugPrint('Error adding child: $e');
    }
    return null;
  }

  Future<bool> updateChild(String childId, Map<String, dynamic> updates) async {
    final userId = _userId;
    if (userId == null) return false;
    try {
      await _repo.updateChild(childId, userId, {...updates, 'updated_at': jsToIsoString(DomainClock.now())});
      await refetch();
      return true;
    } catch (e) {
      debugPrint('Error updating child: $e');
    }
    return false;
  }

  Future<bool> deleteChild(String childId) async {
    final userId = _userId;
    if (userId == null) return false;
    try {
      await _repo.updateChild(childId, userId, {'is_active': false});
      final selected = _ref.read(childStoreProvider).selectedChildId;
      if (selected == childId) setSelectedChild(null);
      await refetch();
      return true;
    } catch (e) {
      debugPrint('Error deleting child: $e');
    }
    return false;
  }
}

final childrenActionsProvider = Provider<ChildrenActions>(ChildrenActions.new);
