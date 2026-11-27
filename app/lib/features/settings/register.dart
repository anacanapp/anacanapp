// Ported from: src/pages/Index.tsx (screens `settings`, `ad-preferences`, `appearance`, `notifications`, `widgets`,
//              `health-sync`, `privacy`, `partner-privacy` and their props)
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shell/feature_registry.dart';
import '../../shell/links/push_nav.dart' show CommunityDeepLinkTarget;
import '../../shell/nav/ids.dart';
import '../../shell/nav/shell_controller.dart';
import 'ad_preferences_screen.dart';
import 'appearance_screen.dart';
import 'health_sync_screen.dart';
import 'notifications_screen.dart';
import 'privacy_screen.dart';
import 'settings_screen.dart';
import 'widget_settings_screen.dart';

void registerSettingsFeature(FeatureRegistry r) {
  r.registerScreen(ScreenId.settings, (context, a) => Consumer(
        builder: (context, ref, _) => SettingsScreen(onBack: a.onBack, onNavigate: ref.read(shellProvider.notifier).openScreen),
      ));
  r.registerScreen(ScreenId.adPreferences, (context, a) => AdPreferencesScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.appearance, (context, a) => AppearanceScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.widgets, (context, a) => WidgetSettingsScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.healthSync, (context, a) => HealthSyncScreen(onBack: a.onBack));
  r.registerScreen(ScreenId.notifications, (context, a) => Consumer(builder: (context, ref, _) {
        final shell = ref.read(shellProvider.notifier);
        return NotificationsScreen(
          onBack: a.onBack,
          onNavigateToModeration: () => shell.openScreen('moderation-history'),
          onNavigateToCommunity: (t) => shell.notificationsToCommunity(t == null
              ? null
              : CommunityDeepLinkTarget(postId: t.postId, commentId: t.commentId, storyId: t.storyId, userId: t.userId, groupId: t.groupId)),
        );
      }));
  r.registerScreen(ScreenId.privacy, (context, a) => Consumer(builder: (context, ref, _) {
        final shell = ref.read(shellProvider.notifier);
        return PrivacyScreen(onBack: a.onBack, onOpenAdSettings: () => shell.openScreen('ad-preferences'), onOpenLegal: (doc) => shell.openScreen('legal/$doc'));
      }));
  r.registerScreen(ScreenId.partnerPrivacy, (context, a) => PrivacyScreen(onBack: a.onBack, partner: true));
}
