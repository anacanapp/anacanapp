// Ported from: module singletons of src/lib/offline-outbox.ts and src/lib/offlineCache.ts,
// src/components/OfflineSyncIndicator.tsx (visibility rule).

import 'dart:async';

import 'package:flutter/widgets.dart' show AppLifecycleListener;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../state/persisted_store.dart';
import '../auth/auth_controller.dart' show authControllerProvider;
import '../net/backend_providers.dart';
import 'connectivity.dart';
import 'offline_cache.dart';
import 'offline_outbox.dart';
import 'outbox_senders.dart';

/// App resume events (`appStateChange` isActive). Overridable in tests.
final appResumeEventsProvider = Provider<Stream<void>>((ref) {
  final controller = StreamController<void>.broadcast();
  final listener = AppLifecycleListener(onResume: () => controller.add(null));
  ref.onDispose(() {
    listener.dispose();
    unawaited(controller.close());
  });
  return controller.stream;
});

final offlineCacheProvider = Provider<OfflineCache>((ref) => OfflineCache(ref.watch(localStoreProvider)));

/// The outbox. Its sender resolves the SDK client lazily (only after startup opened the app).
final offlineOutboxProvider = Provider<OfflineOutbox>((ref) {
  final outbox = OfflineOutbox(
    store: ref.watch(localStoreProvider),
    sender: (table, row) => SupabaseOutboxSender(ref.read(supabaseClientProvider))(table, row),
    connectivity: ref.watch(connectivitySourceProvider),
    resumes: ref.watch(appResumeEventsProvider),
  );
  ref.onDispose(() => unawaited(outbox.dispose()));
  return outbox;
});

/// `OfflineSyncIndicator`: shown while offline for a signed-in account.
final offlineSyncIndicatorVisibleProvider = Provider<bool>((ref) {
  final online = ref.watch(onlineStatusProvider);
  final signedIn = ref.watch(authControllerProvider.select((s) => s.user != null));
  return !online && signedIn;
});

/// Queued rows of a user (badge / optimistic lists); recomputed on every outbox change.
final outboxEntriesProvider = StreamProvider.family<List<OutboxEntry>, String>((ref, userId) {
  final outbox = ref.watch(offlineOutboxProvider);
  final controller = StreamController<List<OutboxEntry>>();
  controller.add(outbox.readOutbox(userId));
  final remove = outbox.subscribe((change) {
    if (change.userId == userId) controller.add(outbox.readOutbox(userId));
  });
  ref.onDispose(() {
    remove();
    unawaited(controller.close());
  });
  return controller.stream;
});
