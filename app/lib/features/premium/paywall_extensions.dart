// Ported from: the paywall's references to src/components/paywall/EpointPayOption.tsx,
// src/components/qaygicash/QaygiCashPremium.tsx (QaygiCashPremiumOption, QcPremiumEarnLine) and
// src/components/premium/SponsorEntry.tsx
//
// Optional payment rows under the store button. They belong to the commerce phase (Epoint card checkout,
// QayğıCash, sponsor link); the paywall only reserves their slots. Each renders nothing unless the commerce
// feature overrides [paywallExtensionsProvider] (the React components also render nothing until the server
// enables them for the user's country/platform).

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

typedef EpointOptionBuilder = Widget Function(BuildContext context, {required String plan, required String source, required VoidCallback onPremium});
typedef QaygiCashOptionBuilder = Widget Function(BuildContext context, {required String plan, required VoidCallback onDone});
typedef QaygiCashEarnLineBuilder = Widget Function(BuildContext context, {required String plan});
typedef SponsorEntryBuilder = Widget Function(BuildContext context, {required VoidCallback onSelf});

class PaywallExtensions {
  const PaywallExtensions({this.epointOption, this.qaygiCashOption, this.qaygiCashEarnLine, this.sponsorEntry});

  /// `<EpointPayOption plan source onPremium style={{marginTop: 10}} />`.
  final EpointOptionBuilder? epointOption;

  /// `<QaygiCashPremiumOption plan onDone style={{marginTop: 10}} />`.
  final QaygiCashOptionBuilder? qaygiCashOption;

  /// `<QcPremiumEarnLine plan />` inside a plan card.
  final QaygiCashEarnLineBuilder? qaygiCashEarnLine;

  /// `<SponsorEntry onSelf />` (native only).
  final SponsorEntryBuilder? sponsorEntry;
}

final paywallExtensionsProvider = Provider<PaywallExtensions>((ref) => const PaywallExtensions());
