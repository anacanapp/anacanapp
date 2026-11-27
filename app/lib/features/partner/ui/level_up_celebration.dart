// Ported from: src/components/partner/LevelUpCelebration.tsx
//
// Level-up dialog with confetti from three angles: drawn over the whole app (React `fixed inset-0 z-[100]`) through
// an [OverlayPortal]; closes after 4 s, on the backdrop or on "Davam et" (onClose 300 ms after the fade starts).
import 'dart:async';

import 'package:flutter/scheduler.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/i18n/tr.dart';
import '../../../design/design.dart';
import '../../settings/ui/settings_ui.dart' show FadeRise, cssUpper;
import 'confetti.dart';
import 'partner_ui.dart';

class LevelUpCelebration extends StatefulWidget {
  const LevelUpCelebration({super.key, required this.show, required this.level, required this.onClose});
  final bool show;
  final int level;
  final VoidCallback onClose;

  /// Anacan palette: coral, peach, warm yellow, soft green (one-off literals of the component).
  static const List<Color> confettiColors = [Color(0xFFFF5A5F), Color(0xFFFFB4A2), Color(0xFFFFD166), Color(0xFF7FD1AE), Color(0xFFFFDCDD)];

  @override
  State<LevelUpCelebration> createState() => _LevelUpCelebrationState();
}

class _LevelUpCelebrationState extends State<LevelUpCelebration> with SingleTickerProviderStateMixin {
  final OverlayPortalController _portal = OverlayPortalController();
  final ConfettiCannonController _confetti = ConfettiCannonController();
  late final Ticker _stream = createTicker(_frame);
  bool _visible = false;
  bool _mounted = false;
  Timer? _autoClose;
  Timer? _closeTimer;

  @override
  void initState() {
    super.initState();
    if (widget.show) WidgetsBinding.instance.addPostFrameCallback((_) => _start());
  }

  @override
  void didUpdateWidget(LevelUpCelebration old) {
    super.didUpdateWidget(old);
    if (widget.show && !old.show) _start();
  }

  void _start() {
    if (!mounted) return;
    setState(() {
      _visible = true;
      _mounted = true;
    });
    _portal.show();
    _closeTimer?.cancel();
    // Initial burst, then 3 + 3 particles per frame from both sides for 3 s.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _confetti.burst(particleCount: 100, spread: 70, originY: 0.6, colors: LevelUpCelebration.confettiColors);
      if (!_stream.isActive) _stream.start();
    });
    _autoClose?.cancel();
    _autoClose = Timer(const Duration(seconds: 4), _close);
  }

  void _frame(Duration elapsed) {
    if (elapsed >= const Duration(seconds: 3)) {
      _stream.stop();
      return;
    }
    _confetti.burst(particleCount: 3, angle: 60, spread: 55, originX: 0, originY: 0.7, colors: LevelUpCelebration.confettiColors);
    _confetti.burst(particleCount: 3, angle: 120, spread: 55, originX: 1, originY: 0.7, colors: LevelUpCelebration.confettiColors);
  }

  void _close() {
    _autoClose?.cancel();
    if (!mounted || !_visible) return;
    setState(() => _visible = false);
    _closeTimer = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() => _mounted = false);
      widget.onClose();
    });
  }

  @override
  void dispose() {
    _autoClose?.cancel();
    _closeTimer?.cancel();
    _stream.dispose();
    _confetti.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => OverlayPortal(
        controller: _portal,
        overlayChildBuilder: (context) => Positioned.fill(
          child: Stack(children: [
            if (_mounted) Positioned.fill(child: _dialog(context)),
            Positioned.fill(child: ConfettiCannon(controller: _confetti)),
          ]),
        ),
        child: const SizedBox.shrink(),
      );

  Widget _dialog(BuildContext context) {
    final a = context.a;
    return AScope(
        child: AnimatedOpacity(
          opacity: _visible ? 1 : 0,
          duration: const Duration(milliseconds: 300),
          child: GestureDetector(
            onTap: _close,
            child: Container(
              // rgba(20, 16, 18, 0.55)
              color: const Color(0x8C141012),
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: GestureDetector(
                onTap: () {},
                child: Semantics(
                  scopesRoute: true,
                  namesRoute: true,
                  explicitChildNodes: true,
                  child: FadeRise(
                    dy: 24,
                    scaleFrom: 0.85,
                    child: Container(
                      key: const ValueKey('level-up-dialog'),
                      constraints: const BoxConstraints(maxWidth: 340),
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: a.surface,
                        borderRadius: BorderRadius.circular(28),
                        // 0 24px 60px rgba(0,0,0,0.25)
                        boxShadow: const [BoxShadow(color: Color(0x40000000), offset: Offset(0, 24), blurRadius: 60)],
                      ),
                      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                        Container(
                          decoration: BoxDecoration(gradient: a.gradPeach),
                          padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
                          child: Stack(clipBehavior: Clip.none, children: [
                            Center(
                              child: FadeRise(
                                dy: -16,
                                scaleFrom: 0.8,
                                delay: const Duration(milliseconds: 150),
                                child: Container(
                                  width: 84,
                                  height: 84,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: a.surface,
                                    shape: BoxShape.circle,
                                    // 0 8px 24px rgba(255, 90, 95, 0.25)
                                    boxShadow: const [BoxShadow(color: Color(0x40FF5A5F), offset: Offset(0, 8), blurRadius: 24)],
                                  ),
                                  child: AIcon(AIcons.trophy, size: 40, color: a.coral),
                                ),
                              ),
                            ),
                            PositionedDirectional(top: -10, start: -2, child: AIcon(AIcons.sparkles, size: 18, color: a.coral)),
                            PositionedDirectional(top: -2, end: 2, child: PartnerLucide(AIcons.star, size: 16, color: a.yellowInk, fill: a.yellow1)),
                          ]),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(24, 18, 24, 22),
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            FadeRise(
                              dy: 12,
                              delay: const Duration(milliseconds: 300),
                              child: Column(children: [
                                Text(tr('levelupcelebration_tebrik_edirik_283dfe', 'Təbrik Edirik! 🎉'),
                                    textAlign: TextAlign.center, style: pText(21, weight: FontWeight.w900, color: a.ink, ls: -0.01)),
                                const SizedBox(height: 4),
                                Text(tr('levelupcelebration_yeni_seviyyeye_kecdiniz_72af13', 'Yeni səviyyəyə keçdiniz!'),
                                    textAlign: TextAlign.center, style: pText(14, color: a.inkSoft)),
                              ]),
                            ),
                            const SizedBox(height: 16),
                            FadeRise(
                              dy: 0,
                              scaleFrom: 0.8,
                              delay: const Duration(milliseconds: 450),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(18)),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(color: a.coral, shape: BoxShape.circle),
                                    child: Text('${widget.level}', style: pText(20, weight: FontWeight.w900, color: a.onCoral)),
                                  ),
                                  const SizedBox(width: 12),
                                  Flexible(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                                      Text(cssUpper(tr('levelupcelebration_seviyye_8266e7', 'Səviyyə')),
                                          style: pText(10.5, weight: FontWeight.w800, color: a.accentInk, ls: 0.06)),
                                      Text(tr('levelupcelebration_davam_et_ela_gedirsen_326f52', 'Davam et, əla gedirsən! 💪'),
                                          style: pText(13, weight: FontWeight.w700, color: a.ink)),
                                    ]),
                                  ),
                                ]),
                              ),
                            ),
                            const SizedBox(height: 18),
                            FadeRise(
                              dy: 8,
                              delay: const Duration(milliseconds: 600),
                              child: PartnerTap(
                                key: const ValueKey('level-up-continue'),
                                scale: 0.97,
                                onTap: _close,
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: a.coral, borderRadius: BorderRadius.circular(16)),
                                  child: Text(tr('untranslated_davam_et_rchhd5', 'Davam et'),
                                      style: pText(15, weight: FontWeight.w800, color: a.onCoral)),
                                ),
                              ),
                            ),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
    );
  }
}
