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

## Entry points (2026-11-06)
All follow the tile rules (Ana module, `weaning_tool` = 'on') and need a child of 12+ months; logic in
`src/lib/weaning-entry.ts`, components in `src/components/tools/weaning/WeaningEntryCards.tsx`, 16 keys × 23 languages.
- **Home card** (`MommyDashboard`, after the prematurity card): one-time, dismissible "Davam etmək də, ayırmaq da
  sizin seçiminizdir" card; "Davam edirəm" stores `continueBF`, ✕ is remembered per account + child on this phone.
  While a plan runs (active/paused) it shows progress and the current step instead. No push, no ad.
- **Feeding logger**: under the feeding options (breastfeeding offered) an "Ayırmağı düşünürsünüz?" link while no
  plan runs and the mother has not chosen to continue. Tapping it reads the last 7 days of breastfeeds and prefills
  the builder (night 22–06, morning 06–09, bedtime 19–22, rest daytime; needs 3+ logged days, else defaults).
- **Anacan.AI**: under the answer to a weaning question (23-language pattern list, mother persona only) a card that
  opens the tool. The AI request itself is unchanged; sending plan context to `dr-anacan-chat` needs a functions change.
- All open the tool with `PUSH_NAV_EVENT { tool: 'weaning' }`. Verified in the real-app harness (az, 14-month child).
