// Ported from: src/pages/Index.tsx (useDeviceToken(), useVaccineRemindersAtStart({...})), src/bootstrap-app.tsx
//              (initializeNativeFeatures()), src/hooks/useAppointments.ts (clearLegacyAppointmentNotifications once a
//              user is signed in), sonner `toast()` of useDeviceToken
//
// A 0×0 widget that runs the services' app-level effects. Mount it once inside the provider scope and the toast
// host after the backend opened (AppSessionHosts).
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart' show authUserProvider;
import '../../design/design.dart' show AToastHost;
import '../../features/settings/ui/settings_ui.dart' show ShadButton, ShadButtonVariant;
import '../../features/tools/vaccines/vaccine_reminders.dart' show vaccineRemindersProvider;
import '../../shell/shell_inputs.dart' show shellUserProvider;
import '../../state/persisted_store.dart' show localStoreProvider;
import 'native_features.dart';
import 'native_platform.dart';
import '../notifications/vaccine_reminders_at_start.dart';
import '../push/device_token.dart';
import 'services_wiring.dart';

/// Sonner toasts of the device-token service on the root toaster. The permission toast with "Allow" uses the
/// toaster's action slot (sonner's `action` button).
class _RootPushToasts implements PushToastSink {
  _RootPushToasts(this._context);
  final BuildContext Function() _context;

  @override
  void show(String title, {String? description, Duration? duration, String? actionLabel, VoidCallback? onAction}) {
    try {
      final toaster = AToastHost.of(_context());
      if (actionLabel == null || onAction == null) {
        toaster.message(title, description: description, duration: duration);
        return;
      }
      late final int id;
      id = toaster.show(
        title: title,
        description: description,
        duration: duration ?? const Duration(milliseconds: 4000),
        action: ShadButton(
          variant: ShadButtonVariant.outline,
          height: 32,
          onPressed: () {
            toaster.dismiss(id);
            onAction();
          },
          child: Text(actionLabel),
        ),
      );
    } catch (_) {
      // no toaster mounted
    }
  }
}

class NativeServicesHost extends ConsumerStatefulWidget {
  const NativeServicesHost({super.key});

  /// `initializeNativeFeatures()` runs once per process (bootstrap-app.tsx).
  static bool nativeFeaturesStarted = false;

  @override
  ConsumerState<NativeServicesHost> createState() => _NativeServicesHostState();
}

class _NativeServicesHostState extends ConsumerState<NativeServicesHost> {
  late final DeviceTokenService _deviceToken = ref.read(deviceTokenServiceProvider);
  late final VaccineRemindersAtStart _vaccines = VaccineRemindersAtStart(
    isNative: () => ref.read(localNotificationBackendProvider).isAvailable,
    reminders: () => ref.read(vaccineRemindersProvider),
    deps: () => ref.read(vaccineRefreshDepsProvider),
  );
  final List<ProviderSubscription<Object?>> _subs = [];
  String? _legacyClearedFor;

  @override
  void initState() {
    super.initState();
    _deviceToken.toasts = _RootPushToasts(() => context);
    if (!NativeServicesHost.nativeFeaturesStarted) {
      NativeServicesHost.nativeFeaturesStarted = true;
      unawaited(initializeNativeFeatures(
        isNative: ref.read(nativePlatformProvider).isNative,
        push: ref.read(pushPlatformProvider),
        store: ref.read(localStoreProvider),
        reminders: ref.read(localRemindersProvider),
        scheduler: ref.read(localNotificationSchedulerProvider),
      ).catchError((Object _) {}));
    }
    final auth = ref.listenManual(authUserProvider, (_, user) {
      _deviceToken.userChanged(user == null ? null : DeviceTokenUser(id: user.id, createdAt: user.createdAt));
      if (user != null && _legacyClearedFor != user.id) {
        _legacyClearedFor = user.id;
        unawaited(ref.read(localNotificationSchedulerProvider).clearLegacyAppointmentNotifications());
      }
    }, fireImmediately: true);
    final shell = ref.listenManual(shellUserProvider, (_, u) {
      _vaccines.update(VaccineRefreshInputs(
        userId: u.isAuthenticated ? u.userId : null,
        ready: u.profileLoaded,
        language: u.language,
        profileCountry: u.profileCountryCode,
        storedCountry: u.storedCountryCode,
      ));
    }, fireImmediately: true);
    _subs..add(auth)..add(shell);
  }

  @override
  void dispose() {
    for (final s in _subs) {
      s.close();
    }
    _vaccines.dispose();
    _deviceToken.toasts = const NoPushToasts();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
