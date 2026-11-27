# app/lib/domain — pure business logic ported from `src/`

Pure Dart (no Flutter imports). Every file starts with `// Ported from: <src path>`. User-visible copy is passed
through a `Tr = String Function(String key, String azDefault)` parameter (default: the Azerbaijani text), so the
i18n runtime plugs in `tr`. "Now" comes from `DomainClock` (tests freeze it like `vi.setSystemTime`).

JS/date-fns semantics live in `js_compat.dart` (tested in `test/domain/js_compat_test.dart`): `Math.round`,
JS `%`, `Number()`, `String(n)`, FNV-1a with `Math.imul`, stable sort, `new Date(string)` parsing (date-only =
UTC, date-time = local, V8 day overflow), date-fns `parseISO` / `addMonths` (month-end clamp) /
`differenceInCalendarDays` (DST-safe). A JS Invalid Date is `null` in Dart.

## Tables and fixtures

* Data tables are generated, never retyped: `node app/tool/domain/gen_data.mjs` → `**/data/*.g.dart`
  (WHO LMS tables, Hadlock/fetal sizes, maternity rules + regional currencies, recap copy/looks/persona/number
  tables, app-language flags, emergency numbers, danger signs, BP copy, ads placements, anacan.ts tables,
  parenting languages, the NFD search-fold table). Re-running it reproduces the files byte for byte.
* Cross-language fixtures: `node app/tool/domain/gen_fixtures.mjs` runs the original TypeScript (bundled with the
  repo's esbuild, `app/tool/domain/run_ts.mjs`) in child processes with `TZ` = UTC, America/New_York,
  Europe/Berlin, Asia/Baku and writes `test/domain/fixtures/*.json`. Zone-dependent tests load the fixture of the
  process zone; zone-specific vitest cases (`process.env.TZ`/`vi.stubEnv('TZ')`) skip outside their zone.
  Run everything with `tool/domain/run_tz_tests.sh` (from `app/`).

## Module map

Cases = `test(...)` blocks in the Dart file (loops count once); "+fx" = fixture-driven cross-language test.

| src module | Dart | Test | Cases |
|---|---|---|---|
| lib/local-date.ts, lib/stored-date-key.ts, lib/local-day-range.ts | dates/local_date.dart | dates/local_date_test.dart | 3 + fx |
| lib/pregnancy-utils.ts | pregnancy/pregnancy_utils.dart | pregnancy/prematurity_test.dart, calendar_age_test.dart, calendar_dates_tz_test.dart | 9 + 7 + 8 + fx |
| lib/pregnancyWeightGain.ts, lib/pregnancyWeightBmi.ts | pregnancy/pregnancy_weight.dart | pregnancy/pregnancy_weight_test.dart | 11 |
| lib/fetal-size.ts, lib/fetal-size-copy.ts | pregnancy/fetal_size.dart (+data) | pregnancy/fetal_size_test.dart | 6 |
| lib/fetalGrowth.ts | pregnancy/fetal_growth.dart | pregnancy/fetal_size_test.dart | (above) + fx |
| lib/cycle-utils.ts (no suite) | cycle/cycle_utils.dart | fixtures_tests/zoned_fixtures_test.dart | fx |
| lib/cycle-predictions.ts (no suite) | cycle/cycle_predictions.dart | fixtures_tests/zoned_fixtures_test.dart | fx |
| lib/period-flow.ts | cycle/period_flow.dart | cycle/period_flow_test.dart | 4 + fx |
| lib/healthCycle.ts (pure part + bridge interface) | cycle/health_cycle.dart | cycle/health_cycle_test.dart | 4 |
| lib/whoGrowth.ts, lib/whoGrowthData.ts | growth/who_growth.dart (+data) | growth/who_growth_test.dart | 16 + fx |
| lib/laborUtils.ts | labor/labor_utils.dart | labor/labor_utils_test.dart | 16 |
| lib/bloodPressure.ts, lib/redFlags.ts, lib/emergency.ts | health/*.dart (+data) | health/health_test.dart | 24 |
| lib/baby-logs-range.ts | baby/baby_logs_range.dart | baby/baby_logs_range_test.dart | 4 + fx |
| lib/sleep-training.ts | sleep/sleep_training.dart | sleep/sleep_training_test.dart | 9 + fx |
| lib/sleep-predict.ts, lib/nap-alerts.ts ("sleep next") | sleep/sleep_predict.dart, sleep/nap_alerts.dart | sleep/sleep_predict_test.dart | 7 + fx |
| lib/vaccine-schedule.ts | vaccines/vaccine_schedule.dart | vaccines/vaccine_schedule_test.dart | 7 + fx |
| lib/water-intake.ts, water-intake-rpc.ts, Nutrition.tsx targets | water/water_target.dart | water/water_test.dart | 3 |
| hooks/useVitaminSchedules.ts, VitaminTracker.tsx, scripts/notification-jobs/vitamin-zones.mjs | vitamins/vitamins.dart | vitamins/vitamins_test.dart | 6 + fx |
| data/maternityRules.ts, MaternityCalculator.tsx, hooks/useMaternityBenefits.ts | maternity/maternity_rules.dart (+data) | maternity/maternity_rules_test.dart | 4 + fx |
| lib/maternity-regional.ts | maternity/maternity_regional.dart (+data) | maternity/maternity_regional_test.dart | 14 |
| lib/aptek-pricing.ts, lib/aptek-offers.ts | aptek/*.dart | aptek/aptek_test.dart | 12 + fx |
| lib/onboarding-billing.ts | billing/onboarding_billing.dart | billing/onboarding_billing_test.dart | 10 |
| lib/freemium.ts, hooks/useSubscription.ts (usage limits) | billing/freemium.dart, billing/usage_limits.dart | billing/freemium_test.dart | 9 |
| lib/ads/policy.ts, lib/ads/cadence.ts, lib/ads/config.ts (non-zod) | ads/*.dart (+data) | ads/ads_test.dart | 10 |
| lib/partner-link.ts (validation/answers/messages) | partner/partner_link.dart | partner/partner_link_test.dart | 9 |
| hooks/useReferral.ts (mapping/stats) | referral/referral.dart | referral/referral_test.dart | 2 |
| lib/recap/{window,numbers,pace,persona,copy,types,model}.ts | recap/*.dart (+data) | recap/recap_test.dart | 16 + fx |
| lib/weaning.ts | weaning/weaning.dart | weaning/weaning_test.dart | 31 + fx |
| lib/parenting.ts (rules, programmes, quizzes, milestones) | parenting/parenting.dart | parenting/parenting_test.dart | 20 |
| lib/kid-exercises.ts | kid_exercises/kid_exercises.dart (+fold data) | kid_exercises/kid_exercises_test.dart | 9 + fx |
| lib/play-together.ts (without book catalogue) | play_together/play_together.dart | play_together/play_together_test.dart | 7 + fx |
| lib/local-notification-scheduler.ts (pure planning) | notifications/local_notification_plan.dart | notifications/local_notification_plan_test.dart | 5 + fx |
| lib/app-languages.ts (lookups) | common/app_languages.dart (+data) | (via vaccines/recap/parenting) | — |
| types/anacan.ts | models/anacan.dart (+data) | models/anacan_test.dart | 3 |

## Deliberately not ported here

* Vitest cases that test React/UI, translation files or native plugins: `emergency.test.ts` locale-file and
  MedicalDisclaimer cases, home-widget groups of `sleep-widgets.test.ts`, the "native scheduling" group of
  `local-notification-scheduler.test.ts` (store rules covered by pure equivalents), `recap.test.ts`
  renderRecapFrame, `partner-link.test.ts` transport/env cases, `weaning.test.ts` WEANING_COPY text checks,
  `play-together.test.ts` text and book-catalogue checks, `kid-exercises.test.ts` image-file existence.
* Admin-only: `ads/config.ts` zod schema validation (`adsConfigurationSchema`, `parseAdsConfiguration`).
* Server-only: `vitamin-zones.mjs` `normalizeTimeZone`/`groupZonesBySlices` (needs an IANA zone DB; slicing is
  ported with an injected offset).
* Not yet ported (pure, but outside this brief): parenting device store / multi-child merge
  (`sanitizeParenting`, slots), `books/*`, `recap/render.ts` (canvas), and the ~150 other `src/lib` modules with
  suites (chat, community, stories, outbox, premium funnel, epdsScoring, bloodSugar, illness, ttc, …).
* Dead per docs/flutter/DEAD_CODE.md: `lib/iap.ts`, `lib/referralSync.ts`, `lib/recap/index.ts`,
  `lib/recap/fixtures.ts` (used only as test data via the fixtures).
