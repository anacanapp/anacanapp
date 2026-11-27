// Ported from: the supabase-js calls of src/hooks/{useStories,useStoryViewers,useStoryReplies}.ts and
//              src/components/community/StoriesBar.tsx that the community port's [CommunityBackend] has no method for
//              (a plain `insert` without `.select()`, `storage.remove`)
//
// Every other call goes through the community feature's [CommunityBackend] (select / maybeSingle / insertSingle /
// delete / upsert / rpc / upload / publicUrl / profile cards / realtime), so tests reuse its fake.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/data/data.dart';
import '../../community/data/community_backend.dart' show CRow;

abstract interface class StoryStorage {
  /// `from(table).insert(values)` (no returning select); throws on `error`.
  Future<void> insert(String table, CRow values);

  /// `storage.from(bucket).remove(paths)`; errors are ignored by the caller.
  Future<void> remove(String bucket, List<String> paths);
}

class SupabaseStoryStorage implements StoryStorage {
  SupabaseStoryStorage(this.db);
  final Db db;

  @override
  Future<void> insert(String table, CRow values) async => await db.from(table).insert(values);

  @override
  Future<void> remove(String bucket, List<String> paths) async => db.client.storage.from(bucket).remove(paths);
}

final storyStorageProvider = Provider<StoryStorage>((ref) => SupabaseStoryStorage(ref.watch(dbProvider)));
