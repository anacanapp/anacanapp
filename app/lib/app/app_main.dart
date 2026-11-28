// Ported from: src/main.tsx (global error / unhandledrejection listeners, bootstrap), src/lib/crashReporter.ts
//              (initCrashReporter: window error + unhandledrejection), src/components/RootErrorBoundary.tsx,
//              src/main.tsx `installNotificationTapListeners()`
//
// Process entry: error zone + framework/platform error hooks → crash reporter, edge-to-edge system chrome, then
// `runApp` immediately so the first Flutter frame (the startup splash, identical to the native launch screen)
// replaces the native splash as early as possible; `runAppStartup` runs behind it (AnacanApp).
import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/i18n/tr.dart' show I18nRuntime;
import '../features/startup/admission_screens.dart' show RootErrorFallback;
import '../features/startup/error_boundary.dart'
    show ConnectedErrorBoundaryFallback;
import '../services/notifications/flutter_local_notification_backend.dart' show LocalNotificationsRuntime;
import '../services/push/firebase_push_platform.dart' show FirebaseRuntime;
import '../services/push/notification_tap_listeners.dart'
    show defaultNotificationTapSources, installNotificationTapListeners;
import 'anacan_app.dart';
import 'crash_reporter.dart';
import 'deep_links.dart';
import 'system_chrome.dart';

/// Installs the global error hooks (idempotent). Errors before the backend opened are only logged, like the
/// WebView before `initCrashReporter()`.
void installErrorHooks() {
  final previous = FlutterError.onError;
  FlutterError.onError = (details) {
    // ErrorBoundary.componentDidCatch → reportComponentCrash(error, componentStack).
    CrashReporting.reportComponentCrash(
      details.exception,
      stack: details.stack,
      componentStack: details.context?.toDescription(),
    );
    if (previous != null) {
      previous(details);
    } else {
      FlutterError.presentError(details);
    }
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    CrashReporting.reportUncaught(error, stack);
    debugPrint('Uncaught: $error');
    return true;
  };
  // Release builds replace a failing widget with the ErrorBoundary fallback instead of a grey box.
  if (kReleaseMode) {
    ErrorWidget.builder = (details) => AppErrorWidget(details: details);
  }
}

/// `ErrorWidget.builder` output: the ErrorBoundary fallback inside the app, RootErrorBoundary's fallback when
/// the failure is above the provider scope.
class AppErrorWidget extends StatelessWidget {
  const AppErrorWidget({super.key, required this.details});
  final FlutterErrorDetails details;

  @override
  Widget build(BuildContext context) {
    var inScope = false;
    try {
      ProviderScope.containerOf(context, listen: false);
      inScope = true;
    } catch (_) {}
    if (inScope) {
      return ConnectedErrorBoundaryFallback(
        message: details.exceptionAsString(),
      );
    }
    return RootErrorFallback(
      language: I18nRuntime.instance.language,
      onRetry: () => AnacanApp.current?.restart(),
    );
  }
}

/// `installNotificationTapListeners()` of main.tsx, plus the plugin start-up it relied on (Capacitor loaded the
/// plugins with the WebView): the local-notification plugin and Firebase are initialised in the background and
/// hand a tap that launched the app to the listeners. Web / tests: nothing to install.
void startNativeNotifications() {
  final sources = defaultNotificationTapSources();
  installNotificationTapListeners(sources);
  if (!sources.isNative) return;
  unawaited(LocalNotificationsRuntime.instance.ensureInitialized().catchError((Object e) {
    debugPrint('Local notifications unavailable: $e');
  }));
  unawaited(FirebaseRuntime.instance.ensureInitialized().catchError((Object e) {
    debugPrint('Firebase unavailable: $e');
  }));
}

/// `main()`.
void runAnacanApp() {
  runZonedGuarded<void>(
    () {
      WidgetsFlutterBinding.ensureInitialized();
      installErrorHooks();
      unawaited(configureSystemChrome());
      // Before the first frame, so the launch link (cold start) is captured; delivered once the app is ready.
      startIncomingLinks();
      startNativeNotifications();
      runApp(const AnacanApp());
    },
    (error, stack) {
      CrashReporting.reportUncaught(error, stack);
      debugPrint('Uncaught (zone): $error');
    },
  );
}
