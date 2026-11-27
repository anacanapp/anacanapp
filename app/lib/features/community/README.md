# Community feature (feed, posts, comments, profiles, moderation tools)

Port of the PARITY_MATRIX rows `tab.community`, `social.post-card`, `social.feed`, `social.comments`,
`social.single-post`, `social.create-post`, `social.user-profile`, `social.my-moderated`, `social.moderator-inline`,
`social.block-user`, `social.moderator-enforcement`. Tests: `app/test/features/community/` (122 tests).

| File | React source |
|---|---|
| `register.dart` | Index `case 'community'` (tab, sliver body), `viewingUserId` overlay, `communityWiringOverrides()` |
| `community_slots.dart` | StoriesBar / ChatGroupsPanel / BannerSlot / AdSurface slots, header counters |
| `copy/` | community-moderation copy, feature37 blog_* keys, date-fns suffix / strict distances (`gen_community_copy.mjs`) |
| `data/community_backend.dart` | every supabase call (`CommunityBackend`, query shape recorded for fakes) |
| `data/community.dart` | `hooks/useCommunity.ts` |
| `data/community_social.dart` | `hooks/useCommunitySocial.ts` |
| `data/unread_community_posts.dart` | `hooks/useUnreadCommunityPosts.ts` (`communityUnreadCountProvider`) |
| `data/community_post_cache.dart` | `lib/community-post-cache.ts` |
| `data/community_moderation.dart` | `lib/community-moderation.ts`, `hooks/useCommunityModeration.ts`, `useFeedLanguages.matchesFeedLanguage` |
| `data/community_blog.dart` | `lib/community-blog.ts`, `useBlogAttachment` search, CommunityBlogCard query |
| `data/community_media.dart` | file inputs (image_picker), upload, `translate-post`, translation cache |
| `data/community_toasts.dart` | mutation toasts (`CommunityToastListener`) |
| `data/community_env.dart` | backend url, auth loading, UI language, uuid, haptics |
| `moderation/` | `ModeratorActionMenu/Dialog/Media`, `RestrictionNote`, `BlockUserDialog`, `ModeratorEnforcement`, `useModeratorContent` |
| `ui/community_screen.dart` | `CommunityScreen.tsx` (+ embedded GroupFeed) |
| `ui/community_post_feed.dart` | `CommunityPostFeed`, `PostSeenObserver`, `PostSearchFilter`, `MyModeratedPosts` |
| `ui/post_card.dart` | `PostCard.tsx` (+ comments sheet, report dialog, `lifeStageLabel`) |
| `ui/comment_reply.dart`, `ui/comment_text.dart` | `CommentReply.tsx`, `CommentText.tsx`, `lib/in-app-links.ts` |
| `ui/media_carousel.dart`, `ui/photo_gallery_viewer.dart` | `MediaCarousel.tsx`, `PhotoGalleryViewer.tsx` |
| `ui/user_badge.dart`, `ui/group_post_tags.dart`, `ui/community_blog_card.dart` | `UserBadge`, `GroupPostTags` (+ `GroupTagPicker`), `CommunityBlogCard`, `BlogAttachmentPicker` |
| `ui/create_post_screen.dart`, `ui/single_post_view.dart`, `ui/user_profile_screen.dart` | the screens of the same names (+ `FollowButton`, `CommunityConnections`) |

## Layout notes

- The tab is a sliver body (`registerTabSlivers`): the feed is a lazy `SliverList` in the shell's single scroll view
  (React windowed the DOM by hand). Building the last card fetches the next page (bottom sentinel).
- Nested full-height screens (DM, conversation list, group chat, DM lookup spinner) fill the viewport
  (`SliverFillRemaining`); profile / composer / single post are slivers / boxes in the same scroll view.
- The comments sheet is an `OverlayPortal` over the whole app (React `createPortal(…, body)`); Android back closes it.
- "Seen" = ≥ 50 % visible in the nearest scroll viewport for 600 ms (no visibility package; computed on scroll).

## Slots / defaults (see the final report for the wiring)

| Provider | Default | Owner |
|---|---|---|
| `communityStoriesBarProvider` | nothing | `social.stories-bar` |
| `communityProfileStoriesProvider` | "Aktiv hekayə yoxdur" card | `social.stories-bar` / `social.story-viewer` |
| `communityGroupsPanelProvider` | placeholder | `social.groups` |
| `chatGroupScreenProvider` (chat) | placeholder | `social.groups` |
| `communityBannerProvider` | nothing | banners / ads (9) |
| `communityBlogOpenerProvider` | shell `openAppBlogLink` (BlogLinkHost overlay) | blog (7) |
| `communityPostCreatedTrackerProvider` | no-op | analytics / Customer.io (9) |
| `communityImageCodecProvider` | `NoImageCodec` (upload the picker-scaled original) | an image encoder package |
| `photoSaverProvider` | fails (error toast) | a gallery-saver plugin (9) |
| `moderationOverlayOpenProvider` | written by ModeratorEnforcement | read by the story viewer |
