# Tərbiyə (positive parenting) tool

- Ana module, tool id `parenting` (app-defined virtual tile, icon HeartHandshake). Visible only when the app language
  is **az** (content is Azerbaijani only), the active child is under 13 (or has no birth date: the parent picks the
  age band) and `app_settings.parenting_tool` = 'on' (default 'off', Admin → Tənzimləmələr). Never in flow/bump/partner.
- Code: `src/lib/parenting*.ts`, `src/components/tools/parenting/`, styles `.a-par-*`; content in
  `src/data/parenting/az/` (add a language as its own folder, never by machine translation). 82 UI keys × 23 languages.
- Content: 4 age-band overviews, 43 articles in 9 areas, 25 SOS cards, 3 programmes (21/14/7 days), 2 quizzes, 40 daily
  tips. Every article cites real sources; emergency numbers come from the country helper (`{emergency}`).
- Free: band overviews, daily tip, 17 full articles (≥1 per area), 8 SOS cards, first 3 days of every programme, short
  quiz results, and **all** "see a specialist" / red-flag / emergency content. Premium (PremiumBlurGate): remaining
  articles' practical sections, all SOS cards, programme days 4+, detailed quiz results and milestone support tips.
- Progress, quiz results, bookmarks and the chosen band are device-only (`anacan.parenting.v1.<uid>` in localStorage).
- Migration `supabase/migrations/20261107170000_parenting_tool.sql` (+ `.cdc.json`): app_settings row + public allowlist
  only, no new relation — **not applied**. Ships to native users with the next native build; switch on after that.
- Needs pediatrician / child-psychologist copy review before switching on.
