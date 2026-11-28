// Ported from: (no React counterpart) — the plan §6 fallback (docs/FLUTTER_MIGRATION_PLAN.md,
// docs/flutter/LEGACY_STORAGE.md "Users who update 52 → 60 directly").
//
// Reads the WebView localStorage that the Capacitor app left on the device, through a one-off hidden
// WebView opened on the Capacitor origin (Android `https://app.anacan.az`, iOS `capacitor://app.anacan.az`;
// capacitor.config.json `server.hostname`). The page is served locally by the native side (no network) and
// only runs [buildLegacyWebStorageScript], which filters by the 53.0 export rules inside the WebView.
// Native halves: LegacyWebStorageChannel.kt / LegacyWebStorageChannel.swift.
//
// Channel `az.anacan/legacy_web_storage`:
//   hasLegacyData            → bool (the WebView data directory of the old app exists; checked before any
//                              WebView is created, so a fresh install never spawns one)
//   read {script, timeoutMs} → String (the script's JSON result)

import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';

import 'migration_export_rules.dart';

/// Origins the Capacitor app stored its localStorage under.
const String legacyWebOriginAndroid = 'https://app.anacan.az';
const String legacyWebOriginIos = 'capacitor://app.anacan.az';

sealed class LegacyWebStorageResult {
  const LegacyWebStorageResult();
}

/// The exportable localStorage entries (already filtered by the export rules).
final class LegacyWebStorageEntries extends LegacyWebStorageResult {
  const LegacyWebStorageEntries(this.entries, {this.totalKeys = 0});
  final Map<String, String> entries;

  /// `localStorage.length` before filtering (diagnostics).
  final int totalKeys;
}

/// No WebView data on this device (fresh install): nothing to recover, ever.
final class LegacyWebStorageNone extends LegacyWebStorageResult {
  const LegacyWebStorageNone();
}

/// Could not read this time (no native channel, WebView failure, timeout). Retried on a later launch.
final class LegacyWebStorageFailed extends LegacyWebStorageResult {
  const LegacyWebStorageFailed(this.reason);
  final String reason;
}

abstract interface class LegacyWebStorageReader {
  /// Never throws.
  Future<LegacyWebStorageResult> read();
}

/// Parses the script result (`{"length":n,"entries":{…}}`); null when malformed.
LegacyWebStorageEntries? parseLegacyWebStorageResult(Object? value) {
  Object? decoded = value;
  try {
    if (decoded is String) decoded = jsonDecode(decoded);
    // Some WebViews hand back the JSON string literal itself; decode once more.
    if (decoded is String) decoded = jsonDecode(decoded);
  } catch (_) {
    return null;
  }
  if (decoded is! Map || decoded['entries'] is! Map) return null;
  final entries = <String, String>{};
  (decoded['entries'] as Map).forEach((key, entry) {
    // Filter again on this side: the result must never carry a non-exportable key.
    if (key is String && entry is String && isMigrationExportKey(key)) entries[key] = entry;
  });
  final length = decoded['length'];
  return LegacyWebStorageEntries(entries, totalKeys: length is num ? length.toInt() : entries.length);
}

class MethodChannelLegacyWebStorageReader implements LegacyWebStorageReader {
  const MethodChannelLegacyWebStorageReader({
    this.channel = defaultChannel,
    this.timeout = const Duration(seconds: 6),
  });

  static const MethodChannel defaultChannel = MethodChannel('az.anacan/legacy_web_storage');

  final MethodChannel channel;

  /// Bound for the whole read (the native side also stops its WebView at this bound).
  final Duration timeout;

  @override
  Future<LegacyWebStorageResult> read() async {
    try {
      final has = await channel.invokeMethod<bool>('hasLegacyData').timeout(const Duration(seconds: 2));
      if (has != true) return const LegacyWebStorageNone();
      final raw = await channel
          .invokeMethod<String>('read', {'script': buildLegacyWebStorageScript(), 'timeoutMs': timeout.inMilliseconds})
          .timeout(timeout + const Duration(seconds: 1));
      return parseLegacyWebStorageResult(raw) ?? const LegacyWebStorageFailed('malformed');
    } on MissingPluginException {
      return const LegacyWebStorageFailed('unavailable');
    } on TimeoutException {
      return const LegacyWebStorageFailed('timeout');
    } on PlatformException catch (error) {
      // Never echo the message: it could contain stored values.
      return LegacyWebStorageFailed(error.code);
    } catch (_) {
      return const LegacyWebStorageFailed('error');
    }
  }
}

/// Fake over a raw localStorage map (tests, previews). Applies the same filter as the WebView script.
class InMemoryLegacyWebStorageReader implements LegacyWebStorageReader {
  InMemoryLegacyWebStorageReader([Map<String, String>? localStorage, this.hasData = true])
      : localStorage = {...?localStorage};

  final Map<String, String> localStorage;
  bool hasData;

  /// Answer every read with [LegacyWebStorageFailed] while set.
  String? failWith;
  int reads = 0;

  @override
  Future<LegacyWebStorageResult> read() async {
    reads++;
    if (!hasData) return const LegacyWebStorageNone();
    final failure = failWith;
    if (failure != null) return LegacyWebStorageFailed(failure);
    return LegacyWebStorageEntries(selectMigrationEntries(localStorage), totalKeys: localStorage.length);
  }
}

/// Answers [LegacyWebStorageNone] (platforms without the Capacitor predecessor).
class NoLegacyWebStorageReader implements LegacyWebStorageReader {
  const NoLegacyWebStorageReader();

  @override
  Future<LegacyWebStorageResult> read() async => const LegacyWebStorageNone();
}
