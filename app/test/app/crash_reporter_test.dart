// Ported from: src/lib/crashReporter.ts (no vitest file for the module itself; cases follow its rules:
//              IGNORED_PATTERNS, 30 s dedupe, column caps, isAuthCancellation, reportAuthError / reportPushFailure)
import 'package:anacan/app/crash_reporter.dart';
import 'package:flutter_test/flutter_test.dart';

class MemorySink implements CrashReportSink {
  final rows = <Map<String, Object?>>[];
  Object? failWith;
  @override
  Future<void> insert(Map<String, Object?> row) async {
    if (failWith != null) throw failWith!;
    rows.add(row);
  }
}

void main() {
  late MemorySink sink;
  late int now;
  late DefaultCrashReporter reporter;

  setUp(() {
    sink = MemorySink();
    now = 1000000;
    reporter = DefaultCrashReporter(
      sink: sink,
      appVersion: '60.0',
      platform: 'android',
      userAgent: 'UA',
      currentUrl: () => 'https://app.anacan.az/',
      now: () => now,
    );
    CrashReporting.reporter = reporter;
  });
  tearDown(() => CrashReporting.reporter = null);

  test('row shape and caps (crash_reports columns)', () async {
    reporter.send(CrashReport(
      errorMessage: 'x' * 2500,
      errorStack: 's' * 6000,
      componentStack: 'c' * 4000,
      extraData: const {'type': 'uncaught_error'},
    ));
    await Future<void>.delayed(Duration.zero);
    final row = sink.rows.single;
    expect((row['error_message'] as String).length, 2000);
    expect((row['error_stack'] as String).length, 5000);
    expect((row['component_stack'] as String).length, 3000);
    expect(row['url'], 'https://app.anacan.az/');
    expect(row['user_agent'], 'UA');
    expect(row['app_version'], '60.0');
    expect(row['platform'], 'android');
    expect(row['extra_data'], {'type': 'uncaught_error'});
  });

  test('missing stacks are null, empty app version is "unknown"', () async {
    DefaultCrashReporter(sink: sink, appVersion: '', platform: 'ios', userAgent: 'UA').send(const CrashReport(errorMessage: 'boom'));
    await Future<void>.delayed(Duration.zero);
    expect(sink.rows.single['error_stack'], isNull);
    expect(sink.rows.single['component_stack'], isNull);
    expect(sink.rows.single['app_version'], 'unknown');
  });

  test('same message within 30 s is dropped, after 30 s it is sent again', () async {
    reporter.send(const CrashReport(errorMessage: 'boom'));
    now += 29999;
    reporter.send(const CrashReport(errorMessage: 'boom'));
    reporter.send(const CrashReport(errorMessage: 'other'));
    now += 30000;
    reporter.send(const CrashReport(errorMessage: 'other'));
    await Future<void>.delayed(Duration.zero);
    expect(sink.rows.map((r) => r['error_message']), ['boom', 'other', 'other']);
  });

  test('noisy transient errors are ignored', () async {
    for (final m in [
      'signal is aborted without reason',
      'Failed to fetch',
      'Load failed',
      'QuotaExceededError: storage full',
      'ResizeObserver loop limit exceeded',
      'Script error.',
      '',
    ]) {
      expect(shouldIgnoreCrash(m), isTrue, reason: m);
      reporter.send(CrashReport(errorMessage: m));
    }
    await Future<void>.delayed(Duration.zero);
    expect(sink.rows, isEmpty);
    expect(shouldIgnoreCrash('TypeError: x is null'), isFalse);
  });

  test('a failing insert never throws', () async {
    sink.failWith = Exception('offline');
    reporter.send(const CrashReport(errorMessage: 'boom'));
    await Future<void>.delayed(Duration.zero);
    expect(sink.rows, isEmpty);
  });

  group('isAuthCancellation', () {
    test('cancellations', () {
      expect(isAuthCancellation('The operation couldn’t be completed. (com.apple.AuthenticationServices.AuthorizationError error 1001.)'), isTrue);
      expect(isAuthCancellation('User cancelled the sign-in flow'), isTrue);
      expect(isAuthCancellation('12501: '), isTrue);
      expect(isAuthCancellation('popup_closed'), isTrue);
      expect(isAuthCancellation('No credentials available'), isTrue);
    });
    test('real errors', () {
      expect(isAuthCancellation('AuthorizationError error 1000'), isFalse);
      expect(isAuthCancellation('Invalid login credentials'), isFalse);
    });
  });

  test('reportAuthError: prefix, extra data; cancellations skipped', () async {
    CrashReporting.reportAuthError('google', Exception('network down'), code: 'x1');
    CrashReporting.reportAuthError('apple', 'User canceled');
    await Future<void>.delayed(Duration.zero);
    final row = sink.rows.single;
    expect(row['error_message'], startsWith('[auth:google] '));
    expect((row['extra_data'] as Map)['type'], 'auth_error');
    expect((row['extra_data'] as Map)['provider'], 'google');
    expect((row['extra_data'] as Map)['code'], 'x1');
  });

  test('reportPushFailure: 500-char message, push_delivery type', () async {
    CrashReporting.reportPushFailure('community_like', 'Forbidden ${'y' * 600}', {'status': 403});
    await Future<void>.delayed(Duration.zero);
    final row = sink.rows.single;
    expect((row['error_message'] as String).length, 500);
    expect(row['error_message'], startsWith('[push:community_like] Forbidden'));
    expect(row['extra_data'], {'type': 'push_delivery', 'kind': 'community_like', 'status': 403});
  });

  test('component crash and uncaught types', () async {
    CrashReporting.reportComponentCrash(StateError('bad state'), componentStack: 'Foo');
    CrashReporting.reportUncaught(ArgumentError('bad arg'), StackTrace.current);
    await Future<void>.delayed(Duration.zero);
    expect(sink.rows.map((r) => (r['extra_data'] as Map)['type']), ['react_error_boundary', 'uncaught_error']);
    expect(sink.rows.first['component_stack'], 'Foo');
  });

  test('nothing is sent while no reporter is installed', () {
    CrashReporting.reporter = null;
    expect(() => CrashReporting.reportUncaught('x', null), returnsNormally);
  });
}
