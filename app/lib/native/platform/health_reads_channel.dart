// Ported from: src/lib/health.ts (the capacitor-health `Health` calls), node_modules/capacitor-health 8.1.2
//              (dist/esm/definitions.d.ts, android HealthPlugin.kt, ios HealthPlugin.swift)
//
// The capacitor-health `Health` plugin over the method channel `anacan/health`. Native side: Android
// `HealthReadsPlugin.kt` (Health Connect), iOS `HealthReadsChannel.swift` (HealthKit). Arguments and answers keep
// the plugin's shapes ({available}, {permissions: {READ_X: bool}}, {aggregatedData: [...]}, {workouts: [...]}),
// so HealthService reads them exactly as health.ts did. As with Capacitor, a rejected call throws
// (PlatformException / MissingPluginException) and HealthService turns it into "unavailable" / an empty read.
import 'package:flutter/services.dart';

import '../../features/settings/data/health_service.dart' show HealthPluginBridge;

Map<String, Object?> _map(Object? value) =>
    value is Map ? {for (final e in value.entries) '${e.key}': e.value} : <String, Object?>{};

List<Map<String, Object?>> _list(Object? value) => value is List ? [for (final v in value) if (v is Map) _map(v)] : const [];

Map<String, bool> _permissions(Object? res) => {for (final e in _map(_map(res)['permissions']).entries) e.key: e.value == true};

class MethodChannelHealth implements HealthPluginBridge {
  const MethodChannelHealth({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/health';
  final MethodChannel _channel;

  @override
  Future<bool> isHealthAvailable() async => _map(await _channel.invokeMethod<Object?>('isHealthAvailable'))['available'] == true;

  @override
  Future<Map<String, bool>> checkHealthPermissions(List<String> permissions) async =>
      _permissions(await _channel.invokeMethod<Object?>('checkHealthPermissions', <String, Object?>{'permissions': permissions}));

  @override
  Future<Map<String, bool>> requestHealthPermissions(List<String> permissions) async =>
      _permissions(await _channel.invokeMethod<Object?>('requestHealthPermissions', <String, Object?>{'permissions': permissions}));

  @override
  Future<List<Map<String, Object?>>> queryAggregated(
      {required String startDate, required String endDate, required String dataType, String bucket = 'day'}) async {
    final res = await _channel.invokeMethod<Object?>('queryAggregated',
        <String, Object?>{'startDate': startDate, 'endDate': endDate, 'dataType': dataType, 'bucket': bucket});
    return _list(_map(res)['aggregatedData']);
  }

  @override
  Future<List<Map<String, Object?>>> queryWorkouts({required String startDate, required String endDate}) async {
    final res = await _channel.invokeMethod<Object?>('queryWorkouts', <String, Object?>{
      'startDate': startDate,
      'endDate': endDate,
      'includeHeartRate': false,
      'includeRoute': false,
      'includeSteps': false,
    });
    return _list(_map(res)['workouts']);
  }

  @override
  Future<void> openAppleHealthSettings() => _channel.invokeMethod<void>('openAppleHealthSettings');

  @override
  Future<void> openHealthConnectSettings() => _channel.invokeMethod<void>('openHealthConnectSettings');

  @override
  Future<void> showHealthConnectInPlayStore() => _channel.invokeMethod<void>('showHealthConnectInPlayStore');
}
