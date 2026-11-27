// Ported from: the supabase calls of src/components/tools/BabyGrowthTracker.tsx (fetchEntries, handleSubmit,
//              handleDelete)
//
// React kept the rows in component state and refetched on [user, selectedChild]; here they are one query
// (`['baby-growth', userId, childId]`, never persisted: health data) refetched after every write.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/cache/cache.dart';
import '../../../core/net/backend_providers.dart';
import '../../baby/hooks/use_children.dart';

typedef GrowthRow = Map<String, dynamic>;

abstract interface class GrowthRepository {
  /// All entries of the user (of the child when given), newest `entry_date` first.
  Future<List<GrowthRow>> list(String userId, String? childId);
  Future<void> insert(GrowthRow row);
  Future<void> update(String id, GrowthRow values);
  Future<void> delete(String id);
}

class SupabaseGrowthRepository implements GrowthRepository {
  SupabaseGrowthRepository(this._client);
  final SupabaseClient Function() _client;
  SupabaseClient get client => _client();

  @override
  Future<List<GrowthRow>> list(String userId, String? childId) async {
    var q = client.from('baby_growth').select().eq('user_id', userId);
    if (childId != null) q = q.eq('child_id', childId);
    final data = await q.order('entry_date', ascending: false);
    return [for (final r in data) Map<String, dynamic>.from(r)];
  }

  @override
  Future<void> insert(GrowthRow row) => client.from('baby_growth').insert(row);
  @override
  Future<void> update(String id, GrowthRow values) => client.from('baby_growth').update(values).eq('id', id);
  @override
  Future<void> delete(String id) => client.from('baby_growth').delete().eq('id', id);
}

final growthRepositoryProvider =
    Provider<GrowthRepository>((ref) => SupabaseGrowthRepository(() => ref.read(supabaseClientProvider)), name: 'growthRepositoryProvider');

final growthEntriesQuery = queryProvider<List<GrowthRow>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final childId = ref.watch(selectedChildIdProvider);
  final repo = ref.watch(growthRepositoryProvider);
  return QueryOptions(
    queryKey: ['baby-growth', userId, childId],
    enabled: userId != null,
    staleTime: Duration.zero,
    retry: noRetry,
    meta: const {'persist': false},
    codec: QueryCodecs.rows,
    queryFn: (_) => repo.list(userId!, childId),
  );
}, name: 'growthEntriesQuery');
