# Dashboard stories (2026-11-09)

Instagram-style story row at the top of the home screen (Hamiləlik, Analıq, Dövr). Azerbaijani only for now.

- **Switch:** Admin → Tənzimləmələr → "Story-lər (ana səhifə)" = `app_settings.dashboard_stories`:
  `admin` (default, admin accounts only), `on` (every `az` user), `off`. Partners never see it.
  Migration: `supabase/migrations/20261109150000_dashboard_stories_setting.sql` (+ public allowlist).
- **Content:** `src/data/stories/az.ts`, 80 stories (StoryJson). Templates: cover, fact, list, myth, quiz, alert,
  quote, cta. Markers `==mark==`, `__accent__`, `**bold**`; no HTML. Medical slides cite their source.
- **Personalisation (on the device):** `{weekLabel}`, `{fruit}`, `{lengthCm}`, `{weightG}`, `{weekNote}` from the
  pregnancy week; `{babyName}`, `{babyMonths}`, `{milestone}` from the selected child; `{cycleLabel}`, `{phase}`,
  `{phaseTip}` from the last period. A story is shown only when its audience fits (stage, week / age window,
  cycle phase, Premium promo only for free users) and every variable it uses is available.
- **UI:** `src/components/stories/` (row, full-screen viewer, code-drawn SVG illustrations, `stories.css`).
  Tap right/left, swipe, hold to pause, swipe down / × / Android back to close. Unseen stories first; seen state is
  per user in localStorage. CTAs open tools, tabs or screens through `PUSH_NAV_EVENT`, so Premium gates apply.
- **Analytics:** `tool_used` with `tool_id = 'stories'`, actions `story_open`, `story_complete`, `story_cta`,
  `story_quiz_ok` / `story_quiz_no`, `item_id` = story id.
- **Fonts:** Plus Jakarta Sans (headlines, numbers) and Inter (text); offline falls back to Inter.
- **Before `on`:** medical copy needs a clinician review; adding a language needs its own `src/data/stories/<lang>.ts`.
- Prototype: `docs/prototypes/dashboard-stories.html`.
