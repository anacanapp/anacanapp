// Ported from: src/components/paywall/EpointPayOption.tsx, src/lib/in-app-epoint.ts (useInAppEpoint)
//
// "Pay with an Azerbaijani card (Epoint)": a secondary option under the store purchase button of the app paywall.
// Renders nothing unless app_settings.in_app_epoint allows the user's country and platform, card payments are live,
// the server has a price for the selected plan and the user has no Premium. Prices are the server's (web-premium
// 'status'), in AZN. The consent line is what the server records as 'premium-autorenew-v1' when the checkout starts.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/app_settings.dart' show appSettingProvider;
import '../../../core/i18n/i18n.dart';
import '../../../design/design.dart';
import '../../../native/purchases/premium_funnel.dart' show PremiumFunnel;
import '../../../native/purchases/purchases_providers.dart' show premiumFunnelProvider;
import '../../../state/persisted_store.dart' show localStoreProvider;
import '../../settings/ui/settings_ui.dart' show ALoader;
import '../commerce_backend.dart';
import '../common/commerce_ui.dart' show tabularFigures;
import 'in_app_epoint.dart';
import 'in_app_epoint_copy.dart';

/// The `useInAppEpoint` result a card renders.
class UseInAppEpoint {
  const UseInAppEpoint({
    required this.available,
    required this.eligible,
    required this.offer,
    required this.status,
    required this.messageKey,
    required this.startCheckout,
    required this.checkAgain,
  });

  /// Admin setting allows this user (country + platform), the merchant is live, there is a price and no Premium.
  final bool available;

  /// Country + platform pass the admin setting (prices may still be loading).
  final bool eligible;
  final EpointOffer? offer;
  final InAppEpointStatus status;

  /// Copy key of the last error / timeout message, if any.
  final String? messageKey;
  final Future<void> Function(EpointPlan plan) startCheckout;

  /// Re-run the entitlement check (after a timeout).
  final VoidCallback checkAgain;

  /// Where the user's current Premium comes from ('store', 'web_subscription', 'web_pass', 'promotional') or null.
  String? get activeSource => offer != null && offer!.premiumActive ? offer!.premiumSource : null;

  String? priceLabel(EpointPlan plan) {
    final value = offer?.plans[plan];
    return value == null ? null : formatAzn(value.price);
  }
}

/// `useQuery(['in-app-epoint-offer', userId], enabled: eligible, staleTime 60 s, retry false)`.
final inAppEpointOfferQuery = queryProviderFamily<EpointOffer?, ({String? userId, bool eligible})>(
  (ref, a) => QueryOptions<EpointOffer?>(
    queryKey: ['in-app-epoint-offer', a.userId],
    enabled: a.eligible,
    staleTime: const Duration(seconds: 60),
    retry: noRetry,
    queryFn: (_) => fetchEpointOffer(ref.read(commerceBackendProvider)),
  ),
);

/// The platform the funnel reports (`funnelPlatform()`).
final epointPlatformProvider = Provider<String>((ref) => ref.watch(premiumFunnelProvider).funnelPlatform());

class EpointPayOption extends ConsumerStatefulWidget {
  const EpointPayOption({super.key, required this.plan, this.source = 'paywall', this.onPremium, this.marginTop = 10});

  /// 'monthly' | 'yearly' | 'lifetime'.
  final String plan;

  /// Paywall placement for the funnel (same value as the store button's analytics source).
  final String source;

  /// Called once when Premium is confirmed after the payment.
  final VoidCallback? onPremium;
  final double marginTop;

  @override
  ConsumerState<EpointPayOption> createState() => _EpointPayOptionState();
}

class _EpointPayOptionState extends ConsumerState<EpointPayOption> {
  InAppEpointStatus _status = 'idle';
  String? _messageKey;
  bool _busy = false;
  bool _polling = false;
  AppLifecycleListener? _lifecycle;

  String? get _userId => ref.read(authUserProvider)?.id;

  @override
  void initState() {
    super.initState();
    // Back from the payment page: app resume, or a restart while a checkout was pending.
    _lifecycle = AppLifecycleListener(
      onResume: () {
        if (pendingCheckout(ref.read(localStoreProvider), _userId)) unawaited(_poll());
      },
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && pendingCheckout(ref.read(localStoreProvider), _userId)) unawaited(_poll());
    });
  }

  @override
  void dispose() {
    _lifecycle?.dispose();
    super.dispose();
  }

  void _set(InAppEpointStatus status, String? key) {
    if (!mounted) return;
    setState(() {
      _status = status;
      _messageKey = key;
    });
  }

  Future<void> _poll() async {
    final userId = _userId;
    if (userId == null || _polling) return;
    _polling = true;
    _set('checking', null);
    final backend = ref.read(commerceBackendProvider);
    final client = ref.read(queryClientProvider);
    final store = ref.read(localStoreProvider);
    final active = await pollUntil(() => hasOwnPremium(backend, userId), cancelled: () => !mounted);
    _polling = false;
    unawaited(
      client.invalidateQueries(
        predicate: (q) => q.queryKey.isNotEmpty && (epointPremiumRoots.contains('${q.queryKey.first}') || q.queryKey.first == 'in-app-epoint-offer'),
      ),
    );
    if (!mounted) return;
    // Either way the automatic check is over; "check again" stays available after a timeout.
    clearEpointPending(store);
    if (active) {
      _set('success', null);
    } else {
      _set('timeout', 'iep_timeout');
    }
  }

  Future<void> _startCheckout(EpointPlan plan, bool eligible, String platform) async {
    final userId = _userId;
    if (userId == null || _busy || !eligible) return;
    _busy = true;
    _set('starting', null);
    final PremiumFunnel funnel = ref.read(premiumFunnelProvider);
    funnel.funnelHit('epoint_started', widget.source);
    funnel.purchaseIntent(widget.source, plan);
    try {
      final result = await requestEpointCheckout(ref.read(commerceBackendProvider), plan, platform, currentLanguage());
      if (!result.ok) {
        _set('error', epointErrorKey(result.error, result.premiumSource));
        if (result.error == 'premium_active') unawaited(ref.read(queryClientProvider).invalidateQueries(queryKey: ['in-app-epoint-offer', userId]));
        return;
      }
      markEpointPending(ref.read(localStoreProvider), userId);
      _set('redirected', null);
      await ref.read(checkoutPageOpenerProvider).open(result.url!);
    } catch (_) {
      _set('error', 'iep_err_generic');
    } finally {
      _busy = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final userId = ref.watch(authUserProvider.select((u) => u?.id));
    final setting = parseInAppEpointSetting(ref.watch(appSettingProvider('in_app_epoint')));
    final platform = ref.watch(epointPlatformProvider);
    final country = resolveCountry(ref.watch(authProfileProvider.select((p) => p?.countryCode)));
    final eligible = userId != null && isInAppEpointEligible(setting, country, platform);
    final offerQ = ref.watch(inAppEpointOfferQuery((userId: userId, eligible: eligible)));
    final offer = eligible ? offerQ.data : null;
    final available =
        eligible && offer != null && offer.paymentsReady && !offer.premiumActive && (offer.plans['monthly'] != null || offer.plans['yearly'] != null);
    final epoint = UseInAppEpoint(
      available: available,
      eligible: eligible,
      offer: offer,
      status: _status,
      messageKey: _messageKey,
      startCheckout: (plan) => _startCheckout(plan, eligible, platform),
      checkAgain: () => unawaited(_poll()),
    );
    return EpointPayOptionView(plan: widget.plan, epoint: epoint, marginTop: widget.marginTop, onPremium: widget.onPremium);
  }
}

/// The card for a given hook result (EpointPayOption's markup and its "Premium confirmed" effect).
class EpointPayOptionView extends StatefulWidget {
  const EpointPayOptionView({super.key, required this.plan, required this.epoint, this.marginTop = 10, this.onPremium});
  final String plan;
  final UseInAppEpoint epoint;
  final double marginTop;

  /// Called once when Premium is confirmed after the payment.
  final VoidCallback? onPremium;

  @override
  State<EpointPayOptionView> createState() => _EpointPayOptionViewState();
}

class _EpointPayOptionViewState extends State<EpointPayOptionView> {
  bool _notified = false;

  void _notify() {
    if (widget.epoint.status == 'success' && !_notified) {
      _notified = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => widget.onPremium?.call());
    }
  }

  @override
  void initState() {
    super.initState();
    _notify();
  }

  @override
  void didUpdateWidget(EpointPayOptionView oldWidget) {
    super.didUpdateWidget(oldWidget);
    _notify();
  }

  @override
  Widget build(BuildContext context) {
    final plan = widget.plan;
    final epoint = widget.epoint;
    final marginTop = widget.marginTop;
    final inFlight = epoint.status == 'starting' || epoint.status == 'redirected' || epoint.status == 'checking';
    final showStatus = epoint.status != 'idle';
    final price = plan == 'lifetime' ? null : epoint.offer?.plans[plan];
    // After the checkout started the card stays visible for its status even if the offer changes (e.g. Premium now active).
    if (plan == 'lifetime' || (!epoint.available && !showStatus) || (price == null && !showStatus)) return const SizedBox.shrink();
    final a = context.a;
    final campaign = epoint.offer?.kind == 'campaign' && price?.was != null;
    return Padding(
      key: const ValueKey('epoint-pay-option'),
      padding: EdgeInsets.only(top: marginTop),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (price != null && epoint.available) ...[
            Semantics(
              button: true,
              enabled: !inFlight,
              child: GestureDetector(
                key: ValueKey('epoint-pay-$plan'),
                behavior: HitTestBehavior.opaque,
                onTap: inFlight ? null : () => unawaited(epoint.startCheckout(plan)),
                child: Opacity(
                  opacity: inFlight ? 0.6 : 1,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: a.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: a.lineStrong, width: 1.5),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(color: a.blue1, borderRadius: BorderRadius.circular(11)),
                          child: inFlight ? ALoader(size: 16, color: a.blueInk) : AIcon(AIcons.creditCard, size: 17, strokeWidth: 2.2, color: a.blueInk),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                iepText('iep_pay_title'),
                                style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: a.ink),
                              ),
                              const SizedBox(height: 2),
                              Wrap(
                                spacing: 6,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  if (campaign)
                                    Text(
                                      formatAzn(price.was!),
                                      style: TextStyle(fontSize: 12, color: a.inkSoft, decoration: TextDecoration.lineThrough, decorationColor: a.inkSoft),
                                    ),
                                  Text(
                                    iepFormat(plan == 'yearly' ? 'iep_price_yearly' : 'iep_price_monthly', {'price': formatAzn(price.price)}),
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: a.ink, fontFeatures: tabularFigures),
                                  ),
                                  if (price.usd != null) Text('≈ \$${price.usd!.toStringAsFixed(2)}', style: TextStyle(fontSize: 11, color: a.inkSoft)),
                                  if (campaign)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                                      decoration: BoxDecoration(color: a.peach1, borderRadius: BorderRadius.circular(999)),
                                      child: Text(
                                        iepText('iep_campaign'),
                                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: a.accentInk),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
              child: Text(
                iepText(plan == 'yearly' ? 'iep_consent_yearly' : 'iep_consent_monthly'),
                style: TextStyle(fontSize: 10.5, height: 1.45, color: a.inkSoft),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 3, 4, 0),
              child: Text(iepText('iep_legal'), style: TextStyle(fontSize: 9.5, height: 1.4, color: a.inkFaint)),
            ),
          ],
          if (showStatus) _EpointStatusLine(status: epoint.status, messageKey: epoint.messageKey, onRetry: epoint.checkAgain),
        ],
      ),
    );
  }
}

class _EpointStatusLine extends StatelessWidget {
  const _EpointStatusLine({required this.status, required this.messageKey, required this.onRetry});
  final InAppEpointStatus status;
  final String? messageKey;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final text = status == 'starting' || status == 'redirected'
        ? iepText('iep_opening')
        : status == 'checking'
        ? iepText('iep_checking')
        : status == 'success'
        ? iepText('iep_success')
        : messageKey != null
        ? iepText(messageKey!)
        : null;
    if (text == null) return const SizedBox.shrink();
    final a = context.a;
    final alert = status == 'error' || status == 'timeout';
    final tone = status == 'success'
        ? a.greenInk
        : alert
        ? a.alertInk
        : a.inkSoft;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Padding(
        key: ValueKey(alert ? 'epoint-alert' : 'epoint-status'),
        padding: const EdgeInsets.only(top: 8),
        child: Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            if (status == 'checking') ALoader(size: 13, color: tone),
            Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: tone),
            ),
            if (alert)
              GestureDetector(
                key: const ValueKey('epoint-check-again'),
                onTap: onRetry,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AIcon(AIcons.refreshCw, size: 11, color: a.ink),
                    const SizedBox(width: 4),
                    Text(
                      iepText('iep_check_again'),
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: a.ink, decoration: TextDecoration.underline, decorationColor: a.ink),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
