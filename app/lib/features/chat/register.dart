// Ported from: src/pages/Index.tsx (`showMotherChat` → MessagesScreen with `profile.linked_partner_id`, partner tab
//              `chat` → MessagesScreen with onBack = setActiveTab('home')), src/components/BottomNav.tsx (the always-
//              mounted usePartnerMessages consumer whose realtime toasts show everywhere)
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth.dart';
import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart';
import 'messages_screen.dart';
import 'partner_message_toasts.dart';

void registerChatFeature(FeatureRegistry r) {
  r.registerOverlay(ShellOverlayId.motherChat, (context, a) => MessagesHost(onBack: a.onClose));
  r.registerTab(ShellTab.chat, (context, a) => const _PartnerChatTab(), partner: true, fillsViewport: true);
  r.registerFrameOverlay('partner-message-toasts', (context) => const PartnerMessageToastListener());
}

/// MessagesScreen with the signed-in user's `linked_partner_id`.
class MessagesHost extends ConsumerWidget {
  const MessagesHost({super.key, required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) =>
      MessagesScreen(onBack: onBack, partnerProfileId: ref.watch(authProfileProvider)?.linkedPartnerId);
}

class _PartnerChatTab extends ConsumerWidget {
  const _PartnerChatTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) => MessagesHost(onBack: () => ref.read(shellProvider.notifier).setTab(ShellTab.home));
}
