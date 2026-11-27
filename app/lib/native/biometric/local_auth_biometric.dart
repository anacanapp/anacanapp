// Ported from: src/lib/appLock.ts (isBiometricAvailable, verifyBiometric → @capgo/capacitor-native-biometric
//              `verifyIdentity({reason, title, maxAttempts: 3})`)
//
// The app lock's biometric prompt over local_auth. iOS: Face ID / Touch ID sheet with `reason` (the plugin passed
// it as `localizedReason`). Android: BiometricPrompt titled with `title` (capgo's `setTitle(title)`), negative
// button "Cancel" like the plugin's default; local_auth also shows `reason` as the description (capgo showed no
// description) and handles attempts itself (no `maxAttempts`). Biometric only (no device-credential fallback),
// as `verifyIdentity` without `useFallback`.
import 'package:flutter/foundation.dart';
import 'package:local_auth/local_auth.dart';
import 'package:local_auth_android/local_auth_android.dart' show AndroidAuthMessages;

import '../../features/security/app_lock.dart' show BiometricAuth;

class LocalAuthBiometricAuth implements BiometricAuth {
  LocalAuthBiometricAuth({LocalAuthentication? auth, this.onPromptStart, this.onPromptEnd})
      : _auth = auth ?? LocalAuthentication();
  final LocalAuthentication _auth;

  /// ScreenshotGuard curtain suspension around the system sheet (the Face ID sheet resigns the app on iOS).
  final Future<void> Function()? onPromptStart;
  final Future<void> Function()? onPromptEnd;

  /// `NativeBiometric.isAvailable()`: hardware present and at least one biometric enrolled.
  @override
  Future<bool> isAvailable() async {
    if (kIsWeb) return false;
    try {
      return await _auth.canCheckBiometrics && (await _auth.getAvailableBiometrics()).isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> verify({required String reason, required String title}) async {
    if (kIsWeb) return false;
    try {
      await onPromptStart?.call();
    } catch (_) {}
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        biometricOnly: true,
        // iOS keeps local_auth_darwin's default messages (the plugin only set the reason).
        authMessages: [AndroidAuthMessages(signInTitle: title, cancelButton: 'Cancel')],
      );
    } catch (_) {
      return false;
    } finally {
      // verifyBiometric: `setTimeout(() => setCurtainSuspended(false), 400)`.
      Future<void>.delayed(const Duration(milliseconds: 400), () async {
        try {
          await onPromptEnd?.call();
        } catch (_) {}
      });
    }
  }
}
