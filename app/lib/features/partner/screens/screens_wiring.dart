// Ported from: src/components/partner/v2/PartnerHomeScreen.tsx (PartnerLossCard, usePregnancyLossText),
//              src/components/tools/parenting/PartnerParentingScreen.tsx (usePartnerData)
//
// The values the partner screens give seams declared elsewhere. Appended to `partnerWiringOverrides()`
// (../partner_wiring.dart), which app_wiring.dart already spreads.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../tools/parenting/partner_parenting_screen.dart' show partnerParentingDataProvider;
import '../partner_ports.dart';
import 'partner_loss_support_screen.dart';
import 'partner_parenting.dart';
import '../../../services/ads/ad_seams.dart' show homeAdInlineAnchorSlot;
import '../../health_screens/register.dart' show partnerIllnessHomeCardSlot;

/// `partnerHomeSlotsProvider.lossCard`: `<PartnerLossCard lossDate onOpen />`.
Widget partnerLossCardSlot(BuildContext context, String? lossDate, VoidCallback onOpen) => PartnerLossCard(lossDate: lossDate, onOpen: onOpen);

/// The partner home slots filled by the partner screens (illness card and ads stay with their features).
const PartnerHomeSlots kPartnerScreensHomeSlots =
    PartnerHomeSlots(
  lossCard: partnerLossCardSlot,
  lossText: partnerLossTextFor,
  illnessHomeCard: partnerIllnessHomeCardSlot,
  adInlineAnchor: homeAdInlineAnchorSlot,
);

List<Override> partnerScreensWiringOverrides() => [
      partnerParentingDataProvider.overrideWith((ref) => ref.watch(partnerParentingDataFromPartnerProvider)),
      partnerHomeSlotsProvider.overrideWithValue(kPartnerScreensHomeSlots),
    ];
