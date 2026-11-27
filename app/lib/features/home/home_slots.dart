// Ported from: src/components/Dashboard.tsx (imports of blocks owned by other features: BannerSlot,
//              AdFreePremiumOffer, AdInlineAnchor, PartnerCareCard, RecoveryHome, BabyChatCard, BooksHomeCard,
//              AptekHomeCard, PartnerHomeCard, ChildSelector, BirthOnboardingModal, DailySummaryAutoSync),
//              src/hooks/useHomeWidgetSync.ts (pushWidgetSnapshot), src/hooks/useBabyLogs.ts (addLog for timers)
//
// The dashboard renders these blocks through [HomeSlots]. Every slot defaults to "renders nothing" (null), so
// the home works before the owning feature is ported; the app root overrides [homeSlotsProvider].
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `<BannerSlot placement="home_top" | "home_bottom" … />` — ads/banners feature.
typedef HomeBannerSlotBuilder = Widget Function(BuildContext context, String placement);

/// `<AdFreePremiumOffer position="top" | "bottom" />`, `<AdInlineAnchor id="home_banner" />`.
typedef HomeKeyedSlotBuilder = Widget Function(BuildContext context, String id);

/// `<PartnerCareCard lifeStage onOpenSharing />`.
typedef HomeStageSlotBuilder = Widget Function(BuildContext context, String lifeStage);

/// `<BooksHomeCard mode="bump" pregnancyWeek />`, `<PartnerHomeCard lifeStage="bump" pregnancyWeek />`.
typedef HomeWeekSlotBuilder = Widget Function(BuildContext context, int? pregnancyWeek);

/// `<BirthOnboardingModal isOpen onClose onComplete />`: shows the modal; completes with true after birth was
/// recorded (React then reloads the page — the user store switch to mommy rebuilds the home instead).
typedef HomeBirthOnboarding = Future<bool?> Function(BuildContext context);

class HomeSlots {
  const HomeSlots({
    this.bannerSlot,
    this.adFreeOffer,
    this.adInlineAnchor,
    this.partnerCareCard,
    this.recoveryHome,
    this.babyChatCard,
    this.booksHomeCard,
    this.aptekHomeCard,
    this.partnerHomeCard,
    this.childSelectorCompact,
    this.dailySummaryAutoSync,
    this.showBirthOnboarding,
  });

  final HomeBannerSlotBuilder? bannerSlot;
  final HomeKeyedSlotBuilder? adFreeOffer;
  final HomeKeyedSlotBuilder? adInlineAnchor;
  final HomeStageSlotBuilder? partnerCareCard;

  /// `<RecoveryHome …/>` (pregnancy-loss home for `flow` + `loss_recovery_active`).
  final WidgetBuilder? recoveryHome;

  /// `<BabyChatCard onOpen={() => onNavigate('baby-chat')} />`.
  final WidgetBuilder? babyChatCard;
  final HomeWeekSlotBuilder? booksHomeCard;

  /// `<AptekHomeCard stage="bump" />` (argument: stage).
  final HomeStageSlotBuilder? aptekHomeCard;
  final HomeWeekSlotBuilder? partnerHomeCard;

  /// `<ChildSelector compact />` in the mommy top bar.
  final WidgetBuilder? childSelectorCompact;

  /// `<DailySummaryAutoSync />` (headless; partner feature's useDailySummary).
  final WidgetBuilder? dailySummaryAutoSync;
  final HomeBirthOnboarding? showBirthOnboarding;
}

final homeSlotsProvider = Provider<HomeSlots>((ref) => const HomeSlots());

/// Renders [builder] or nothing.
Widget homeSlot(BuildContext context, Widget Function(BuildContext context)? builder) =>
    builder == null ? const SizedBox.shrink() : builder(context);

/// `pushWidgetSnapshot` of src/lib/home-widgets.ts (AnacanWidgets plugin). Default: no-op.
abstract interface class HomeWidgetBridge {
  Future<void> pushJourney(HomeWidgetJourney? journey);
}

class NoopHomeWidgetBridge implements HomeWidgetBridge {
  const NoopHomeWidgetBridge();
  @override
  Future<void> pushJourney(HomeWidgetJourney? journey) async {}
}

final homeWidgetBridgeProvider = Provider<HomeWidgetBridge>((ref) => const NoopHomeWidgetBridge());

/// `WidgetJourney` of src/lib/home-widgets.ts.
@immutable
class HomeWidgetJourney {
  const HomeWidgetJourney({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.badge,
    required this.progress,
    required this.emoji,
  });
  final String eyebrow, title, subtitle, badge, emoji;
  final double progress;

  Map<String, Object?> toJson() =>
      {'eyebrow': eyebrow, 'title': title, 'subtitle': subtitle, 'badge': badge, 'progress': progress, 'emoji': emoji};

  @override
  bool operator ==(Object other) => other is HomeWidgetJourney && other.toJson().toString() == toJson().toString();

  @override
  int get hashCode => toJson().toString().hashCode;
}
