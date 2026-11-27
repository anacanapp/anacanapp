// Ported from: src/hooks/usePlayActivities.ts
//
// Same query keys, filters, translation fields and stale times as the React hooks; reads and writes go through the
// tools' [HealthDb] seam.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/cache/cache.dart';
import '../../../core/data/data.dart' show Rows, mapRowsTranslation;
import '../../../state/user_store.dart';
import '../health_common/health_common.dart' show healthUserIdProvider;
import '../health_common/health_db.dart';

String _language(Ref ref) => ref.watch(userStoreProvider.select((s) => s.language));

/// `item.toLowerCase().replace(/\s+/g, '_')`.
String playItemKey(String item) => item.toLowerCase().replaceAll(RegExp(r'\s+'), '_');

List<String> _strings(Object? v) => v is List ? [for (final s in v) '$s'] : const [];

/// `usePlayActivities()` (no age / items) → `['play-activities', undefined, undefined, language]` (5 min).
final playActivitiesQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['play-activities', null, null, language],
    staleTime: const Duration(minutes: 5),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
      await db.select(HQuery('play_activities', filters: [eqF('is_active', true)], order: const [(column: 'sort_order', ascending: true)])),
      language,
      const ['title', 'description', 'instructions'],
    ),
  );
}, name: 'playActivitiesQuery');

/// `usePlayInventoryItems()` → `['play-inventory-items', language]` (10 min).
final playInventoryItemsQuery = queryProvider<Rows>((ref) {
  final language = _language(ref);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['play-inventory-items', language],
    staleTime: const Duration(minutes: 10),
    codec: QueryCodecs.rows,
    queryFn: (_) async => mapRowsTranslation(
      await db.select(HQuery('play_inventory_items', filters: [eqF('is_active', true)], order: const [(column: 'sort_order', ascending: true)])),
      language,
      const ['name'],
    ),
  );
}, name: 'playInventoryItemsQuery');

/// `useUserPlayInventory()` → `['user-play-inventory', userId]`.
final userPlayInventoryQuery = queryProvider<Rows>((ref) {
  final userId = ref.watch(healthUserIdProvider);
  final db = ref.watch(healthDbProvider);
  return QueryOptions<Rows>(
    queryKey: ['user-play-inventory', userId],
    enabled: userId != null,
    codec: QueryCodecs.rows,
    queryFn: (_) async => userId == null ? const [] : db.select(HQuery('user_play_inventory', filters: [eqF('user_id', userId)])),
  );
}, name: 'userPlayInventoryQuery');

/// `useToggleInventoryItem().mutateAsync({ itemName, itemNameAz })`: removes the item when it exists, else adds it.
Future<String> togglePlayInventoryItem(HealthDb db, String? userId, {required String itemName, String? itemNameAz}) async {
  if (userId == null) throw StateError('User not authenticated');
  Map<String, dynamic>? existing;
  try {
    existing = await db.maybeSingle(HQuery('user_play_inventory', columns: 'id', filters: [eqF('user_id', userId), eqF('item_name', itemName)]));
  } catch (_) {
    // `.single()` with no row reports an error that React ignores (`existing` stays null).
    existing = null;
  }
  if (existing != null) {
    await db.delete('user_play_inventory', [eqF('id', existing['id'])]);
    return 'removed';
  }
  await db.insert('user_play_inventory', {'user_id': userId, 'item_name': itemName, 'item_name_az': itemNameAz});
  return 'added';
}

/// `useLogPlayActivity().mutateAsync({ activityId, rating, notes })`.
Future<Map<String, dynamic>> logPlayActivity(HealthDb db, String? userId, {required String activityId, int? rating, String? notes}) {
  if (userId == null) throw StateError('User not authenticated');
  // `undefined` values are left out of the JSON body.
  return db.insert('play_activity_logs', {'user_id': userId, 'activity_id': activityId, 'rating': ?rating, 'notes': ?notes});
}

/// The `required_items` / `skill_tags` arrays of an activity row.
List<String> activityItems(Map<String, dynamic> a) => _strings(a['required_items']);
List<String> activitySkills(Map<String, dynamic> a) => _strings(a['skill_tags']);
