// Ported from: src/App.tsx (headless components mounted for the whole app inside AuthProvider:
//              <PremiumEntitlementMonitor />, the deeplink / OAuth `appUrlOpen` listeners), src/pages/Index.tsx
//              (usePendingTimerStops for the whole session), src/hooks/useSubscription.ts (deviceTimeZone)
//
// Invisible app-level hosts. They live at the root (not as shell frame overlays) so they stay mounted while a
// sub-screen, a gate or an outer route is shown, like their React counterparts, and only once startup opened the
// backend (every one of them talks to the SDK).
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/auth_providers.dart' show authUserProvider;
import '../core/device/time_zone.dart';
import '../core/net/backend_providers.dart' show backendOpenProvider;
import '../features/baby/hooks/use_pending_timer_stops.dart' show PendingTimerStopsHost;
import '../native/purchases/premium_entitlement.dart' show PremiumEntitlementMonitor;
import '../native/purchases/subscription.dart' as subscription show deviceTimeZone;
import 'deep_links.dart';

class AppSessionHosts extends ConsumerStatefulWidget {
  const AppSessionHosts({super.key});

  @override
  ConsumerState<AppSessionHosts> createState() => _AppSessionHostsState();
}

class _AppSessionHostsState extends ConsumerState<AppSessionHosts> {
  static String _fallbackZone() => 'Asia/Baku';

  @override
  void initState() {
    super.initState();
    // usage_consume_v1 / usage_add_seconds_v1 `p_time_zone`: the device zone, else Asia/Baku (React fallback).
    subscription.deviceTimeZone = () => (mounted ? ref.read(ianaTimeZoneProvider) : null) ?? 'Asia/Baku';
  }

  @override
  void dispose() {
    subscription.deviceTimeZone = _fallbackZone;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Keeps the zone loaded (and refreshed on resume) for synchronous readers.
    ref.watch(ianaTimeZoneProvider);
    if (!ref.watch(backendOpenProvider)) return const SizedBox.shrink();
    final signedIn = ref.watch(authUserProvider.select((u) => u != null));
    return Stack(
      children: [
        const IncomingLinkHost(),
        // App.tsx mounts the monitor inside AuthProvider; without an account it has nothing to watch.
        if (signedIn) const PremiumEntitlementMonitor(),
        const PendingTimerStopsHost(),
      ],
    );
  }
}
