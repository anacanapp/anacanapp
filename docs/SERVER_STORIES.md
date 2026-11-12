# Server stories (2026-11-12)

Admins add, replace or hide dashboard stories without an app update.

- Table `public.app_stories` (migration `20261112200000_app_stories.sql`, CDC enrolled, writer guarded, admin-only RLS).
  One row per story id: `action` `show` (new story, or replaces the bundled story with the same id) or `hide`
  (hides a bundled story), `audience` `test` (admins only) or `all`, `enabled`, optional `starts_at` / `ends_at`,
  `sort_order` (bigger first). `story` is the same StoryJson as `src/data/stories/az.ts` without `id`.
- Apps read `get_app_stories_v1(p_language)`; it already filters enabled rows, the window and the audience.
- Client: `src/lib/server-stories.ts` validates every row again (templates, themes, navigation ids, text lengths;
  bad slides and rows are dropped), merges with the bundled list and caches the last answer on the device
  (`anacan-server-stories:v1:<lang>`), so stories work offline. `src/hooks/useServerStories.ts`,
  `src/components/stories/DashboardStories.tsx`.
- Admin: Admin → Məzmun → Story-lər (`src/components/admin/AdminStories.tsx`): JSON editor with slide templates,
  validation, preview with sample values, copy a bundled story, hide a bundled story.
- Statistics need nothing new: Story statistikası counts by story id, server stories included.
- Only builds that contain this loader show server stories; older builds keep their bundled stories.
- The global switch `app_settings.dashboard_stories` (off / admin / on) still applies, and stories remain
  Azerbaijani only.
