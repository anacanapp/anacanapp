// Ported from: src/hooks/useSubscription.ts (deviceTimeZone: `Intl.DateTimeFormat().resolvedOptions().timeZone`,
//              fallback Asia/Baku), src/hooks/usePeriodDayLogs.ts / useRecordPeriodDays (`p_timezone`: same call,
//              fallback 'UTC'), src/lib/user-timezone.ts (deviceTimeZone)
//
// The device IANA zone, the one source for every RPC that sends a zone. Dart has no IANA lookup of its own, so
// the zone comes from flutter_timezone (`TimeZone.getDefault().id` / `NSTimeZone.local.identifier`). The value
// is null until the platform answered (or when it cannot); each consumer keeps its React fallback. The WebView
// evaluated `Intl` on every call, so the zone is re-read when the app returns to the foreground (travel).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';

import '../offline/offline_providers.dart' show appResumeEventsProvider;

/// Reads the device zone; null when unavailable.
typedef TimeZoneLookup = Future<String?> Function();

/// flutter_timezone lookup (any platform error → null).
Future<String?> flutterTimeZoneLookup() async {
  try {
    final id = (await FlutterTimezone.getLocalTimezone()).identifier.trim();
    return id.isEmpty ? null : id;
  } catch (_) {
    return null;
  }
}

/// Overridable in tests.
final timeZoneLookupProvider = Provider<TimeZoneLookup>((ref) => flutterTimeZoneLookup);

/// `Intl.DateTimeFormat().resolvedOptions().timeZone` of the device (null = unknown → caller's fallback).
final ianaTimeZoneProvider = NotifierProvider<IanaTimeZone, String?>(IanaTimeZone.new);

class IanaTimeZone extends Notifier<String?> {
  /// Last answer of this process, so a restarted container starts with it.
  static String? _last;

  @override
  String? build() {
    final lookup = ref.watch(timeZoneLookupProvider);
    StreamSubscription<void>? resumed;
    try {
      resumed = ref.watch(appResumeEventsProvider).listen((_) => unawaited(_load(lookup)));
    } catch (_) {
      // no lifecycle stream (tests)
    }
    ref.onDispose(() => unawaited(resumed?.cancel()));
    unawaited(_load(lookup));
    return _last;
  }

  Future<void> _load(TimeZoneLookup lookup) async {
    final zone = await lookup();
    if (zone == null || !ref.mounted) return;
    _last = zone;
    if (state != zone) state = zone;
  }
}
