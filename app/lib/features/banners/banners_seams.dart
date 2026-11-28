// Ported from: the `<BannerSlot … />` call sites of src/components/Dashboard.tsx (home_top mb-2 / home_bottom mt-2,
//              onToolOpen = onNavigateToTool), ProfileScreen.tsx (profile_top mb-3, onNavigate), ToolsHub.tsx
//              (tools_top / tools_bottom, onToolOpen = gatedOpenTool) and CommunityScreen.tsx (community_top mt-4,
//              AdSurface / AdInlineAnchor community_banner)
//
// Builders for the banner slots other features expose. The app root puts them into the slot objects
// (`HomeSlots.bannerSlot`, `ProfileSlots.bannerSlot`, `ToolsHubSlots.bannerSlot`) and `communityBannerProvider`.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../services/ads/ad_widgets.dart' show AdInlineAnchor, AdSurface;
import '../../shell/shell.dart';
import 'ui/banner_slot.dart';

/// `HomeSlots.bannerSlot`: `home_top` / `home_bottom`; a `tool` banner opens the tool from the dashboard. The
/// dashboard applies the `mb-2` / `mt-2` spacing itself.
Widget homeBannerSlot(BuildContext context, String placement) => Consumer(
      builder: (context, ref, _) => BannerSlot(
        placement: placement,
        onNavigate: (_) {},
        onToolOpen: (tool) => ref.read(shellProvider.notifier).openToolId(tool),
      ),
    );

/// `ProfileSlots.bannerSlot` (`profile_top`; the profile applies `mb-3`).
Widget profileBannerSlot(BuildContext context, String placement, void Function(String screen) onNavigate) =>
    BannerSlot(placement: placement, onNavigate: onNavigate);

/// `ToolsHubSlots.bannerSlot` (`tools_top` / `tools_bottom`; the hub applies `mt-3` / `mt-6`).
Widget toolsHubBannerSlot(BuildContext context, String placement, void Function(String toolId) onToolOpen) =>
    BannerSlot(placement: placement, onNavigate: (_) {}, onToolOpen: onToolOpen);

/// `communityBannerProvider`: `community_banner` → `<AdSurface>`, `community_top` → `<BannerSlot className="mt-4">`,
/// `community_inline` → `<AdInlineAnchor id="community_banner">`.
Widget communityBanner(BuildContext context, String placement) => switch (placement) {
      'community_banner' => const AdSurface(id: 'community_banner'),
      'community_top' => const BannerSlot(placement: 'community_top', padding: EdgeInsets.only(top: 16)),
      'community_inline' => const AdInlineAnchor(id: 'community_banner'),
      _ => const SizedBox.shrink(),
    };
