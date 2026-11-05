# Süddən ayırma (gradual weaning) tool

- Ana module, tool id `weaning`; tile visible for an active child of 9+ months, plan building from 12 months.
- Admin switch `app_settings.weaning_tool` ('on' / 'off', default 'off'), in Admin → Tənzimləmələr and on the
  public settings allowlist (`get_public_app_setting`).
- Code: `src/lib/weaning*.ts`, `src/components/tools/weaning/`, styles `.a-wean-*`; 319 keys in all 23 languages.
- Data: `weaning_plans`, `weaning_checkins` (owner-only RLS, CDC/writer guarded), migration
  `supabase/migrations/20261106090000_weaning.sql` — **applied on Google 2026-11-05** (verified: RLS on, guarded,
  `tool_configs.weaning` free + mommy only, `weaning_tool` = "off", allowlist intact).
- Free: intro, readiness, check-in and red flags, guides, myths, plan hub. Premium: dated timeline and step reminders.
- Ships to native users with the next native build; turn the switch on only after that build is live.
- UX spec: approved prototype (version A · Yol); content from WHO 2023, AAP 2022, NHS, La Leche League; needs
  pediatrician + IBCLC copy review before switching on.
