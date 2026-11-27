// Ported from: src/lib/appLock.ts, src/lib/lock-offer.ts
//
// Device-level app lock. The PIN is never stored: `anacan_lock_hash` = hex(SHA-256(utf8("<salt>:<pin>:anacan")))
// with `anacan_lock_salt` = 16 random bytes as lower-case hex — byte-compatible with the Capacitor app, so a PIN
// set there (and imported into LocalStore) unlocks here. Keys: anacan_lock_enabled ('1'), _hash, _salt, _bio ('1'),
// _last_bg (ms timestamp). Re-lock after more than 30 s in the background.
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import '../../state/state.dart';

const String kLockEnabled = 'anacan_lock_enabled';
const String kLockHash = 'anacan_lock_hash';
const String kLockSalt = 'anacan_lock_salt';
const String kLockBio = 'anacan_lock_bio';
const String kLockLastBg = 'anacan_lock_last_bg';
const String kLockOfferSeen = 'anacan.lockOffer.seenAt';

/// Arxa fonda bu qədərdən çox qalanda qayıdışda yenidən kilidlənir.
const Duration kBackgroundLock = Duration(milliseconds: 30000);
const int kPinLength = 4;

String _hex(List<int> bytes) => bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();

/// `hashPin(pin, salt)`.
String hashPin(String pin, String salt) => _hex(sha256.convert(utf8.encode('$salt:$pin:anacan')).bytes);

/// Biometrics (`@capgo/capacitor-native-biometric` → local_auth).
abstract interface class BiometricAuth {
  Future<bool> isAvailable();

  /// Shows the OS prompt; true on success.
  Future<bool> verify({required String reason, required String title});
}

/// local_auth implementation (native only; any error → unavailable / false).
class LocalAuthBiometric implements BiometricAuth {
  LocalAuthBiometric({LocalAuthentication? auth, this.onPromptStart, this.onPromptEnd}) : _auth = auth ?? LocalAuthentication();
  final LocalAuthentication _auth;

  /// ScreenshotGuard curtain suspension around the Face ID sheet (see screen_capture_guard.dart).
  final Future<void> Function()? onPromptStart;
  final Future<void> Function()? onPromptEnd;

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
      return await _auth.authenticate(localizedReason: reason, biometricOnly: true);
    } catch (_) {
      return false;
    } finally {
      Future<void>.delayed(const Duration(milliseconds: 400), () async {
        try {
          await onPromptEnd?.call();
        } catch (_) {}
      });
    }
  }
}

final biometricAuthProvider = Provider<BiometricAuth>((ref) => LocalAuthBiometric());

/// Whether the app runs natively (Capacitor.isNativePlatform). Always true in the Flutter app; tests override.
final isNativePlatformProvider = Provider<bool>((ref) => !kIsWeb);

/// appLock.ts on LocalStore.
class AppLock {
  AppLock(this.store, {int Function()? now, Random? random})
      : _now = now ?? (() => DateTime.now().millisecondsSinceEpoch),
        _random = random ?? Random.secure();
  final LocalStore store;
  final int Function() _now;
  final Random _random;

  String _randomSalt() => _hex(List<int>.generate(16, (_) => _random.nextInt(256)));

  bool isLockEnabled() => store.getItem(kLockEnabled) == '1' && (store.getItem(kLockHash) ?? '').isNotEmpty;

  void setPin(String pin) {
    final salt = _randomSalt();
    store.setItem(kLockSalt, salt);
    store.setItem(kLockHash, hashPin(pin, salt));
    store.setItem(kLockEnabled, '1');
  }

  bool verifyPin(String pin) {
    final salt = store.getItem(kLockSalt);
    final stored = store.getItem(kLockHash);
    if (salt == null || salt.isEmpty || stored == null || stored.isEmpty) return false;
    return hashPin(pin, salt) == stored;
  }

  void disableLock() {
    for (final k in const [kLockEnabled, kLockHash, kLockSalt, kLockBio, kLockLastBg]) {
      store.removeItem(k);
    }
  }

  bool isBiometricPrefEnabled() => store.getItem(kLockBio) == '1';

  void setBiometricPref(bool enabled) => enabled ? store.setItem(kLockBio, '1') : store.removeItem(kLockBio);

  void markBackgrounded() => store.setItem(kLockLastBg, '${_now()}');

  bool shouldRelock() {
    if (!isLockEnabled()) return false;
    final ts = num.tryParse(store.getItem(kLockLastBg) ?? '') ?? 0;
    if (ts == 0) return false;
    return _now() - ts > kBackgroundLock.inMilliseconds;
  }

  void clearBackgroundMark() => store.removeItem(kLockLastBg);

  /// `shouldOfferLock()` (lock-offer.ts).
  bool shouldOfferLock({required bool isNative}) {
    if (!isNative || isLockEnabled()) return false;
    return store.getItem(kLockOfferSeen) == null;
  }

  void markLockOfferSeen() => store.setItem(kLockOfferSeen, '${_now()}');
}

final appLockProvider = Provider<AppLock>((ref) => AppLock(ref.watch(localStoreProvider)));
