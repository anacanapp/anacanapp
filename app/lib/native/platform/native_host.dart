// Ported from: src/lib/native.ts (`Capacitor.isNativePlatform()`, `Capacitor.getPlatform()`) for the method-channel
//              clients of this folder
//
// The channel clients talk to the app's own Kotlin / Swift code (app/android/app/src/main/kotlin/com/atlasoon/anacan/,
// app/ios/Runner/). [NativeHost.current] reads the real host OS (dart:io), not `defaultTargetPlatform`: flutter_test
// reports Android there, and the channel-backed implementations must stay off in widget tests and desktop runs.
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

@immutable
class NativeHost {
  const NativeHost(this.platform);

  /// 'ios' | 'android' | 'web' (anything that is not the iOS / Android app).
  final String platform;

  static NativeHost current() {
    if (kIsWeb) return const NativeHost('web');
    if (Platform.isAndroid) return const NativeHost('android');
    if (Platform.isIOS) return const NativeHost('ios');
    return const NativeHost('web');
  }

  bool get isNative => platform == 'android' || platform == 'ios';
  bool get isAndroid => platform == 'android';
  bool get isIOS => platform == 'ios';
}
