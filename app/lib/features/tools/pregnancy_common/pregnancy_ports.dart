// Ported from: src/hooks/usePartnerNotifications.ts (notifyKickSession / notifyContractionStarted /
//              notifyContraction511 interface), src/hooks/useSOSAlert.ts (sendSOS / hasPartner / loading interface),
//              src/lib/healthVitals.ts (syncVitalsInBackground call site), src/lib/native.ts (hapticFeedback)
//
// Seams of the pregnancy tools to features that are not ported yet. Every default is a safe no-op; the owning
// feature overrides the provider in `featureWiringOverrides()` (docs/flutter/WIRING.md).
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// `usePartnerNotifications()` (partner phase 6). Default: nothing is sent.
abstract interface class PregnancyPartnerNotifications {
  Future<void> notifyKickSession(int kickCount, int durationSeconds);
  Future<void> notifyContractionStarted(int durationSeconds, num? intervalSeconds);
  Future<void> notifyContraction511();
}

class NoopPregnancyPartnerNotifications implements PregnancyPartnerNotifications {
  const NoopPregnancyPartnerNotifications();
  @override
  Future<void> notifyKickSession(int kickCount, int durationSeconds) async {}
  @override
  Future<void> notifyContractionStarted(int durationSeconds, num? intervalSeconds) async {}
  @override
  Future<void> notifyContraction511() async {}
}

final pregnancyPartnerNotificationsProvider =
    Provider<PregnancyPartnerNotifications>((ref) => const NoopPregnancyPartnerNotifications());

/// `useSOSAlert()` (partner phase 6): `{ sendSOS, hasPartner, loading }`. Default: no partner (the button is hidden).
@immutable
class SosAlertPort {
  const SosAlertPort({this.hasPartner = false, this.loading = false, this.sendSOS});
  final bool hasPartner;
  final bool loading;

  /// `sendSOS(message, includeLocation, alertType)` → `{ error }` (null = sent).
  final Future<Object?> Function(String message, bool includeLocation, String alertType)? sendSOS;
}

final sosAlertPortProvider = Provider<SosAlertPort>((ref) => const SosAlertPort());

/// `import('@/lib/healthVitals').then(m => m.syncVitalsInBackground(userId))` after a saved weight (phase 9).
final healthVitalsBackgroundSyncProvider = Provider<void Function(String? userId)>((ref) => (_) {});

/// `hapticFeedback.light / medium / heavy` (Capacitor Haptics impact).
@immutable
class PregnancyHaptics {
  const PregnancyHaptics({required this.light, required this.medium, required this.heavy});
  final Future<void> Function() light;
  final Future<void> Function() medium;
  final Future<void> Function() heavy;
}

final pregnancyHapticsProvider = Provider<PregnancyHaptics>((ref) => const PregnancyHaptics(
      light: HapticFeedback.lightImpact,
      medium: HapticFeedback.mediumImpact,
      heavy: HapticFeedback.heavyImpact,
    ));

/// Components of other features rendered inside the pregnancy tools. Null = not shown.
@immutable
class PregnancyToolSlots {
  const PregnancyToolSlots({this.aptekBagCard, this.hospitalBagArticles, this.albumOrderScreen, this.babyNamesAd});

  /// HospitalBag `<AptekHomeCard stage="bump" context="bag" />` (commerce, phase 7).
  final WidgetBuilder? aptekBagCard;

  /// HospitalBag `<ModuleArticles module="hospitalBag" />` (blog, phase 7).
  final WidgetBuilder? hospitalBagArticles;

  /// PregnancyAlbum `<AlbumOrderScreen albumType="pregnancy" onBack />` (shop, phase 7).
  final Widget Function(BuildContext context, VoidCallback onBack)? albumOrderScreen;

  /// BabyNames `<AdSurface id="baby_names_banner" enabled />` + `<AdInlineAnchor />` (ads, phase 9).
  final Widget Function(BuildContext context, bool enabled)? babyNamesAd;
}

final pregnancyToolSlotsProvider = Provider<PregnancyToolSlots>((ref) => const PregnancyToolSlots());
