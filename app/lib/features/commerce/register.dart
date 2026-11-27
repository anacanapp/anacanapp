// Ported from: src/pages/Index.tsx (screens `qaygicash`, `aptek[/…]`, `partners`; the `cakes` tab), src/App.tsx
//              (/payment/success, /payment/error, <PromoRedeemer />), src/components/ToolsHub.tsx (tool `cakes`,
//              AptekSearchResults), src/components/Dashboard.tsx (AptekHomeCard / PartnerHomeCard),
//              src/components/flow/FlowDashboard.tsx (PartnerHomeCard), src/components/tools/HospitalBag.tsx
//              (AptekHomeCard context="bag"), src/components/ProfileScreen.tsx (QaygiCashProfileCard,
//              PromoCodeDialog, the QayğıCash row), src/components/paywall/PaywallCore.tsx +
//              src/components/onboarding/OnboardingPaywall.tsx (EpointPayOption, QaygiCashPremiumOption,
//              QcPremiumEarnLine, SponsorEntry)
//
// The commerce feature (phase 7). `screen.referral` stays with the profile feature (ReferralScreen already
// registered there). The web-only pages (/p/v/:token, /h/:code landing, the Mağaza `shop` screen) are not ported.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/shell.dart';
import '../books/books_qaygicash.dart' show booksQaygiCashProvider;
import '../home_mommy/mommy_home_slots.dart' show MommySlot, MommySlotArgs;
import '../premium/paywall_extensions.dart';
import '../profile/profile_interfaces.dart' show qaygiCashRowProvider;
import 'aptek/aptek_entry.dart';
import 'aptek/aptek_screen.dart';
import 'cakes/cakes_screen.dart';
import 'epoint/epoint_pay_option.dart';
import 'partner_shop/partner_shop_ui.dart';
import 'partners/partners_screen.dart';
import 'payment/payment_result.dart';
import 'promo/promo_redeemer.dart';
import 'qaygicash/books_qaygicash_port.dart';
import 'qaygicash/qaygicash_cards.dart';
import 'qaygicash/qaygicash_premium.dart';
import 'qaygicash/qaygicash_screen.dart';
import 'sponsor/sponsor_sheet.dart';

void registerCommerceFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.qaygicash, (context, a) => QaygiCashScreen(onBack: a.onBack));
  // ErrorBoundary key="aptek": one store instance for every `aptek/<view>` id.
  r.registerScreen(ScreenId.aptek, (context, a) => AptekScreen(onBack: a.onBack, initialScreen: a.screen.raw));
  r.registerScreen(ScreenId.partners, (context, a) => PartnersScreen(onBack: a.onBack));
  r.registerTab(ShellTab.cakes, (context, a) => const CakesScreen());
  r.registerTool(ToolId.cakes, (context, a) => CakesScreen(onBack: a.onBack));
  r.registerRoutePage(OuterRouteId.paymentSuccess, (context, a) => const PaymentSuccessPage());
  r.registerRoutePage(OuterRouteId.paymentError, (context, a) => const PaymentErrorPage());
  // <PromoRedeemer /> (App.tsx): grants a saved /h/<CODE> gift code once signed in.
  r.registerFrameOverlay('promo-redeemer', (context) => const PromoRedeemer());
}

// ── slot builders for providers the app root already overrides (merge into those overrides) ─────────────

/// `HomeSlots.aptekHomeCard`: `<AptekHomeCard stage="bump" />`.
Widget commerceAptekHomeCard(BuildContext context, String stage) => AptekHomeCard(stage: stage);

/// `HomeSlots.partnerHomeCard`: `<PartnerHomeCard lifeStage="bump" pregnancyWeek />`.
Widget commercePartnerHomeCard(BuildContext context, int? pregnancyWeek) => PartnerHomeCard(lifeStage: 'bump', pregnancyWeek: pregnancyWeek);

/// `MommySlot.aptekHome`: `<AptekHomeCard stage="mommy" babyMonths babyName onOpen={onNavigate} />`.
Widget commerceMommyAptekHome(BuildContext context, MommySlotArgs args) =>
    AptekHomeCard(stage: 'mommy', babyMonths: args.babyMonths, babyName: args.babyName, onOpen: args.onNavigate);

/// `MommySlot.partnerHome`: `<PartnerHomeCard lifeStage="mommy" babyMonths onOpen={onNavigate} />`.
Widget commerceMommyPartnerHome(BuildContext context, MommySlotArgs args) =>
    PartnerHomeCard(lifeStage: 'mommy', babyMonths: args.babyMonths, onOpen: args.onNavigate);

/// The two mommy slots, keyed for `MommyHomeSlots.slots`.
const Map<MommySlot, Widget Function(BuildContext, MommySlotArgs)> commerceMommySlots = {
  MommySlot.aptekHome: commerceMommyAptekHome,
  MommySlot.partnerHome: commerceMommyPartnerHome,
};

/// `FlowHomeSlots.partnerHomeCard`: `<PartnerHomeCard lifeStage="flow" daysUntilPeriod />`.
Widget commerceFlowPartnerHomeCard(BuildContext context, int daysUntilPeriod) => PartnerHomeCard(lifeStage: 'flow', daysUntilPeriod: daysUntilPeriod);

/// `ProfileSlots.qaygiCashCard`: `<QaygiCashProfileCard onOpen />`.
Widget commerceQaygiCashProfileCard(BuildContext context, VoidCallback? onOpen) => QaygiCashProfileCard(onOpen: onOpen);

/// `ProfileSlots.promoDialog`: `<PromoCodeDialog open onClose />`.
Future<void> commercePromoDialog(BuildContext context) => showPromoCodeDialog(context);

/// `ToolsHubSlots.aptekSearchResults`: `<AptekSearchResults query close onOpen />`.
Widget commerceAptekSearchResults(BuildContext context, String query, VoidCallback close, void Function(String screen) onOpen) =>
    AptekSearchResults(query: query, close: close, onOpen: onOpen);

/// `PregnancyToolSlots.aptekBagCard`: HospitalBag `<AptekHomeCard stage="bump" context="bag" />` (`.a-scope`,
/// margin-top 4 is applied by the hospital bag).
Widget commerceAptekBagCard(BuildContext context) => const AptekHomeCard(stage: 'bump', context: 'bag');

/// The paywall rows (EpointPayOption / QaygiCashPremiumOption with `style={{ marginTop: 10 }}`, QcPremiumEarnLine,
/// SponsorEntry).
final PaywallExtensions commercePaywallExtensions = PaywallExtensions(
  epointOption: (context, {required plan, required source, required onPremium}) => EpointPayOption(plan: plan, source: source, onPremium: onPremium),
  qaygiCashOption: (context, {required plan, required onDone}) => QaygiCashPremiumOption(plan: plan, onDone: onDone, marginTop: 10),
  qaygiCashEarnLine: (context, {required plan}) => QcPremiumEarnLine(plan: plan),
  sponsorEntry: (context, {required onSelf}) => SponsorEntry(onSelf: onSelf),
);

/// Overrides of interfaces nobody else overrides yet (append to `featureWiringOverrides()`).
List<Override> commerceWiringOverrides() => [
  paywallExtensionsProvider.overrideWithValue(commercePaywallExtensions),
  // `useQaygiCashWallet().wallet` → the profile row.
  qaygiCashRowProvider.overrideWith((ref) => ref.watch(qaygiCashProfileRowProvider)),
  // The book store's QayğıCash parts (wallet, redeem row, badges, earn box, errors).
  booksQaygiCashProvider.overrideWith(CommerceBooksQaygiCash.new),
];
