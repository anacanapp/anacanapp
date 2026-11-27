// Ported from: src/lib/native.ts (hapticFeedback.light / medium / heavy, @capacitor/haptics impact Heavy),
//              src/hooks/useSOSAlert.ts (@capacitor/geolocation getCurrentPosition), src/lib/chat.ts
//              (sendPartnerMessage), src/hooks/usePartnerMessages.ts (messages / getUnreadCount),
//              src/components/partner/v2/PartnerHomeScreen.tsx (IllnessHomeCard, PartnerLossCard, usePregnancyLossText,
//              AdInlineAnchor imports owned by other features)
//
// Seams of the partner feature. Each has a working default (Flutter haptics, the chat feature's message list and
// send path) or a neutral one for features that are not ported yet (docs/flutter/WIRING.md).
import 'package:flutter/services.dart' show HapticFeedback;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../chat/data/chat.dart' show sendPartnerMessage;
import '../chat/data/chat_backend.dart' show chatBackendProvider;
import '../chat/data/chat_push.dart' show chatPushSenderProvider;
import '../chat/data/partner_messages.dart' show partnerMessagesProvider;

/// `hapticFeedback.light / medium / heavy` (Capacitor Haptics impact → Flutter [HapticFeedback]).
@immutable
class PartnerHaptics {
  const PartnerHaptics({required this.light, required this.medium, required this.heavy});
  final Future<void> Function() light;
  final Future<void> Function() medium;
  final Future<void> Function() heavy;
}

final partnerHapticsProvider = Provider<PartnerHaptics>((ref) => const PartnerHaptics(
      light: HapticFeedback.lightImpact,
      medium: HapticFeedback.mediumImpact,
      heavy: HapticFeedback.heavyImpact,
    ));

/// A GPS fix for an SOS (`Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })`).
@immutable
class SosLocation {
  const SosLocation({required this.latitude, required this.longitude, this.locationName});
  final double latitude;
  final double longitude;
  final String? locationName;
}

/// `getCurrentLocation()` of useSOSAlert: asks for the permission when needed; null when denied or failed.
/// Default: no location (`geolocator` is not a dependency yet) — React's denied-permission branch, the alert is
/// still sent, just without coordinates.
final sosLocationProvider = Provider<Future<SosLocation?> Function()>((ref) => () async => null);

/// `sendPartnerMessage(actor, partnerUserId, content)` (src/lib/chat.ts: chat_send_message_v2 + push).
final partnerChatSenderProvider = Provider<Future<void> Function(String actor, String partnerUserId, String content)>((ref) {
  return (actor, partnerUserId, content) async {
    await sendPartnerMessage(ref.read(chatBackendProvider), ref.read(chatPushSenderProvider), actor, partnerUserId, content);
  };
});

/// `usePartnerMessages()` as the partner cards read it: messages newest first and the unread count.
@immutable
class PartnerMessagesFeed {
  const PartnerMessagesFeed({this.messages = const [], this.unreadCount = 0});
  final List<Map<String, dynamic>> messages;
  final int unreadCount;
}

final partnerMessagesFeedProvider = Provider.autoDispose<PartnerMessagesFeed>((ref) {
  final state = ref.watch(partnerMessagesProvider);
  final userId = ref.watch(authUserProvider)?.id;
  return PartnerMessagesFeed(messages: state.messages, unreadCount: state.unreadCount(userId));
});

/// `usePregnancyLossText(language)` — the two fields the partner home reads (pregnancy-loss feature).
@immutable
class PartnerLossText {
  const PartnerLossText({required this.heroLabel, required this.chips});

  /// `ui.p_hero_label`.
  final String heroLabel;

  /// `chips` (quick messages during a shared loss).
  final List<String> chips;
}

/// Blocks of other features rendered on the partner home. Null = not shown (React's "text not loaded" branch for
/// the loss text, an unported card for the rest).
@immutable
class PartnerHomeSlots {
  const PartnerHomeSlots({this.illnessHomeCard, this.lossCard, this.lossText, this.adInlineAnchor});

  /// `<IllnessHomeCard mode="active" | "entry" onOpen />` (illness tracker).
  final Widget Function(BuildContext context, String mode, VoidCallback onOpen)? illnessHomeCard;

  /// `<PartnerLossCard lossDate onOpen />` (pregnancy-loss feature).
  final Widget Function(BuildContext context, String? lossDate, VoidCallback onOpen)? lossCard;

  /// `usePregnancyLossText(language)`; null = not loaded.
  final PartnerLossText? Function(String language)? lossText;

  /// `<AdInlineAnchor id="home_banner" />` (ads).
  final Widget Function(BuildContext context, String id)? adInlineAnchor;
}

final partnerHomeSlotsProvider = Provider<PartnerHomeSlots>((ref) => const PartnerHomeSlots());

/// Runs [future] and ignores its error (`try { await … } catch {}`).
Future<void> quietly(Future<void> Function() run) async {
  try {
    await run();
  } catch (_) {}
}
