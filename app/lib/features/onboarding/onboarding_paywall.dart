// Ported from: src/components/onboarding/OnboardingPaywall.tsx, src/styles/onboarding.css (.onb-paywall, .onb-plan*,
// .onb-offer, .onb-payment-*)
//
// Store prices and eligibility drive the offer: the annual first-year price only when the store reports it
// (iOS eligible, or unknown eligibility shown as "first year X; otherwise Y"; Android the explicit
// `yearly-plan:onboarding-first-year` option), monthly at the store's monthly price. Closing the annual paywall,
// or cancelling the annual store sheet, opens the one-time monthly "coffee" offer (claimed on the server, once
// per account); a selected monthly plan or an already seen offer just continues free.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../native/purchases/purchases.dart';
import '../premium/effect_tracker.dart';
import '../premium/paywall_extensions.dart';
import 'onboarding_companion.dart';
import 'onboarding_frame.dart';
import 'onboarding_i18n.dart';

typedef OnboardingSuccess = void Function(String outcome, [String? selectedPlan]);

class OnboardingPaywall extends ConsumerStatefulWidget {
  const OnboardingPaywall({
    super.key,
    required this.stage,
    required this.language,
    required this.mode,
    required this.initialPlan,
    required this.onPlanChange,
    required this.offerSeen,
    required this.pending,
    required this.onPending,
    required this.onOffer,
    required this.onSkip,
    required this.onSuccess,
    required this.onLegal,
  });
  final String stage;
  final String language;

  /// 'paywall' | 'offer'
  final String mode;
  final String initialPlan;
  final ValueChanged<String> onPlanChange;
  final bool offerSeen;
  final bool pending;
  final VoidCallback onPending;
  final Future<bool> Function() onOffer;
  final VoidCallback onSkip;
  final OnboardingSuccess onSuccess;

  /// 'privacy_policy' | 'terms_of_service'
  final ValueChanged<String> onLegal;

  @override
  ConsumerState<OnboardingPaywall> createState() => _OnboardingPaywallState();
}

class _OnboardingPaywallState extends ConsumerState<OnboardingPaywall> with InAppPurchaseHost {
  late String _plan = widget.initialPlan;
  bool _working = false;
  String? _message;
  String? _notice;
  bool _finished = false, _actionLock = false, _handledCancellation = false;
  final EffectTracker _fx = EffectTracker();

  String t(String key, [Map<String, Object?> values = const {}]) => onboardingText(widget.language, key, values);

  @override
  void dispose() {
    _fx.disposed = true;
    super.dispose();
  }

  RcPackage? _find(String type) {
    for (final pkg in purchases.packages) {
      if (pkg.packageType == type && pkg.productIdentifier.split(':')[0] != onboardingOfferProduct) return pkg;
    }
    return null;
  }

  bool get _busy => _working || purchases.isPurchasing;

  Future<void> _run(Future<void> Function() operation) async {
    if (_actionLock || _busy) return;
    _actionLock = true;
    setState(() {
      _working = true;
      _message = null;
      _notice = null;
    });
    try {
      await operation();
    } catch (_) {
      if (mounted) setState(() => _message = 'purchase_failed');
    } finally {
      _actionLock = false;
      if (mounted) setState(() => _working = false);
    }
  }

  String get _source => widget.mode == 'offer' ? 'onboarding_offer' : 'onboarding';

  Future<void> _purchase(StorePlan? choice, bool waiting) => _run(() async {
        if (choice == null || !purchases.isSupported || waiting) return;
        _handledCancellation = false;
        final funnel = ref.read(premiumFunnelProvider);
        funnel.funnelHit('paywall_clicked', _source);
        funnel.purchaseIntent(_source, widget.mode == 'offer' ? 'offer' : choice.kind);
        funnel.funnelHit('purchase_started', _source);
        final sub = ref.read(subscriptionProvider);
        if (await purchases.purchaseExact(choice.pkg!, choice.request,
            PremiumPurchaseContext(ownPremium: sub.ownPremium, householdPremium: sub.householdPremium))) {
          _finished = true;
          widget.onSuccess('purchased', choice.kind);
        }
      });

  Future<void> _restore() => _run(() async {
        if (!purchases.isSupported) return;
        ref.read(premiumFunnelProvider).funnelHit('restore_clicked', 'onboarding');
        final outcome = await purchases.restorePurchasesDetailed();
        if (outcome.ok) {
          _finished = true;
          widget.onSuccess('restored');
        } else if (outcome.failure == 'network') {
          if (mounted) {
            setState(() => _notice = tr('restore_err_network',
                'Bərpa alınmadı: mağaza ilə əlaqə yoxdur. İnternet bağlantısını yoxlayıb yenidən cəhd edin.'));
          }
        } else if (outcome.failure != 'pending') {
          if (mounted) setState(() => _message = 'restore_none');
        }
      });

  Future<void> _close(StorePlan? monthly, bool waiting) => _run(() async {
        if (widget.mode == 'paywall' && _plan == 'yearly' && monthly != null && !widget.offerSeen && !waiting) {
          await widget.onOffer();
        } else {
          widget.onSkip();
        }
      });

  Future<void> _refresh() => _run(() async {
        if (await purchases.retryActivation()) {
          _finished = true;
          widget.onSuccess('restored');
        }
      });

  String _uncertain(StorePlan value) => tr('pw_intro_uncertain_year', 'İlk il {intro}; bu təklifə uyğun deyilsinizsə {regular}')
      .replaceFirst('{intro}', value.priceString)
      .replaceFirst('{regular}', value.renewalPriceString);

  void _setPlan(String plan) {
    setState(() => _plan = plan);
    widget.onPlanChange(plan);
  }

  @override
  Widget build(BuildContext context) => PurchasesBuilder(controller: purchases, builder: (context, iap) => _build(context, iap));

  Widget _build(BuildContext context, InAppPurchaseController iap) {
    final sub = ref.watch(subscriptionProvider);
    final rc = iap.deps.rc;
    final platform = rc.getPlatform();
    final yearPkg = _find('ANNUAL'), monthPkg = _find('MONTHLY');
    final yearly = annualStorePlan(yearPkg?.js, platform, iap.introEligibility[yearPkg?.productIdentifier ?? '']);
    final monthly = standardStorePlan(monthPkg?.js, platform, 'monthly', iap.introEligibility[monthPkg?.productIdentifier ?? '']);
    final choice = widget.mode == 'offer' ? monthly : (_plan == 'yearly' ? yearly : monthly);
    final waiting = widget.pending || iap.purchaseStatus == 'pending';
    final busy = _busy;

    _fx.effect('pending', [iap.purchaseStatus], () {
      if (iap.purchaseStatus == 'pending') widget.onPending();
    });
    _fx.effect('fallback', [iap.isLoading, widget.mode, _plan, yearly != null, monthly != null], () {
      if (iap.isLoading || widget.mode != 'paywall' || !mounted) return;
      final fallback = _plan == 'yearly' ? (yearly == null && monthly != null ? 'monthly' : null) : (monthly == null && yearly != null ? 'yearly' : null);
      if (fallback != null) _setPlan(fallback);
    });
    _fx.effect('existing', [sub.isPremium, sub.loading, waiting], () {
      if (sub.isPremium && !sub.loading && !waiting && !_finished) {
        _finished = true;
        widget.onSuccess('existing');
      }
    });
    _fx.effect('shown', [widget.mode], () => ref.read(premiumFunnelProvider).funnelHit('paywall_shown', _source));
    _fx.effect('cancelled', [iap.purchaseStatus, busy, widget.mode, _plan], () {
      if (iap.purchaseStatus == 'cancelled' && !_busy && !_handledCancellation && widget.mode == 'paywall' && _plan == 'yearly') {
        _handledCancellation = true;
        _close(monthly, waiting);
      }
    });

    final o = OnbStyle.of(context);
    final ext = ref.watch(paywallExtensionsProvider);

    Widget prices(StorePlan value) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          OnbNote(value.introUncertain == true ? _uncertain(value) : t('charged_today', {'price': value.priceString}), tight: true),
          OnbNote(t(value.kind == 'yearly' ? 'renewal_year' : 'renewal_month', {'price': value.renewalPriceString}), tight: true),
        ]);

    Widget card(String kind, StorePlan? value) {
      final pressed = _plan == kind;
      final off = busy || value == null || waiting;
      final discount = value != null && value.price < value.renewalPrice;
      Widget body = Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: pressed ? o.bg : null,
          border: Border.all(color: pressed ? o.ink : o.line, width: 2),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (kind == widget.initialPlan)
              Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(color: o.ink, borderRadius: BorderRadius.circular(15)),
                child: Text(t('recommended'), style: TextStyle(fontSize: 10, height: 1.4, color: o.surface)),
              ),
            DefaultTextStyle.merge(
              style: const TextStyle(fontWeight: FontWeight.w800, height: 1.4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t(kind)),
                const SizedBox(height: 4),
                if (discount)
                  Opacity(
                    opacity: 0.7,
                    child: Text(t('per_year', {'price': value.renewalPriceString}),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w400, decoration: TextDecoration.lineThrough)),
                  ),
                Text(value != null ? t(kind == 'yearly' ? 'per_year' : 'per_month', {'price': value.priceString}) : t('price_unavailable')),
              ]),
            ),
            if (discount)
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Text(value.introUncertain == true ? _uncertain(value) : t('first_year', {'price': value.priceString}),
                    style: TextStyle(fontSize: 11, height: 1.5, color: o.muted)),
              ),
            if (value != null)
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Text(
                  kind == 'yearly'
                      ? t('equivalent_month', {'price': formatCurrency(widget.language, value.price / 12, value.currency)})
                      : t('flexible_plan'),
                  style: TextStyle(fontSize: 11, height: 1.5, color: o.muted),
                ),
              ),
          ],
        ),
      );
      if (off) body = Opacity(opacity: 0.5, child: body);
      return Semantics(
        key: ValueKey('plan-$kind'),
        button: true,
        toggled: pressed,
        enabled: !off,
        child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: off ? null : () => _setPlan(kind), child: body),
      );
    }

    final narrowPlans = MediaQuery.sizeOf(context).width <= 359;
    Widget status;
    if (waiting) {
      status = OnbFeedback(t('purchase_pending'), compact: true);
    } else if (platform == 'web') {
      status = OnbFeedback(t('mobile_purchase'), compact: true);
    } else if (iap.isLoading) {
      status = OnbNote(t('loading_prices'));
    } else if (widget.mode == 'offer' && monthly != null) {
      status = Container(
        margin: const EdgeInsets.symmetric(vertical: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: o.bg, border: Border.all(color: o.line, width: 1.5), borderRadius: BorderRadius.circular(16)),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          AIcon(AIcons.coffee, size: 28, color: o.accent),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              t('per_month', {'price': monthly.priceString}),
              key: const ValueKey('onb-offer-price'),
              style: TextStyle(fontSize: (MediaQuery.sizeOf(context).width * 0.07).clamp(26.0, 32.0), height: 1.25, fontWeight: FontWeight.w800),
            ),
          ),
        ]),
      );
    } else if (widget.mode == 'paywall') {
      final cards = [card('yearly', yearly), card('monthly', monthly)];
      status = narrowPlans
          ? Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [cards[0], const SizedBox(height: 8), cards[1]])
          : IntrinsicHeight(
              child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Expanded(child: cards[0]),
                const SizedBox(width: 8),
                Expanded(child: cards[1]),
              ]),
            );
    } else {
      status = OnbFeedback(t('store_unavailable'), compact: true);
    }

    final errorText = (_message != null || _notice != null || iap.purchaseStatus == 'failed') && !waiting
        ? (_notice ?? (_message != null ? t(_message!) : (iap.error ?? t('purchase_failed'))))
        : null;

    return Column(
      key: const ValueKey('onboarding-paywall'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Semantics(
              button: true,
              label: t('close'),
              child: GestureDetector(
                onTap: busy ? null : () => _close(monthly, waiting),
                child: SizedBox(width: 44, height: 44, child: Center(child: AIcon(AIcons.x, size: 21, color: o.ink))),
              ),
            ),
            if (platform != 'web')
              OnbLegalLinks(links: [(t('restore'), _restore)], disabled: busy || iap.isLoading || !iap.isSupported),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 14),
          child: Row(children: [
            Expanded(child: OnbTitle(t(widget.mode == 'offer' ? 'coffee_title' : 'premium_title'), subtitle: t(widget.mode == 'offer' ? 'coffee_sub' : 'premium_sub'), summary: true)),
            const SizedBox(width: 12),
            OnboardingCompanion(stage: widget.stage, pose: widget.mode == 'offer' ? 'exit' : 'paywall', language: widget.language, size: CompanionSize.tiny, inSummary: true),
          ]),
        ),
        OnboardingBenefits(stage: widget.stage, page: widget.mode, language: widget.language, margin: const EdgeInsets.symmetric(vertical: 12)),
        status,
        if (widget.mode == 'offer' && !waiting) OnbNote(t('once_only')),
        if (errorText != null) OnbError(errorText),
        const SizedBox(height: 12),
        if (waiting)
          OnboardingButton(label: t('refresh_status'), onPressed: _refresh, busy: busy)
        else if (platform != 'web')
          OnboardingButton(
            label: choice != null ? t(widget.mode == 'offer' ? 'buy_monthly' : 'buy', {'price': choice.priceString}) : t('price_unavailable'),
            onPressed: () => _purchase(choice, waiting),
            busy: busy,
            disabled: iap.isLoading || !iap.isSupported || choice == null,
          ),
        if (platform != 'web' && choice == null && !iap.isLoading && !waiting)
          OnboardingButton(label: t('retry'), secondary: true, busy: busy, onPressed: () => _run(iap.reloadOfferings)),
        OnboardingButton(
          testId: 'onb-skip-premium',
          label: t(widget.mode == 'offer' ? 'decline' : 'continue_free'),
          secondary: true,
          busy: busy,
          onPressed: () => _close(monthly, waiting),
        ),
        if (widget.mode == 'paywall' && !waiting && ext.epointOption != null)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: ext.epointOption!(context, plan: _plan == 'yearly' ? 'yearly' : 'monthly', source: 'onboarding', onPremium: () {
              _finished = true;
              widget.onSuccess('purchased', _plan == 'yearly' ? 'yearly' : 'monthly');
            }),
          ),
        if (choice != null && !waiting) prices(choice),
        OnbNote(t('manage_store'), tight: true),
        OnbLegalLinks(links: [(t('terms'), () => widget.onLegal('terms_of_service')), (t('privacy'), () => widget.onLegal('privacy_policy'))], disabled: busy),
      ],
    );
  }
}
