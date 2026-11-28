// Ported from: src/lib/healthCycle.ts (registerPlugin('HealthCycle')), src/lib/healthVitals.ts
//              (registerPlugin('HealthVitals'))
//
// The two local Health plugins over method channels: `anacan/health_cycle` and `anacan/health_vitals`. Native side:
// Android `HealthPlugins.kt` (Health Connect), iOS `HealthChannels.swift` (HealthKit). As with Capacitor, a
// rejected call throws (PlatformException) and HealthService turns it into "unavailable" / a failed write.
//
// The capacitor-health `Health` plugin (steps / workouts / mindfulness reads, settings shortcuts) is
// health_reads_channel.dart (`anacan/health`).
import 'package:flutter/services.dart';

import '../../domain/cycle/health_cycle.dart' show MenstruationWrite;
import '../../features/settings/data/health_service.dart' show HealthCyclePluginBridge, HealthVitalsPluginBridge;

bool _granted(Object? res) => res is Map && res['granted'] == true;

/// `HealthCycle`: isAvailable -> {available, apiVersion}, requestWritePermission -> {granted},
/// writeMenstruation {startDate, endDate, flow, cycleStart}.
class MethodChannelHealthCycle implements HealthCyclePluginBridge {
  const MethodChannelHealthCycle({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/health_cycle';
  final MethodChannel _channel;

  @override
  Future<({bool available, int? apiVersion})> isAvailable() async {
    final res = await _channel.invokeMethod<Object?>('isAvailable');
    if (res is! Map) return (available: false, apiVersion: null);
    final version = res['apiVersion'];
    return (available: res['available'] == true, apiVersion: version is num ? version.toInt() : null);
  }

  @override
  Future<bool> requestWritePermission() async => _granted(await _channel.invokeMethod<Object?>('requestWritePermission'));

  @override
  Future<void> writeMenstruation(MenstruationWrite write) => _channel.invokeMethod<void>('writeMenstruation', write.toJson());
}

/// `HealthVitals`: isAvailable -> {available}, requestWritePermission -> {granted}, writeWeight / writeBloodPressure /
/// writeBloodGlucose.
class MethodChannelHealthVitals implements HealthVitalsPluginBridge {
  const MethodChannelHealthVitals({MethodChannel? channel}) : _channel = channel ?? const MethodChannel(channelName);

  static const String channelName = 'anacan/health_vitals';
  final MethodChannel _channel;

  @override
  Future<bool> isAvailable() async {
    final res = await _channel.invokeMethod<Object?>('isAvailable');
    return res is Map && res['available'] == true;
  }

  @override
  Future<bool> requestWritePermission() async => _granted(await _channel.invokeMethod<Object?>('requestWritePermission'));

  @override
  Future<void> writeWeight({required double kg, String? date}) =>
      _channel.invokeMethod<void>('writeWeight', <String, Object?>{'kg': kg, 'date': ?date});

  @override
  Future<void> writeBloodPressure({required double systolic, required double diastolic, String? date}) =>
      _channel.invokeMethod<void>(
          'writeBloodPressure', <String, Object?>{'systolic': systolic, 'diastolic': diastolic, 'date': ?date});

  @override
  Future<void> writeBloodGlucose({required double mgdl, String? date}) =>
      _channel.invokeMethod<void>('writeBloodGlucose', <String, Object?>{'mgdl': mgdl, 'date': ?date});
}
