# Groups (panel, group chat, presence, group feed)

Port of the PARITY_MATRIX row `social.groups`. Tests: `app/test/features/groups/`
(`flutter test test/features/groups`).

| File | React source |
|---|---|
| `register.dart` | where React mounts the groups; `groupsWiringOverrides()` |
| `data/chat_groups.dart` | `hooks/useChatGroups.ts` (list, people, create / action / update, realtime) |
| `data/group_presence.dart` | `hooks/useGroupPresence.ts` (presence channel `group_presence:<id>`, typing) |
| `ui/chat_groups_panel.dart` | `components/community/ChatGroupsPanel.tsx` |
| `ui/group_chat_screen.dart` | `components/community/GroupChatScreen.tsx` (reuses the chat `ConversationScreen` and `ChatMemberPicker`) |
| `ui/group_feed.dart` | `components/community/GroupFeed.tsx` (stand-alone page), `GroupPresenceBar.tsx` |
| `ui/group_widgets.dart` | shared chips / inputs / public-private choice |

`lib/group-i18n.ts` is the chat feature's `groupTr` (`features/chat/copy/`).

## Behaviour notes

- Query keys are React's (`['chat-groups-v3', backend, actor, scope, group, search, language|null]`,
  `['chat-members-v3', backend, actor, group]`), so the chat feature's own list query and this one share cache
  entries. `chatGroupsProvider` (chat) is overridden with this hook; `kUnreadGroups` is unchanged.
- Inbox lists listen to every `group_messages` change, throttled (leading + trailing, ≥ 5 s); an open group listens
  to its own rows and refreshes at once.
- Details / invitation / settings are dialog routes above the full-screen chat; leaving / deleting (or losing the
  membership) closes them together with the screen.
- `GroupFeed` stand-alone is ported, but React (and this app) only mount the embedded variant (community feature).

## Slots filled (see `register.dart`)

| Provider | Value |
|---|---|
| `communityGroupsPanelProvider` (community) | `ChatGroupsPanel(search, onOpen)` |
| `chatGroupScreenProvider` (chat) | `GroupChatScreen(groupId, onBack)` |
| `chatGroupsProvider` (chat) | `chatGroupsViewFor` (this hook, same keys) |

## Not ported / not verified

`useAdSafetyBlock(true)` of GroupChatScreen (ads, phase 9). Realtime presence and postgres changes were not run
against a live backend; nothing here ran on a device.
