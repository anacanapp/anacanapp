# Gündəlik Bilik Yarışı (daily quiz), 2026-11-13

**What it is:** a free code tool (`daily-quiz`) with 5 questions a day, a 20-second timer and instant feedback per
question. It has a streak, weekly points, leagues and a weekly leaderboard (first names only).

## Database
Migrations `20261113200000_daily_quiz.sql`, `…210000_daily_quiz_seed_az.sql`, `…220000_daily_quiz_answer.sql` and
`…230000_daily_quiz_tool.sql`. The quiz tables have CDC and writer guards.
- `quiz_questions`
  - One row per question per language. Translations share `group_id`.
  - Admins edit it through RLS. Apps never read it directly.
  - Seed: 100 Azerbaijani questions from `scripts/daily-quiz/questions_az.py`, built by `build_seed.py` with stable
    group ids and shuffled option order.
- `quiz_attempts`
  - One round per user per Baku day.
  - The question set favours questions the player has not seen in 60 days.
- RPCs
  - `daily_quiz_state_v1`
  - `daily_quiz_start_v1`: questions come without answers; also used to resume a round.
  - `daily_quiz_answer_v1`: stores the answer once, then reveals it.
  - `daily_quiz_finish_v1`
  - Clients cannot call `daily_quiz_submit_v1`.
- Scoring
  - 20 points per correct answer, +20 for a perfect round.
  - League: bronze below 150 points a week, silver below 350, gold from 350.
- Settings
  - Stored in `app_settings.daily_quiz` as `{enabled, languages[], questions_per_day, seconds_per_question}`.
  - The key is in the public allowlist (`get_public_app_setting`).
  - A language can be played only when it is listed and has at least `questions_per_day` active questions.
  - Admins can always see the quiz.

## App
- Code
  - Screen: `src/components/tools/quiz/DailyQuizTool.tsx` and `daily-quiz.css`.
  - Client: `src/lib/daily-quiz/api.ts`.
  - Tile visibility: `visibility.ts`.
- UI copy is in 23 languages (`copy.ts`).
- Illustrations are in `public/quiz/*.webp`, made with Nano Banana Pro.
- Native apps get it with build 51.0. The web app gets it with the gateway deploy.

## Admin → Bilik Yarışı
- **Suallar:** edit questions, filter by category and search. "Düz cavab %" shows how hard each question is.
- **Dillər və tərcümə:** "Tərcümə qaralaması" copies the Azerbaijani questions into a language as inactive drafts.
  Translate each one (the Azerbaijani source is shown), mark it active, then switch the language to live.
- **Statistika və reytinq:** results for the last 30 days and this week's leaderboard.
- **Ayarlar:** turn the quiz on or off, questions per day, seconds per question.

Translations are made by people or Claude, never by Gemini (owner rule).

## Switched off and removed (2026-11-14)
On the owner's request the quiz is off and its code is gone from the app and Admin. The migration is
`20261114080000_daily_quiz_off.sql`.
- `app_settings.daily_quiz.enabled` is `false`.
- The `tool_configs` row `daily-quiz` is deleted.
- `quiz_questions` (300 Azerbaijani questions) and `quiz_attempts` are still in the database.
- To bring the quiz back, restore the removed files from commit 6229683 and set `enabled` back to true.
