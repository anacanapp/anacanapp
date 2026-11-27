// Ported from: src/components/BillingScreen.tsx
//
// "My Subscription": plan status, start / renewal dates, cancel / resume / upgrade where the Premium is billed
// (App Store, Google Play or anacan.az), the Premium feature list and the store payment history.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/i18n/i18n.dart';
import '../../design/design.dart';
import '../../native/purchases/paywall_config.dart';
import '../../native/purchases/premium_config.dart';
import '../../native/purchases/purchase_errors.dart';
import '../../native/purchases/purchases_providers.dart';
import '../../native/purchases/revenuecat.dart' show RevenueCatConfig, storeSubscriptionsUrl;
import '../../native/purchases/subscription.dart';
import '../../native/purchases/web_premium_client.dart';
import '../home/widgets/home_widgets.dart' show APulse;
import '../premium/premium_modal.dart' show showPremiumModal;
import '../settings/ui/settings_ui.dart' show ALoader, ShadButton, ShadButtonVariant, ShadDialogFrame, Tw, cssUpper, px, toasts;
import 'billing_model.dart';
import 'billing_store.dart';
import 'cancellation_reason_dialog.dart';

/// `#63bd8b` (BillingScreen.tsx: active dot, restore button, included-feature tick).
const Color _green = Color(0xFF63BD8B);

/// `#ffc94d` (BillingScreen.tsx: scheduled-renewal timeline dot).
const Color _scheduledDot = Color(0xFFFFC94D);

String _fmt(String? iso) {
  final d = iso == null ? null : DateTime.tryParse(iso);
  if (d == null) return '';
  try {
    return formatDatePattern(d.toLocal(), 'd MMM yyyy');
  } catch (_) {
    return formatDatePattern(d.toLocal(), 'd MMM yyyy', language: 'en');
  }
}

class BillingScreen extends ConsumerStatefulWidget {
  const BillingScreen({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  ConsumerState<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends ConsumerState<BillingScreen> with InAppPurchaseHost<BillingScreen> {
  bool _isCanceling = false;
  bool _isRestoring = false;
  List<PaymentEntry> _payments = const [];
  bool _loadingPayments = false;
  String? _realPriceString;
  String? _activeProductId;
  bool _storeRead = false;
  String? _activeStore;
  WebPremiumState? _webState;
  bool _webBusy = false;

  String get _platform => ref.read(billingPlatformProvider);

  @override
  void initState() {
    super.initState();
    unawaited(_fetchPaymentHistory());
    ref.listenManual(subscriptionProvider.select((s) => s.ownPremium), (_, own) {
      // Premium bought on anacan.az (Epoint) is not visible to the store SDK.
      if (own) unawaited(_loadWebState());
    }, fireImmediately: true);
  }

  Future<void> _loadWebState() async {
    final state = await ref.read(webPremiumClientProvider).fetchState();
    if (mounted) setState(() => _webState = state);
  }

  Future<void> _fetchPaymentHistory() async {
    if (_platform == 'web') return;
    setState(() => _loadingPayments = true);
    try {
      final store = ref.read(billingStoreReaderProvider);
      final info = await store.customerInfo();
      if (info == null) throw StateError('no customer info');
      final history = paymentHistoryFrom(info, entitlementId: const RevenueCatConfig().entitlementId);
      if (!mounted) return;
      setState(() {
        _storeRead = true;
        _activeStore = history.activeStore;
        if (history.activeProductId != null) _activeProductId = history.activeProductId;
      });
      // The exact price the user pays (currency / country / promo) from the active product.
      final productId = history.activeProductId;
      if (productId != null) {
        try {
          final price = await store.priceString(productId);
          if (price != null && price.isNotEmpty && mounted) setState(() => _realPriceString = price);
        } catch (_) {}
      }
      if (mounted) setState(() => _payments = history.entries);
    } catch (_) {
      // Payment history is informational; failures keep the previous list.
    } finally {
      if (mounted) setState(() => _loadingPayments = false);
    }
  }

  BillingState _state(SubscriptionState sub) => BillingState(
        subscription: sub.subscription,
        isPremium: sub.isPremium,
        ownPremium: sub.ownPremium,
        householdPremium: sub.householdPremium,
        rowCancelled: sub.isCancelled,
        loading: sub.loading,
        platform: _platform,
        webState: _webState,
        storeRead: _storeRead,
        activeStore: _activeStore,
        activeProductId: _activeProductId,
        realPriceString: _realPriceString,
      );

  Future<void> _openStoreManagement(String store) async {
    // iOS: RevenueCat Customer Center when available, otherwise Apple's subscriptions page.
    if (store == 'ios' && purchases.isSupported && _platform == 'ios' && await purchases.showCustomerCenter()) return;
    await ref.read(billingLinkOpenerProvider)(Uri.parse(storeSubscriptionsUrl(store, _activeProductId)));
  }

  Future<void> _changeWebRenewal(String action) async {
    if (action == 'cancel') {
      final ok = await _confirm(tr('billing_web_cancel_confirm', 'Avtomatik yenilənmə dayandırılsın? Premium ödənilmiş dövrün sonuna qədər aktiv qalacaq.'));
      if (!ok || !mounted) return;
    }
    setState(() => _webBusy = true);
    final toast = toasts(context);
    final client = ref.read(webPremiumClientProvider);
    try {
      final result = await client.setRenewal(action);
      if (result == 'ok') {
        toast.show(
            title: action == 'cancel'
                ? tr('billing_web_cancel_done', 'Avtomatik yenilənmə dayandırıldı. Premium ödənilmiş dövrün sonuna qədər aktivdir.')
                : tr('billing_web_resume_done', 'Avtomatik yenilənmə yenidən aktivdir.'));
        await Future.wait<void>([_loadWebState(), ref.read(billingRefetchSubscriptionProvider)(ref)]);
      } else if (result == 'refused') {
        // The server keeps subscription management on anacan.az: open the cabinet there.
        await client.openCabinet();
      } else {
        toast.show(
          title: tr('billingscreen_error', 'Error'),
          description: tr('billing_action_failed', 'Əməliyyat alınmadı. İnternet bağlantısını yoxlayıb yenidən cəhd edin.'),
          destructive: true,
        );
      }
    } finally {
      if (mounted) setState(() => _webBusy = false);
    }
  }

  /// `window.confirm(text)` (the WebView shows the system dialog; here a minimal Radix-style one).
  Future<bool> _confirm(String text) async {
    final result = await showGeneralDialog<bool>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'close',
      barrierColor: const Color(0xCC000000),
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (ctx, _, _) => Center(
        child: ShadDialogFrame(maxWidth: 320, inset: 24, radius: 12, children: <Widget>[
          Text(text, style: Tw.sm.copyWith(color: ctx.tokens.shadcn.foreground)),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: <Widget>[
            ShadButton(
                key: const ValueKey<String>('billing-confirm-cancel'),
                variant: ShadButtonVariant.ghost,
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Cancel')),
            const SizedBox(width: 8),
            ShadButton(key: const ValueKey<String>('billing-confirm-ok'), onPressed: () => Navigator.of(ctx).pop(true), child: const Text('OK')),
          ]),
        ]),
      ),
    );
    return result == true;
  }

  Future<void> _proceedWithPlatformCancel() async {
    // Cancel where the subscription is billed. The app itself never marks a store subscription cancelled:
    // the store / anacan.az decides, sync follows.
    final st = _state(ref.read(subscriptionProvider));
    if (st.isWebSubscription) {
      await _changeWebRenewal('cancel');
      return;
    }
    final store = st.cancelStore;
    if (store != null) {
      setState(() => _isCanceling = true);
      try {
        await _openStoreManagement(store);
      } finally {
        if (mounted) setState(() => _isCanceling = false);
      }
      return;
    }
    // Web app without a store: subscriptions bought on anacan.az are managed in its cabinet.
    await ref.read(webPremiumClientProvider).openCabinet();
  }

  void _handleCancelSubscription(BillingState st) {
    unawaited(showCancellationReasonDialog(
      context,
      onProceed: () => unawaited(_proceedWithPlatformCancel()),
      planType: st.planType,
      wasTrial: st.subscription?['is_trial'] as bool?,
    ));
  }

  Future<void> _handleRestoreSubscription() async {
    final st = _state(ref.read(subscriptionProvider));
    setState(() => _isRestoring = true);
    final toast = toasts(context);
    try {
      // Cancelled anacan.az subscription: undo the cancellation before the period ends.
      if (st.isWebSubscription) {
        await _changeWebRenewal('resume');
        return;
      }
      // Cancelled store subscription: only the store can turn renewal back on.
      final storeKind = st.storeKind;
      if (storeKind != null) {
        await _openStoreManagement(storeKind);
        toast.show(title: tr('billing_store_resume_hint', 'Avtomatik yenilənməni mağazanın abunəlik səhifəsində yenidən aktiv edin.'));
        return;
      }
      // Unknown source: real store restore + server-side sync (never a local status flip).
      final outcome = await purchases.restorePurchasesDetailed();
      if (outcome.ok) {
        toast.show(
          title: tr('billingscreen_restore_success', 'Subscription Restored'),
          description: tr('billingscreen_restore_success_desc', 'Your Premium subscription is active again.'),
        );
      } else {
        toast.show(
          title: tr('billingscreen_error', 'Error'),
          destructive: true,
          description: outcome.failure == 'network'
              ? tr('restore_err_network', 'Bərpa alınmadı: mağaza ilə əlaqə yoxdur. İnternet bağlantısını yoxlayıb yenidən cəhd edin.')
              : outcome.failure == 'pending'
                  ? purchaseErrorMessage('PURCHASE_PENDING')
                  : tr('pw_restore_none_desc', 'Bu hesabla bağlı əvvəlki abunəlik yoxdur'),
        );
      }
    } finally {
      if (mounted) setState(() => _isRestoring = false);
    }
  }

  void _handleUpgrade(BillingState st) {
    final block = st.upgradeBlock();
    if (block != null) {
      toasts(context).show(title: purchaseErrorMessage(block));
      return;
    }
    unawaited(showPremiumModal(context));
  }

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final sub = ref.watch(subscriptionProvider);
    final config = ref.watch(billingConfigProvider);
    final features = ref.watch(premiumConfigProvider).features.where((f) => f['is_included_premium'] == true).toList();
    final st = _state(sub);
    final bottom = MediaQuery.paddingOf(context).bottom;

    final planName = st.householdOnly
        ? tr('billing_household_active', 'Ailə Premium-u (partnyorunuzun abunəliyi)')
        : !st.hasPremiumSub && !st.isPremium
            ? config.s('free_plan_name')
            : st.isPremiumPlus
                ? config.s('premium_yearly_name')
                : config.s('premium_monthly_name');
    final planPrice = st.planPrice;
    final planPeriod = planPrice.isEmpty ? '' : st.isPremiumPlus ? tr('common_per_year', '/year') : tr('common_per_month', '/month');

    return AScope(
      child: ColoredBox(
        color: a.bg,
        child: PurchasesBuilder(
          controller: purchases,
          builder: (context, _) => CustomScrollView(
            key: const ValueKey<String>('billing-scroll'),
            slivers: <Widget>[
              SliverPersistentHeader(pinned: true, delegate: _HeaderDelegate(onBack: widget.onBack)),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + (bottom > 16 ? bottom : 16)),
                sliver: SliverToBoxAdapter(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 512),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
                        _statusCard(context, st, planName, planPrice, planPeriod, config),
                        if (sub.ownPremium && st.subscription != null) ...<Widget>[
                          const SizedBox(height: 14),
                          _details(context, st, config),
                        ],
                        const SizedBox(height: 14),
                        _featuresCard(context, features, st.isPremium),
                        if (sub.ownPremium && st.subscription != null && _payments.isNotEmpty) ...<Widget>[
                          const SizedBox(height: 14),
                          _history(context, config),
                        ],
                        const SizedBox(height: 14),
                        _footer(context, config),
                      ]),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusCard(BuildContext context, BillingState st, String planName, String planPrice, String planPeriod, PaywallConfig config) {
    final a = context.a;
    final isPremium = st.isPremium;
    Widget badge;
    if (isPremium && !st.isCancelled) {
      badge = _Pill(
        key: const ValueKey<String>('billing-active-badge'),
        background: a.green1,
        children: <Widget>[
          APulse(child: Container(width: 6, height: 6, decoration: const BoxDecoration(color: _green, shape: BoxShape.circle))),
          Text(config.s('active_badge'), style: px(10, weight: FontWeight.w800, color: a.greenInk)),
        ],
      );
    } else if (st.isCancelled && isPremium) {
      badge = _Pill(
        key: const ValueKey<String>('billing-cancelled-badge'),
        background: a.yellow1,
        children: <Widget>[
          AIcon(AIcons.triangleAlert, size: 10, color: a.warnInk),
          Text(config.s('cancelled_badge'), style: px(10, weight: FontWeight.w800, color: a.warnInk)),
        ],
      );
    } else if (st.statusLoading) {
      badge = ALoader(key: const ValueKey<String>('billing-status-loading'), size: 14, color: a.inkSoft);
    } else {
      badge = Text(tr('billingscreen_status_free', 'Current Status: Free'), style: px(11.5, weight: FontWeight.w500, color: a.inkSoft));
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: a.surface,
        borderRadius: BorderRadius.circular(a.radiusMd),
        boxShadow: a.cardShadow,
        border: Border.all(color: isPremium ? a.peach2 : const Color(0x00000000), width: 1.5),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(children: <Widget>[
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                color: isPremium ? null : a.surfaceSoft,
                gradient: isPremium ? a.gradPeach : null,
              ),
              child: AIcon(AIcons.crown, size: 19, color: isPremium ? a.accentInk : a.inkSoft),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
                Text(planName, key: const ValueKey<String>('billing-plan-name'), style: px(17, weight: FontWeight.w800, color: a.ink, height: 1.2, ls: -0.01)),
                Padding(padding: const EdgeInsets.only(top: 2), child: badge),
              ]),
            ),
          ]),
        ),
        if (planPrice.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: <Widget>[
              Text(planPrice, key: const ValueKey<String>('billing-price'), textDirection: TextDirection.ltr, style: px(30, weight: FontWeight.w900, color: a.ink, ls: -0.03)),
              const SizedBox(width: 4),
              Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(planPeriod, style: px(13, weight: FontWeight.w600, color: a.inkSoft))),
            ]),
          ),
        if (st.isFreeUser)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: _PillButton(
              key: const ValueKey<String>('billing-upgrade-free'),
              height: 48,
              background: a.peach2,
              foreground: const Color(0xFFFFFFFF),
              // 0 14px 28px -12px rgba(217, 108, 74, 0.55)
              shadow: const <BoxShadow>[BoxShadow(color: Color(0x8CD96C4A), offset: Offset(0, 14), blurRadius: 28, spreadRadius: -12)],
              icon: AIcons.crown,
              iconGap: 16,
              label: tr('billingscreen_upgrade_btn', 'Upgrade to Premium'),
              onTap: () => unawaited(showPremiumModal(context)),
            ),
          ),
      ]),
    );
  }

  Widget _details(BuildContext context, BillingState st, PaywallConfig config) {
    final a = context.a;
    final sub = st.subscription!;
    final expires = sub['expires_at'] as String?;
    final busy = _isCanceling || _webBusy;

    Widget dateCard(String label, AIconData? icon, Color? iconColor, String value, Color valueColor, Key key) => Container(
          key: key,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(children: <Widget>[
                if (icon != null) ...<Widget>[AIcon(icon, size: 12, color: iconColor ?? a.inkSoft), const SizedBox(width: 4)],
                Flexible(child: Text(cssUpper(label), style: px(10, weight: FontWeight.w800, color: a.inkSoft, ls: 0.06))),
              ]),
            ),
            Text(value, style: px(13.5, weight: FontWeight.w700, color: valueColor)),
          ]),
        );

    final start = dateCard(config.s('start_date_label'), AIcons.calendar, null, _fmt(sub['started_at'] as String?), a.ink, const ValueKey<String>('billing-start'));
    final end = expires == null
        ? null
        : dateCard(
            st.isCancelled ? config.s('expiry_label') : config.s('renewal_label'),
            st.isCancelled ? AIcons.triangleAlert : AIcons.trendingUp,
            st.isCancelled ? a.yellowInk : a.accentInk,
            _fmt(expires),
            st.isCancelled ? a.yellowInk : a.ink,
            const ValueKey<String>('billing-end'),
          );

    Widget? actions;
    if (st.isCancelled) {
      actions = _PillButton(
        key: const ValueKey<String>('billing-restore'),
        height: 44,
        background: _green,
        foreground: const Color(0xFFFFFFFF),
        icon: AIcons.rotateCcw,
        iconGap: 16,
        loading: _isRestoring || _webBusy,
        label: st.storeKind != null && !st.isWebSubscription ? tr('billing_manage_in_store', 'Mağazada idarə et') : config.s('restore_cta'),
        onTap: _isRestoring || _webBusy ? null : () => unawaited(_handleRestoreSubscription()),
      );
    } else if (st.planType == 'premium') {
      actions = Row(children: <Widget>[
        Expanded(
          child: _PillButton(
            key: const ValueKey<String>('billing-upgrade'),
            height: 44,
            background: a.peach1,
            foreground: a.accentInk,
            icon: AIcons.crown,
            iconGap: 14,
            label: tr('billingscreen_upgrade', 'Upgrade'),
            onTap: () => _handleUpgrade(st),
          ),
        ),
        if (!st.nothingRenews) ...<Widget>[
          const SizedBox(width: 8),
          Expanded(
            child: _PillButton(
              key: const ValueKey<String>('billing-cancel'),
              height: 44,
              foreground: a.inkSoft,
              icon: AIcons.circleX,
              iconGap: 14,
              loading: _isCanceling,
              label: config.s('cancel_cta'),
              onTap: busy ? null : () => _handleCancelSubscription(st),
            ),
          ),
        ],
      ]);
    } else if (!st.nothingRenews) {
      actions = _PillButton(
        key: const ValueKey<String>('billing-cancel'),
        height: 44,
        foreground: a.inkSoft,
        icon: AIcons.circleX,
        iconGap: 16,
        loading: _isCanceling,
        label: config.s('cancel_cta'),
        onTap: busy ? null : () => _handleCancelSubscription(st),
      );
    }

    // grid-cols-2 gap-3: [start][end] then the col-span-2 action box (its own row).
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
      IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
          Expanded(child: start),
          const SizedBox(width: 12),
          Expanded(child: end ?? const SizedBox.shrink()),
        ]),
      ),
      const SizedBox(height: 12),
      Container(
        key: const ValueKey<String>('billing-actions'),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(18), boxShadow: a.cardShadow),
        // An empty flex box keeps its 8 px padding (16 px tall), as in React.
        child: actions ?? const SizedBox.shrink(),
      ),
    ]);
  }

  Widget _featuresCard(BuildContext context, List<Map<String, dynamic>> features, bool isPremium) {
    final a = context.a;
    return ClipRRect(
      borderRadius: BorderRadius.circular(a.radiusMd),
      child: Container(
        decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(color: a.surfaceSoft, border: Border(bottom: BorderSide(color: a.line))),
            child: _SectionTitle(icon: AIcons.layoutGrid, text: tr('billingscreen_premium_features', 'Premium Features')),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
              for (var i = 0; i < features.length; i++) ...<Widget>[
                if (i > 0) const SizedBox(height: 4),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(children: <Widget>[
                    Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(10)),
                      child: Text('${features[i]['icon'] ?? ''}', style: Tw.sm),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Text('${features[i]['title'] ?? ''}', style: px(12, weight: FontWeight.w600, color: a.ink))),
                    const SizedBox(width: 12),
                    Padding(
                      padding: const EdgeInsetsDirectional.only(end: 4),
                      child: isPremium ? const AIcon(AIcons.circleCheckBig, size: 14, color: _green) : AIcon(AIcons.lock, size: 14, color: a.inkFaint),
                    ),
                  ]),
                ),
              ],
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _history(BuildContext context, PaywallConfig config) {
    final a = context.a;
    final showStoreButton = purchases.isSupported && _platform != 'android';
    return Container(
      key: const ValueKey<String>('billing-history'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: a.surface, borderRadius: BorderRadius.circular(a.radiusMd), boxShadow: a.cardShadow),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: <Widget>[
            Flexible(child: _SectionTitle(icon: AIcons.creditCard, text: config.s('payment_title'))),
            Semantics(
              button: true,
              label: tr('billingscreen_refresh', 'Yenilə'),
              child: GestureDetector(
                key: const ValueKey<String>('billing-refresh'),
                behavior: HitTestBehavior.opaque,
                onTap: _loadingPayments ? null : () => unawaited(_fetchPaymentHistory()),
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: _loadingPayments
                      ? _Spin(child: AIcon(AIcons.refreshCw, size: 14, color: a.peach2))
                      : AIcon(AIcons.refreshCw, size: 14, color: a.inkSoft),
                ),
              ),
            ),
          ]),
        ),
        _Timeline(entries: _payments, paidLabel: config.s('paid_label')),
        if (showStoreButton)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: GestureDetector(
              key: const ValueKey<String>('billing-open-store'),
              behavior: HitTestBehavior.opaque,
              onTap: () async {
                await purchases.showCustomerCenter();
                unawaited(_fetchPaymentHistory());
              },
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(color: a.surfaceSoft, borderRadius: BorderRadius.circular(999)),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
                  Text(tr('billingscreen_open_in_store', 'View in App Store'), style: px(12, weight: FontWeight.w700, color: a.accentInk)),
                  const SizedBox(width: 6),
                  AIcon(AIcons.chevronRight, size: 14, color: a.accentInk, mirrorInRtl: true),
                ]),
              ),
            ),
          ),
      ]),
    );
  }

  Widget _footer(BuildContext context, PaywallConfig config) {
    final a = context.a;
    final email = config.s('support_email');
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 24),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 6,
        children: <Widget>[
          AIcon(AIcons.gift, size: 14, color: a.inkSoft),
          Text(tr('billingscreen_need_help', 'Need help?'), style: px(12, color: a.inkSoft)),
          GestureDetector(
            key: const ValueKey<String>('billing-support-email'),
            onTap: () => unawaited(ref.read(billingLinkOpenerProvider)(Uri.parse('mailto:$email'))),
            child: Text(email, style: px(12, weight: FontWeight.w700, color: a.accentInk)),
          ),
        ],
      ),
    );
  }
}

/// Opens store pages / mailto links outside the app (`window.open(url, '_system')`); overridable in tests.
final billingLinkOpenerProvider = Provider<Future<void> Function(Uri uri)>((ref) => (uri) async {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    });

class _HeaderDelegate extends SliverPersistentHeaderDelegate {
  _HeaderDelegate({required this.onBack});
  final VoidCallback onBack;

  // py-2.5 + 44 px back button (`.a-subscreen .sticky.top-0 > .a-icon-btn`) + 1 px bottom border.
  static const double _height = 10 + 44 + 10 + 1;

  @override
  double get minExtent => _height;
  @override
  double get maxExtent => _height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    final a = context.a;
    return AGlass.header(
      context: context,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(children: <Widget>[
        Semantics(
          button: true,
          label: tr('common_geri', 'Geri'),
          child: PressScale(
            key: const ValueKey<String>('billing-back'),
            scale: 0.95,
            onTap: onBack,
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: a.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: a.btnBorder),
                // .a-icon-btn: 0 6px 14px -8px rgba(217, 108, 74, .35)
                boxShadow: const <BoxShadow>[BoxShadow(color: Color(0x59D96C4A), offset: Offset(0, 6), blurRadius: 14, spreadRadius: -8)],
              ),
              child: AIcon(AIcons.arrowLeft, size: 16, strokeWidth: 2, color: a.ink, mirrorInRtl: true),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(tr('billingscreen_title', 'My Subscription'),
              maxLines: 1, overflow: TextOverflow.ellipsis, style: px(16, weight: FontWeight.w800, color: a.ink, ls: -0.01)),
        ),
      ]),
    );
  }

  @override
  bool shouldRebuild(_HeaderDelegate old) => old.onBack != onBack;
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.text});
  final AIconData icon;
  final String text;
  @override
  Widget build(BuildContext context) {
    final a = context.a;
    return Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
      AIcon(icon, size: 15, color: a.accentInk),
      const SizedBox(width: 6),
      Flexible(child: Text(text, style: px(13, weight: FontWeight.w800, color: a.ink))),
    ]);
  }
}

class _Pill extends StatelessWidget {
  const _Pill({super.key, required this.background, required this.children});
  final Color background;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
          for (var i = 0; i < children.length; i++) ...<Widget>[if (i > 0) const SizedBox(width: 4), children[i]],
        ]),
      );
}

/// shadcn `<Button>` with the screen's `rounded-full font-bold text-sm border-0` classes: icon (16 px, `gap-2` +
/// its `me-*` margin = [iconGap]) and label centred; disabled = 50 % opacity; a spinner replaces the icon.
class _PillButton extends StatelessWidget {
  const _PillButton({
    super.key,
    required this.height,
    required this.foreground,
    required this.icon,
    required this.iconGap,
    required this.label,
    required this.onTap,
    this.background,
    this.shadow,
    this.loading = false,
  });
  final double height;
  final Color? background;
  final Color foreground;
  final List<BoxShadow>? shadow;
  final AIconData icon;
  final double iconGap;
  final String label;
  final VoidCallback? onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    Widget body = Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999), boxShadow: shadow),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
        loading ? ALoader(size: 16, color: foreground) : AIcon(icon, size: 16, color: foreground),
        SizedBox(width: iconGap),
        Flexible(
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: px(14, weight: FontWeight.w700, color: foreground, height: 20 / 14)),
        ),
      ]),
    );
    if (disabled) body = Opacity(opacity: 0.5, child: body);
    return Semantics(button: true, enabled: !disabled, child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: onTap, child: body));
  }
}

class _Timeline extends StatelessWidget {
  const _Timeline({required this.entries, required this.paidLabel});
  final List<PaymentEntry> entries;
  final String paidLabel;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    // `relative ps-5 ms-1.5` with a 1 px line on the start side; the dots sit at `-start-[25px]`.
    // React drew the line with `borderLeft` (physical): in RTL it ended up on the far side (PARITY_FIXES.md).
    return Container(
      margin: const EdgeInsetsDirectional.only(start: 6),
      padding: const EdgeInsetsDirectional.only(start: 20),
      decoration: BoxDecoration(border: BorderDirectional(start: BorderSide(color: a.lineStrong))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: <Widget>[
        for (var i = 0; i < entries.length; i++) ...<Widget>[
          if (i > 0) const SizedBox(height: 16),
          _TimelineEntry(entry: entries[i], paidLabel: paidLabel),
        ],
      ]),
    );
  }
}

class _TimelineEntry extends StatelessWidget {
  const _TimelineEntry({required this.entry, required this.paidLabel});
  final PaymentEntry entry;
  final String paidLabel;

  @override
  Widget build(BuildContext context) {
    final a = context.a;
    final isNext = entry.type == 'next';
    final label = entry.type == 'original'
        ? tr('billingscreen_first_purchase', 'First Purchase')
        : isNext
            ? tr('billingscreen_next_renewal', 'Next Renewal')
            : tr('billingscreen_auto_renewal', 'Auto Renewal');
    return Stack(clipBehavior: Clip.none, children: <Widget>[
      PositionedDirectional(
        start: -25,
        top: 4,
        child: Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: isNext ? _scheduledDot : a.peach2,
            shape: BoxShape.circle,
            // box-shadow: 0 0 0 2px var(--a-surface)
            boxShadow: <BoxShadow>[BoxShadow(color: a.surface, spreadRadius: 2)],
          ),
        ),
      ),
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: <Widget>[
            Text(entry.isYearly ? tr('billingscreen_annual_premium', 'Annual Premium') : tr('billingscreen_monthly_premium', 'Monthly Premium'),
                style: px(12, weight: FontWeight.w700, color: a.ink)),
            Text('${_fmt(entry.date)} · $label', style: px(10, color: a.inkSoft)),
          ]),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
          decoration: BoxDecoration(color: isNext ? a.yellow1 : a.green1, borderRadius: BorderRadius.circular(7)),
          child: Text(
            cssUpper(isNext ? tr('billingscreen_scheduled', 'Scheduled') : paidLabel),
            style: px(9, weight: FontWeight.w800, color: isNext ? a.yellowInk : a.greenInk, ls: 0.04),
          ),
        ),
      ]),
    ]);
  }
}

/// `animate-spin` (1 s linear, infinite) around [child].
class _Spin extends StatefulWidget {
  const _Spin({required this.child});
  final Widget child;
  @override
  State<_Spin> createState() => _SpinState();
}

class _SpinState extends State<_Spin> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 1));
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!animationsDisabled(context) && !_c.isAnimating) _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RotationTransition(turns: _c, child: widget.child);
}
