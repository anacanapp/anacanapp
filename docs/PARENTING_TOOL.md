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

## Update 2026-11-08 (content + UX)

- Content (all 23 languages, same ids/order as az): 61 articles (24 free), 28 SOS cards (10 free), 6 programmes
  (`no-shouting-21`, `tantrums-14`, `sleep-7`, `siblings-7`, `screen-reset-7`, `special-time-7`), 30 daily tips per band.
  New 0–1 articles and family topics are in `articles-baby-year.ts` / `articles-family-life.ts`. Specialist review of
  the new medical/psychological copy is still outstanding (deferred by the owner).
- Per-child state: band, programme progress and quiz results are stored per child (`children` map next to the old
  account-level fields, which older app versions keep reading); a manual band expires when the child moves to another
  band. Child switcher in the tool header for 2+ children under 13; the tile/home card stays while any child is under 13.
- First-run intro (3 steps, asks for the age band when there is no birth date); quizzes have a back button; finished
  programmes show a summary and a next suggestion; free users see "İlk 3 gün pulsuz" on programme rows.
- CMS history: `20261108160000_parenting_cms_history.sql` (applied) adds `parenting_content_override_history` (trigger on
  overrides, admin-only read, list/restore RPCs, CDC + writer guard). CDC replay must run with
  `session_replication_role = replica` so history rows are not written twice. Admin shows history, preview and
  stale-translation badges.

## Update 2026-11-09 (sharing, reminders, sources, support, milestones)

- **Send to partner** (SOS cards and articles; the mother with a linked partner): `src/lib/parenting-share.ts` sends an
  ordinary partner chat message (`partner_messages`, type `text`, same RPC and push as the chat): emoji + title, a
  one-line summary, a hint and the link `https://app.anacan.az/parenting/<kind>/<id>` (`kind` = `sos` | `article`;
  `parseDeeplink` also accepts `programme` and `anacan://parenting/…`). No new message type, table or push contract.
  In the chat such app links open in the app (`CommentText` → `anacan:deeplink`, Index routes it: mother to the tool,
  partner to `partner-parenting`, on that item); other links still open in the browser. The partner's Tərbiyə home
  lists **"Sənə göndərilənlər"** (her shares of the last 60 days, one row per item, unread marked; opening marks the
  message read). A second button opens the phone's share sheet (title, summary, footer; no link).
- **Free-day reminders:** free users can turn on programme reminders for the free days (days 1–3,
  `canRemindDay`); later days need Premium. The reminder card says so (`par_reminder_free`).
- **SOS sources:** each SOS card has `sources: string[]`, ids into the shared list `az/sources.ts` (1–3 per card).
  The ids are the same in every language; `scripts/parenting/check-translation.mjs` compares them and does not treat
  them as translatable text. The daily tip has a "Mənbələr" link to the band overview's sources.
- **Support cards:** band overviews, articles and SOS cards may carry `support: 'mental-health' | 'child-safety'`
  (same value in every language). The card opens the app's mental-health tool (mood / EPDS test) and offers the
  emergency call (country helper, never hard-coded). The partner sees only the call button.
- **Milestone check:** not offered in the 6–12 band (6 years and older) nor after the last checkpoint + 12 months;
  not before the first checkpoint. A preterm baby (born before 37 weeks, from the child's due date) gets the
  corrected age until 24 corrected months (`milestoneAge`). Mother side: `user_children.due_date`. Partner side:
  `partner_children_v1` returns `due_date` after migration `20261109090000_partner_children_due_date.sql`
  (function only, not applied yet); without it the partner gets calendar age.
- **Home card:** the Ana home card loads only the small tips + programmes chunk of the language
  (`PARENTING_HOME_LOADERS`), never the whole content.

## Update 2026-11-09: Premium-only
- Tərbiyə is fully Premium (owner decision): removed from the free list in `src/lib/freemium.ts`, so the tile,
  deeplinks, push links and the dashboard "Davam et" line open the paywall for free users (ToolsHub
  `PremiumToolBoundary`). The partner screen `partner-parenting` is wrapped in the same boundary (household
  Premium counts). The dashboard home card and the tip/programme reminders run only for Premium users.
- Əlavə qida bələdçisi (`solid-food-guide`) is Premium-only too (no longer "free · limited").
