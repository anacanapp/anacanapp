// Ported from: the platform/service touchpoints of src/components/onboarding/OnboardingJourney.tsx and
// OnboardingTourHost.tsx (@capacitor-firebase/messaging permissions, localStorage drafts, supabase writes,
// useUserStore / childStore side effects)
//
// Everything the onboarding needs from outside its directory, as overridable providers. Native push is a
// later phase: the default permission port reports "unsupported", which the journey records as `denied` and
// the tour as "no push ask" — exactly what the web build did when the messaging plugin was missing.

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../core/cache/cache.dart';
import '../../core/net/backend_providers.dart';
import '../../state/child_store.dart';
import '../../state/persisted_store.dart';
import '../../state/local_store.dart';
import '../../state/shell_bindings.dart' show backendUrlProvider;
import '../../state/user_store.dart';
import 'onboarding_model.dart';
import 'onboarding_persistence.dart';

/// `FirebaseMessaging.checkPermissions()` / `requestPermissions()` → `receive`.
abstract interface class NotificationPermissionPort {
  /// 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'. Throws when push is unavailable.
  Future<String> check();
  Future<String> request();
}

class UnsupportedNotificationPermission implements NotificationPermissionPort {
  const UnsupportedNotificationPermission();
  @override
  Future<String> check() => Future.error(UnsupportedError('push messaging is not available'));
  @override
  Future<String> request() => Future.error(UnsupportedError('push messaging is not available'));
}

/// The native push agent overrides this (Firebase Messaging).
final notificationPermissionProvider = Provider<NotificationPermissionPort>((ref) => const UnsupportedNotificationPermission());

/// Fired after the tour's permission request was granted (`anacan:push-granted`): the push service registers
/// the device token at once. Default: nothing listens yet.
final pushGrantedCallbackProvider = Provider<void Function()>((ref) => () {});

class LocalStoreDraftStorage implements DraftStorage {
  const LocalStoreDraftStorage(this.store);
  final LocalStore store;
  @override
  String? getItem(String key) => store.getItem(key);
  @override
  void setItem(String key, String value) => store.setItem(key, value);
  @override
  void removeItem(String key) => store.removeItem(key);
}

final onboardingDraftStorageProvider = Provider<DraftStorage>((ref) => LocalStoreDraftStorage(ref.watch(localStoreProvider)));

final onboardingDataPortProvider = Provider<OnboardingDataPort>(
    (ref) => SupabaseOnboardingDataPort(ref.watch(supabaseClientProvider), () => ref.read(backendUrlProvider)));

/// `hasPendingOnboarding(user.id, backendUrl, profile.onboarding_answers)` for the gate inputs
/// (overrides shell_bindings' `hasPendingOnboardingProvider`).
final onboardingPendingProvider = Provider<bool>((ref) {
  final user = ref.watch(authUserProvider);
  final profile = ref.watch(authProfileProvider);
  final backend = ref.watch(backendUrlProvider);
  if (user == null || backend.isEmpty) return false;
  return hasPendingOnboarding(user.id, backend, profile?.onboardingAnswers, ref.watch(onboardingDraftStorageProvider));
});

/// Side effects on the rest of the app (userStore, childStore, children query).
class OnboardingEffects {
  const OnboardingEffects({
    required this.syncSavedProfile,
    required this.setFunnelCompleted,
    required this.selectChild,
    required this.childrenUpdated,
    required this.refreshProfile,
    required this.updateName,
    required this.hasSeenIntro,
  });

  /// `useUserStore.setState({ name, babyCount, multiplesType })` from the verified server row.
  final void Function(Map<String, Object?> saved) syncSavedProfile;
  final void Function(bool value) setFunnelCompleted;

  /// `useChildStore.getState().setSelectedChildId(id)`.
  final void Function(String? id) selectChild;

  /// `window.dispatchEvent(new Event('anacan:children-updated'))`.
  final void Function() childrenUpdated;

  /// `useAuth().refreshProfile()`.
  final Future<void> Function() refreshProfile;

  /// `useAuth().updateProfile({ name })` → saved row or error.
  final Future<({Map<String, Object?>? data, Object? error})> Function(String name) updateName;

  /// `useUserStore.getState().hasSeenIntro`.
  final bool Function() hasSeenIntro;
}

final onboardingEffectsProvider = Provider<OnboardingEffects>((ref) {
  UserStore store() => ref.read(userStoreProvider.notifier);
  return OnboardingEffects(
    syncSavedProfile: (saved) {
      final s = ref.read(userStoreProvider);
      store().setAuth(s.isAuthenticated, s.userId, s.email, saved['name'] as String?);
      final multiples = saved['multiples_type'] as String?;
      final count = (saved['baby_count'] as num?)?.toInt() ?? 1;
      if (multiples != null) store().setMultiplesData(count, multiples);
    },
    setFunnelCompleted: (v) => store().setFunnelCompleted(v),
    selectChild: (id) => ref.read(childStoreProvider.notifier).setSelectedChildId(id),
    childrenUpdated: () {
      final userId = ref.read(authUserProvider)?.id;
      unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: ['user-children', userId]));
    },
    refreshProfile: () => ref.read(authControllerProvider.notifier).refreshProfile(),
    updateName: (name) async {
      final result = await ref.read(authControllerProvider.notifier).updateProfile({'name': name});
      return (data: result.data?.row.cast<String, Object?>(), error: result.error);
    },
    hasSeenIntro: () => ref.read(userStoreProvider).hasSeenIntro,
  );
});
