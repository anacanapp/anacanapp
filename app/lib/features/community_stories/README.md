# Community stories (stories bar, viewer, editor, export)

Port of the PARITY_MATRIX rows `social.stories-bar`, `social.story-viewer`, `social.story-editor`.
Tests: `app/test/features/community_stories/` (`flutter test test/features/community_stories`).

The HOME dashboard stories (`features/stories/`) are a different feature; this port only fills its
`storyExporterProvider` (the "Yüklə" button) with `lib/story-export.ts`.

| File | React source |
|---|---|
| `register.dart` | where React mounts the bar / profile tab; `communityStoriesWiringOverrides()` |
| `data/stories.dart` | `hooks/useStories.ts` (`storiesQuery(groupId)`, `storiesProvider`, create / delete / like mutations, `markStoryViewedProvider`) |
| `data/story_viewers.dart` | `hooks/useStoryViewers.ts`, `hooks/useStoryReplies.ts` |
| `data/stories_backend.dart` | the two calls the community `CommunityBackend` has no method for (plain insert, `storage.remove`) |
| `data/story_media_picker.dart` | the hidden gallery / camera inputs of `StoriesBar.tsx` (image_picker) |
| `data/story_ads.dart` | the `useAdExperience()` surface of the viewer (`storyAdBreaksProvider`, default: no breaks) |
| `editor/story_scene.dart` | `lib/story-editor.ts` (scene, framing, gestures, hit test, validation) |
| `editor/story_painter.dart` | `lib/story-editor.ts` (`drawStoryScene`, `exportStoryImage`) on `dart:ui`, `StoryImageEncoder` |
| `editor/story_crop_editor.dart` | `components/community/StoryCropEditor.tsx`, `.story-editor-*` of `styles/anacan-design.css` |
| `export/story_export.dart` | `lib/story-export.ts` + the dashboard viewer's `save()` (`dashboardStoryExporterProvider`) |
| `ui/stories_bar.dart` | `components/community/StoriesBar.tsx` |
| `ui/story_viewer.dart` | `components/community/StoryViewer.tsx` (`CommunityStoryViewer`, `LiveStoryViewer`, `pushStoryViewer`) |
| `ui/story_video_layout.dart` | `components/community/StoryVideoLayout.tsx` (video_player) |
| `ui/profile_stories.dart` | the stories tab of `components/community/UserProfileScreen.tsx` |

`src/components/stories/stories.css` belongs to the dashboard stories and does not apply here.

## Behaviour notes

- Query keys are React's: `['stories', user, groupId]`, `['story-viewers', id]`, `['story-replies', id]`. A view patches
  only `['stories', viewer]` caches; likes are optimistic per viewer and roll back on error; the bar invalidates
  `['stories']` once when the viewer closes.
- The viewer and the editor are full-screen routes on the root navigator (React portals them to `body`). The viewer
  pauses while any other route covers it (delete confirm, moderator menu / dialog — React's `onOpenChange` flags)
  and while the moderator warning popup is open (`moderationOverlayOpenProvider`).
- Progress = one `AnimationController` per story (image 6 s, video its length up to 30 s); completion advances,
  with the `community_story_break` check of React (ads are not ported: `storyAdBreaksProvider` never offers one).
- Image stories are exported by the editor to a 1080×1920 picture and uploaded as **PNG** (`<user>/<uuid>.png`,
  `image/png`): Flutter has no JPEG encoder. React uploaded `image/jpeg` at quality 0.94. A JPEG package can
  override `storyImageEncoderProvider`. The dashboard "Yüklə" share is PNG as well (React: JPEG 0.93).
- Caption fonts: Arial / Georgia / Courier New with the platform's sans / serif / monospace fallbacks (not bundled).

## Slots filled (see `register.dart`)

| Provider | Value |
|---|---|
| `communityStoriesBarProvider` | `StoriesBar(groupId, autoOpenStoryId, onAutoOpenConsumed)` |
| `communityProfileStoriesProvider` | `ProfileStories(userId)` |
| `storyExporterProvider` (features/stories) | `dashboardStoryExporterProvider` (render + `babyChatSharerProvider`) |

## Not verified

No device: camera / gallery picking, video playback and sound, PNG upload to `community-media`, the share sheet,
font fallbacks and the pinch / rotate feel were not exercised. Mouse-wheel zoom of the editor (desktop web only)
is not ported.
