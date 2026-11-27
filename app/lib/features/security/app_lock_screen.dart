// Ported from: src/components/security/AppLockScreen.tsx, src/components/security/AppLockGate.tsx
//
// Full-screen lock (cold start with the lock on; back from > 30 s in the background). PIN + biometrics (auto-tried
// once). After 3 wrong PINs "forgot" → reset the lock and sign out.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart' show Material, MaterialType;

import '../../core/auth/auth.dart';
import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../profile/profile_interfaces.dart';
import '../settings/ui/settings_ui.dart';
import 'app_lock.dart';
import 'pin_pad.dart';

const int kMaxAttemptsBeforeHint = 3;

/// What "forgot PIN" does after the lock is reset: sign out (the web reloads the page).
final appLockForgotActionProvider = Provider<Future<void> Function()>((ref) => () async {
      try {
        await ref.read(accountActionsProvider).signOut();
      } catch (_) {}
    });

class AppLockScreen extends ConsumerStatefulWidget {
  const AppLockScreen({super.key, required this.onUnlock});
  final VoidCallback onUnlock;
  @override
  ConsumerState<AppLockScreen> createState() => _AppLockScreenState();
}

class _AppLockScreenState extends ConsumerState<AppLockScreen> {
  bool _bioReady = false;
  int _attempts = 0;
  bool _confirmForgot = false;
  bool _bioTried = false;

  @override
  void initState() {
    super.initState();
    unawaited(_tryBiometric());
  }

  void _unlock() {
    ref.read(appLockProvider).clearBackgroundMark();
    widget.onUnlock();
  }

  String get _reason => tr('applock_bio_reason', 'Tətbiqi açmaq üçün kimliyinizi təsdiqləyin');
  String get _title => tr('applock_bio_title', 'Anacan kilidi');

  Future<void> _tryBiometric() async {
    final lock = ref.read(appLockProvider);
    if (!lock.isBiometricPrefEnabled()) return;
    final bio = ref.read(biometricAuthProvider);
    final available = await bio.isAvailable();
    if (!mounted || !available) return;
    setState(() => _bioReady = true);
    if (!_bioTried) {
      _bioTried = true;
      final ok = await bio.verify(reason: _reason, title: _title);
      if (mounted && ok) _unlock();
    }
  }

  bool _handlePin(String pin) {
    if (ref.read(appLockProvider).verifyPin(pin)) {
      _unlock();
      return true;
    }
    setState(() => _attempts++);
    return false;
  }

  Future<void> _handleBiometric() async {
    final ok = await ref.read(biometricAuthProvider).verify(reason: _reason, title: _title);
    if (ok && mounted) _unlock();
  }

  Future<void> _handleForgot() async {
    ref.read(appLockProvider).disableLock();
    await ref.read(appLockForgotActionProvider)();
    if (mounted) widget.onUnlock();
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final user = ref.watch(authUserProvider);
    final mq = MediaQuery.of(context);
    return AScope(
      child: Material(
        type: MaterialType.transparency,
        child: ColoredBox(
          color: a.bg,
          child: Stack(children: <Widget>[
            const Positioned(top: 0, left: 0, right: 0, child: ASky()),
            Positioned.fill(
              child: Padding(
                padding: EdgeInsets.fromLTRB(24, mq.padding.top, 24, mq.padding.bottom + 20),
                child: Center(
                  child: SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, children: <Widget>[
                      Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: FadeRise(
                          dy: 0,
                          scaleFrom: 0.85,
                          child: Stack(clipBehavior: Clip.none, children: <Widget>[
                            Container(
                              width: 64,
                              height: 64,
                              clipBehavior: Clip.antiAlias,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                gradient: a.gradPeach,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x80D96C4A), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12)],
                              ),
                              child: Image.asset('assets/images/brand-mark.png', width: 40, height: 40, fit: BoxFit.contain),
                            ),
                            PositionedDirectional(
                              bottom: -6,
                              end: -6,
                              child: Container(
                                width: 28,
                                height: 28,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(color: a.surface, shape: BoxShape.circle, boxShadow: a.cardShadow),
                                child: AIcon(AIcons.lock, size: 13, color: a.accentInk),
                              ),
                            ),
                          ]),
                        ),
                      ),
                      Text(tr('applock_title', 'Tətbiq kilidlidir'), textAlign: TextAlign.center, style: px(20, weight: FontWeight.w800, color: a.ink, ls: -0.01)),
                      Padding(
                        padding: const EdgeInsets.only(top: 4, bottom: 32),
                        child: Text(tr('applock_subtitle', 'Davam etmək üçün PIN daxil edin'), textAlign: TextAlign.center, style: px(12.5, color: a.inkSoft)),
                      ),
                      PinPad(onComplete: _handlePin, showBiometric: _bioReady, onBiometric: _handleBiometric),
                      const SizedBox(height: 32),
                      ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 44),
                        child: Column(children: <Widget>[
                          if (_attempts >= kMaxAttemptsBeforeHint && !_confirmForgot)
                            GestureDetector(
                              key: const ValueKey<String>('applock-forgot'),
                              onTap: () => setState(() => _confirmForgot = true),
                              child: Text(tr('applock_forgot', 'PIN-i unutmusunuz?'), style: px(12.5, weight: FontWeight.w600, color: a.inkSoft)),
                            ),
                          if (_confirmForgot)
                            FadeRise(
                              dy: 6,
                              child: Column(children: <Widget>[
                                ConstrainedBox(
                                  constraints: const BoxConstraints(maxWidth: 260),
                                  child: Text(
                                    tr('applock_forgot_desc', 'Kilid sıfırlanacaq və hesabdan çıxacaqsınız. Yenidən daxil olduqdan sonra PIN təyin edə bilərsiniz.'),
                                    textAlign: TextAlign.center,
                                    style: px(11.5, color: a.inkSoft),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                GestureDetector(
                                  key: const ValueKey<String>('applock-reset'),
                                  onTap: _handleForgot,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    decoration: BoxDecoration(gradient: a.alertBg, borderRadius: BorderRadius.circular(999)),
                                    child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
                                      AIcon(AIcons.logOut, size: 14, color: a.alertInk),
                                      const SizedBox(width: 6),
                                      Text(
                                        user != null ? tr('applock_signout_reset', 'Çıxış et və kilidi sıfırla') : tr('applock_reset', 'Kilidi sıfırla'),
                                        style: px(12.5, weight: FontWeight.w700, color: a.alertInk),
                                      ),
                                    ]),
                                  ),
                                ),
                              ]),
                            ),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// App-level gate (mounted once above the app, like `<AppLockGate />` in App.tsx): locked at a cold start when the
/// lock is on; re-locks when the app returns after more than 30 s in the background.
class AppLockGate extends ConsumerStatefulWidget {
  const AppLockGate({super.key});
  @override
  ConsumerState<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends ConsumerState<AppLockGate> {
  late bool _locked = ref.read(appLockProvider).isLockEnabled();
  late final AppLifecycleListener _life = AppLifecycleListener(
    onHide: _background,
    onShow: _foreground,
  );

  void _background() => ref.read(appLockProvider).markBackgrounded();

  void _foreground() {
    final lock = ref.read(appLockProvider);
    if (lock.shouldRelock()) {
      setState(() => _locked = true);
    } else {
      lock.clearBackgroundMark();
    }
  }

  @override
  void initState() {
    super.initState();
    _life;
  }

  @override
  void dispose() {
    _life.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_locked) return const SizedBox.shrink();
    return AppLockScreen(onUnlock: () => setState(() => _locked = false));
  }
}
