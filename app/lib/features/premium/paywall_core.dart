// Ported from: src/components/paywall/PaywallCore.tsx
//
// Anacan's own paywall (the RevenueCat native paywall UI is not used): offerings from the SDK, stage-specific
// value list, store prices exactly as the store reports them, purchase bound to the selected package, restore,
// "refresh status" for a payment the server has not confirmed yet, retry when offerings failed. Shared by
// PremiumModal and other paywall surfaces.

import 'dart:async';

import 'package:flutter/physics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../domain/js_compat.dart' show jsRoundInt;
import '../../native/purchases/purchases.dart';
import '../../state/user_store.dart';
import '../onboarding/onboarding_i18n.dart';
import 'effect_tracker.dart';
import 'paywall_extensions.dart';
import 'paywall_stage_copy.dart';

/// 'yearly' | 'monthly' | 'lifetime'
typedef PlanKey = String;

/// Store-currency price in the app language's number format (as OnboardingPaywall).
String formatMoney(String language, double amount, String? currency) =>
    formatCurrency(language, amount, currency != null && RegExp(r'^[A-Z]{3}$').hasMatch(currency) ? currency : 'USD');

/// PaywallCore's literal rgba shadows/backgrounds (PaywallCore.tsx inline styles).
abstract final class _PwColors {
  /// `rgba(255,255,255,0.5)` inactive plan card.
  static const Color cardIdle = Color(0x80FFFFFF);

  /// `rgba(217, 108, 74, …)` peach shadow family.
  static Color peach(double a) => Color.fromRGBO(217, 108, 74, a);

  /// CTA gradient end `#e86a4c`.
  static const Color ctaEnd = Color(0xFFE86A4C);
}

class PaywallCore extends ConsumerStatefulWidget {
  const PaywallCore({super.key, this.feature, this.analyticsSource, required this.onPurchased, this.onNonNativeCta, this.compact = false});

  /// Analytics source (e.g. tool id); falls back to [feature].
  final String? analyticsSource;
  final String? feature;

  /// After a successful purchase / restore (`'yearly' | 'monthly' | 'lifetime' | 'restore' | 'epoint' | 'qaygicash'`).
  final void Function(String planId) onPurchased;

  /// Web / unsupported platform CTA (funnel: continue). Without it a toast is shown.
  final VoidCallback? onNonNativeCta;
  final bool compact;

  @override
  ConsumerState<PaywallCore> createState() => _PaywallCoreState();
}

class _PaywallCoreState extends ConsumerState<PaywallCore> with InAppPurchaseHost {
  PlanKey _selected = 'yearly';
  bool _restoring = false;
  bool _refreshing = false;
  final EffectTracker _fx = EffectTracker();

  String get _src => widget.analyticsSource ?? widget.feature ?? 'general';

  @override
  void dispose() {
    _fx.disposed = true;
    super.dispose();
  }

  RcPackage? _findPkg(String type, String idPart) {
    for (final p in purchases.packages) {
      if (p.packageType == type ||
          p.identifier == '\$rc_${idPart == 'yearly' ? 'annual' : idPart}' ||
          p.productIdentifier.contains(idPart) ||
          (idPart == 'yearly' && p.productIdentifier.contains('annual'))) {
        return p;
      }
    }
    return null;
  }

  AToastController? _toasts(BuildContext context) {
    try {
      return AToastHost.of(context);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) => PurchasesBuilder(controller: purchases, builder: (context, iap) => _build(context, iap));

  Widget _build(BuildContext context, InAppPurchaseController iap) {
    final cfg = ref.watch(paywallConfigProvider);
    final language = ref.watch(userStoreProvider.select((s) => s.language));
    final stage = paywallStage(ref.watch(userStoreProvider.select((s) => s.lifeStage)));
    final entitlement = ref.watch(premiumEntitlementProvider);
    String text(String key, [Map<String, Object?> values = const {}]) => onboardingText(language, key, values);
    final rc = iap.deps.rc;
    final isNative = rc.isNativePlatform;
    final platform = rc.getPlatform();

    final yearlyPkg = _findPkg('ANNUAL', 'yearly');
    final monthlyPkg = _findPkg('MONTHLY', 'monthly');
    final lifetimePkg = _findPkg('LIFETIME', 'lifetime');
    final yearlyPlan = annualStorePlan(yearlyPkg?.js, platform, iap.introEligibility[yearlyPkg?.productIdentifier ?? '']);
    final monthlyPlan = standardStorePlan(monthlyPkg?.js, platform, 'monthly', iap.introEligibility[monthlyPkg?.productIdentifier ?? '']);

    String? nonEmpty(String? s) => s == null || s.isEmpty ? null : s;
    // Web display reference only; native charges always use the actual store price.
    final currency = nonEmpty(yearlyPlan?.currency) ?? nonEmpty(monthlyPlan?.currency) ?? nonEmpty(yearlyPkg?.currencyCode) ?? nonEmpty(monthlyPkg?.currencyCode);
    final monthlyPrice = monthlyPlan?.price ?? monthlyPkg?.price ?? 3.99;
    final yearlyPrice = yearlyPlan?.price ?? yearlyPkg?.price ?? 29.99;
    final monthlyStr = isNative && monthlyPlan == null
        ? '–'
        : nonEmpty(monthlyPlan?.priceString) ?? nonEmpty(monthlyPkg?.priceString) ?? formatMoney(language, monthlyPrice, currency);
    final yearlyStr = isNative && yearlyPlan == null
        ? '–'
        : nonEmpty(yearlyPlan?.priceString) ?? nonEmpty(yearlyPkg?.priceString) ?? formatMoney(language, yearlyPrice, currency);
    final annualDiscount = yearlyPlan != null && yearlyPlan.price < yearlyPlan.renewalPrice;
    final lifetimeStr = lifetimePkg?.priceString ?? '';
    final yearlyPerMonth = formatMoney(language, yearlyPrice / 12, nonEmpty(yearlyPlan?.currency) ?? currency);
    // iOS with unknown intro eligibility: StoreKit charges the first-year price when eligible, otherwise the regular one.
    final introUncertainText = yearlyPlan?.introUncertain == true
        ? tr('pw_intro_uncertain_year', 'İlk il {intro}; bu təklifə uyğun deyilsinizsə {regular}')
            .replaceFirst('{intro}', yearlyPlan!.priceString)
            .replaceFirst('{regular}', yearlyPlan.renewalPriceString)
        : null;
    final pricesMissing = isNative && !iap.isLoading && yearlyPlan == null && monthlyPlan == null && lifetimePkg == null;
    final savings = annualDiscount
        ? jsRoundInt((1 - yearlyPlan.price / yearlyPlan.renewalPrice) * 100)
        : monthlyPrice > 0
            ? (jsRoundInt((1 - yearlyPrice / 12 / monthlyPrice) * 100)).clamp(0, 1 << 30)
            : 0;

    _fx.effect('shown', const [], () => ref.read(premiumFunnelProvider).funnelHit('paywall_shown', _src));
    _fx.effect('status', [iap.purchaseStatus], () {
      const map = {'cancelled': 'purchase_cancelled', 'failed': 'purchase_failed', 'pending': 'purchase_pending'};
      final ev = map[iap.purchaseStatus];
      if (ev != null) ref.read(premiumFunnelProvider).funnelHit(ev, _src);
    });
    _fx.effect('fallback', [isNative, iap.isLoading, _selected, yearlyPlan != null, monthlyPlan != null, lifetimePkg != null], () {
      if (!isNative || iap.isLoading || !mounted) return;
      final available = {'yearly': yearlyPlan != null, 'monthly': monthlyPlan != null, 'lifetime': lifetimePkg != null};
      if (available[_selected] == true) return;
      for (final key in const ['yearly', 'monthly', 'lifetime']) {
        if (available[key] == true) {
          setState(() => _selected = key);
          return;
        }
      }
    });

    final busy = iap.isPurchasing || _restoring;
    final t = context.a;

    Future<void> handlePurchase() async {
      final toasts = _toasts(context);
      if (!isNative || !iap.isSupported) {
        if (widget.onNonNativeCta != null) {
          widget.onNonNativeCta!();
          return;
        }
        toasts?.show(title: tr('pw_web_title', 'Premium mobil tətbiqdədir'), description: cfg.nonNativeNotice, destructive: true);
        return;
      }
      final pkg = _selected == 'yearly' ? yearlyPkg : _selected == 'monthly' ? monthlyPkg : lifetimePkg;
      final plan = _selected == 'yearly' ? yearlyPlan : _selected == 'monthly' ? monthlyPlan : null;
      if (pkg == null || (_selected != 'lifetime' && plan == null)) {
        toasts?.show(title: tr('pw_no_product', 'Məhsul tapılmadı'), description: tr('pw_no_product_desc', 'Bir az sonra yenidən cəhd edin'), destructive: true);
        return;
      }
      try {
        ref.read(analyticsSinkProvider).logPaywallClicked(_src, _selected);
      } catch (_) {}
      final funnel = ref.read(premiumFunnelProvider);
      funnel.funnelHit('paywall_clicked', _src);
      funnel.purchaseIntent(_src, _selected);
      funnel.funnelHit('purchase_started', _src);
      final premium = PremiumPurchaseContext(ownPremium: entitlement.ownPremium, householdPremium: entitlement.householdPremium);
      final selected = _selected;
      final ok = plan != null ? await iap.purchaseExact(plan.pkg!, plan.request, premium) : await iap.purchaseByIdentifier(pkg.identifier, premium);
      if (ok) {
        toasts?.show(title: tr('pw_success_title', 'Premium aktivləşdirildi! 🎉'), description: tr('pw_success_desc', 'Bütün imkanlar açıldı — xoş istifadələr!'));
        widget.onPurchased(selected);
      }
    }

    Future<void> handleRestore() async {
      final toasts = _toasts(context);
      ref.read(premiumFunnelProvider).funnelHit('restore_clicked', _src);
      setState(() => _restoring = true);
      final outcome = await iap.restorePurchasesDetailed();
      if (mounted) setState(() => _restoring = false);
      if (outcome.ok) {
        toasts?.show(title: tr('pw_restored', 'Alışlar bərpa edildi ✓'), description: tr('pw_restored_desc', 'Premium abunəliyiniz aktivdir'));
        widget.onPurchased('restore');
      } else if (outcome.failure == 'pending') {
        // The alert + "refresh status" button cover a pending server confirmation.
      } else if (outcome.failure == 'network' || outcome.failure == 'error' || outcome.failure == 'account') {
        toasts?.show(
          title: tr('useinapppurchase_alislar_berpa_edile_bilmedi_33b266', 'Alışlar bərpa edilə bilmədi'),
          destructive: true,
          description: outcome.failure == 'network'
              ? tr('restore_err_network', 'Bərpa alınmadı: mağaza ilə əlaqə yoxdur. İnternet bağlantısını yoxlayıb yenidən cəhd edin.')
              : outcome.failure == 'account'
                  ? purchaseErrorMessage('REVENUECAT_ACCOUNT_MISMATCH')
                  : purchaseErrorMessage('STORE_PROBLEM'),
        );
      } else {
        toasts?.show(title: tr('pw_restore_none', 'Alış tapılmadı'), description: tr('pw_restore_none_desc', 'Bu hesabla bağlı əvvəlki abunəlik yoxdur'), destructive: true);
      }
    }

    Future<void> handleRefreshStatus() async {
      final toasts = _toasts(context);
      setState(() => _refreshing = true);
      final ok = await iap.retryActivation();
      if (mounted) setState(() => _refreshing = false);
      if (ok) {
        toasts?.show(title: tr('pw_success_title', 'Premium aktivləşdirildi! 🎉'));
        widget.onPurchased('restore');
      }
    }

    final ctaText = text('premium_cta');
    final gap = widget.compact ? 12.0 : 16.0;
    final features = paywallFeatures(stage);
    final proof = paywallSocialProof();
    final tints = [(t.peach1, t.accentInk), (t.pink1, t.berryInk), (t.lav1, t.lavInk), (t.blue1, t.blueInk), (t.green1, t.greenInk), (t.yellow1, t.warnInk)];

    Widget planCard({required PlanKey plan, required String label, required String priceMain, String? suffix, required String sub, String? badge, Widget? icon, String? oldPrice, Widget? extra}) {
      final active = _selected == plan;
      final card = AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: ACurves.cssEase,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: active ? t.surface : _PwColors.cardIdle,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: active ? t.peach2 : t.lineStrong, width: 2),
          boxShadow: active ? [BoxShadow(color: _PwColors.peach(0.55), offset: const Offset(0, 16), blurRadius: 32, spreadRadius: -18)] : const [],
        ),
        child: Row(children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? t.peach2 : null,
              border: active ? null : Border.all(color: t.inkFaint, width: 2),
            ),
            alignment: Alignment.center,
            child: active ? const AIcon(AIcons.check, size: 12, strokeWidth: 3.5, color: Color(0xFFFFFFFF)) : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                if (icon != null) ...[icon, const SizedBox(width: 6)],
                Flexible(child: Text(label, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: t.ink))),
              ]),
              Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub, style: TextStyle(fontSize: 10.5, color: t.inkSoft))),
              ?extra,
            ]),
          ),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            if (oldPrice != null) Text(oldPrice, style: TextStyle(fontSize: 12, color: t.inkSoft, decoration: TextDecoration.lineThrough)),
            Text.rich(TextSpan(children: [
              TextSpan(text: priceMain, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900, color: t.ink, letterSpacing: em(-0.02, 19))),
              if (suffix != null && suffix.isNotEmpty) TextSpan(text: suffix, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w500, color: t.inkSoft)),
            ])),
          ]),
        ]),
      );
      return Semantics(
        key: ValueKey('plan-$plan'),
        button: true,
        toggled: active,
        label: label,
        child: PressScale(
          scale: 0.98,
          enabled: !(AnacanTokens.of(context).lite || animationsDisabled(context)),
          onTap: () => setState(() => _selected = plan),
          child: Stack(clipBehavior: Clip.none, children: [
            card,
            if (badge != null)
              PositionedDirectional(
                top: -10,
                end: 16,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    gradient: t.gradPeach,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: t.chipOverlay),
                    boxShadow: [BoxShadow(color: _PwColors.peach(0.5), offset: const Offset(0, 6), blurRadius: 14, spreadRadius: -6)],
                  ),
                  child: Text(badge,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, letterSpacing: em(0.06, 9.5), color: t.accentInk)),
                ),
              ),
          ]),
        ),
      );
    }

    final plans = <Widget>[
      planCard(
        plan: 'yearly',
        label: cfg.yearlyLabel,
        priceMain: yearlyStr,
        suffix: cfg.yearlyTotalSuffix,
        oldPrice: annualDiscount ? yearlyPlan.renewalPriceString : null,
        sub: isNative && yearlyPlan == null
            ? text('store_unavailable')
            : introUncertainText ?? (annualDiscount ? text('first_year', {'price': yearlyStr}) : '$yearlyPerMonth${cfg.yearlySuffix} · ${tr('pw_billed_yearly', 'ildə bir dəfə ödənilir')}'),
        badge: isNative && yearlyPlan == null ? null : cfg.savingsBadge.replaceFirst('{percent}', '$savings'),
        extra: ref.watch(paywallExtensionsProvider).qaygiCashEarnLine?.call(context, plan: 'yearly'),
      ),
      planCard(
        plan: 'monthly',
        label: cfg.monthlyLabel,
        priceMain: monthlyStr,
        suffix: cfg.monthlySuffix,
        sub: isNative && monthlyPlan == null ? text('store_unavailable') : tr('pw_flexible', 'Çevik — istənilən ay dayandır'),
        extra: ref.watch(paywallExtensionsProvider).qaygiCashEarnLine?.call(context, plan: 'monthly'),
      ),
      if (lifetimePkg != null)
        planCard(
          plan: 'lifetime',
          label: tr('pw_lifetime', 'Ömürlük'),
          priceMain: lifetimeStr,
          sub: tr('pw_lifetime_sub', 'Bir dəfə ödə — həmişəlik sənin'),
          icon: AIcon(AIcons.infinity, size: 14, color: t.accentInk),
        ),
    ];

    final ext = ref.watch(paywallExtensionsProvider);
    final ctaDisabled = busy ||
        (iap.isLoading && isNative) ||
        (isNative && iap.purchaseStatus == 'pending') ||
        (isNative && _selected != 'lifetime' && (_selected == 'yearly' ? yearlyPlan : monthlyPlan) == null);
    Widget pill({required Widget child, required VoidCallback? onTap}) => GestureDetector(
          onTap: onTap,
          child: Opacity(
            opacity: onTap == null ? 0.6 : 1,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: t.lineStrong)),
              child: DefaultTextStyle.merge(style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: t.ink), child: child),
            ),
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(12)),
          child: Text(paywallHeadline(stage), textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w700, color: t.ink)),
        ),
        if (iap.error != null)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(gradient: t.alertBg, borderRadius: BorderRadius.circular(14)),
            child: Column(children: [
              Text(iap.error!, textAlign: TextAlign.center, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: t.alertInk)),
              if (iap.purchaseStatus == 'pending' && isNative)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Semantics(
                    button: true,
                    child: pill(
                      onTap: _refreshing || busy ? null : handleRefreshStatus,
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        _Spin(spinning: _refreshing, child: AIcon(AIcons.refreshCw, size: 12, color: t.ink)),
                        const SizedBox(width: 6),
                        Text(text('refresh_status')),
                      ]),
                    ),
                  ),
                ),
            ]),
          ),
        Padding(
          padding: EdgeInsets.only(bottom: gap),
          child: _FeatureGrid(children: [
            for (final (i, f) in features.indexed)
              _RiseIn(
                delay: Duration(milliseconds: 50 + i * 40),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
                  decoration: BoxDecoration(
                    color: t.surface,
                    borderRadius: BorderRadius.circular(15),
                    boxShadow: [BoxShadow(color: _PwColors.peach(0.4), offset: const Offset(0, 8), blurRadius: 18, spreadRadius: -14)],
                  ),
                  child: Row(children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(color: tints[i % 6].$1, borderRadius: BorderRadius.circular(10)),
                      alignment: Alignment.center,
                      child: Text(f.icon, style: const TextStyle(fontSize: 14)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(f.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: t.ink, height: 1.25)),
                    ),
                  ]),
                ),
              ),
          ]),
        ),
        Padding(
          key: const ValueKey('paywall-social-proof'),
          padding: EdgeInsets.only(bottom: gap),
          child: Wrap(alignment: WrapAlignment.center, spacing: 6, children: [
            for (final s in [proof.rating, '·', proof.downloads]) Text(s, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: t.inkSoft)),
          ]),
        ),
        if (iap.isLoading && isNative)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              _Spin(spinning: true, child: AIcon(AIcons.loaderCircle, size: 16, color: t.inkSoft)),
              const SizedBox(width: 8),
              Text(tr('pw_loading_prices', 'Qiymətlər yüklənir...'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: t.inkSoft)),
            ]),
          )
        else
          Padding(
            padding: EdgeInsets.only(top: 6, bottom: gap),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (i, p) in plans.indexed) ...[if (i > 0) const SizedBox(height: 10), p],
            ]),
          ),
        if (isNative && !iap.isLoading && (iap.offeringsFailed || pricesMissing))
          Padding(
            padding: EdgeInsets.only(bottom: gap),
            child: Column(children: [
              Text(tr('pw_prices_failed', 'Qiymətləri yükləmək alınmadı. Bağlantını yoxlayıb yenidən cəhd edin.'),
                  textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: t.inkSoft)),
              const SizedBox(height: 8),
              Semantics(
                button: true,
                child: GestureDetector(
                  onTap: busy ? null : () => unawaited(iap.reloadOfferings()),
                  child: Opacity(
                    opacity: busy ? 0.6 : 1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(color: t.surface, borderRadius: BorderRadius.circular(999), border: Border.all(color: t.lineStrong)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        AIcon(AIcons.refreshCw, size: 13, color: t.ink),
                        const SizedBox(width: 6),
                        Text(tr('paymenterror_yeniden_cehd_et_d273ac', 'Yenidən cəhd et'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: t.ink)),
                      ]),
                    ),
                  ),
                ),
              ),
            ]),
          ),
        _CtaButton(
          label: busy ? cfg.purchasingText : ctaText,
          busy: busy,
          dimmed: busy || (iap.isLoading && isNative),
          disabled: ctaDisabled,
          onPressed: () => unawaited(handlePurchase()),
        ),
        if (_selected != 'lifetime' && ext.qaygiCashOption != null)
          Padding(padding: const EdgeInsets.only(top: 10), child: ext.qaygiCashOption!(context, plan: _selected, onDone: () => widget.onPurchased('qaygicash'))),
        if (_selected != 'lifetime' && ext.epointOption != null)
          Padding(padding: const EdgeInsets.only(top: 10), child: ext.epointOption!(context, plan: _selected, source: _src, onPremium: () => widget.onPurchased('epoint'))),
        if (_selected == 'yearly' && yearlyPlan != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              '${introUncertainText ?? text('charged_today', {'price': yearlyPlan.priceString})} ${text('renewal_year', {'price': yearlyPlan.renewalPriceString})}',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, height: 16 / 12, color: t.inkSoft),
            ),
          ),
        if (_selected == 'monthly' && monthlyPlan != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              '${text('charged_today', {'price': monthlyPlan.priceString})} ${text('renewal_month', {'price': monthlyPlan.renewalPriceString})}',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, height: 16 / 12, color: t.inkSoft),
            ),
          ),
        if (isNative && ext.sponsorEntry != null) ext.sponsorEntry!(context, onSelf: () => unawaited(handlePurchase())),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            AIcon(AIcons.shield, size: 12, color: t.greenInk),
            const SizedBox(width: 6),
            Flexible(child: Text(cfg.cancelNotice, textAlign: TextAlign.center, style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: t.inkSoft))),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Wrap(alignment: WrapAlignment.center, crossAxisAlignment: WrapCrossAlignment.center, spacing: 8, runSpacing: 4, children: [
            if (isNative && iap.isSupported) ...[
              Semantics(
                button: true,
                child: GestureDetector(
                  onTap: busy ? null : () => unawaited(handleRestore()),
                  child: Opacity(
                    opacity: busy ? 0.5 : 1,
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      _Spin(spinning: _restoring, child: AIcon(AIcons.refreshCw, size: 11, color: t.inkSoft)),
                      const SizedBox(width: 4),
                      Text(cfg.restoreText, style: TextStyle(fontSize: 10.5, color: t.inkSoft)),
                    ]),
                  ),
                ),
              ),
              Text('•', style: TextStyle(fontSize: 10.5, color: t.inkFaint)),
            ],
            _Link(cfg.termsLabel, 'https://anacan.az/az/istifade-sertleri/', t.inkSoft),
            Text('•', style: TextStyle(fontSize: 10.5, color: t.inkFaint)),
            _Link(cfg.privacyLabel, 'https://anacan.az/az/mexfilik-siyaseti/', t.inkSoft),
          ]),
        ),
        if (!isNative && cfg.nonNativeNotice.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              AIcon(AIcons.sparkles, size: 11, color: t.inkSoft),
              const SizedBox(width: 4),
              Flexible(child: Text(cfg.nonNativeNotice, textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: t.inkSoft))),
            ]),
          ),
      ],
    );
  }
}

/// `grid grid-cols-2 gap-2`.
class _FeatureGrid extends StatelessWidget {
  const _FeatureGrid({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i += 2) {
      rows.add(IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: children[i]),
          const SizedBox(width: 8),
          Expanded(child: i + 1 < children.length ? children[i + 1] : const SizedBox.shrink()),
        ]),
      ));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      for (final (i, r) in rows.indexed) ...[if (i > 0) const SizedBox(height: 8), r],
    ]);
  }
}

class _Link extends StatelessWidget {
  const _Link(this.label, this.url, this.color);
  final String label;
  final String url;
  final Color color;
  @override
  Widget build(BuildContext context) => Semantics(
        link: true,
        child: GestureDetector(
          onTap: () => unawaited(launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication)),
          child: Text(label, style: TextStyle(fontSize: 10.5, color: color, decoration: TextDecoration.underline)),
        ),
      );
}

/// `animate-spin` while [spinning].
class _Spin extends StatefulWidget {
  const _Spin({required this.spinning, required this.child});
  final bool spinning;
  final Widget child;
  @override
  State<_Spin> createState() => _SpinState();
}

class _SpinState extends State<_Spin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));
  void _sync() {
    if (widget.spinning && !animationsDisabled(context)) {
      if (!_c.isAnimating) _c.repeat();
    } else {
      _c
        ..stop()
        ..value = 0;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  @override
  void didUpdateWidget(_Spin old) {
    super.didUpdateWidget(old);
    _sync();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: widget.child);
}

/// framer `initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} transition={{delay}}`: opacity tween
/// (300 ms, framer default curve), y on framer's transform spring (500/25). Reduced motion keeps the fade only.
class _RiseIn extends StatefulWidget {
  const _RiseIn({required this.delay, required this.child});
  final Duration delay;
  final Widget child;
  @override
  State<_RiseIn> createState() => _RiseInState();
}

class _RiseInState extends State<_RiseIn> with TickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
  late final AnimationController _y = AnimationController.unbounded(vsync: this, value: 10);
  Timer? _timer;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final reduced = AnacanTokens.of(context).lite || animationsDisabled(context);
    if (reduced) _y.value = 0;
    _timer = Timer(widget.delay, () {
      if (!mounted) return;
      _fade.animateTo(1, curve: ACurves.framerDefault);
      if (!reduced) _y.animateWith(SpringSimulation(ASprings.transform, 10, 0, 0));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _fade.dispose();
    _y.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: Listenable.merge([_fade, _y]),
        builder: (context, child) => Opacity(opacity: _fade.value.clamp(0.0, 1.0), child: Transform.translate(offset: Offset(0, _y.value), child: child)),
        child: widget.child,
      );
}

/// The CTA: 56 px pill, `linear-gradient(135deg, var(--a-peach-2), #e86a4c)`, shine sweep every 3.6 s.
class _CtaButton extends StatefulWidget {
  const _CtaButton({required this.label, required this.busy, required this.dimmed, required this.disabled, required this.onPressed});
  final String label;
  final bool busy;
  final bool dimmed;
  final bool disabled;
  final VoidCallback onPressed;
  @override
  State<_CtaButton> createState() => _CtaButtonState();
}

class _CtaButtonState extends State<_CtaButton> with SingleTickerProviderStateMixin {
  // 2.2 s sweep + 1.4 s repeatDelay.
  late final AnimationController _shine = AnimationController(vsync: this, duration: const Duration(milliseconds: 3600));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_shine.isAnimating && !animationsDisabled(context)) _shine.repeat();
  }

  @override
  void dispose() {
    _shine.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.a;
    final body = Container(
      height: 56,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [t.peach2, _PwColors.ctaEnd]),
        boxShadow: [BoxShadow(color: _PwColors.peach(0.65), offset: const Offset(0, 18), blurRadius: 36, spreadRadius: -12)],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        if (!widget.busy)
          AnimatedBuilder(
            animation: _shine,
            builder: (context, _) {
              final p = (_shine.value * 3600 / 2200).clamp(0.0, 1.0);
              final x = -0.2 + 1.4 * ACurves.cssEaseInOut.transform(p);
              return LayoutBuilder(builder: (context, c) {
                final rtl = Directionality.of(context) == TextDirection.rtl;
                final left = c.maxWidth * x;
                return Stack(children: [
                  Positioned(
                    top: 0,
                    bottom: 0,
                    left: rtl ? null : left,
                    right: rtl ? left : null,
                    width: 60,
                    child: Transform(
                      transform: Matrix4.skewX(-0.349),
                      child: const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [Color(0x00FFFFFF), Color(0x73FFFFFF), Color(0x00FFFFFF)]),
                        ),
                      ),
                    ),
                  ),
                ]);
              });
            },
          ),
        Center(
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            widget.busy
                ? const _Spin(spinning: true, child: AIcon(AIcons.loaderCircle, size: 17, color: Color(0xFFFFFFFF)))
                : const AIcon(AIcons.crown, size: 17, strokeWidth: 2.2, color: Color(0xFFFFFFFF)),
            const SizedBox(width: 8),
            Flexible(child: Text(widget.label, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: Color(0xFFFFFFFF)))),
          ]),
        ),
      ]),
    );
    return Semantics(
      button: true,
      enabled: !widget.disabled,
      label: widget.label,
      excludeSemantics: true,
      child: PressScale(
        scale: widget.busy ? 1 : 0.98,
        enabled: !widget.disabled && !(AnacanTokens.of(context).lite || animationsDisabled(context)),
        onTap: widget.disabled ? null : widget.onPressed,
        child: Opacity(opacity: widget.dimmed ? 0.65 : 1, child: body),
      ),
    );
  }
}
