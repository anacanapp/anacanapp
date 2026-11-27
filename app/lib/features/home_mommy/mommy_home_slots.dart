// Ported from: src/components/Dashboard.tsx (MommyDashboard children owned by other features:
//              IllnessHomeCard, WeaningHomeCard / WeaningFeedingLink, ParentingHomeCard, BooksHomeCarousel,
//              UpcomingAppointments, WaterWidget, PremiumBlurGate, AptekHomeCard, PartnerHomeCard, PremiumModal)
//
// The mommy home renders blocks that belong to other feature ports. They plug in here; an unregistered slot
// renders nothing (PremiumBlurGate: its child unchanged, i.e. the premium view). The app root overrides
// [mommyHomeSlotsProvider] once those features exist.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum MommySlot {
  /// `<IllnessHomeCard mode="active" onOpen={() => onNavigate('illness')} />` (top, under the hero).
  illnessActive,

  /// `<WeaningHomeCard />`.
  weaningHome,

  /// `<UpcomingAppointments />`.
  upcomingAppointments,

  /// `<IllnessHomeCard mode="entry" … />`.
  illnessEntry,

  /// `<ParentingHomeCard onOpen={() => onNavigateToTool('parenting')} />`.
  parentingHome,

  /// `<BooksHomeCarousel childMonths onOpen={() => onNavigate('books')} />` (admin or az only; the host checks).
  booksCarousel,

  /// `<WaterWidget variant="anacan" />`.
  waterWidget,

  /// `<WeaningFeedingLink />` (inside the open feeding picker, while breastfeeding is offered).
  weaningFeedingLink,

  /// `<AptekHomeCard stage="mommy" babyMonths babyName onOpen={onNavigate} />`.
  aptekHome,

  /// `<PartnerHomeCard lifeStage="mommy" babyMonths onOpen={onNavigate} />`.
  partnerHome,
}

/// Values a slot may need.
class MommySlotArgs {
  const MommySlotArgs({
    required this.onNavigate,
    required this.onNavigateToTool,
    this.childMonths,
    this.babyMonths,
    this.babyName,
  });

  /// `onNavigate(screen)`.
  final void Function(String screen) onNavigate;

  /// `onNavigateToTool(tool)`.
  final void Function(String tool) onNavigateToTool;

  /// `childAge?.months` (BooksHomeCarousel).
  final int? childMonths;

  /// `exactMonths` (Aptek / partner shop).
  final int? babyMonths;
  final String? babyName;
}

typedef MommySlotBuilder = Widget Function(BuildContext context, MommySlotArgs args);

/// `<PremiumBlurGate feature title subtitle blur>{child}</PremiumBlurGate>`.
class PremiumGateArgs {
  const PremiumGateArgs({required this.feature, required this.title, required this.subtitle, this.blur, required this.child});
  final String feature;
  final String title;
  final String subtitle;

  /// `'sm'` or null (default blur).
  final String? blur;
  final Widget child;
}

typedef PremiumGateBuilder = Widget Function(BuildContext context, PremiumGateArgs args);

class MommyHomeSlots {
  const MommyHomeSlots({this.slots = const {}, this.premiumGate, this.showPremiumModal});

  final Map<MommySlot, MommySlotBuilder> slots;

  /// Default: the child as is.
  final PremiumGateBuilder? premiumGate;

  /// `<PremiumModal isOpen feature />` opener (TrackerAIInsight limit CTA). Default: nothing.
  final void Function(BuildContext context, String feature)? showPremiumModal;

  Widget slot(BuildContext context, MommySlot id, MommySlotArgs args) => slots[id]?.call(context, args) ?? const SizedBox.shrink();

  bool has(MommySlot id) => slots.containsKey(id);

  Widget gate(BuildContext context, PremiumGateArgs args) => premiumGate?.call(context, args) ?? args.child;
}

final mommyHomeSlotsProvider = Provider<MommyHomeSlots>((ref) => const MommyHomeSlots());
