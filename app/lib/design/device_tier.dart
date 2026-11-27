// Ported from: src/lib/device-tier.ts
// (html.a-lite is set in src/App.tsx from isLowEndDevice(); see anacan-design.css "Zəif cihaz")
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Hardware facts used for the tier decision. `null` = unknown (the web API was missing).
class DeviceHardware {
  const DeviceHardware({this.cores, this.memoryGb});

  /// `navigator.hardwareConcurrency` equivalent.
  final int? cores;

  /// `navigator.deviceMemory` equivalent (GB; the web API rounds to 0.25/0.5/1/2/4/8).
  final double? memoryGb;
}

/// Pure port of `isLowEndDevice()`: ≤4 cores **or** ≤4 GB RAM; unknown/0 values never count.
bool isLowEndDevice(DeviceHardware hw) {
  final cores = hw.cores;
  final memory = hw.memoryGb;
  return (cores != null && cores > 0 && cores <= 4) || (memory != null && memory > 0 && memory <= 4);
}

/// Native probe for core count and RAM.
///
/// TODO(native): implement with a MethodChannel (Android: Runtime.availableProcessors +
/// ActivityManager.MemoryInfo.totalMem; iOS: ProcessInfo.activeProcessorCount/physicalMemory).
/// Note the web reports `deviceMemory` capped at 8 and bucketed; the native value is exact.
abstract interface class DeviceHardwareProbe {
  Future<DeviceHardware> probe();
}

/// Probe that reports nothing (→ not lite), used until the native probe exists.
class UnknownHardwareProbe implements DeviceHardwareProbe {
  const UnknownHardwareProbe();
  @override
  Future<DeviceHardware> probe() async => const DeviceHardware();
}

/// `html.a-lite`. Computed once at startup (the web value never changes during a session):
/// override in `ProviderScope(overrides: [liteModeProvider.overrideWithValue(isLowEndDevice(hw))])`.
final liteModeProvider = Provider<bool>((ref) => false);
