// Ported from: src/lib/logout-cleanup.ts
//
// Only the bounded orchestration is ported here. The steps themselves (local
// notifications, queued notification taps, device-token unregistration) belong to
// other features and are injected as callbacks.

import 'dart:async';

/// Every logout step is bounded: a stuck native bridge or network never holds the logout.
const Duration logoutStepTimeout = Duration(milliseconds: 2500);

Future<void> _settleWithin(Future<void> Function() work, Duration limit) {
  final done = Completer<void>();
  final timer = Timer(limit, () {
    if (!done.isCompleted) done.complete();
  });
  Future<void>.sync(work).then((_) {}, onError: (Object _) {}).whenComplete(() {
    if (!done.isCompleted) done.complete();
  });
  return done.future.whenComplete(timer.cancel);
}

/// Steps of the privacy cleanup.
class LogoutCleanupSteps {
  const LogoutCleanupSteps({
    this.cancelAllLocalNotifications,
    this.dropQueuedNotificationTaps,
    this.unregisterDeviceForLogout,
  });

  /// Cancels scheduled and delivered local notifications and forgets the scheduler's set.
  final Future<void> Function()? cancelAllLocalNotifications;

  /// A notification tapped before (or during) logout must not open the next account's screens.
  final Future<void> Function()? dropQueuedNotificationTaps;

  /// Deletes this device's push registration (RLS-scoped: must run while signed in).
  final Future<void> Function(String userId, Duration timeout)? unregisterDeviceForLogout;
}

/// Privacy cleanup that must run while the session still exists. Never throws;
/// completes within about [timeout] + 1.5 s even if a step hangs.
Future<void> runLogoutCleanup(
  String? userId,
  LogoutCleanupSteps steps, {
  Duration timeout = logoutStepTimeout,
  bool isNativePlatform = true,
}) async {
  final work = <Future<void> Function()>[
    if (isNativePlatform && steps.cancelAllLocalNotifications != null) steps.cancelAllLocalNotifications!,
    if (steps.dropQueuedNotificationTaps != null) steps.dropQueuedNotificationTaps!,
    if (userId != null && userId.isNotEmpty && steps.unregisterDeviceForLogout != null)
      () => steps.unregisterDeviceForLogout!(userId, timeout),
  ];
  // The device step has its own per-call bounds; the outer bound covers the step setup too.
  await Future.wait(work.map((step) => _settleWithin(step, timeout + const Duration(milliseconds: 1500))));
}
