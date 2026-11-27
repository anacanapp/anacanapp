// Ported from: src/components/premium/AdFreePremiumOffer.tsx
//
// "Go Premium to remove ads" card on the home screen. The first visible card of a visit is at the top; once it
// has really been seen (≥ 50 % on screen) the account/backend-scoped marker
// `anacan-ad-free-offer-seen-v1:<encodeURIComponent(backend)>:<user>` = '1' is written and later visits show it
// at the bottom. The placement of the current visit never moves while it is read. Hidden for Premium /
// household Premium and while the entitlement is unknown.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../design/design.dart';
import '../../native/purchases/purchases.dart';
import '../../state/persisted_store.dart';
import '../../state/shell_bindings.dart' show backendUrlProvider;
import '../../state/user_store.dart';
import '../onboarding/onboarding_i18n.dart';
import 'premium_modal.dart';

/// 'top' | 'bottom'
typedef OfferPosition = String;

final Set<String> _shownInMemory = {};

/// Test helper: forget this process' shown markers.
void resetAdFreeOfferMemory() => _shownInMemory.clear();

String adFreeOfferScope(String backend, String userId) => 'anacan-ad-free-offer-seen-v1:${Uri.encodeComponent(backend)}:$userId';

/// Reports how much of the card is visible (IntersectionObserver ≥ 0.5). The default fires at once, like the
/// fallback when IntersectionObserver is unavailable; a scroll-aware host may override it.
typedef VisibilityReporter = Widget Function({required Key key, required Widget child, required VoidCallback onHalfVisible});

final adFreeOfferVisibilityProvider = Provider<VisibilityReporter>((ref) => ({required key, required child, required onHalfVisible}) {
      WidgetsBinding.instance.addPostFrameCallback((_) => onHalfVisible());
      return KeyedSubtree(key: key, child: child);
    });

class AdFreePremiumOffer extends ConsumerWidget {
  const AdFreePremiumOffer({super.key, required this.position});
  final OfferPosition position;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(purchasesUserIdProvider);
    final backend = ref.watch(backendUrlProvider);
    final lifeStage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    final scope = userId != null ? adFreeOfferScope(backend, userId) : null;
    return _OfferForVisit(key: ValueKey('$scope:$lifeStage:$position'), scope: scope, position: position);
  }
}

class _OfferForVisit extends ConsumerStatefulWidget {
  const _OfferForVisit({super.key, required this.scope, required this.position});
  final String? scope;
  final OfferPosition position;
  @override
  ConsumerState<_OfferForVisit> createState() => _OfferForVisitState();
}

class _OfferForVisitState extends ConsumerState<_OfferForVisit> {
  late bool _intro;
  bool _remembered = false;

  bool _wasShown(String scope) {
    if (_shownInMemory.contains(scope)) return true;
    try {
      return ref.read(localStoreProvider).getItem(scope) == '1';
    } catch (_) {
      return false;
    }
  }

  @override
  void initState() {
    super.initState();
    final scope = widget.scope;
    // Both dashboard slots capture the same initial placement; recording the impression later does not move the
    // card or close its paywall while it is being read.
    _intro = scope != null && !_wasShown(scope);
  }

  void _remember() {
    final scope = widget.scope;
    if (_remembered || scope == null || !mounted) return;
    _remembered = true;
    _shownInMemory.add(scope);
    try {
      ref.read(localStoreProvider).setItem(scope, '1');
    } catch (_) {
      // Retain this session's placement if storage is unavailable.
    }
  }

  @override
  Widget build(BuildContext context) {
    final sub = ref.watch(subscriptionProvider);
    final scope = widget.scope;
    if (sub.isPremium && scope != null && _wasShown(scope)) _intro = false;
    final visible = scope != null && !sub.isPremium && !sub.loading && widget.position == (_intro ? 'top' : 'bottom');
    if (!visible) return const SizedBox.shrink();
    final language = ref.watch(appLanguagePreferenceProvider);
    String t(String key) => onboardingText(language, key);
    final a = context.a;
    final card = Container(
      key: const ValueKey('ad-free-premium-offer'),
      margin: const EdgeInsets.symmetric(vertical: 16),
      child: ACard(
        padding: const EdgeInsets.all(16),
        child: Semantics(
          container: true,
          label: t('remove_ads_premium'),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(top: 4), child: AIcon(AIcons.shieldCheck, size: 24, color: a.accentInk)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(t('remove_ads_premium'), style: TextStyle(fontSize: 14, height: 20 / 14, fontWeight: FontWeight.w700, color: a.ink)),
                  const SizedBox(height: 4),
                  Text(t('remove_ads_sub'), style: TextStyle(fontSize: 12, height: 16 / 12, color: a.inkSoft)),
                ]),
              ),
            ]),
            const SizedBox(height: 12),
            Semantics(
              button: true,
              label: t('premium_cta'),
              excludeSemantics: true,
              child: GestureDetector(
                onTap: () => showPremiumModal(context, feature: 'ad_free'),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 44),
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 11),
                  decoration: BoxDecoration(color: a.peach2, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    const AIcon(AIcons.crown, size: 16, color: Color(0xFFFFFFFF)),
                    const SizedBox(width: 6),
                    Text(t('premium_cta'), style: context.aText.aCtaBtn.copyWith(fontSize: 14)),
                  ]),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
    final wrapped = AScope(child: card);
    if (widget.position != 'top' || _remembered) return wrapped;
    return ref.watch(adFreeOfferVisibilityProvider)(key: const ValueKey('ad-free-visibility'), child: wrapped, onHalfVisible: _remember);
  }
}

/// The app language (`useUserStore(state => state.language)`).
final appLanguagePreferenceProvider = Provider<String>((ref) => ref.watch(userStoreProvider.select((s) => s.language)));
