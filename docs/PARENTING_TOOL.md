# Tərbiyə (positive parenting) tool

- Ana module, tool id `parenting` (app-defined virtual tile, icon HeartHandshake). Visible when content is
  **registered for the app language** (`src/data/parenting/index.ts`; all 23 app languages), the active child is under 13
  (or has no birth date: the parent picks the age band) and `app_settings.parenting_tool` = 'on' (Admin →
  Tənzimləmələr). Never in flow/bump. The linked **partner** of an Ana-module mother sees it too (below).
- Code: `src/lib/parenting*.ts`, `src/components/tools/parenting/`, styles `.a-par-*`; content in
  `src/data/parenting/<lang>/` (each language its own folder and lazy chunk, never machine-translated from az).
- Content: 4 age-band overviews, 43 articles in 9 areas, 25 SOS cards, 3 programmes (21/14/7 days), 2 quizzes, 40 daily
  tips. Every article cites real sources; emergency numbers come from the country helper (`{emergency}`). Articles,
  SOS cards and programmes carry optional `tags` (search / Anacan.AI stems; az in `az/tags.ts`).
- Free: band overviews, daily tip, 17 full articles (≥1 per area), 8 SOS cards, first 3 days of every programme, short
  quiz results, and **all** "see a specialist" / red-flag / emergency content. Premium (PremiumBlurGate): remaining
  articles' practical sections, all SOS cards, programme days 4+, detailed quiz results, milestone support tips and
  programme reminders.

## Content loading and languages

`src/data/parenting/index.ts` is an async, lazy registry:

```ts
export const PARENTING_LANGUAGE_LOADERS = {
  az: () => import('./az'),
  // register a finished translation with one line:
  // en: () => import('./en'),
};
```

Registering a language is that one line; the tile, home card, partner entry, search and the Anacan.AI link then
appear for that app language automatically. `loadParentingContent(lang)` = bundled chunk + published editor
overrides (cached in memory 10 min); `useParentingContent(lang)` gives `{ content, loading, failed, retry }`.

## Account sync

Device first (`anacan.parenting.v1.<uid>`), merged in the background with `public.parenting_state` (one row per
account, RLS own row): newest band, max programme progress (newer on a tie; restart tombstones), newest quiz result,
bookmarks union with add/remove times. The reminder preference never leaves the phone. Offline changes stay dirty and
retry on `online`.

## Programme reminders (Premium)

On the programme screen: on/off switch and time (default 20:30); pause/resume per programme. One local notification
a day for the most recently changed running programme, next 7 days scheduled (`src/lib/parenting-reminders.ts`, ids
882200+). Everything is cancelled when the programme finishes or pauses, the preference is off, or the switch /
content / Premium is gone (the Ana home card re-checks on every app open). A tap opens the tool (partner: his screen).

## Search, Anacan.AI, partner

- Search field on the tool home: article titles/summaries/tags, SOS titles/moments/tags, programme titles; folds
  ə/e, ı/i, ö/o, ü/u, ş/s, ç/c, ğ/g; grouped results; Premium items keep their lock.
- Anacan.AI: under the answer to a parenting question (isterika, vurmaq, yatmaq istəmir, qısqanclıq, ekran, yalan,
  qorxu, dişləmək, bağırmaq …) a card links to the best SOS card or article (`src/lib/parenting-match.ts`, over the
  app language's content) and opens the tool directly on it. Only when the tool is available to that user.
- Partner: "Birlikdə" hub → Tərbiyə (screen `partner-parenting`), same switch/content rules, the woman's current child
  he can see (`partner_children_v1`, else her profile baby); his progress is his own row.

## Admin CMS (Admin → Məzmun → Tərbiyə məzmunu)

Language → item type (article, SOS, programme day, tip, band, quiz, programme, area) → item: the bundled text, a form
of its text fields, save draft / publish / unpublish / revert to bundled. Rows in `public.parenting_content_overrides`
(patch jsonb by item id; published rows readable by everyone, public columns only; writes only via
`admin_parenting_override_save_v1` / `_revert_v1`, `has_role(auth.uid(), 'admin')`). Structure (ids, bands,
Free/Premium, scoring) cannot be overridden; `{emergency}` must stay and numbers may not be hard-coded.

## Migrations

- `20261107170000_parenting_tool.sql` (+ `.cdc.json`): app_settings row + public allowlist (applied; switch on).
- `20261107200000_parenting_sync_cms.sql` (+ `.cdc.json`), applied on Google: `parenting_state`,
  `parenting_content_overrides`, three admin RPCs; both relations enrolled in CDC + writer guard. No cron/timer.

Live (switch on). A pediatrician / child-psychologist copy review is still outstanding (deferred by the owner).

## Behaviour notes (2026-11-08)

- Sync merge: for the same programme run (same `startedAt`) the newest change wins, so "undo" on one phone is not
  reverted by the other copy; runs started on different days keep the copy with more checked-off days.
- Milestone self-check is not offered before the first checkpoint (4 months): a newborn's "not yet" on a 4-month
  red-flag item is normal (`tooEarlyForMilestones`, copy `par_milestone_early`).
- The style-quiz result is saved in the account (synced); the intro says so in all 23 languages.
- Anacan.AI matcher: zh/ja tags match as substrings (no spaces between words); Arabic folds alef/taa marbuta and
  strips attached ال / و / ب / ل / ف / ك prefixes.
- Paywall labels `pm_feat_par_*`; an unknown feature id never shows raw (generic "Bu alət").
- Analytics: `tool_used` with `item_id` for opened articles, SOS cards and programmes (also when opened directly),
  `home_card_open`, `home_continue`.
- Reminder taps carry the programme id and open that programme; the Ana home card shows "Davam et: <programme>
  · Gün n/total" for the running programme (native: needs a new build for the reminder payload).
