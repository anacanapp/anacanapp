// Ported from: src/integrations/supabase/client.ts (the `supabase` singleton export),
// src/bootstrap-app.tsx (startup result).
//
// Riverpod access to the backend. The shell watches [backendBootstrapProvider] and only
// builds app screens once it is a [BootstrapOpened]; feature code reads
// [supabaseClientProvider] and [authStateProvider] afterwards.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../session/session_persistence.dart';
import 'backend_client.dart';

/// Overridable in tests (e.g. with a [BackendClient] over in-memory stores).
final backendClientProvider = Provider<BackendClient>((ref) => BackendClient());

/// One startup per [BackendClient]. To retry/restart: `await client.restart()` then
/// `ref.invalidate(backendClientProvider)`.
final backendBootstrapProvider = FutureProvider<BootstrapResult>(
  (ref) => ref.watch(backendClientProvider).bootstrapBackend(),
);

BootstrapOpened _opened(Ref ref) {
  final result = ref.watch(backendBootstrapProvider).requireValue;
  if (result is BootstrapOpened) return result;
  throw StateError('Backend is not admitted: ${result.runtimeType}');
}

/// The SDK client. Throws until startup opened the app.
final supabaseClientProvider = Provider<SupabaseClient>((ref) {
  final client = _opened(ref).client;
  if (client == null) throw StateError('No SDK client in this backend handle');
  return client;
});

/// Session backup/restore/sign-out. Sign out through `persistence.signOut()`.
final sessionPersistenceProvider = Provider<NativeSessionPersistence>((ref) => _opened(ref).persistence);

/// Auth events of the SDK client.
final authStateProvider = StreamProvider<AuthState>((ref) => ref.watch(supabaseClientProvider).auth.onAuthStateChange);

/// The current session, re-evaluated on every auth event.
final currentSessionProvider = Provider<Session?>((ref) {
  ref.watch(authStateProvider);
  return ref.watch(supabaseClientProvider).auth.currentSession;
});

/// True once startup opened the backend with an SDK client. App-wide hosts that must not touch the SDK before
/// that (frame overlays during tests, the root link handler) guard on it instead of catching provider errors.
final backendOpenProvider = Provider<bool>((ref) {
  final result = ref.watch(backendBootstrapProvider).value;
  return result is BootstrapOpened && result.client != null;
});
