// Ported from: src/hooks/useModerator.ts, src/components/moderation/MyModerationDecisions.tsx (its query)
//
// Moderation queries (never persisted) and the moderator mutation. Toasts of `useModeratorMutation` are shown by
// the calling widget ([runModeratorMutation] returns the error instead of toasting).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/data/data.dart';
import '../../state/shell_bindings.dart' show backendUrlProvider;

/// `MODERATION_POLL`: re-read on resume / reconnect once 60 s stale, plus a 10 min foreground poll.
const Duration moderationStaleTime = Duration(seconds: 60);
const Duration moderationRefetchInterval = Duration(minutes: 10);

/// Data access (supabase rpc), replaceable in tests.
abstract interface class ModerationBackend {
  Future<Object?> rpc(String name, [Map<String, dynamic>? args]);
}

class SupabaseModerationBackend implements ModerationBackend {
  SupabaseModerationBackend(this.db);
  final Db db;
  @override
  Future<Object?> rpc(String name, [Map<String, dynamic>? args]) => db.rpc<Object?>(name, params: args);
}

final moderationBackendProvider = Provider<ModerationBackend>((ref) => SupabaseModerationBackend(ref.watch(dbProvider)));

String _backend(Ref ref) {
  try {
    return ref.watch(backendUrlProvider);
  } catch (_) {
    return '';
  }
}

/// `useModeratorAccess()`.
final moderatorAccessQuery = queryProvider<Map<String, dynamic>?>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final allowedRole = ref.watch(isModeratorProvider) || ref.watch(isAdminProvider);
  return QueryOptions<Map<String, dynamic>?>(
    queryKey: ['moderator-access', _backend(ref), userId],
    enabled: userId != null && allowedRole,
    meta: const {'persist': false},
    staleTime: moderationStaleTime,
    refetchInterval: moderationRefetchInterval,
    retry: noRetry,
    queryFn: (_) async {
      final data = await ref.read(moderationBackendProvider).rpc('get_moderator_access_v1');
      return data is Map ? Map<String, dynamic>.from(data) : null;
    },
  );
}, name: 'moderatorAccessQuery');

/// `useMyModerationStatus()`: null when the backend has no moderation functions.
final myModerationStatusQuery = queryProvider<Map<String, dynamic>?>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions<Map<String, dynamic>?>(
    queryKey: ['my-moderation-status', _backend(ref), userId],
    enabled: userId != null,
    meta: const {'persist': false},
    staleTime: moderationStaleTime,
    refetchInterval: moderationRefetchInterval,
    retry: noRetry,
    queryFn: (_) async {
      Object? data;
      try {
        data = await ref.read(moderationBackendProvider).rpc('get_my_moderation_status_v1', {'p_actor': userId});
      } catch (error) {
        if (isMissingFunctionError(error)) return null;
        rethrow;
      }
      if (data is! Map || data['user_id'] != userId) throw StateError('MODERATOR_ACCOUNT_CHANGED');
      return Map<String, dynamic>.from(data);
    },
  );
}, name: 'myModerationStatusQuery');

/// `error.code` is PGRST202 / 42883 (the function does not exist on this backend).
bool isMissingFunctionError(Object? error) {
  if (error == null) return false;
  Object? code;
  if (error is Map) {
    code = error['code'];
  } else {
    try {
      code = (error as dynamic).code;
    } catch (_) {}
  }
  return code == 'PGRST202' || code == '42883';
}

/// `MyModerationDecisions` query: `my_moderator_decisions_v1` (30 latest), fresh on every mount.
final myModerationDecisionsQuery = queryProvider<List<Map<String, dynamic>>>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  return QueryOptions<List<Map<String, dynamic>>>(
    queryKey: ['my-moderation-decisions', _backend(ref), userId],
    enabled: userId != null,
    meta: const {'persist': false},
    staleTime: Duration.zero,
    queryFn: (_) async {
      final data = await ref.read(moderationBackendProvider).rpc('my_moderator_decisions_v1', {'p_actor': userId, 'p_limit': 30});
      if (data is! List) return const <Map<String, dynamic>>[];
      return [for (final r in data) if (r is Map) Map<String, dynamic>.from(r)];
    },
  );
}, name: 'myModerationDecisionsQuery');

final RegExp _invalidated = RegExp(r'^(moderator-|my-moderation|my-active-block|community-ad|community-feed|group-posts|single-post|post-comments|stories)');

/// `useModeratorMutation().mutate({ rpc, args })` without the toasts: runs the RPC, then invalidates the
/// moderation / community queries. Returns `(data, error)`; the caller toasts `moderatorText('saved')` or
/// `moderatorError(error)`.
Future<({Object? data, Object? error})> runModeratorMutation(Ref ref, String rpc, Map<String, dynamic> args) async {
  try {
    final data = await ref.read(moderationBackendProvider).rpc(rpc, args);
    unawaited(ref.read(queryClientProvider).invalidateQueries(
          predicate: (q) => q.queryKey.isNotEmpty && _invalidated.hasMatch('${q.queryKey.first}'),
        ));
    return (data: data, error: null);
  } catch (error) {
    return (data: null, error: error);
  }
}

/// [runModeratorMutation] for widgets.
final moderatorMutationProvider = Provider<Future<({Object? data, Object? error})> Function(String rpc, Map<String, dynamic> args)>(
  (ref) => (rpc, args) => runModeratorMutation(ref, rpc, args),
);
