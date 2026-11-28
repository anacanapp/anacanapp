// Ported from: src/components/partner/SOSButton.tsx, src/components/partner/v2/MotherSOSSheet.tsx
//
// Press-and-hold senders of an SOS / birth alert: the partner's red SOS button (2 s, compact in the home top bar or
// full) and the mother's sheet (1.5 s on "Doğuş başladı!" or "Təcili kömək — SOS"). Both fire once per hold.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../../shell/widgets/android_back_scope.dart' show OverlayBackHandler;
import '../data/sos_alert.dart';
import '../partner_ports.dart';
import 'partner_ui.dart';

// Tailwind `from-red-500 to-red-600`, `shadow-red-500/30` (one-off literals of SOSButton).
const Color _red500 = Color(0xFFEF4444);
const Color _red600 = Color(0xFFDC2626);
const Color _white = Color(0xFFFFFFFF);

/// 'full' | 'compact'.
enum SosButtonVariant { full, compact }

class SosButton extends ConsumerStatefulWidget {
  const SosButton({super.key, this.variant = SosButtonVariant.full});
  final SosButtonVariant variant;

  /// Hold this long to activate.
  static const Duration holdDuration = Duration(seconds: 2);

  @override
  ConsumerState<SosButton> createState() => _SosButtonState();
}

class _SosButtonState extends ConsumerState<SosButton> with SingleTickerProviderStateMixin {
  late final AnimationController _fill = AnimationController(vsync: this, duration: SosButton.holdDuration);
  bool _holding = false;
  bool _confirmation = false;
  Timer? _timeout;
  Timer? _confirmTimer;

  // One-shot guard: the SOS is sent at most once per hold.
  bool _fired = false;

  final OverlayPortalController _portal = OverlayPortalController();

  void _setHolding(bool holding) {
    if (_holding == holding) return;
    setState(() => _holding = holding);
    _timeout?.cancel();
    if (holding) {
      _fired = false;
      _fill.forward(from: 0);
      _timeout = Timer(SosButton.holdDuration, () {
        if (_fired) return;
        _fired = true;
        unawaited(_handleSos());
      });
    } else {
      _fill.reset();
    }
  }

  Future<void> _handleSos() async {
    _setHolding(false);
    await quietly(ref.read(partnerHapticsProvider).heavy);
    final result = await ref.read(sosAlertProvider.notifier).sendSOS();
    if (result.error == null && mounted) {
      setState(() => _confirmation = true);
      _portal.show();
      _confirmTimer?.cancel();
      _confirmTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _confirmation = false);
      });
    }
  }

  @override
  void dispose() {
    _timeout?.cancel();
    _confirmTimer?.cancel();
    _fill.dispose();
    super.dispose();
  }

  Widget _holdable({required Widget child}) => Listener(
        onPointerDown: (_) => _setHolding(true),
        onPointerUp: (_) => _setHolding(false),
        onPointerCancel: (_) => _setHolding(false),
        child: PressScale(child: child),
      );

  @override
  Widget build(BuildContext context) {
    if (!ref.watch(sosHasPartnerProvider)) return const SizedBox.shrink();
    final loading = ref.watch(sosAlertProvider.select((s) => s.loading));
    const gradient = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [_red500, _red600]);
    // shadow-lg shadow-red-500/30
    const shadow = [
      BoxShadow(color: Color(0x4DEF4444), offset: Offset(0, 10), blurRadius: 15, spreadRadius: -3),
      BoxShadow(color: Color(0x4DEF4444), offset: Offset(0, 4), blurRadius: 6, spreadRadius: -4),
    ];

    if (widget.variant == SosButtonVariant.compact) {
      return Semantics(
        button: true,
        label: trInline('SOSButton.tsx', 'SOS'),
        child: _holdable(
          child: Container(
            key: const ValueKey('sos-button-compact'),
            width: 56,
            height: 56,
            clipBehavior: Clip.antiAlias,
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: gradient, boxShadow: shadow),
            child: Stack(alignment: Alignment.center, children: [
              const AIcon(AIcons.triangleAlert, size: 24, color: _white),
              if (_holding)
                Positioned.fill(
                  child: ScaleTransition(
                    scale: Tween<double>(begin: 0, end: 2).animate(_fill),
                    child: Container(color: _white.withValues(alpha: 0.3)),
                  ),
                ),
            ]),
          ),
        ),
      );
    }

    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (context) => _confirmation
          ? Positioned.fill(
              child: Container(
                // bg-green-500
                color: const Color(0xFF22C55E),
                alignment: Alignment.center,
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 80,
                    height: 80,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: _white.withValues(alpha: 0.2), shape: BoxShape.circle),
                    child: const AIcon(AIcons.check, size: 40, color: _white),
                  ),
                  const SizedBox(height: 16),
                  Text(tr('sosbutton_sos_gonderildi_fa1202', 'SOS Göndərildi!'), style: pText(24, weight: FontWeight.w700, color: _white, height: 32 / 24)),
                  const SizedBox(height: 8),
                  Text(tr('sosbutton_partnyorunuz_xeberdar_edildi_4497d5', 'Partnyorunuz xəbərdar edildi'), style: pText(16, color: _white.withValues(alpha: 0.8))),
                ]),
              ),
            )
          : const SizedBox.shrink(),
      child: FadeRiseIn(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          IgnorePointer(
            ignoring: loading,
            child: _holdable(
              child: Container(
                key: const ValueKey('sos-button-full'),
                padding: const EdgeInsets.all(24),
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(16), gradient: gradient, boxShadow: shadow),
                child: Stack(children: [
                  if (_holding)
                    Positioned.fill(
                      child: AnimatedBuilder(
                        animation: _fill,
                        builder: (context, _) => Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: FractionallySizedBox(widthFactor: _fill.value, heightFactor: 1, child: Container(color: _white.withValues(alpha: 0.2))),
                        ),
                      ),
                    ),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const AIcon(AIcons.triangleAlert, size: 32, color: _white),
                    const SizedBox(width: 12),
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(trInline('SOSButton.tsx', 'SOS'), style: pText(20, weight: FontWeight.w700, color: _white, height: 28 / 20)),
                      Text(loading ? tr('sosbutton_gonderilir_1d548c', 'Göndərilir...') : tr('sosbutton_basib_saxla_2_san_27183d', 'Basıb saxla (2 san)'),
                          style: pText(14, color: _white.withValues(alpha: 0.8), height: 20 / 14)),
                    ]),
                  ]),
                ]),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(tr('sosbutton_tecili_veziyyetde_partnyorunuz_902e41', 'Təcili vəziyyətdə partnyorunuza bildiriş və lokasiya göndərilir'),
              textAlign: TextAlign.center, style: pText(12, color: context.tokens.shadcn.mutedForeground, height: 16 / 12)),
        ]),
      ),
    );
  }
}

/// framer `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}` for the full SOS button.
class FadeRiseIn extends StatelessWidget {
  const FadeRiseIn({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: animationsDisabled(context) ? 1 : 0, end: 1),
        duration: const Duration(milliseconds: 300),
        curve: ACurves.framerDefault,
        builder: (context, v, child) => Opacity(opacity: v, child: Transform.translate(offset: Offset(0, 20 * (1 - v)), child: child)),
        child: child,
      );
}

// ── MotherSOSSheet ───────────────────────────────────────────────────────────────────────────────────────────

/// The hold time that protects against accidental touches.
const Duration kMotherSosHold = Duration(milliseconds: 1500);

/// Mother side — SOS / "Doğuş başladı!" sender. Drawn over the whole app (React portals it to `body`, z-90).
class MotherSosSheet extends ConsumerStatefulWidget {
  const MotherSosSheet({super.key, required this.open, required this.onClose, this.lifeStage});
  final bool open;
  final VoidCallback onClose;
  final String? lifeStage;

  @override
  ConsumerState<MotherSosSheet> createState() => _MotherSosSheetState();
}

class _MotherSosSheetState extends ConsumerState<MotherSosSheet> {
  final OverlayPortalController _portal = OverlayPortalController();
  String? _holdType;
  double _progress = 0;
  String? _sent;
  Timer? _timer;
  bool _fired = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _portal.show();
    });
  }

  @override
  void didUpdateWidget(MotherSosSheet old) {
    super.didUpdateWidget(old);
    if (!widget.open && old.open) {
      _sent = null;
      _stopHold();
    }
  }

  void _stopHold() {
    _timer?.cancel();
    _timer = null;
    if (!mounted) return;
    setState(() {
      _holdType = null;
      _progress = 0;
    });
  }

  void _startHold(String type) {
    if (ref.read(sosAlertProvider).loading || _sent != null) return;
    _fired = false;
    setState(() {
      _holdType = type;
      _progress = 0;
    });
    _timer?.cancel();
    // Elapsed time counted in 50 ms ticks (React measured Date.now() inside the same 50 ms interval).
    _timer = Timer.periodic(const Duration(milliseconds: 50), (t) async {
      final pct = (t.tick * 50 / kMotherSosHold.inMilliseconds * 100).clamp(0, 100).toDouble();
      if (mounted) setState(() => _progress = pct);
      if (pct >= 100 && !_fired) {
        _fired = true;
        _stopHold();
        final result = await ref.read(sosAlertProvider.notifier).sendSOS(null, true, type);
        if (result.error == null && mounted) setState(() => _sent = type);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasPartner = ref.watch(sosHasPartnerProvider);
    // Keep the alert state alive while the sheet can send.
    ref.watch(sosAlertProvider.select((s) => s.loading));
    if (!hasPartner) return const SizedBox.shrink();
    return OverlayPortal(
      controller: _portal,
      overlayChildBuilder: (context) => Positioned.fill(child: _SheetLayer(open: widget.open, onClose: widget.onClose, child: _content(context))),
      child: const SizedBox.shrink(),
    );
  }

  Widget _holdButton({
    required String type,
    required Gradient? gradient,
    required Color? background,
    required Border border,
    required Color fillColor,
    required Color iconBg,
    required AIconData icon,
    required String title,
    required String subtitle,
    required Color titleColor,
    required Color subtitleColor,
  }) {
    return Listener(
      key: ValueKey('mother-sos-$type'),
      onPointerDown: (_) => _startHold(type),
      onPointerUp: (_) => _stopHold(),
      onPointerCancel: (_) => _stopHold(),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: background, gradient: gradient, borderRadius: BorderRadius.circular(20), border: border),
        child: Stack(children: [
          if (_holdType == type)
            Positioned.fill(
              child: Align(
                alignment: Alignment.centerLeft,
                child: FractionallySizedBox(widthFactor: _progress / 100, heightFactor: 1, child: ColoredBox(color: fillColor)),
              ),
            ),
          Padding(padding: const EdgeInsets.all(18), child: Row(children: [
            Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
              child: AIcon(icon, size: 22, color: _white),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: pText(15.5, weight: FontWeight.w800, color: titleColor)),
                Text(subtitle, style: pText(11.5, color: subtitleColor)),
              ]),
            ),
          ])),
        ]),
      ),
    );
  }

  Widget _content(BuildContext context) {
    final a = context.a;
    final sent = _sent;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 4),
        child: Row(children: [
          Expanded(child: Text(tr('partnerv2_partnyoru_cagir', 'Partnyoru çağır'), style: pText(18, weight: FontWeight.w800, color: a.ink, ls: -0.01))),
          PartnerTap(
            key: const ValueKey('mother-sos-close'),
            semanticLabel: tr('premiummodal_bagla_84bdc9', 'Bağla'),
            onTap: widget.onClose,
            child: Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.surface, shape: BoxShape.circle, border: Border.all(color: a.btnBorder)),
              child: AIcon(AIcons.x, size: 14, color: a.ink),
            ),
          ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Text(tr('partnerv2_sos_hold_hint', 'Göndərmək üçün düyməni 1.5 saniyə basılı tutun. Yeriniz avtomatik paylaşılır.'),
            style: pText(12, color: a.inkSoft)),
      ),
      if (sent != null)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 32),
          child: Column(children: [
            Container(
              width: 80,
              height: 80,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: a.green1, shape: BoxShape.circle),
              child: AIcon(AIcons.check, size: 36, color: a.greenInk, strokeWidth: 2.5),
            ),
            const SizedBox(height: 16),
            Text(sent == 'birth' ? tr('partnerv2_dogus_siqnali_gonderildi', 'Doğuş siqnalı göndərildi!') : tr('partnerv2_sos_gonderildi', 'SOS göndərildi!'),
                textAlign: TextAlign.center, style: pText(17, weight: FontWeight.w800, color: a.ink)),
            const SizedBox(height: 4),
            Text(tr('partnerv2_partnyor_xeberdar_edildi', 'Partnyorunuz dərhal xəbərdar edildi. 💙'), textAlign: TextAlign.center, style: pText(12.5, color: a.inkSoft)),
          ]),
        )
      else ...[
        // Birth alert — pregnancy only.
        if (widget.lifeStage == 'bump') ...[
          _holdButton(
            type: 'birth',
            gradient: null,
            background: a.peach1,
            border: Border.all(color: a.peach2, width: 2),
            // rgba(255,157,99,0.35)
            fillColor: const Color(0x59FF9D63),
            iconBg: a.peach2,
            icon: AIcons.baby,
            title: tr('partnerv2_dogus_basladi_btn', 'Doğuş başladı! 👶'),
            subtitle: tr('partnerv2_dogus_basladi_sub', 'Partnyor xəstəxana rejiminə keçəcək'),
            titleColor: a.accentInk,
            subtitleColor: a.accentInk.withValues(alpha: 0.8),
          ),
          const SizedBox(height: 12),
        ],
        _holdButton(
          type: 'emergency',
          gradient: a.alertBg,
          background: null,
          // rgba(177, 39, 91, 0.35)
          border: Border.all(color: const Color(0x59B1275B), width: 2),
          // rgba(177,39,91,0.22)
          fillColor: const Color(0x38B1275B),
          iconBg: a.pinkInk,
          icon: AIcons.siren,
          title: tr('partnerv2_tecili_sos_btn', 'Təcili kömək — SOS 🚨'),
          subtitle: tr('partnerv2_tecili_sos_sub', 'Yeriniz və xəbərdarlıq dərhal çatır'),
          titleColor: a.alertInk,
          subtitleColor: a.alertSoft,
        ),
      ],
    ]);
  }
}

/// Backdrop (`bg-black/45`, tap closes) + bottom sheet (radius 26, padding 22, grabber, spring slide).
class _SheetLayer extends StatelessWidget {
  const _SheetLayer({required this.open, required this.onClose, required this.child});
  final bool open;
  final VoidCallback onClose;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final bottom = MediaQuery.paddingOf(context).bottom;
    final reduce = animationsDisabled(context);
    return OverlayBackHandler(
      open: open,
      onClose: onClose,
      child: IgnorePointer(
        ignoring: !open,
        child: AScope(
          child: Stack(children: [
            Positioned.fill(
              child: AnimatedOpacity(
                opacity: open ? 1 : 0,
                duration: reduce ? Duration.zero : const Duration(milliseconds: 200),
                child: GestureDetector(key: const ValueKey('mother-sos-backdrop'), onTap: onClose, child: const ColoredBox(color: Color(0x73000000))),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: AnimatedSlide(
                offset: open ? Offset.zero : const Offset(0, 1),
                duration: reduce ? Duration.zero : const Duration(milliseconds: 350),
                curve: ACurves.spring,
                child: open
                    ? GestureDetector(
                        onTap: () {},
                        child: Container(
                          decoration: BoxDecoration(color: a.surface, borderRadius: const BorderRadius.vertical(top: Radius.circular(26))),
                          padding: EdgeInsets.fromLTRB(22, 22, 22, (bottom == 0 ? 16 : bottom) + 22),
                          child: Stack(clipBehavior: Clip.none, children: [
                            Positioned(
                              top: -10,
                              left: 0,
                              right: 0,
                              child: Center(
                                child: Container(width: 48, height: 6, decoration: BoxDecoration(color: a.lineStrong, borderRadius: BorderRadius.circular(999))),
                              ),
                            ),
                            child,
                          ]),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}
