// Ported from: src/components/security/AppLockSetupSheet.tsx
//
// Lock setup / management sheet (from Settings and the first-run offer). Off → create PIN → confirm → (biometric
// offer) → done. On → menu: biometric toggle · change PIN (verify first) · disable (verify first).
import 'dart:async';

import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../settings/ui/settings_ui.dart';
import 'app_lock.dart';
import 'pin_pad.dart';

enum LockStep { menu, create, confirm, verifyChange, verifyDisable, bioOffer, done }

/// Opens the sheet; [onChanged] runs after the lock state changed (enable / disable / PIN changed + finished).
Future<void> showAppLockSetupSheet(BuildContext context, {VoidCallback? onChanged, bool preferBio = false}) {
  return Navigator.of(context, rootNavigator: true).push<void>(PageRouteBuilder<void>(
    opaque: false,
    barrierDismissible: true,
    barrierColor: const Color(0x73000000),
    barrierLabel: 'applock',
    transitionDuration: const Duration(milliseconds: 800),
    reverseTransitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (ctx, _, _) => Align(alignment: Alignment.bottomCenter, child: AppLockSetupSheet(onClose: () => Navigator.of(ctx).maybePop(), onChanged: onChanged, preferBio: preferBio)),
    transitionsBuilder: (ctx, anim, _, child) => AnimatedBuilder(
      animation: anim,
      builder: (context, c) {
        // spring damping 26 (stiffness 100, mass 1) on y: 100% → 0
        final t = anim.status == AnimationStatus.reverse ? anim.value : _spring(anim.value);
        return FractionalTranslation(translation: Offset(0, 1 - t), child: c);
      },
      child: child,
    ),
  ));
}

/// framer `{ type: 'spring', damping: 26 }` (stiffness 100, mass 1, overdamped) over the route's 800 ms.
final SpringSimulation _sim = SpringSimulation(ASprings.spring(damping: 26), 0, 1, 0);
double _spring(double t) => t >= 1 ? 1 : _sim.x(t * 0.8) / _sim.x(0.8);

class AppLockSetupSheet extends ConsumerStatefulWidget {
  const AppLockSetupSheet({super.key, required this.onClose, this.onChanged, this.preferBio = false});
  final VoidCallback onClose;
  final VoidCallback? onChanged;
  final bool preferBio;
  @override
  ConsumerState<AppLockSetupSheet> createState() => _AppLockSetupSheetState();
}

class _AppLockSetupSheetState extends ConsumerState<AppLockSetupSheet> {
  late LockStep _step = ref.read(appLockProvider).isLockEnabled() ? LockStep.menu : LockStep.create;
  String _firstPin = '';
  bool _bioAvailable = false;
  late bool _bioEnabled = ref.read(appLockProvider).isBiometricPrefEnabled();
  bool _mismatch = false;

  @override
  void initState() {
    super.initState();
    unawaited(ref.read(biometricAuthProvider).isAvailable().then((v) {
      if (mounted) setState(() => _bioAvailable = v);
    }));
  }

  void _finish() {
    widget.onChanged?.call();
    widget.onClose();
  }

  bool _create(String pin) {
    setState(() {
      _firstPin = pin;
      _mismatch = false;
      _step = LockStep.confirm;
    });
    return true;
  }

  Future<bool> _confirm(String pin) async {
    if (pin != _firstPin) {
      setState(() {
        _mismatch = true;
        _step = LockStep.create;
        _firstPin = '';
      });
      return true;
    }
    ref.read(appLockProvider).setPin(pin);
    toasts(context).show(title: tr('applock_enabled_toast', 'Kilid aktivləşdirildi 🔒'));
    if (_bioAvailable && widget.preferBio) {
      await _bioToggle(true);
      _finish();
    } else if (_bioAvailable) {
      setState(() => _step = LockStep.bioOffer);
    } else {
      _finish();
    }
    return true;
  }

  bool _verifyChange(String pin) {
    if (!ref.read(appLockProvider).verifyPin(pin)) return false;
    setState(() {
      _firstPin = '';
      _step = LockStep.create;
    });
    return true;
  }

  bool _verifyDisable(String pin) {
    final lock = ref.read(appLockProvider);
    if (!lock.verifyPin(pin)) return false;
    lock.disableLock();
    toasts(context).show(title: tr('applock_disabled_toast', 'Kilid söndürüldü'));
    _finish();
    return true;
  }

  Future<void> _bioToggle(bool checked) async {
    if (checked) {
      final ok = await ref.read(biometricAuthProvider).verify(
            reason: tr('applock_bio_reason', 'Tətbiqi açmaq üçün kimliyinizi təsdiqləyin'),
            title: tr('applock_bio_title', 'Anacan kilidi'),
          );
      if (!ok) return;
    }
    ref.read(appLockProvider).setBiometricPref(checked);
    if (mounted) setState(() => _bioEnabled = checked);
  }

  String _title() => switch (_step) {
        LockStep.menu => tr('applock_manage_title', 'Tətbiq kilidi'),
        LockStep.create => tr('applock_create_title', 'Yeni PIN təyin edin'),
        LockStep.confirm => tr('applock_confirm_title', 'PIN-i təkrar daxil edin'),
        LockStep.verifyChange || LockStep.verifyDisable => tr('applock_verify_title', 'Cari PIN-i daxil edin'),
        LockStep.bioOffer => tr('applock_bio_offer_title', 'Biometrika ilə açılsın?'),
        LockStep.done => '',
      };

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    Widget menuRow({required String key, required AIconData icon, required Color iconBg, Gradient? iconGrad, required Color iconInk, required String label, String? sub, Color? bg, Gradient? bgGrad, Color? labelColor, Widget? trailing, VoidCallback? onTap}) {
      Widget row = Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(color: bgGrad == null ? (bg ?? a.surfaceSoft) : null, gradient: bgGrad, borderRadius: BorderRadius.circular(16)),
        child: Row(children: <Widget>[
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(13)),
            child: AIcon(icon, size: 17, color: iconInk),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
              Text(label, style: px(13.5, weight: FontWeight.w700, color: labelColor ?? a.ink)),
              if (sub != null) Text(sub, style: px(11, color: a.inkSoft)),
            ]),
          ),
          ?trailing,
        ]),
      );
      if (onTap != null) row = PressScale(key: ValueKey<String>(key), scale: 0.98, onTap: onTap, child: row);
      return row;
    }

    final pinStep = _step == LockStep.create || _step == LockStep.confirm || _step == LockStep.verifyChange || _step == LockStep.verifyDisable;
    return AScope(
      child: Material(
        type: MaterialType.transparency,
        child: Container(
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 380),
          padding: EdgeInsets.fromLTRB(22, 22, 22, (safeBottom == 0 ? 16 : safeBottom) + 22),
          decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(26))),
          child: Stack(clipBehavior: Clip.none, children: <Widget>[
            Positioned(
              top: -10,
              left: 0,
              right: 0,
              child: Center(child: Container(width: 48, height: 6, decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999)))),
            ),
            Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 4),
                child: Row(children: <Widget>[
                  Expanded(child: Text(_title(), style: px(17.5, weight: FontWeight.w800, color: a.ink, ls: -0.01))),
                  AIconBtn(size: 32, radius: 999, semanticLabel: tr('premiummodal_bagla_84bdc9', 'Bağla'), onTap: widget.onClose, icon: const AIcon(AIcons.x, size: 14)),
                ]),
              ),
              if (_step == LockStep.menu)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: VGap(gap: 10, children: <Widget>[
                    if (_bioAvailable)
                      menuRow(
                        key: 'applock-bio-row',
                        icon: AIcons.fingerprint,
                        iconBg: a.lav1,
                        iconInk: a.lavInk,
                        label: tr('applock_bio_row', 'Biometrika ilə aç'),
                        sub: tr('applock_bio_row_sub', 'Face ID / barmaq izi'),
                        trailing: ShadSwitch(key: const ValueKey<String>('applock-bio-switch'), checked: _bioEnabled, checkedColor: a.peach2, onChanged: (v) => unawaited(_bioToggle(v))),
                      ),
                    menuRow(
                      key: 'applock-change',
                      icon: AIcons.keyRound,
                      iconBg: a.blue1,
                      iconInk: a.blueInk,
                      label: tr('applock_change_pin', 'PIN-i dəyiş'),
                      onTap: () => setState(() => _step = LockStep.verifyChange),
                    ),
                    menuRow(
                      key: 'applock-disable',
                      icon: AIcons.shieldOff,
                      iconBg: a.chipOverlay,
                      iconInk: a.alertInk,
                      label: tr('applock_disable', 'Kilidi söndür'),
                      labelColor: a.alertInk,
                      bgGrad: a.alertBg,
                      onTap: () => setState(() => _step = LockStep.verifyDisable),
                    ),
                  ]),
                ),
              if (pinStep)
                Padding(
                  padding: const EdgeInsets.only(top: 20),
                  child: Column(children: <Widget>[
                    if (_mismatch && _step == LockStep.create)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(tr('applock_mismatch', 'PIN-lər uyğun gəlmədi — yenidən cəhd edin'), textAlign: TextAlign.center, style: px(12, weight: FontWeight.w600, color: a.alertInk)),
                      ),
                    Center(
                      child: PinPad(
                        resetKey: '${_step.name}$_mismatch',
                        onComplete: (pin) => switch (_step) {
                          LockStep.create => _create(pin),
                          LockStep.confirm => _confirm(pin),
                          LockStep.verifyChange => _verifyChange(pin),
                          _ => _verifyDisable(pin),
                        },
                      ),
                    ),
                  ]),
                ),
              if (_step == LockStep.bioOffer)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Column(children: <Widget>[
                    Container(
                      width: 80,
                      height: 80,
                      margin: const EdgeInsets.only(bottom: 16),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.lav1, shape: BoxShape.circle),
                      child: AIcon(AIcons.fingerprint, size: 36, color: a.lavInk),
                    ),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 260),
                      child: Text(tr('applock_bio_offer_desc', 'PIN əvəzinə Face ID / barmaq izi ilə daha sürətli açın.'), textAlign: TextAlign.center, style: px(13, color: a.inkSoft)),
                    ),
                    const SizedBox(height: 24),
                    GestureDetector(
                      key: const ValueKey<String>('applock-bio-yes'),
                      onTap: () async {
                        await _bioToggle(true);
                        _finish();
                      },
                      child: Container(
                        height: 50,
                        decoration: BoxDecoration(
                          color: a.peach2,
                          borderRadius: BorderRadius.circular(999),
                          boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12)],
                        ),
                        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                          const AIcon(AIcons.check, size: 17, color: Color(0xFFFFFFFF)),
                          const SizedBox(width: 8),
                          Text(tr('applock_bio_offer_yes', 'Bəli, aktivləşdir'), style: px(14, weight: FontWeight.w700, color: const Color(0xFFFFFFFF))),
                        ]),
                      ),
                    ),
                    const SizedBox(height: 10),
                    GestureDetector(
                      key: const ValueKey<String>('applock-bio-no'),
                      onTap: _finish,
                      child: Container(
                        height: 46,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                        child: Text(tr('applock_bio_offer_no', 'İndi yox'), style: px(13, weight: FontWeight.w600, color: a.inkSoft)),
                      ),
                    ),
                  ]),
                ),
            ]),
          ]),
        ),
      ),
    );
  }
}
