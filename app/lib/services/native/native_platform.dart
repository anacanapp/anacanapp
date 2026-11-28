// Ported from: src/lib/native.ts (isNative, isIOS, isAndroid, hapticFeedback)
//
// Platform checks of the WebView build. `isNative` was `Capacitor.isNativePlatform()`: true inside the iOS / Android
// app, false on the web. The Flutter app is native on iOS and Android; anything else (tests on a desktop host, web)
// is treated as the web build. Haptics use Flutter's own HapticFeedback (no plugin needed).
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

@immutable
class NativePlatform {
  const NativePlatform({required this.platform});

  /// The platform of this process: 'ios' | 'android' | 'web'.
  factory NativePlatform.current() {
    if (kIsWeb) return const NativePlatform(platform: 'web');
    return switch (defaultTargetPlatform) {
      TargetPlatform.iOS => const NativePlatform(platform: 'ios'),
      TargetPlatform.android => const NativePlatform(platform: 'android'),
      _ => const NativePlatform(platform: 'web'),
    };
  }

  /// `Capacitor.getPlatform()`.
  final String platform;

  /// `Capacitor.isNativePlatform()`.
  bool get isNative => platform == 'ios' || platform == 'android';
  bool get isIOS => platform == 'ios';
  bool get isAndroid => platform == 'android';

  @override
  bool operator ==(Object other) => other is NativePlatform && other.platform == platform;
  @override
  int get hashCode => platform.hashCode;
}

final nativePlatformProvider = Provider<NativePlatform>((ref) => NativePlatform.current(), name: 'nativePlatformProvider');

/// `hapticFeedback` of lib/native.ts: impacts only inside the native app.
class NativeHaptics {
  const NativeHaptics(this.platform);
  final NativePlatform platform;

  Future<void> light() async {
    if (platform.isNative) await HapticFeedback.lightImpact();
  }

  Future<void> medium() async {
    if (platform.isNative) await HapticFeedback.mediumImpact();
  }

  Future<void> heavy() async {
    if (platform.isNative) await HapticFeedback.heavyImpact();
  }

  Future<void> vibrate() async {
    if (platform.isNative) await HapticFeedback.vibrate();
  }
}

final nativeHapticsProvider = Provider<NativeHaptics>((ref) => NativeHaptics(ref.watch(nativePlatformProvider)));
