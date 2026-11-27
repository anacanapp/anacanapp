// Ported from: src/pages/Index.tsx (`activeScreen === 'baby-chat'` → BabyChatScreen with onBack / onOpenAssistant),
//              src/components/Dashboard.tsx (`<BabyChatCard onOpen={() => onNavigate('baby-chat')} />`)
//
// The screen guard (not partner, stage bump) is applied by the shell (ScreenId.babyChat).
// Home slot for the app root: `HomeSlots(babyChatCard: babyChatCardSlot, …)`.
import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/feature_registry.dart';
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart' show shellProvider;
import '../../state/user_store.dart';
import 'baby_chat_card.dart';
import 'baby_chat_notifications.dart';
import 'baby_chat_screen.dart';

export 'baby_chat_card.dart' show BabyChatCard;
export 'baby_chat_notifications.dart' show babyChatNotificationPlannerProvider, cancelBabyChatNotifications, scheduleBabyChatNotifications;
export 'baby_chat_screen.dart' show BabyChatScreen;

/// `HomeSlots.babyChatCard`.
Widget babyChatCardSlot(BuildContext context) => const BabyChatCard();

/// Index: "the baby's daily notifications are scheduled on the device while pregnant; once the stage changes
/// (birth, loss, or another device), cancel whatever is still pending here."
class BabyChatNotificationsCleanup extends ConsumerStatefulWidget {
  const BabyChatNotificationsCleanup({super.key});
  @override
  ConsumerState<BabyChatNotificationsCleanup> createState() => _BabyChatNotificationsCleanupState();
}

class _BabyChatNotificationsCleanupState extends ConsumerState<BabyChatNotificationsCleanup> {
  String? _done;

  @override
  Widget build(BuildContext context) {
    final stage = ref.watch(userStoreProvider.select((s) => s.lifeStage));
    if (stage != null && stage.isNotEmpty && stage != 'bump' && _done != stage) {
      _done = stage;
      unawaited(cancelBabyChatNotifications(ref.read(babyChatNotificationPlannerProvider)).catchError((Object _) {}));
    } else if (stage == 'bump') {
      _done = null;
    }
    return const SizedBox.shrink();
  }
}

void registerBabyChatFeature(FeatureRegistry r) {
  r.registerFrameOverlay('baby-chat-notifications', (context) => const BabyChatNotificationsCleanup());
  r.registerScreen(
    ScreenId.babyChat,
    (context, a) => Consumer(
      builder: (context, ref, _) => BabyChatScreen(
        onBack: a.onBack,
        onOpenAssistant: () => ref.read(shellProvider.notifier).screenOpensAssistant(),
      ),
    ),
  );
}
