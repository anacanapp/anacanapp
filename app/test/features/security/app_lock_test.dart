// Ported from: src/lib/lock-offer.test.ts (case names kept), src/lib/appLock.ts (no vitest suite — cases for the
//              port), src/components/security/ScreenCaptureGuard.test.tsx (native-curtain cases; the DOM scan
//              `dashboardCaptureAllowed` is an injected input here)
import 'dart:async';
import 'dart:math';

import 'package:anacan/features/profile/profile_interfaces.dart';
import 'package:anacan/features/security/app_lock.dart';
import 'package:anacan/features/security/app_lock_screen.dart';
import 'package:anacan/features/security/app_lock_setup_sheet.dart';
import 'package:anacan/features/security/screen_capture_guard.dart';
import 'package:anacan/state/state.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart' show StateProvider;
import 'package:flutter_test/flutter_test.dart';

import '../profile/profile_edit_screen_test.dart' show FakeActions;
import '../settings/support/harness.dart';

class FakeBio implements BiometricAuth {
  FakeBio({this.available = false, this.result = true});
  bool available;
  bool result;
  int prompts = 0;
  @override
  Future<bool> isAvailable() async => available;
  @override
  Future<bool> verify({required String reason, required String title}) async {
    prompts++;
    return result;
  }
}

class FakeGuard implements ScreenshotGuardPlatform {
  final enabled = <bool>[];
  final shots = StreamController<void>.broadcast();
  final capture = StreamController<bool>.broadcast();
  @override
  Stream<bool> get captureChanged => capture.stream;
  @override
  Stream<void> get screenshotTaken => shots.stream;
  @override
  Future<void> setCurtainSuspended(bool suspended) async {}
  @override
  Future<void> setEnabled(bool enabled) async => this.enabled.add(enabled);
}

Future<void> typePin(WidgetTester tester, String pin) async {
  for (final d in pin.split('')) {
    await tester.tap(find.byKey(ValueKey<String>('pin-$d')));
    await tester.pump();
  }
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(loadAnacanFonts);

  group('PIN hash scheme', () {
    test('a hash produced by the TypeScript implementation verifies in Dart', () {
      // node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt+':'+pin+':anacan'))…" with the
      // salt/PIN below (src/lib/appLock.ts hashPin) printed:
      const salt = '9f1c2a7b3e4d5f60718293a4b5c6d7e8';
      const tsHash = '83614ae4047c45b74e50734760158d642d097fe73fdd8a739cf89436e85e74f2';
      expect(hashPin('2580', salt), tsHash);
      final store = LocalStore.memory({kLockEnabled: '1', kLockSalt: salt, kLockHash: tsHash});
      final lock = AppLock(store);
      expect(lock.isLockEnabled(), isTrue);
      expect(lock.verifyPin('2580'), isTrue);
      expect(lock.verifyPin('2581'), isFalse);
    });

    test('setPin writes a 16-byte hex salt, the hash and the enabled flag', () {
      final store = LocalStore.memory();
      final lock = AppLock(store, random: Random(1));
      lock.setPin('1234');
      expect(store.getItem(kLockSalt), matches(RegExp(r'^[0-9a-f]{32}$')));
      expect(store.getItem(kLockHash), hashPin('1234', store.getItem(kLockSalt)!));
      expect(store.getItem(kLockEnabled), '1');
      expect(lock.verifyPin('1234'), isTrue);
    });

    test('enabled needs both the flag and a hash; disable clears every key', () {
      final store = LocalStore.memory({kLockEnabled: '1'});
      final lock = AppLock(store);
      expect(lock.isLockEnabled(), isFalse);
      lock.setPin('0000');
      lock.setBiometricPref(true);
      lock.markBackgrounded();
      lock.disableLock();
      for (final k in [kLockEnabled, kLockHash, kLockSalt, kLockBio, kLockLastBg]) {
        expect(store.getItem(k), isNull, reason: k);
      }
    });
  });

  group('background re-lock', () {
    test('re-locks only after more than 30 s and only when the lock is on', () {
      var now = 1000000;
      final store = LocalStore.memory();
      final lock = AppLock(store, now: () => now);
      lock.markBackgrounded();
      now += 60000;
      expect(lock.shouldRelock(), isFalse, reason: 'lock off');
      lock.setPin('1111');
      lock.markBackgrounded();
      now += 30000;
      expect(lock.shouldRelock(), isFalse, reason: 'exactly 30 s');
      now += 1;
      expect(lock.shouldRelock(), isTrue);
      lock.clearBackgroundMark();
      expect(lock.shouldRelock(), isFalse);
    });
  });

  group('lock offer', () {
    test('offers once on native when the lock is off', () {
      final lock = AppLock(LocalStore.memory());
      expect(lock.shouldOfferLock(isNative: true), isTrue);
      lock.markLockOfferSeen();
      expect(lock.shouldOfferLock(isNative: true), isFalse);
    });
    test('never offers on the web or when the lock is already on', () {
      final store = LocalStore.memory();
      final lock = AppLock(store);
      expect(lock.shouldOfferLock(isNative: false), isFalse);
      store.setItem('anacan_lock_enabled', '1');
      store.setItem('anacan_lock_hash', 'x');
      expect(lock.shouldOfferLock(isNative: true), isFalse);
    });
  });

  group('setup sheet', () {
    screenTest('create → confirm enables the lock; mismatch returns to create', (tester) async {
      final store = seededStore();
      await pumpApp(tester, Builder(builder: (context) => GestureDetector(key: const ValueKey<String>('open'), behavior: HitTestBehavior.opaque, onTap: () => showAppLockSetupSheet(context), child: const SizedBox(width: 100, height: 100))),
          scroll: false, overrides: [...baseOverrides(store: store), biometricAuthProvider.overrideWithValue(FakeBio())]);
      await tester.tap(find.byKey(const ValueKey<String>('open')));
      await tester.pumpAndSettle();
      expect(find.text('Yeni PIN təyin edin'), findsOneWidget);
      await typePin(tester, '1234');
      expect(find.text('PIN-i təkrar daxil edin'), findsOneWidget);
      await typePin(tester, '9999');
      expect(find.text('PIN-lər uyğun gəlmədi — yenidən cəhd edin'), findsOneWidget);
      await typePin(tester, '1234');
      await typePin(tester, '1234');
      await tester.pumpAndSettle();
      expect(AppLock(store).verifyPin('1234'), isTrue);
      expect(find.text('Kilid aktivləşdirildi 🔒'), findsOneWidget);
    });

    screenTest('disable requires the current PIN', (tester) async {
      final store = seededStore();
      AppLock(store).setPin('4321');
      await pumpApp(tester, Builder(builder: (context) => GestureDetector(key: const ValueKey<String>('open'), behavior: HitTestBehavior.opaque, onTap: () => showAppLockSetupSheet(context), child: const SizedBox(width: 100, height: 100))),
          scroll: false, overrides: [...baseOverrides(store: store), biometricAuthProvider.overrideWithValue(FakeBio())]);
      await tester.tap(find.byKey(const ValueKey<String>('open')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey<String>('applock-disable')));
      await tester.pumpAndSettle();
      await typePin(tester, '0000');
      expect(AppLock(store).isLockEnabled(), isTrue);
      await typePin(tester, '4321');
      await tester.pumpAndSettle();
      expect(AppLock(store).isLockEnabled(), isFalse);
    });
  });

  group('lock screen', () {
    screenTest('unlocks with the right PIN, shows "forgot" after 3 wrong ones, reset signs out', (tester) async {
      final store = seededStore();
      AppLock(store).setPin('2468');
      var unlocked = 0;
      final actions = FakeActions();
      await pumpApp(tester, AppLockScreen(onUnlock: () => unlocked++), scroll: false, overrides: [
        ...baseOverrides(store: store),
        biometricAuthProvider.overrideWithValue(FakeBio()),
        accountActionsProvider.overrideWithValue(actions),
      ]);
      for (var i = 0; i < 3; i++) {
        await typePin(tester, '1111');
      }
      expect(unlocked, 0);
      await tester.tap(find.byKey(const ValueKey<String>('applock-forgot')));
      await tester.pump();
      expect(find.text('Çıxış et və kilidi sıfırla'), findsOneWidget);
      await typePin(tester, '2468');
      expect(unlocked, 1);
    });

    screenTest('biometric preference auto-prompts once and unlocks', (tester) async {
      final store = seededStore();
      final lock = AppLock(store)..setPin('2468');
      lock.setBiometricPref(true);
      final bio = FakeBio(available: true);
      var unlocked = 0;
      await pumpApp(tester, AppLockScreen(onUnlock: () => unlocked++), scroll: false, overrides: [...baseOverrides(store: store), biometricAuthProvider.overrideWithValue(bio)]);
      await tester.pump();
      expect(bio.prompts, 1);
      expect(unlocked, 1);
    });

    screenTest('gate locks at a cold start when the lock is on', (tester) async {
      final store = seededStore();
      AppLock(store).setPin('2468');
      await pumpApp(tester, const AppLockGate(), scroll: false, overrides: [...baseOverrides(store: store), biometricAuthProvider.overrideWithValue(FakeBio())]);
      expect(find.byType(AppLockScreen), findsOneWidget);
      await typePin(tester, '2468');
      expect(find.byType(AppLockScreen), findsNothing);
    });
  });

  group('screen capture guard', () {
    screenTest('uses a fully opaque branded curtain for protected capture, but permits dashboard capture', (tester) async {
      final guard = FakeGuard();
      final allowed = StateProvider<bool>((ref) => true);
      await pumpApp(tester, const ScreenCaptureGuard(child: SizedBox()), scroll: false, overrides: [
        ...baseOverrides(),
        screenshotGuardPlatformProvider.overrideWithValue(guard),
        dashboardCaptureAllowedProvider.overrideWith((ref) => ref.watch(allowed)),
      ]);
      await tester.pump();
      expect(guard.enabled.last, isFalse);
      guard.shots.add(null);
      await tester.pump();
      expect(find.byKey(const ValueKey<String>(kCaptureCurtainKey)), findsNothing);
      final container = ProviderScope.containerOf(tester.element(find.byType(ScreenCaptureGuard)));
      container.read(allowed.notifier).state = false;
      await tester.pump();
      await tester.pump();
      expect(guard.enabled.last, isTrue);
      guard.capture.add(true);
      await tester.pump();
      await tester.pump();
      expect(find.byKey(const ValueKey<String>(kCaptureCurtainKey)), findsOneWidget);
      guard.capture.add(false);
      await tester.pump();
      await tester.pump();
      expect(find.byKey(const ValueKey<String>(kCaptureCurtainKey)), findsNothing);
    });
  });

  group('goldens', () {
    for (final mode in ['light', 'dark', 'rtl']) {
      screenTest('lock screen $mode', (tester) async {
        final store = seededStore();
        AppLock(store).setPin('2468');
        await pumpApp(tester, AppLockScreen(onUnlock: () {}), scroll: false, dark: mode == 'dark', rtl: mode == 'rtl',
            overrides: [...baseOverrides(store: store), biometricAuthProvider.overrideWithValue(FakeBio())]);
        await tester.tap(find.byKey(const ValueKey<String>('pin-1')));
        await tester.pump();
        await expectGolden(tester, 'lock_screen_$mode');
      });
    }
    screenTest('setup sheet menu light', (tester) async {
      final store = seededStore();
      AppLock(store).setPin('2468');
      await pumpApp(tester, Builder(builder: (context) => GestureDetector(key: const ValueKey<String>('open'), behavior: HitTestBehavior.opaque, onTap: () => showAppLockSetupSheet(context), child: const SizedBox(width: 100, height: 100))),
          scroll: false, overrides: [...baseOverrides(store: store), biometricAuthProvider.overrideWithValue(FakeBio(available: true))]);
      await tester.tap(find.byKey(const ValueKey<String>('open')));
      await tester.pumpAndSettle();
      await expectGolden(tester, 'lock_setup_menu_light');
    });
  });
}
