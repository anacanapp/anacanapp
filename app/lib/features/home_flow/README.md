# home_flow — flow (cycle tracking) life-stage home

Port of `src/components/flow/**`, `src/components/ttc/TtcSection.tsx` (+ `src/lib/ttc.ts`, `src/data/ttc`),
`src/components/mommy/MommyPeriodTracker.tsx` (+ `src/lib/mommy-period.ts`) and the hooks they use.
Entry point: `registerHomeFlowFeature(FeatureRegistry r)` in `home_flow.dart` — registers the flow stage body
(`registerHomeStageBody('flow', FlowDashboard)`) and the `mommy-period` screen (`PeriodTrackerView`).

## React → Dart

| React | Dart |
|---|---|
| FlowDashboard.tsx | flow_dashboard.dart (`FlowDashboard`, period start/end dialogs, `differenceInDaysFns`) |
| FlowPeriodCalendar.tsx | flow_period_calendar.dart |
| FlowDailyLogger.tsx | flow_daily_logger.dart |
| FlowCycleStats.tsx / CycleTrendChart.tsx / FlowMoodChart.tsx | flow_cycle_stats.dart / cycle_trend_chart.dart / flow_mood_chart.dart |
| SymptomPatternReport.tsx | symptom_pattern_report.dart (`SymptomAnchor` = `anchor` prop) |
| DailyStoryCards.tsx | daily_story_cards.dart (`seededShuffle` with JS number semantics) |
| PeriodDelayBanner.tsx / CycleAnomalyBanner.tsx | period_delay_banner.dart / cycle_anomaly_banner.dart |
| PillReminderCard.tsx / FlowRemindersCard.tsx | pill_reminder_card.dart / flow_reminders_card.dart |
| PartnerFlowStatusCard.tsx | partner_flow_status_card.dart (data via `partnerFlowSnapshotProvider`) |
| MommyPeriodTracker.tsx | mommy_period_tracker.dart: `MommyPeriodBanner` (for the mommy home), `PeriodTrackerView` (= default export) |
| lib/mommy-period.ts | logic/mommy_period.dart |
| hooks useCycleHistory / usePeriodDayLogs / useFlowDailyLogs / useFlowReminders / usePhaseTips / useFlowData(useFlowInsights) | data/flow_hooks.dart (same query keys, staleTimes, invalidations; `period-recording:<uid>` scope via `runInScope`) |
| all supabase calls of those hooks | data/flow_repository.dart (`FlowRepository`, Supabase impl, overridable) |
| PHASE_INFO / CATEGORY_INFO / REMINDER_TYPE_INFO, getTranslatedTip | data/phase_info.dart |
| feature37Text (flow keys) | copy/flow_copy.dart + flow_copy.g.dart |
| TtcSection.tsx / lib/ttc.ts / data/ttc | ../ttc/ttc_section.dart / ../ttc/ttc.dart / ../ttc/data/ttc_text.g.dart |
| shadcn Switch / Slider / Input / Button / AlertDialog / Calendar (core.design-ui not ported) | widgets/flow_ui.dart (local equivalents) |

`useDailyLogs`: no flow component uses it (CalendarScreen does) — nothing ported here.
Generated data: `node app/tool/ttc/gen_flow_data.mjs` (byte-for-byte reproducible). No asset dirs are needed (const Dart).

## Interfaces awaiting wiring (flow_platform.dart; all have safe defaults)

| Provider | Default | Wire to |
|---|---|---|
| `cycleHealthWriterProvider` (`CycleHealthWriter`) | no-op | native HealthCycle bridge + `syncPeriodDaysToHealth` (domain/cycle/health_cycle.dart) |
| `flowNotificationPlannerProvider` | not native, no-op | central local-notification scheduler (`flow-pill`, id 91201, daily) |
| `flowPremiumGateProvider` / `flowIsPremiumProvider` | pass-through / true | paywall.gates `PremiumGate`, `useSubscription().isPremium` |
| `flowHomeSlotsProvider` | nothing | WaterWidget, PartnerHomeCard, UpcomingAppointments |
| `flowOpenAiChatProvider` | no-op | AI tab with a prompt (`/ai-chat?prompt=`) |
| `flowAddAppointmentProvider` | no-op | `useAppointments().addAppointment` |
| `partnerFlowSnapshotProvider` | null | partner.home `usePartnerData` |
| `flowTimeZoneProvider` | `'UTC'` | device IANA zone (`p_timezone`; needs e.g. flutter_timezone) |
| `flowHapticsProvider` | no-op | lib/native haptics |
| `flowOutboxProvider` | `offlineOutboxProvider` | — |

## Behaviour notes

* The React logger writes through `record_period_days` directly: no optimistic cache write and no outbox. Only
  `useAddCycle` uses the outbox (optimistic insert, refetch after the `cycle_history` flush event). Kept as is.
* TanStack mutation `scope` is not in core/cache; `runInScope` serialises per scope id (foundation gap).
* `.a-fade-in` (CSS animation) overrides framer's inline opacity/transform, so cards with both only show the 460 ms
  fade/rise; framer-only elements use `FramerEnter` (opacity 300 ms + y spring 500/25, with the TSX delays).
* `format(..., { locale })` for az uses the date-fns tables (`flowFormat`); intl's az months are lower-case
  (foundation gap in `formatDatePattern`). `text-transform: uppercase` under `lang=az|tr` maps i→İ (`cssUpper`).
* `mapFollowupContent` bundled fallback (followup36-content.json) and the legacy TIP_TRANSLATIONS table are not ported:
  phase tips use `mapRowsTranslation`, `getTranslatedTip` uses the `tip.<text>` dictionary entry only.

## Visual uncertainties / deviations

* Charts (recharts → fl_chart): monotone curves approximated by `isCurved + preventCurveOverShooting`; no axis tick
  marks (recharts draws 6 px ticks); tooltips are fl_chart touch tooltips (position/arrow differ, CycleTrend shows
  `#n` + `Uzunluq : N gün`, Mood shows the date + rows); Y ticks of the trend chart fixed to recharts' nice ticks
  15/22.5/30/37.5/45; mood chart `connectNulls` = skipped days; area gradients 0.3→0 at 5 %/95 %; recharts
  animations (1.5 s draw) are not reproduced.
* Native inputs: `type=time` (pill) → Material time picker; `type=month` (TTC start) → Material date picker in year
  mode; number inputs → EditableText. shadcn Calendar weekday names for az use date-fns `short` values.
* Dashed borders (predicted days, `.a-teaser`) are painted dashes (3/3) — browser dash lengths differ slightly.
* The period-picker bottom sheet uses `--a-spring` over 300 ms instead of framer's spring 300/25; DailyStoryCards
  detail sheet blur = sigma 4.
* `.a-section-link` month label in the calendar head looks larger in the reference shots than 12 px; kept at the CSS value.
* Goldens (test/features/home_flow/goldens) have no emoji font: emoji render as boxes.
