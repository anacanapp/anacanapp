// Ported from: src/App.tsx (LITE_DEVICE = isLowEndDevice() || IS_ANDROID → html.a-lite, MotionConfig
//              reducedMotion 'always'; IS_ANDROID → html.a-noblur), src/lib/device-tier.ts
//
// Probe (DeviceInfoHardwareProbe):
//   cores  = Platform.numberOfProcessors (navigator.hardwareConcurrency; available on every platform).
//   memory = device_info_plus `physicalRamSize` (MB), turned into `navigator.deviceMemory` the way Chromium
//            does (nearest power of two in GiB, clamped to 0.25…8) — Android only. iOS WKWebView has no
//            `navigator.deviceMemory`, so iOS reports no memory (only cores count, as in the WebView).
//   A failing plugin call → memory unknown (never counts as low-end), cores still from dart:io.
// Android is lite and noBlur regardless of the probe (React forces both for any Android), so the probe only
// changes the outcome on iOS.
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../design/device_tier.dart';

/// `html.a-lite` / `html.a-noblur` for this process.
@immutable
class DeviceTier {
  const DeviceTier({required this.lite, required this.noBlur});
  final bool lite;
  final bool noBlur;

  /// Before the probe: Android is known synchronously, iOS starts as not-lite.
  static DeviceTier initial({required bool android}) =>
      DeviceTier(lite: android, noBlur: android);

  /// `LITE_DEVICE = isLowEndDevice() || IS_ANDROID`; `a-noblur` = IS_ANDROID.
  static DeviceTier resolve({
    required bool android,
    required DeviceHardware hardware,
  }) => DeviceTier(lite: android || isLowEndDevice(hardware), noBlur: android);

  @override
  bool operator ==(Object other) =>
      other is DeviceTier && other.lite == lite && other.noBlur == noBlur;
  @override
  int get hashCode => Object.hash(lite, noBlur);
  @override
  String toString() => 'DeviceTier(lite: $lite, noBlur: $noBlur)';
}

/// Chromium `ApproximatedDeviceMemory`: physical MB → nearest power of two (GiB), clamped to [0.25, 8].
double approximateDeviceMemoryGb(int physicalMb) {
  if (physicalMb <= 0) return 0;
  final lower = 1 << (physicalMb.bitLength - 1);
  final upper = lower << 1;
  // Chromium keeps the two most significant bits: 0b11… rounds up, 0b10… rounds down (tie → up).
  final nearest = (physicalMb - lower) < (upper - physicalMb) ? lower : upper;
  return math.min(8, math.max(0.25, nearest / 1024));
}

/// Real probe: dart:io cores + device_info_plus RAM.
class DeviceInfoHardwareProbe implements DeviceHardwareProbe {
  DeviceInfoHardwareProbe({DeviceInfoPlugin? plugin})
    : _plugin = plugin ?? DeviceInfoPlugin();
  final DeviceInfoPlugin _plugin;

  @override
  Future<DeviceHardware> probe() async {
    if (kIsWeb) return const DeviceHardware();
    final cores = Platform.numberOfProcessors;
    double? memory;
    if (Platform.isAndroid) {
      try {
        final info = await _plugin.androidInfo;
        memory = approximateDeviceMemoryGb(info.physicalRamSize);
      } catch (_) {
        memory = null;
      }
    }
    return DeviceHardware(cores: cores, memoryGb: memory);
  }
}

bool get _isAndroid =>
    !kIsWeb &&
    defaultTargetPlatform == TargetPlatform.android &&
    Platform.isAndroid;

/// The device tier; the app root resolves it once at startup ([DeviceTierController.probe]).
final deviceTierProvider = NotifierProvider<DeviceTierController, DeviceTier>(
  DeviceTierController.new,
);

class DeviceTierController extends Notifier<DeviceTier> {
  @override
  DeviceTier build() => DeviceTier.initial(android: _isAndroid);

  /// Computed once (the web value never changes during a session).
  Future<void> probe(DeviceHardwareProbe probe, {bool? android}) async {
    final isAndroid = android ?? _isAndroid;
    DeviceHardware hw;
    try {
      hw = await probe.probe();
    } catch (_) {
      hw = const DeviceHardware();
    }
    state = DeviceTier.resolve(android: isAndroid, hardware: hw);
  }

  /// Tests / previews.
  void set(DeviceTier tier) => state = tier;
}

/// The probe the root uses (override in tests).
final deviceHardwareProbeProvider = Provider<DeviceHardwareProbe>(
  (ref) => DeviceInfoHardwareProbe(),
);

/// `liteModeProvider` override: the design layer reads lite from here.
final appLiteModeProvider = Provider<bool>(
  (ref) => ref.watch(deviceTierProvider).lite,
);
