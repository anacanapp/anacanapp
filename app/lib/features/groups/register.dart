// Ported from: the places React mounts the groups: CommunityScreen.tsx (`<ChatGroupsPanel search onOpen />`,
//              `<GroupChatScreen groupId onBack />`), MessagesScreen.tsx / ConversationListScreen.tsx (GroupChatScreen),
//              and every `useChatGroups(...)` reader (the chat feature's `chatGroupsProvider`)
//
// Nothing is registered in the shell; the orchestrator spreads [groupsWiringOverrides] into
// `featureWiringOverrides()`.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

import '../../shell/feature_registry.dart';
import '../chat/data/chat_groups.dart' show chatGroupsProvider;
import '../chat/ui/chat_widgets.dart' show chatGroupScreenProvider;
import '../community/community_slots.dart' show communityGroupsPanelProvider;
import 'data/chat_groups.dart' show chatGroupsViewFor;
import 'ui/chat_groups_panel.dart';
import 'ui/group_chat_screen.dart' show buildGroupChatScreen;

void registerGroupsFeature(FeatureRegistry r) {}

/// `<ChatGroupsPanel search onOpen />` for [communityGroupsPanelProvider].
Widget buildChatGroupsPanel(BuildContext context, {required String search, required void Function(String groupId) onOpen}) =>
    ChatGroupsPanel(search: search, onOpen: onOpen);

List<Override> groupsWiringOverrides() => [
      communityGroupsPanelProvider.overrideWithValue(buildChatGroupsPanel),
      chatGroupScreenProvider.overrideWithValue(buildGroupChatScreen),
      chatGroupsProvider.overrideWith(chatGroupsViewFor),
    ];
