# features/home — woman home tab (shared dashboard + bump), stories, calendar

Entry point: `registerHomeFeature(FeatureRegistry r)` (`register_home.dart`) registers the `home` tab (Dashboard),
`ScreenId.calendar`, the frame overlays `floating-timer` and `home-widget-sync`, and the `bump` stage body.
Flow / mommy ports call `registerHomeStageBody(LifeStages.flow|mommy, builder)` (or `registerHomeStageSlivers`) from
`home_stage_registry.dart`; unregistered stages render nothing.

## React → Dart

| React | Dart |
|---|---|
| components/Dashboard.tsx (frame, top bar, greeting) | dashboard.dart |
| components/Dashboard.tsx (BumpDashboard) | bump/bump_dashboard.dart |
| components/bump/FetusHeroImage.tsx, lib/illustration-image.ts | bump/fetus_hero_image.dart |
| hooks/usePregnancyContent.ts, useTrimesterTips.ts, useTrimesterInfo.ts (fallback), useDynamicContent.ts (useWeeklyTips), useFruitData.ts, useFetusIllustrations.ts, usePregnancyDayNavigation.ts | data/pregnancy_content.dart |
| hooks/useDailyLogs.ts (+ lib/water-intake.ts) | data/daily_logs.dart |
| hooks/useAppointments.ts | data/appointments.dart |
| all supabase calls of the above | data/home_repository.dart (`homeRepositoryProvider`, fakeable) |
| components/home/UpcomingAppointments.tsx, AppointmentSheet.tsx | appointments/*.dart |
| components/dashboard/WaterWidget.tsx, RedFlagBanner.tsx (+ useBloodPressureLogs), RecentBlogPosts.tsx | dashboard/*.dart |
| components/MedicalDisclaimer.tsx (anacan, inline) | dashboard/medical_disclaimer.dart |
| components/recap/RecapEntry.tsx (RecapHomeCard) | dashboard/recap_home_card.dart (opens screen `recap`) |
| components/FloatingTimerWidget.tsx | floating_timer_widget.dart |
| components/HomeWidgetSync.tsx, hooks/useHomeWidgetSync.ts (journey only) | home_widget_sync.dart, data/widget_text.g.dart |
| CSS primitives (.a-sky, .a-cloud, .a-fade-in, .a-float, .a-tag, .a-trio*, .a-icon-btn) | widgets/home_widgets.dart |
| components/stories/*, lib/stories.ts, lib/server-stories.ts, hooks/useServerStories.ts, data/stories/az.ts | ../stories/*.dart (+ data/*.g.dart) |
| components/CalendarScreen.tsx (+ usePeriodDayLogs query) | ../calendar/calendar_screen.dart |

Generated / copied (reproducible): `node app/tool/home/copy_assets.mjs` (fetus SVGs → `assets/images/fetus/`, `<style>`
classes inlined because flutter_svg ignores them), `node app/tool/home/gen_stories.mjs`, `node app/tool/home/gen_widget_text.mjs`.
**Declare `assets/images/fetus/` in pubspec.yaml** (tests read it from disk meanwhile).

## Interfaces awaiting wiring (all have safe defaults)

* Wired by the app root (app/lib/app/app_wiring.dart): premium, app settings, selected child, cycle length, disabled
  tools, emergency number, AdFreePremiumOffer, ChildSelector, BirthOnboardingModal. Still default: docs/flutter/WIRING.md.
* `home_inputs.dart`: `homeIsPremiumProvider` (false), `homeTotalUnreadProvider` (0: unread partner + DM count),
  `homeAppSettingProvider(key)` (null → stories off until `dashboard_stories` is wired), `homeSelectedChildProvider`,
  `homeEffectiveCycleLengthProvider`, `homeToolDisabledProvider`, `homeIsNativeProvider`; `homeNavigationProvider`
  already drives the shell.
* `home_slots.dart` `HomeSlots` (render nothing by default): BannerSlot (`home_top`/`home_bottom`), AdFreePremiumOffer,
  AdInlineAnchor, PartnerCareCard, RecoveryHome, BabyChatCard, BooksHomeCard, AptekHomeCard, PartnerHomeCard,
  ChildSelector (mommy top bar), DailySummaryAutoSync, BirthOnboardingModal. `homeWidgetBridgeProvider` (native widgets).
* `homeBlogPostsProvider` — stand-in query (title/excerpt translation only); override with the blog feature's useBlog
  (country filter, editorial localisation).
* `recapHomeYearQuery` uses its own key until the recap feature exposes useRecap.
* `homeWaterGoalNotifierProvider` (partner notification), `timerLogSaverProvider` (defaults to the outbox `baby_logs` row),
  `storyExporterProvider` (story "Yüklə" → share; default fails → "Alınmadı"), `storyEventLoggerProvider` (analytics).

## Unsure / not ported

* The home tab is registered with `registerTabSlivers` (`DashboardSliver` + `DashboardSky` background, update banner
  above): stage slivers sit directly in the shell's scroll view. `Dashboard` (box, shrink-wrapped) stays for tests.
* Reference-shot comparison (bump week 24, 390×844 light): hero, chips, progress bar, tips list, cards, calendar list,
  trio, water card match. Remaining: hero block sits ~6 pt higher than in the web shot; the fetal-length note wraps one
  word later; emoji render as boxes in goldens (no emoji font in the test harness).
* Not ported: the default (non-redesign) Dashboard branch and RecentBlogPosts default variant (no woman stage reaches
  them), PregnancyDayNavigator (unused: "naviqasiya UI silinib"), RedFlagBanner urgent pulse, story mascot images,
  HomeWidgetSync care (Premium feeding / nap) section, `.loss-scope` sky tint.
* `DashboardHomeBlocks.test.tsx` covers ParentingHomeCard / BooksHomeCarousel (mommy / books features) — not ported here.
