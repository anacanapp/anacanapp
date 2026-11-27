// Ported from: src/components/partner/PartnerAIPremiumGate.tsx
//
// Anacan.AI is Premium only. `self` is the woman's own assistant (no partner context); without it this is Ata AI
// for the partner. A free user who opens the tab sees the locked screen and the paywall opens at once (self).
import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/scheduler.dart' show SchedulerBinding;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/tr.dart';
import '../../core/offline/connectivity.dart' show onlineStatusProvider;
import '../../design/design.dart';
import '../../native/purchases/subscription.dart' show subscriptionProvider, refetchSubscription;
import '../premium/a_sky.dart';
import '../settings/ui/settings_ui.dart' show ARingSpinner;
import 'ai_chat_inputs.dart';
import 'ai_chat_screen.dart';

/// After this long the Premium check counts as stuck: show retry instead of a spinner.
const Duration kAiGateSlow = Duration(milliseconds: 15000);

/// The `useSubscription()` fields the gate reads (+ `refetch`).
class AiPremiumState {
  const AiPremiumState({required this.isPremium, required this.loading, this.entitlementReady, this.entitlementError = false, this.refetch});
  final bool isPremium;
  final bool loading;
  final bool? entitlementReady;
  final bool entitlementError;
  final Future<void> Function(WidgetRef ref)? refetch;
}

final aiPremiumStateProvider = Provider<AiPremiumState>((ref) {
  final s = ref.watch(subscriptionProvider);
  return AiPremiumState(
    isPremium: s.isPremium,
    loading: s.loading,
    entitlementReady: s.entitlementReady,
    entitlementError: s.entitlementError,
    refetch: refetchSubscription,
  );
});

class AiPremiumGate extends ConsumerStatefulWidget {
  const AiPremiumGate({super.key, this.self = false, this.child});
  final bool self;
  final Widget? child;

  @override
  ConsumerState<AiPremiumGate> createState() => _AiPremiumGateState();
}

class _AiPremiumGateState extends ConsumerState<AiPremiumGate> {
  bool _slow = false;
  Timer? _slowTimer;
  bool _hadPremium = false;
  bool _autoOpened = false;
  bool? _lastLoading;
  bool _modalOpen = false;

  @override
  void dispose() {
    _slowTimer?.cancel();
    super.dispose();
  }

  void _armSlow(bool loading) {
    _slowTimer?.cancel();
    _slowTimer = null;
    _slow = false;
    if (!loading) return;
    _slowTimer = Timer(kAiGateSlow, () {
      if (mounted) setState(() => _slow = true);
    });
  }

  void _openModal() {
    if (_modalOpen) return;
    _modalOpen = true;
    SchedulerBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) {
        _modalOpen = false;
        return;
      }
      try {
        await ref.read(aiPremiumModalProvider)(context, analyticsSource: widget.self ? 'ai_tab' : 'partner_ai_tab');
      } finally {
        _modalOpen = false;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(aiPremiumStateProvider);
    final online = ref.watch(onlineStatusProvider);
    if (_lastLoading != s.loading) {
      _lastLoading = s.loading;
      _armSlow(s.loading);
    }
    // No server answer and no confirmed grant: the check failed (or is paused offline). This is neither "free
    // user" (no paywall) nor "loading" (no endless spinner).
    final unresolved = !s.isPremium && s.entitlementReady == false && (s.entitlementError || !online);
    final checkFailed = !s.isPremium && ((s.loading && _slow) || (!s.loading && unresolved));

    if (widget.self && !s.loading && !s.isPremium && !checkFailed && s.entitlementReady != false && !_autoOpened) {
      _autoOpened = true;
      _openModal();
    }
    if (s.isPremium) {
      _hadPremium = true;
    } else if (_hadPremium) {
      _hadPremium = false;
      _openModal();
    }

    final a = context.a;
    if (checkFailed) {
      return ColoredBox(
        color: a.bg,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: Semantics(
                liveRegion: true,
                container: true,
                child: ACard(
                  key: const ValueKey('ai-gate-alert'),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 32),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    AIcon(online ? AIcons.refreshCw : AIcons.wifiOff, size: 28, color: a.inkSoft),
                    const SizedBox(height: 12),
                    Text(
                      online ? tr('aigate_check_failed', 'Premium statusu yoxlanmadı') : tr('errorboundary_offline_retry', 'İnternet yoxdur, yenidən cəhd et'),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: a.ink, height: 1.5),
                    ),
                    const SizedBox(height: 16),
                    AButton(
                      key: const ValueKey('ai-gate-retry'),
                      variant: AButtonVariant.pillSoft,
                      leading: AIcon(AIcons.refreshCw, size: 15, color: a.accentInk),
                      onPressed: () {
                        // Back to the spinner for one more bounded wait; the answer (or another failure) decides.
                        setState(() => _armSlow(s.loading));
                        unawaited(Future.sync(() => s.refetch?.call(ref)).catchError((Object _) {}));
                      },
                      child: Text(tr('errorboundary_yeniden_cehd_et_d273ac', 'Yenidən cəhd et')),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      );
    }

    if (s.loading) {
      return ColoredBox(key: const ValueKey('ai-gate-loading'), color: a.bg, child: Center(child: ARingSpinner(size: 32, color: a.peach2)));
    }

    if (s.isPremium) {
      return widget.child ?? AIChatScreen(partner: widget.self ? null : partnerContextFrom(ref.watch(aiPartnerSourceProvider)));
    }

    return _Locked(onUpgrade: _openModal);
  }
}

class _Locked extends StatelessWidget {
  const _Locked({required this.onUpgrade});
  final VoidCallback onUpgrade;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final x = context.aText;
    final features = [
      tr('partneraipremiumgate_anacan_ai_ile_limitsiz_sohbet_431177', 'Anacan.AI ilə limitsiz söhbət'),
      tr('partneraipremiumgate_hamilelik_ve_korpe_bilgileri_9b3dc5', 'Hamiləlik və körpə bilgiləri'),
      tr('partneraipremiumgate_partnyor_mod_ve_sinxronizasiya_1e764c', 'Partnyor mod və sinxronizasiya'),
      tr('partneraipremiumgate_butun_premium_aletler_b6b57d', 'Bütün premium alətlər'),
    ];
    // HTML collapses the whitespace of the source string.
    String collapse(String s) => s.replaceAll(RegExp(r'\s+'), ' ').trim();
    return ColoredBox(
      key: const ValueKey('ai-gate-locked'),
      color: a.bg,
      child: Stack(children: [
        const Positioned(top: 0, left: 0, right: 0, child: IgnorePointer(child: ASky())),
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 32, 20, 112),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 448),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Center(child: _CrownHero()),
                const SizedBox(height: 20),
                Text(
                  tr('partneraipremiumgate_anacan_ai_premium_ucundur_37ae9a', 'Anacan.AI Premium üçündür'),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 23, fontWeight: FontWeight.w900, letterSpacing: -0.02 * 23, color: a.ink, height: 1.5),
                ),
                const SizedBox(height: 8),
                Text(
                  collapse(tr('partneraipremiumgate_anacan_ai_komekcisi_ve_partnyo_b352ea',
                      'Anacan.AI köməkçisi və partnyor funksiyaları yalnız Premium istifadəçilər üçündür.\n            Həyat yoldaşınızın və ya öz hesabınızın Premium aboneliyi aktiv olduqda burada\n            ekspert məsləhətləri ala bilərsiniz.')),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13.5, height: 1.625, color: a.bodyText),
                ),
                const SizedBox(height: 32),
                ACard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      AIcon(AIcons.sparkles, size: 15, color: a.yellowInk),
                      const SizedBox(width: 8),
                      Expanded(child: Text(tr('partneraipremiumgate_premium_da_ne_var_d28116', 'Premium-da nə var?'), style: x.aCardTitle)),
                    ]),
                    const SizedBox(height: 12),
                    for (var i = 0; i < features.length; i++) ...[
                      if (i > 0) const SizedBox(height: 10),
                      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          margin: const EdgeInsets.only(top: 2),
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(color: a.green1, shape: BoxShape.circle),
                          child: Center(child: AIcon(AIcons.check, size: 12, strokeWidth: 3, color: a.greenInk)),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(features[i], style: TextStyle(fontSize: 13, color: a.ink, height: 1.5))),
                      ]),
                    ],
                  ]),
                ),
                const SizedBox(height: 20),
                Semantics(
                  button: true,
                  label: tr('partneraipremiumgate_premium_a_kec_9dadb6', 'Premium-a keç'),
                  excludeSemantics: true,
                  child: PressScale(
                    onTap: onUpgrade,
                    child: Container(
                      key: const ValueKey('ai-gate-upgrade'),
                      height: 56,
                      decoration: BoxDecoration(
                        color: a.peach2,
                        borderRadius: BorderRadius.circular(999),
                        // `0 16px 32px -12px rgba(217, 108, 74, 0.6)` (one-off literal of PartnerAIPremiumGate.tsx).
                        boxShadow: const [BoxShadow(color: Color.fromRGBO(217, 108, 74, 0.6), offset: Offset(0, 16), blurRadius: 32, spreadRadius: -12)],
                      ),
                      alignment: Alignment.center,
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const AIcon(AIcons.crown, size: 20, color: Color(0xFFFFFFFF)),
                        const SizedBox(width: 8),
                        Text(tr('partneraipremiumgate_premium_a_kec_9dadb6', 'Premium-a keç'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFFFFFFFF))),
                      ]),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  tr('partneraipremiumgate_aboneliyi_heyat_yoldasiniz_da__8eb9a1', 'Aboneliyi həyat yoldaşınız da əldə edə bilər — ikiniz üçün də açılacaq.'),
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11.5, color: a.onBgSoft, height: 1.5),
                ),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

/// The crown tile (`rotate [0, -5, 5, 0]` 4 s) with the sparkle badge (`scale [1, 1.1, 1]` 2 s), each once.
class _CrownHero extends StatefulWidget {
  @override
  State<_CrownHero> createState() => _CrownHeroState();
}

class _CrownHeroState extends State<_CrownHero> with TickerProviderStateMixin {
  late final AnimationController _rotate = AnimationController(vsync: this, duration: const Duration(seconds: 4));
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(seconds: 2));
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (!animationsDisabled(context)) {
      _rotate.forward();
      _pulse.forward();
    }
  }

  @override
  void dispose() {
    _rotate.dispose();
    _pulse.dispose();
    super.dispose();
  }

  static double _keyframes(double t, List<double> values) {
    final seg = 1 / (values.length - 1);
    final i = math.min((t / seg).floor(), values.length - 2);
    final local = Curves.easeInOut.transform(((t - i * seg) / seg).clamp(0.0, 1.0));
    return values[i] + (values[i + 1] - values[i]) * local;
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return SizedBox(
      width: 96,
      height: 96,
      child: Stack(clipBehavior: Clip.none, children: [
        Positioned.fill(
          child: AnimatedBuilder(
            animation: _rotate,
            builder: (context, child) => Transform.rotate(angle: _keyframes(_rotate.value, const [0, -5, 5, 0]) * math.pi / 180, child: child),
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                gradient: a.gradPeach,
                borderRadius: BorderRadius.circular(28),
                // `0 24px 48px -16px rgba(217, 108, 74, 0.55)` (one-off literal of PartnerAIPremiumGate.tsx).
                boxShadow: const [BoxShadow(color: Color.fromRGBO(217, 108, 74, 0.55), offset: Offset(0, 24), blurRadius: 48, spreadRadius: -16)],
              ),
              child: Center(child: AIcon(AIcons.crown, size: 44, color: a.accentInk)),
            ),
          ),
        ),
        PositionedDirectional(
          top: -8,
          end: -8,
          child: AnimatedBuilder(
            animation: _pulse,
            builder: (context, child) => Transform.scale(scale: _keyframes(_pulse.value, const [1, 1.1, 1]), child: child),
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(color: a.surface, shape: BoxShape.circle, boxShadow: a.cardShadow),
              // `#ffc94d` (one-off literal of PartnerAIPremiumGate.tsx).
              child: const Center(child: AIcon(AIcons.sparkles, size: 15, color: Color(0xFFFFC94D))),
            ),
          ),
        ),
      ]),
    );
  }
}
