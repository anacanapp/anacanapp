// Ported from: src/lib/native.ts (`Capacitor.isNativePlatform()` as the plugin gate)
//
// Whether this process really runs inside the iOS / Android app. Plugin-backed providers use it to pick the native
// implementation; everything else (widget tests on a desktop host, where `defaultTargetPlatform` reports Android,
// and the web) keeps the feature's web default.
import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

bool get isMobileHost {
  if (kIsWeb) return false;
  try {
    return Platform.isAndroid || Platform.isIOS;
  } catch (_) {
    return false;
  }
}

bool get isAndroidHost => isMobileHost && Platform.isAndroid;
bool get isIOSHost => isMobileHost && Platform.isIOS;

Future<int>? _sdkInt;

/// `Build.VERSION.SDK_INT` (0 off Android). The Capacitor plugins branch on it (TIRAMISU, S).
Future<int> androidSdkInt() {
  if (!isAndroidHost) return Future.value(0);
  return _sdkInt ??= DeviceInfoPlugin().androidInfo.then((i) => i.version.sdkInt, onError: (Object _) {
    _sdkInt = null;
    return 0;
  });
}
