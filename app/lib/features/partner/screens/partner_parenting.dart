// Ported from: src/components/tools/parenting/PartnerParentingScreen.tsx (its `usePartnerData()` read), src/pages/Index.tsx
//              (`partner-parenting` → `<PremiumToolBoundary onClose><PartnerParentingScreen onBack /></PremiumToolBoundary>`)
//
// The parenting tool owns PartnerParentingScreen (features/tools/parenting/partner_parenting_screen.dart); the partner
// feature supplies her data through `partnerParentingDataProvider` and registers the screen.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../premium/premium_gates.dart' show PremiumToolBoundary;
import '../../tools/parenting/partner_parenting_screen.dart';
import '../data/partner_data.dart';

/// `usePartnerData()` → [PartnerParentingData] (her profile baby + the active children he can see).
PartnerParentingData partnerParentingDataOf(PartnerData d) {
  final p = d.partnerProfile;
  return PartnerParentingData(
    babyName: p?.babyName,
    babyBirthDate: p?.babyBirthDate,
    hasProfile: p != null,
    children: [
      for (final c in d.partnerChildren) PartnerChildRow(id: c.id, name: c.name, birthDate: c.birthDate, isCurrent: c.isCurrent, dueDate: c.dueDate),
    ],
  );
}

/// The value of `partnerParentingDataProvider` (see `partnerScreensWiringOverrides`).
final partnerParentingDataFromPartnerProvider = Provider.autoDispose<PartnerParentingData>((ref) => partnerParentingDataOf(ref.watch(partnerDataProvider)));

/// `partner-parenting`: the paid tool behind its boundary.
class PartnerParentingEntry extends StatelessWidget {
  const PartnerParentingEntry({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => PremiumToolBoundary(onClose: onBack, child: PartnerParentingScreen(onBack: onBack));
}
