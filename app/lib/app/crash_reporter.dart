// Ported from: src/lib/crashReporter.ts
//
// What is captured and where it goes (same as React):
//   table `crash_reports` (insert; RLS allows anonymous rows) with
//   {user_id, error_message ≤2000, error_stack ≤5000, component_stack ≤3000, url, user_agent, app_version,
//    platform, extra_data}.
//   Same message within 30 s → dropped; noisy transient messages (IGNORED_PATTERNS) → dropped; a failing insert
//   is swallowed (the reporter never crashes the app).
// Sources: uncaught errors (zone / PlatformDispatcher → `type: uncaught_error`), framework build/layout errors
// (FlutterError.onError → `type: react_error_boundary`, the ErrorBoundary equivalent), `reportAuthError`,
// `reportPushFailure`.
//
// Differences: `user_id` is the SDK's current user (React awaited `auth.getUser()`, a network call); `url` is
// the WebView-equivalent app origin + the current route; `user_agent` describes the Flutter app instead of the
// WebView UA. Nothing is sent before startup opened the backend (React installs the reporter after admission).
import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show SupabaseClient;

/// One report (`CrashReport`).
@immutable
class CrashReport {
  const CrashReport({
    required this.errorMessage,
    this.errorStack,
    this.componentStack,
    this.url,
    this.userAgent,
    this.appVersion,
    this.platform,
    this.extraData,
  });

  final String errorMessage;
  final String? errorStack;
  final String? componentStack;
  final String? url;
  final String? userAgent;
  final String? appVersion;
  final String? platform;
  final Map<String, Object?>? extraData;
}

/// `IGNORED_PATTERNS`: browser/network/storage transient conditions that pollute reports.
final List<RegExp> kIgnoredCrashPatterns = [
  RegExp('signal is aborted', caseSensitive: false),
  RegExp('the operation was aborted', caseSensitive: false),
  RegExp('aborterror', caseSensitive: false),
  RegExp('the user aborted a request', caseSensitive: false),
  RegExp('load failed', caseSensitive: false),
  RegExp('networkerror when attempting to fetch', caseSensitive: false),
  RegExp('failed to fetch', caseSensitive: false),
  RegExp(
    'internal error was encountered in the indexed database',
    caseSensitive: false,
  ),
  RegExp('write permission denied', caseSensitive: false),
  RegExp('quotaexceedederror', caseSensitive: false),
  RegExp('resizeobserver loop', caseSensitive: false),
  RegExp(r'script error\.?$', caseSensitive: false),
  RegExp('non-error promise rejection captured', caseSensitive: false),
  RegExp(
    r"cannot read properties of null \(reading 'useeffect'\)",
    caseSensitive: false,
  ),
  RegExp(
    r"cannot read properties of null \(reading 'getsnapshot'\)",
    caseSensitive: false,
  ),
];

/// `shouldIgnore(message)`.
bool shouldIgnoreCrash(String message) =>
    message.isEmpty || kIgnoredCrashPatterns.any((re) => re.hasMatch(message));

/// `isAuthCancellation(message)`: the user closed the sign-in sheet / has no account on the device.
bool isAuthCancellation(String message) {
  if (message.contains('AuthorizationError') &&
      RegExp(r'(^|\D)1001(\D|$)').hasMatch(message)) {
    return true;
  }
  return RegExp(
    r'(user canceled|user cancelled|cancelled by (the )?user|canceled by (the )?user|popup_closed|12501|no credentials available|user disabled the feature)',
    caseSensitive: false,
  ).hasMatch(message);
}

String? _cap(String? s, int max) =>
    s == null ? null : (s.length > max ? s.substring(0, max) : s);

/// Where reports go.
abstract interface class CrashReportSink {
  Future<void> insert(Map<String, Object?> row);
}

/// `supabase.from('crash_reports').insert(row)`.
class SupabaseCrashReportSink implements CrashReportSink {
  SupabaseCrashReportSink(this.client);
  final SupabaseClient client;

  @override
  Future<void> insert(Map<String, Object?> row) async {
    await client.from('crash_reports').insert({
      ...row,
      'user_id': client.auth.currentUser?.id,
    });
  }
}

/// The crash reporter interface used by the app.
abstract interface class CrashReporter {
  void send(CrashReport report);
}

/// Dedupe + filter + row shape; [sink] does the I/O. Never throws.
class DefaultCrashReporter implements CrashReporter {
  DefaultCrashReporter({
    required this.sink,
    required this.appVersion,
    String? platform,
    String? userAgent,
    String Function()? currentUrl,
    int Function()? now,
  }) : platform = platform ?? detectCrashPlatform(),
       userAgent = userAgent ?? defaultCrashUserAgent(appVersion),
       currentUrl = currentUrl ?? (() => 'https://app.anacan.az/'),
       _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  /// `DEDUPE_MS`.
  static const int dedupeMs = 30000;

  final CrashReportSink sink;
  final String appVersion;
  final String platform;
  final String userAgent;
  final String Function() currentUrl;
  final int Function() _now;
  String _lastMessage = '';
  int _lastTime = 0;

  @override
  void send(CrashReport report) {
    if (shouldIgnoreCrash(report.errorMessage)) return;
    final now = _now();
    if (report.errorMessage == _lastMessage && now - _lastTime < dedupeMs) {
      return;
    }
    _lastMessage = report.errorMessage;
    _lastTime = now;
    final String url;
    try {
      url = report.url ?? currentUrl();
    } catch (_) {
      return;
    }
    final row = <String, Object?>{
      'error_message': _cap(report.errorMessage, 2000),
      'error_stack': _nullIfEmpty(_cap(report.errorStack, 5000)),
      'component_stack': _nullIfEmpty(_cap(report.componentStack, 3000)),
      'url': url,
      'user_agent': report.userAgent ?? userAgent,
      'app_version':
          report.appVersion ?? (appVersion.isEmpty ? 'unknown' : appVersion),
      'platform': report.platform ?? platform,
      'extra_data': report.extraData,
    };
    unawaited(
      Future<void>.sync(() => sink.insert(row)).catchError((Object _) {}),
    );
  }

  static String? _nullIfEmpty(String? s) => (s == null || s.isEmpty) ? null : s;
}

/// `detectPlatform()`.
String detectCrashPlatform() {
  if (kIsWeb) return 'web';
  if (Platform.isAndroid) return 'android';
  if (Platform.isIOS) return 'ios';
  return 'web';
}

String defaultCrashUserAgent(String appVersion) {
  if (kIsWeb) return 'Anacan-Flutter';
  return 'Anacan-Flutter/${appVersion.isEmpty ? 'unknown' : appVersion} (${Platform.operatingSystem} ${Platform.operatingSystemVersion})';
}

/// The installed reporter (null until startup opened the backend).
final crashReporterProvider = Provider<CrashReporter?>(
  (ref) => CrashReporting.reporter,
);

/// Process-wide access for global handlers and non-widget code (`import { reportX } from crashReporter`).
abstract final class CrashReporting {
  static CrashReporter? reporter;

  /// `reportComponentCrash(error, componentStack)` (ErrorBoundary).
  static void reportComponentCrash(
    Object error, {
    StackTrace? stack,
    String? componentStack,
  }) => reporter?.send(
    CrashReport(
      errorMessage: _message(error),
      errorStack: stack?.toString(),
      componentStack: componentStack,
      extraData: const {'type': 'react_error_boundary'},
    ),
  );

  /// Global `error` handler.
  static void reportUncaught(Object error, StackTrace? stack) => reporter?.send(
    CrashReport(
      errorMessage: _message(error).isEmpty ? 'Unknown error' : _message(error),
      errorStack: stack?.toString(),
      extraData: const {'type': 'uncaught_error'},
    ),
  );

  /// `reportPushFailure(kind, reason, extra)`.
  static void reportPushFailure(
    String kind,
    String reason, [
    Map<String, Object?>? extra,
  ]) {
    final msg = '[push:$kind] $reason';
    reporter?.send(
      CrashReport(
        errorMessage: msg.length > 500 ? msg.substring(0, 500) : msg,
        extraData: {'type': 'push_delivery', 'kind': kind, ...?extra},
      ),
    );
  }

  /// `reportAuthError(provider, error)`; cancellations are not reported.
  static void reportAuthError(
    String provider,
    Object? error, {
    StackTrace? stack,
    Object? code,
    String? name,
    Object? status,
  }) {
    final message = _message(error).isEmpty
        ? 'Unknown auth error'
        : _message(error);
    if (isAuthCancellation(message)) return;
    reporter?.send(
      CrashReport(
        errorMessage: '[auth:$provider] $message',
        errorStack: stack?.toString(),
        extraData: {
          'type': 'auth_error',
          'provider': provider,
          'code': code,
          'error_name': name,
          'error_status': status,
        },
      ),
    );
  }

  static String _message(Object? error) {
    if (error == null) return '';
    try {
      final dynamic e = error;
      final Object? m = e.message;
      if (m is String && m.isNotEmpty) return m;
    } catch (_) {}
    return error.toString();
  }
}
