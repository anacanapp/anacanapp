// Ported from: src/hooks/useUnreadCommunityPosts.ts
//
// Unread global-feed posts of the selected language (the Community tab badge and the red dot on cards). Local seen
// markers (LocalStore `community_seen_posts_v2:<scope>`, bounded to 1000) cache the server-side
// `community_post_reads`; scope = [backend, user, language].
import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/i18n/i18n.dart';
import '../../../state/local_store.dart' show LocalStore;
import '../../../state/persisted_store.dart' show localStoreProvider;
import 'community_backend.dart';
import 'community_env.dart';
import 'community_moderation.dart' show matchesFeedLanguage;

typedef PostMap = Map<String, bool>;

/// `communityUnreadScope(userId, language)` = `JSON.stringify([backend, userId, language])`.
String communityUnreadScope(String backend, String userId, String language) =>
    jsonEncode([backend, userId, normalizeAppLanguage(language)]);

const int kMaxSeenPostIds = 1000;

PostMap _capSeen(PostMap ids) {
  if (ids.length <= kMaxSeenPostIds) return ids;
  return {for (final id in ids.keys.skip(ids.length - kMaxSeenPostIds)) id: true};
}

/// `readCommunityPostMarkers(userId, postIds)`: batches of 100 ids (request-line limits), all in parallel.
Future<PostMap> readCommunityPostMarkers(CommunityBackend backend, String userId, List<String> postIds) async {
  final batches = <List<String>>[];
  for (var offset = 0; offset < postIds.length; offset += 100) {
    batches.add(postIds.sublist(offset, (offset + 100).clamp(0, postIds.length)));
  }
  final results = await Future.wait(
      batches.map((batch) => backend.select(CQuery('community_post_reads', 'post_id').eq('user_id', userId).inList('post_id', batch))));
  return {for (final rows in results) for (final row in rows) '${row['post_id']}': true};
}

typedef MarkerPost = Map<String, dynamic>;

Future<List<MarkerPost>> _readUnreadCandidates(CommunityBackend backend, String userId, String language, String? lastSeen) async {
  final q = CQuery('community_posts', 'id,created_at,user_id,language,is_active,group_id')
      .eq('is_active', true)
      .eq('language', language)
      .isNull('group_id')
      .neq('user_id', userId)
      .order('created_at', ascending: false)
      .limit(500);
  if (lastSeen != null) q.gt('created_at', lastSeen);
  final rows = await backend.select(q);
  return [
    for (final post in rows)
      if (matchesFeedLanguage(post, language) && post['is_active'] == true && post['group_id'] == null && post['user_id'] != userId) post,
  ];
}

Future<void> _writeMarkers(CommunityBackend backend, String userId, List<MarkerPost> posts) async {
  for (var offset = 0; offset < posts.length; offset += 100) {
    final slice = posts.sublist(offset, (offset + 100).clamp(0, posts.length));
    await backend.upsert(
      'community_post_reads',
      [for (final post in slice) {'user_id': userId, 'post_id': post['id'], 'seen_at': DateTime.now().toUtc().toIso8601String()}],
      onConflict: 'user_id,post_id',
    );
  }
}

@immutable
class UnreadCommunityState {
  const UnreadCommunityState({
    this.scope,
    this.initializedUserId,
    this.unreadCount = 0,
    this.lastSeenAt,
    this.seenPostIds = const {},
    this.unreadPostIds = const {},
  });
  final String? scope;
  final String? initializedUserId;
  final int unreadCount;
  final String? lastSeenAt;
  final PostMap seenPostIds;
  final PostMap unreadPostIds;

  UnreadCommunityState copyWith({
    Object? scope = _keep,
    Object? initializedUserId = _keep,
    int? unreadCount,
    Object? lastSeenAt = _keep,
    PostMap? seenPostIds,
    PostMap? unreadPostIds,
  }) =>
      UnreadCommunityState(
        scope: identical(scope, _keep) ? this.scope : scope as String?,
        initializedUserId: identical(initializedUserId, _keep) ? this.initializedUserId : initializedUserId as String?,
        unreadCount: unreadCount ?? this.unreadCount,
        lastSeenAt: identical(lastSeenAt, _keep) ? this.lastSeenAt : lastSeenAt as String?,
        seenPostIds: seenPostIds ?? this.seenPostIds,
        unreadPostIds: unreadPostIds ?? this.unreadPostIds,
      );
}

const Object _keep = Object();

/// `unreadCommunityStore` (a process-wide store, like the zustand store).
class UnreadCommunityStore extends Notifier<UnreadCommunityState> {
  int _generation = 0;
  void Function()? _activeChannel;
  String? channelScope;
  String? hydrationScope;
  ({String scope, PostMap ids})? _pendingWrite;
  Timer? _writeTimer;

  @override
  UnreadCommunityState build() {
    // `pagehide` / `visibilitychange: hidden` flush the pending seen markers.
    try {
      final lifecycle = AppLifecycleListener(onHide: flushSeen, onPause: flushSeen);
      ref.onDispose(lifecycle.dispose);
    } catch (_) {
      // No binding (pure unit tests).
    }
    ref.onDispose(() {
      flushSeen();
      _activeChannel?.call();
    });
    return const UnreadCommunityState();
  }

  CommunityBackend get _backend => ref.read(communityBackendProvider);
  LocalStore get _store => ref.read(localStoreProvider);
  String get _backendUrl => ref.read(communityBackendUrlProvider);
  String _currentLanguage() => ref.read(communityLanguageProvider);

  String scopeFor(String userId, [String? language]) => communityUnreadScope(_backendUrl, userId, language ?? _currentLanguage());

  PostMap _readSeen(String scope, String userId) {
    try {
      final raw = _store.getItem('community_seen_posts_v2:$scope') ?? _store.getItem('community_seen_posts:$userId');
      final ids = raw != null && raw.isNotEmpty ? jsonDecode(raw) : const [];
      return _capSeen({for (final id in ids is List ? ids : const []) if (id is String) id: true});
    } catch (_) {
      return {};
    }
  }

  String? _readLastSeen(String scope) {
    try {
      final value = _store.getItem('community_seen_at_v2:$scope');
      return value != null && value.isNotEmpty && DateTime.tryParse(value) != null ? value : null;
    } catch (_) {
      return null;
    }
  }

  /// `flushSeen()` (also on app hide / pause through [UnreadCommunityLifecycle]).
  void flushSeen() {
    _writeTimer?.cancel();
    _writeTimer = null;
    final pending = _pendingWrite;
    if (pending == null) return;
    try {
      _store.setItem('community_seen_posts_v2:${pending.scope}', jsonEncode(pending.ids.keys.toList()));
    } catch (_) {
      // optional local cache
    }
    _pendingWrite = null;
  }

  void _writeSeen(String scope, PostMap ids) {
    if (_pendingWrite != null && _pendingWrite!.scope != scope) flushSeen();
    _pendingWrite = (scope: scope, ids: ids);
    _writeTimer?.cancel();
    _writeTimer = Timer(const Duration(milliseconds: 800), flushSeen);
  }

  Future<void> hydrateForUser(String userId, [String? inputLanguage]) async {
    final language = normalizeAppLanguage(inputLanguage ?? _currentLanguage());
    final scope = scopeFor(userId, language);
    final request = ++_generation;
    if (state.scope != scope) {
      state = UnreadCommunityState(scope: scope, lastSeenAt: _readLastSeen(scope), seenPostIds: _readSeen(scope, userId));
    }
    final previouslyUnread = state.unreadPostIds.keys.toSet();
    final lastSeenAt = state.lastSeenAt;
    final posts = await _readUnreadCandidates(_backend, userId, language, lastSeenAt);
    final serverSeen = await readCommunityPostMarkers(_backend, userId, [for (final p in posts) '${p['id']}']);
    if (!ref.mounted || request != _generation || state.scope != scope) return;
    final seenPostIds = <String, bool>{..._readSeen(scope, userId), ...serverSeen, ...state.seenPostIds};
    final arriving = state.unreadPostIds.keys.where((id) => !previouslyUnread.contains(id));
    final unreadPostIds = <String, bool>{
      for (final id in arriving) id: true,
      for (final post in posts) if (seenPostIds['${post['id']}'] != true) '${post['id']}': true,
    };
    for (final id in seenPostIds.keys) {
      unreadPostIds.remove(id);
    }
    final bounded = _capSeen(seenPostIds);
    _writeSeen(scope, bounded);
    state = state.copyWith(
        initializedUserId: userId, lastSeenAt: lastSeenAt, seenPostIds: bounded, unreadPostIds: unreadPostIds, unreadCount: unreadPostIds.length);
  }

  Future<void> markPostSeen({required String userId, required String postId, String? postUserId, String? language}) async {
    final scope = scopeFor(userId, language);
    final s = state;
    if (postUserId == userId || s.scope != scope || s.seenPostIds[postId] == true) return;
    final seenPostIds = _capSeen({...s.seenPostIds, postId: true});
    final unreadPostIds = {...s.unreadPostIds}..remove(postId);
    state = s.copyWith(seenPostIds: seenPostIds, unreadPostIds: unreadPostIds, unreadCount: unreadPostIds.length);
    _writeSeen(scope, seenPostIds);
    try {
      await _backend.upsert(
          'community_post_reads', [{'user_id': userId, 'post_id': postId, 'seen_at': DateTime.now().toUtc().toIso8601String()}],
          onConflict: 'user_id,post_id');
    } catch (_) {
      debugPrint('[community-unread] marker_failed');
    }
  }

  Future<void> markCommunitySeen(String userId, [String? inputLanguage]) async {
    final language = normalizeAppLanguage(inputLanguage ?? _currentLanguage());
    final scope = scopeFor(userId, language);
    if (state.scope != scope) return;
    final posts = await _readUnreadCandidates(_backend, userId, language, state.lastSeenAt);
    await _writeMarkers(_backend, userId, posts);
    if (!ref.mounted || state.scope != scope) return;
    ++_generation;
    final seenPostIds = <String, bool>{...state.seenPostIds, for (final p in posts) '${p['id']}': true};
    final latest = posts.isNotEmpty ? posts.first['created_at'] as String? : state.lastSeenAt;
    final current = state.lastSeenAt;
    final lastSeenAt = current != null && latest != null && current.compareTo(latest) > 0 ? current : latest;
    final unreadPostIds = {...state.unreadPostIds};
    for (final id in seenPostIds.keys) {
      unreadPostIds.remove(id);
    }
    final bounded = _capSeen(seenPostIds);
    state = state.copyWith(
        initializedUserId: userId, seenPostIds: bounded, unreadPostIds: unreadPostIds, unreadCount: unreadPostIds.length, lastSeenAt: lastSeenAt);
    _writeSeen(scope, bounded);
    try {
      if (lastSeenAt != null) _store.setItem('community_seen_at_v2:$scope', lastSeenAt);
    } catch (_) {
      // per-post server receipts remain authoritative
    }
  }

  void registerNewPost({required String userId, required String postId, required String createdAt, String? postUserId, String? language}) {
    final s = state;
    final lastSeen = s.lastSeenAt == null ? null : DateTime.tryParse(s.lastSeenAt!);
    final created = DateTime.tryParse(createdAt);
    if (postUserId == userId ||
        s.scope != scopeFor(userId, language) ||
        s.seenPostIds[postId] == true ||
        s.unreadPostIds[postId] == true ||
        (lastSeen != null && created != null && !created.isAfter(lastSeen))) {
      return;
    }
    final unreadPostIds = {...s.unreadPostIds, postId: true};
    state = s.copyWith(unreadPostIds: unreadPostIds, unreadCount: unreadPostIds.length);
  }

  void reset() {
    ++_generation;
    flushSeen();
    _activeChannel?.call();
    _activeChannel = null;
    channelScope = null;
    hydrationScope = null;
    state = const UnreadCommunityState();
  }

  /// The effect of `useUnreadCommunityPosts`: hydrate once per scope and keep one INSERT channel for it.
  void ensure(String? userId, String language) {
    if (userId == null) {
      if (state.scope != null || _activeChannel != null) reset();
      return;
    }
    final scope = scopeFor(userId, language);
    if ((state.scope != scope || state.initializedUserId != userId) && hydrationScope != scope) {
      hydrationScope = scope;
      unawaited(hydrateForUser(userId, language).catchError((Object _) => debugPrint('[community-unread] hydration_failed')).whenComplete(() {
        if (hydrationScope == scope) hydrationScope = null;
      }));
    }
    if (channelScope != scope) {
      _activeChannel?.call();
      _activeChannel = _backend.subscribe(
        channelPrefix: 'community-unread:$userId:$language',
        table: 'community_posts',
        event: 'INSERT',
        filter: 'language=eq.$language',
        onChange: (event) {
          final post = event.newRecord;
          if (!matchesFeedLanguage(post, language) || post['group_id'] != null || post['is_active'] != true) return;
          registerNewPost(
              userId: userId, language: language, postId: '${post['id']}', createdAt: '${post['created_at']}', postUserId: post['user_id'] as String?);
        },
      );
      channelScope = scope;
    }
  }
}

final unreadCommunityStoreProvider = NotifierProvider<UnreadCommunityStore, UnreadCommunityState>(UnreadCommunityStore.new);

/// `useUnreadCommunityPosts()` view.
@immutable
class UnreadCommunityPosts {
  const UnreadCommunityPosts({required this.unreadCount, required this.lastSeenAt, required this.seenPostIds});
  final int unreadCount;
  final String? lastSeenAt;
  final PostMap seenPostIds;
}

/// `useUnreadCommunityPosts()`: runs the hydrate / channel effect for the signed-in user and language.
final unreadCommunityPostsProvider = Provider<UnreadCommunityPosts>((ref) {
  final userId = ref.watch(authUserProvider)?.id;
  final language = ref.watch(communityLanguageProvider);
  final store = ref.read(unreadCommunityStoreProvider.notifier);
  // Store writes must not happen while this provider builds.
  scheduleMicrotask(() {
    if (ref.mounted) store.ensure(userId, language);
  });
  final state = ref.watch(unreadCommunityStoreProvider);
  final scope = userId == null ? null : store.scopeFor(userId, language);
  final current = scope != null && state.scope == scope;
  return UnreadCommunityPosts(
    unreadCount: current ? state.unreadCount : 0,
    lastSeenAt: current ? state.lastSeenAt : null,
    seenPostIds: current ? state.seenPostIds : const {},
  );
}, name: 'unreadCommunityPostsProvider');

/// The bottom-nav badge (`useUnreadCommunityPosts().unreadCount`); the shell's `unreadCommunityPostsCountProvider`
/// should be overridden with it.
final communityUnreadCountProvider = Provider<int>((ref) => ref.watch(unreadCommunityPostsProvider).unreadCount);

/// `usePostSeenFlag(postId)`.
final postSeenFlagProvider = Provider.autoDispose.family<bool, String>((ref, postId) {
  final userId = ref.watch(authUserProvider)?.id;
  if (userId == null) return false;
  final store = ref.read(unreadCommunityStoreProvider.notifier);
  final scope = store.scopeFor(userId, ref.watch(communityLanguageProvider));
  return ref.watch(unreadCommunityStoreProvider.select((s) => s.scope == scope && s.seenPostIds[postId] == true));
});

/// `usePostUnreadFlag(userId, postId, createdAt, postUserId)`.
final postUnreadFlagProvider = Provider.autoDispose.family<bool, ({String postId, String? postUserId})>((ref, args) {
  final userId = ref.watch(authUserProvider)?.id;
  if (userId == null || args.postUserId == userId) return false;
  final store = ref.read(unreadCommunityStoreProvider.notifier);
  final scope = store.scopeFor(userId, ref.watch(communityLanguageProvider));
  return ref.watch(unreadCommunityStoreProvider.select((s) => s.scope == scope && s.unreadPostIds[args.postId] == true));
});
