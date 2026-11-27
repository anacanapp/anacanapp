// Ported from: src/components/PremiumModal.tsx
//
// Full-screen Premium paywall (custom UI over PaywallCore; RevenueCat's native paywall is not used): `--a-bg`
// with the cloudy sky, close button, crown hero, admin-configurable title / subtitle / pills, the feature lock
// chip, and the scrolling PaywallCore. Open it with [showPremiumModal]; Android back closes it (route pop).

import 'dart:async';

import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../native/purchases/purchases.dart';
import '../onboarding/onboarding_i18n.dart';
import 'a_sky.dart';
import 'paywall_core.dart';

/// Machine feature ids → localized names for the lock chip (never a raw id).
String premiumFeatureLabel(String feature, String language) {
  final labels = <String, String Function()>{
    'ad_free': () => onboardingText(language, 'premium_noads'),
    'tool': () => tr('pm_feat_tool', 'Bu alət'),
    'ai_chat': () => tr('pm_feat_ai_chat', 'Limitsiz AI söhbəti'),
    'doctor_report': () => tr('pm_feat_doctor_report', 'Həkim PDF hesabatı'),
    'baby_insight': () => tr('pm_feat_baby_insight', 'AI tracker analizi'),
    'cry_translator': () => tr('pm_feat_cry', 'Ağlama tərcüməçisi'),
    'poop_scanner': () => tr('pm_feat_poop', 'Bez analizi'),
    'fairy_tale': () => tr('pm_feat_fairy', 'AI nağıllar'),
    'horoscope': () => tr('pm_feat_horoscope', 'Ulduz falı analizi'),
    'weekly_stats': () => tr('pm_feat_weekly', 'Həftəlik statistika'),
    'teething': () => tr('pm_feat_teething', 'Diş izləyicisi'),
    'growth': () => tr('pm_feat_growth', 'Boy-çəki izləyicisi'),
    'pregnancy_days': () => tr('pm_feat_pregdays', 'Bütün günlərə baxış'),
    'white_noise': () => tr('pm_feat_whitenoise', 'Limitsiz ağ səs'),
    'winback': () => tr('pm_feat_winback', 'Premium'),
    'onboarding_funnel': () => tr('pm_feat_general', 'Premium'),
    'flow_daily_logger': () => tr('pm_feat_flow_logger', 'Gündəlik qeydlər'),
    'flow_mood_chart': () => tr('pm_feat_flow_mood', 'Əhval qrafiki'),
    'flow_cycle_stats': () => tr('pm_feat_flow_stats', 'Tsikl statistikası'),
    'flow_trend_chart': () => tr('pm_feat_flow_trend', 'Trend qrafiki'),
    'flow_symptom_report': () => tr('pm_feat_flow_symptom', 'Simptom hesabatı'),
    'flow_reminders': () => tr('pm_feat_flow_reminders', 'Xatırlatmalar'),
    'parenting_article': () => tr('pm_feat_par_article', 'Tərbiyə məqalələri'),
    'parenting_sos': () => tr('pm_feat_par_sos', 'Bütün SOS kartları'),
    'parenting_programme': () => tr('pm_feat_par_programme', 'Tərbiyə proqramları'),
    'parenting_quiz': () => tr('pm_feat_par_quiz', 'Testin ətraflı nəticəsi'),
  };
  return labels[feature]?.call() ?? tr('pm_feat_tool', 'Bu alət');
}

/// `getDynamicIcon(name, Sparkles)` for the admin pill icons.
AIconData premiumPillIcon(String name) => switch (name) {
      'Users' => AIcons.users,
      'Shield' => AIcons.shield,
      'Crown' => AIcons.crown,
      'Zap' => AIcons.zap,
      'Heart' => AIcons.heart,
      'Star' => AIcons.star,
      'Gift' => AIcons.gift,
      'Infinity' => AIcons.infinity,
      'Baby' => AIcons.baby,
      'Bot' => AIcons.bot,
      'FileText' => AIcons.fileText,
      _ => AIcons.sparkles,
    };

/// Opens the Premium paywall over everything (`<PremiumModal isOpen feature analyticsSource onPurchased />`).
/// [onPurchased] runs after a successful purchase/restore (the modal closes first unless [keepOpenOnPurchase]).
Future<void> showPremiumModal(BuildContext context, {String? feature, String? analyticsSource, String? source, VoidCallback? onPurchased}) {
  return Navigator.of(context, rootNavigator: true).push(PremiumModalRoute(
    feature: feature,
    analyticsSource: analyticsSource ?? source,
    onPurchased: onPurchased,
  ));
}

class PremiumModalRoute extends PageRoute<void> {
  PremiumModalRoute({this.feature, this.analyticsSource, this.onPurchased});
  final String? feature;
  final String? analyticsSource;
  final VoidCallback? onPurchased;

  @override
  Color? get barrierColor => null;
  @override
  String? get barrierLabel => null;
  @override
  bool get maintainState => true;
  @override
  bool get opaque => false;
  @override
  Duration get transitionDuration => const Duration(milliseconds: 300);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) => PremiumModalView(
        feature: feature,
        analyticsSource: analyticsSource,
        onClose: () => Navigator.of(context).maybePop(),
        onPurchased: () {
          Navigator.of(context).maybePop();
          onPurchased?.call();
        },
      );

  /// framer `initial={{opacity: 0}} animate={{opacity: 1}}` of the backdrop (300 ms default tween).
  @override
  Widget buildTransitions(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation, Widget child) =>
      FadeTransition(opacity: CurvedAnimation(parent: animation, curve: ACurves.framerDefault), child: child);
}

/// The modal body (also rendered in place by PremiumToolBoundary).
class PremiumModalView extends ConsumerStatefulWidget {
  const PremiumModalView({super.key, this.feature, this.analyticsSource, required this.onClose, this.onPurchased});
  final String? feature;
  final String? analyticsSource;
  final VoidCallback onClose;

  /// Defaults to [onClose]; a tool gate passes its own so the user stays in the tool.
  final VoidCallback? onPurchased;

  @override
  ConsumerState<PremiumModalView> createState() => _PremiumModalViewState();
}

class _PremiumModalViewState extends ConsumerState<PremiumModalView> with TickerProviderStateMixin {
  // `initial={{opacity: 0, y: 30}} animate={{opacity: 1, y: 0}} transition={{type: 'spring', damping: 25, stiffness: 300}}`
  late final AnimationController _enter = AnimationController.unbounded(vsync: this, value: 0);
  // crown badge: scale 0 → 1, rotate −12° → 0, spring damping 13 (stiffness 100), delay 50 ms.
  late final AnimationController _badge = AnimationController.unbounded(vsync: this, value: 0);
  late final AnimationController _sparkle = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400));
  Timer? _badgeTimer;

  @override
  void initState() {
    super.initState();
    try {
      ref.read(analyticsSinkProvider).logPaywallShown(widget.analyticsSource ?? widget.feature ?? 'general');
    } catch (_) {}
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = AnacanTokens.of(context).lite || animationsDisabled(context);
    if (_badgeTimer == null && _badge.value == 0) {
      if (reduced) {
        _enter.value = 1;
        _badge.value = 1;
      } else {
        _enter.animateWith(SpringSimulation(ASprings.standard, 0, 1, 0));
        _badgeTimer = Timer(const Duration(milliseconds: 50), () {
          if (mounted) _badge.animateWith(SpringSimulation(ASprings.spring(damping: 13), 0, 1, 0));
        });
      }
    }
    if (!reduced && !_sparkle.isAnimating) _sparkle.repeat();
  }

  @override
  void dispose() {
    _badgeTimer?.cancel();
    _enter.dispose();
    _badge.dispose();
    _sparkle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final cfg = ref.watch(paywallConfigProvider);
    final language = ref.watch(appLanguageProvider);
    final padding = MediaQuery.paddingOf(context);
    final feature = widget.feature;
    final lockText = feature != null ? cfg.featureLockText.replaceFirst('{feature}', premiumFeatureLabel(feature, language)) : '';

    final hero = Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: AnimatedBuilder(
            animation: Listenable.merge([_badge, _sparkle]),
            builder: (context, _) {
              final k = _badge.value;
              final s = _sparkle.value;
              final wave = s < 0.5 ? s * 2 : (1 - s) * 2;
              return Transform.rotate(
                angle: (1 - k) * -12 * 3.14159265 / 180,
                child: Transform.scale(
                  scale: k.clamp(0.0, 2.0),
                  child: SizedBox(
                    width: 60,
                    height: 60,
                    child: Stack(clipBehavior: Clip.none, children: [
                      Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(21),
                          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [t.peach2, const Color(0xFFE86A4C)]),
                          boxShadow: const [BoxShadow(color: Color.fromRGBO(217, 108, 74, 0.6), offset: Offset(0, 16), blurRadius: 32, spreadRadius: -12)],
                        ),
                        alignment: Alignment.center,
                        child: const AIcon(AIcons.crown, size: 28, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
                      ),
                      PositionedDirectional(
                        top: -4,
                        end: -4,
                        child: Transform.rotate(
                          angle: 12 * wave * 3.14159265 / 180,
                          child: Transform.scale(scale: 1 + 0.25 * wave, child: const Text('✨', style: TextStyle(fontSize: 14))),
                        ),
                      ),
                    ]),
                  ),
                ),
              );
            },
          ),
        ),
        Text(cfg.title,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: em(-0.02, 24), color: t.ink, height: 1.15)),
        Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(cfg.subtitle, textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, color: t.inkSoft)),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Wrap(alignment: WrapAlignment.center, spacing: 6, runSpacing: 6, children: [
            for (final pill in cfg.pills)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
                decoration: BoxDecoration(color: t.chipOverlay, border: Border.all(color: t.line), borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  AIcon(premiumPillIcon(pill.icon), size: 12, color: t.accentInk),
                  const SizedBox(width: 4),
                  Text(pill.text, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.accentInk)),
                ]),
              ),
          ]),
        ),
        if (feature != null)
          Container(
            margin: const EdgeInsets.only(top: 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(color: t.chipOverlay, border: Border.all(color: t.line), borderRadius: BorderRadius.circular(999)),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              AIcon(AIcons.lock, size: 12, color: t.accentInk),
              const SizedBox(width: 6),
              Flexible(child: Text(lockText, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: t.accentInk))),
            ]),
          ),
      ]),
    );

    final body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      hero,
      Expanded(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 0, 20, padding.bottom + 16),
          child: PaywallCore(
            feature: feature,
            analyticsSource: widget.analyticsSource,
            onPurchased: (_) => (widget.onPurchased ?? widget.onClose)(),
          ),
        ),
      ),
    ]);

    final closeButton = Semantics(
      button: true,
      label: tr('premiummodal_bagla_84bdc9', 'Bağla'),
      child: GestureDetector(
        onTap: widget.onClose,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: t.surface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: t.btnBorder),
            boxShadow: const [BoxShadow(color: Color.fromRGBO(217, 108, 74, 0.35), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
          ),
          alignment: Alignment.center,
          child: AIcon(AIcons.x, size: 16, strokeWidth: 2, color: t.ink),
        ),
      ),
    );

    return AScope(
      child: Material(
        type: MaterialType.canvas,
        color: t.bg,
        child: Stack(children: [
          const Positioned(top: 0, left: 0, right: 0, child: ASky()),
          AnimatedBuilder(
            animation: _enter,
            builder: (context, child) => Opacity(
              opacity: _enter.value.clamp(0.0, 1.0),
              child: Transform.translate(offset: Offset(0, 30 * (1 - _enter.value)), child: child),
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 448),
                child: Padding(
                  padding: EdgeInsets.only(top: padding.top),
                  child: Semantics(
                    scopesRoute: true,
                    namesRoute: true,
                    label: cfg.title,
                    explicitChildNodes: true,
                    child: Stack(children: [
                      Positioned.fill(child: body),
                      PositionedDirectional(top: 12, end: 16, child: closeButton),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
