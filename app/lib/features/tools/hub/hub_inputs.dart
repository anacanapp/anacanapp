// Ported from: src/components/ToolsHub.tsx (hook reads: useUserStore, useAuth, useSubscription, useChildren,
//              useDisabledTools, useAppSetting, useToolConfigs; PremiumModal; BannerSlot / AdSurface / AdInlineAnchor /
//              AptekSearchResults / usePrefetchFirstAid slots)
//
// The seams of the hub: one provider for every store value it reads ([toolsHubContextProvider]), the tool-config
// query view ([toolsHubConfigsProvider]), the paywall opener and the optional slots other features fill later.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth.dart';
import '../../../core/cache/cache.dart';
import '../../../core/data/app_settings.dart' show appSettingProvider;
import '../../../core/i18n/language_controller.dart' show disabledToolsProvider;
import '../../../native/purchases/purchases.dart' show subscriptionProvider;
import '../../../state/user_store.dart';
import '../../baby/hooks/use_children.dart' show childrenProvider;
import '../../premium/premium_modal.dart' show showPremiumModal;
import '../data/dynamic_tools.dart' show toolConfigsQuery;
import '../data/tool_config.dart';
import 'hub_model.dart';

/// Store / auth / subscription / settings values of the hub.
final toolsHubContextProvider = Provider.autoDispose<HubContext>((ref) {
  final store = ref.watch(userStoreProvider);
  final profile = ref.watch(authProfileProvider);
  final children = ref.watch(childrenProvider);
  final child = children.selectedChild ?? (children.children.isEmpty ? null : children.children.first);
  String? date(String? s) => s == null || s.isEmpty ? null : s;
  return HubContext(
    lifeStage: store.lifeStage,
    language: store.language,
    countryCode: store.countryCode,
    profileCountryCode: profile?.countryCode,
    hasPartner: (profile?.linkedPartnerId ?? '').isNotEmpty,
    isAdmin: ref.watch(isAdminProvider),
    isPremium: ref.watch(subscriptionProvider.select((s) => s.isPremium)),
    currentWeek: store.getPregnancyData()?.currentWeek ?? 0,
    disabledTools: ref.watch(disabledToolsProvider),
    childBirthDate: date(child?.birthDate),
    childBirthDates: [for (final c in children.children) date(c.birthDate)],
    weaningSetting: ref.watch(appSettingProvider('weaning_tool')),
    parentingSetting: ref.watch(appSettingProvider('parenting_tool')),
  );
}, name: 'toolsHubContextProvider');

/// What the hub needs of `useToolConfigs(...)`.
@immutable
class ToolConfigsView {
  const ToolConfigsView({this.data = const [], this.isPending = false, this.isError = false, this.fetchStatus = FetchStatus.idle, this.refetch});
  final List<ToolConfig> data;
  final bool isPending;
  final bool isError;
  final FetchStatus fetchStatus;
  final VoidCallback? refetch;
}

/// `useToolConfigs(isAdmin ? undefined : lifeStage || undefined)` for the given stage argument.
final toolsHubConfigsProvider = Provider.autoDispose.family<ToolConfigsView, String?>((ref, stage) {
  final q = ref.watch(toolConfigsQuery(stage));
  return ToolConfigsView(
    data: q.data ?? const [],
    isPending: q.isPending,
    isError: q.isError,
    fetchStatus: q.fetchStatus,
    refetch: () => ref.read(toolConfigsQuery(stage).notifier).refetch(),
  );
}, name: 'toolsHubConfigsProvider');

/// `<PremiumModal isOpen feature="tool" analyticsSource={paywallTool ?? 'tool'} />`. Completes when it closes.
typedef ToolsHubPaywall = Future<void> Function(BuildContext context, String analyticsSource);

final toolsHubPaywallProvider = Provider<ToolsHubPaywall>(
  (ref) => (context, source) => showPremiumModal(context, feature: 'tool', analyticsSource: source),
);

/// Slots of the hub that other features fill (`featureWiringOverrides()`); all render nothing by default.
@immutable
class ToolsHubSlots {
  const ToolsHubSlots({this.bannerSlot, this.adSurface, this.adInlineAnchor, this.aptekSearchResults, this.prefetchFirstAid});

  /// `<BannerSlot placement="tools_top" | "tools_bottom" onToolOpen={gatedOpenTool} />` (top: `mt-3`, bottom:
  /// `mt-6`, applied by the hub).
  final Widget Function(BuildContext context, String placement, void Function(String toolId) onToolOpen)? bannerSlot;

  /// `<AdSurface id="tools_banner" />` (first child of the page).
  final Widget Function(BuildContext context, String id)? adSurface;

  /// `<AdInlineAnchor id="tools_banner" />` (above the tool sections).
  final Widget Function(BuildContext context, String id)? adInlineAnchor;

  /// `<AptekSearchResults query close onOpen />` under the search box while the query is not blank. `query` is the
  /// trimmed, lower-cased, diacritic-free text (`foldQuery`); `onOpen(screen)` opens an Aptek screen.
  final Widget Function(BuildContext context, String query, VoidCallback close, void Function(String screen) onOpen)? aptekSearchResults;

  /// `usePrefetchFirstAid()`: called once when the hub mounts (first aid must work offline).
  final void Function(WidgetRef ref)? prefetchFirstAid;
}

final toolsHubSlotsProvider = Provider<ToolsHubSlots>((ref) => const ToolsHubSlots());
