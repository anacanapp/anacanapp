# Partner feature (phase 6, partner core)

Port of the partner module 2.0: the partner's `home` ("Bu gün") and `together` ("Birlikdə") tabs, the home cards,
the pairing form, the onboarding tour, level-up confetti, SOS (button, mother sheet, receiver), the mother's partner
care card and daily-summary sync, the partner push settings screen, and the shared partner data hooks.
Register with `registerPartnerFeature` (`register.dart`); wire the seams with `partnerWiringOverrides()`
(`partner_wiring.dart`). Tests: `app/test/features/partner/`.

The partner `chat` tab (chat feature), `ai` tab + `PartnerAIPremiumGate` (ai_chat) and `profile` tab
(`PartnerProfileScreen`, profile feature) are registered by their features; this feature supplies their data
(`aiPartnerSourceProvider`, `partnerProfileDataProvider`, `profileSlotsProvider.partnerLinkForm`).

## Layout

| React | Dart |
|---|---|
| `hooks/usePartnerData.ts` | `data/partner_data.dart` — `partnerDataProvider` (masked view + `getPregnancyWeek` / `getDaysUntilDue` / `getBabyAgeDays` / `getCyclePhaseInfo` / `getDaysUntilNextPeriod`), `partnerDataSourceProvider` (fetch, 5-min poll, resume refetch, offline cache), `PartnerWomanData`, `PartnerChild`, `normalizePartnerChildren`, `PartnerDailyLog` |
| `hooks/usePartnerSharing.ts` | `data/partner_sharing.dart` — `partnerSharingProvider` (mother: read / optimistic write), `partnerSharedSettingsProvider` (partner: her row, realtime), `ownSharingCacheProvider` (`getOwnSharingSettings`, 60 s), `PartnerSharing`, `pickSharing` |
| `hooks/usePartnerFamily.ts`, `hooks/usePartnerRecentMoods.ts` | `data/partner_family.dart` — `nightShiftsQuery((from, to))`, `setNightShiftMutation`, `birthPlanQuery`, `saveBirthPlanMutation` (+ `BirthPlanChangedError`), `partnerRecentMoodsProvider((days, enabled))`, `isoDay`, `addDays` |
| `data/partner-missions`, `hooks/usePartnerMissions.ts` | `data/partner_missions.dart` — `kPartnerMissions`, `missionPoolsFor`, `pickDailyMissions`, `dailyMissionId`, `partnerMissionsProvider` (shared completion state / points / level), `partnerMissionsViewProvider(stage)` |
| `hooks/usePartnerStats.ts`, `hooks/usePartnerConfig.ts`, `hooks/useSurprises.ts` | `data/partner_progress.dart` — `partnerStatsProvider`, `partnerAchievementsQuery`, `partnerMenuItemsQuery`, `surpriseCategoriesQuery`, `fallbackSurpriseCategories()`, `surprisesProvider` (add / complete / delete, planned / completed, points, category stats, 6-month chart, top category) |
| `hooks/usePartnerHospitalBag.ts` | `data/partner_hospital_bag.dart` — `partnerHospitalBagProvider` (the tools feature's bag sync with role `partner`), `linkedPartnerUserIdProvider` |
| `hooks/useDailySummary.ts` | `data/daily_summary.dart` — `dailySummaryProvider` (summaries, today, silent 1.5 s sync, `generateAndSendSummary`) |
| `hooks/usePartnerNotifications.ts` | `data/partner_notifications.dart` — `partnerNotifierProvider` (`notifyPartner`, mood / contractions / 5-1-1 / kicks / water) |
| `hooks/useSOSAlert.ts` | `data/sos_alert.dart` — `sosAlertProvider` (alerts, pending, `sendSOS`, `acknowledgeAlert`), `sosHasPartnerProvider`, `sosLocationSharingProvider`, `claimSosHaptic` |
| `hooks/usePartnerDailyTips.ts`, `data/postpartum-partner` | `data/partner_content.dart` — `partnerDailyTipsQuery`, `pickDailyTip`, `partnerDailyTipProvider`, `postpartumWeek`, `postpartumPartnerText(lang)` |
| NextAppointmentCard / PartnerBabyTodayCard effects | `data/partner_cards_data.dart` — `partnerNextAppointmentProvider(motherId)`, `partnerBabyTodayProvider(motherId)`, `aggregateBabyDay` |
| supabase calls of all of the above | `data/partner_backend.dart` — `PartnerBackend` / `partnerBackendProvider` |
| `PartnerHomeScreen.tsx` | `ui/partner_home_screen.dart` |
| `PartnerTogetherScreen.tsx` | `ui/partner_together_screen.dart` |
| `DailyMissionsCard`, `BirthModeCard`, `PostpartumCard`, `PartnerActivityFeed`, `NextAppointmentCard`, `PartnerWeekInfoCard`, `PartnerBabyTodayCard` | `ui/home_cards.dart` |
| `PartnerLinkForm.tsx` | `ui/partner_link_form.dart` (+ `partnerLinkFormSlot`) |
| `PartnerOnboardingTour.tsx` | `ui/partner_onboarding_tour.dart` (`kPartnerTourKey`) |
| `LevelUpCelebration.tsx`, `lib/celebrate.ts` | `ui/level_up_celebration.dart`, `ui/confetti.dart` (`ConfettiCannon`, `showCelebrateConfetti`) |
| `SOSButton.tsx`, `MotherSOSSheet.tsx` | `ui/sos.dart` |
| `AlertReceiver.tsx` | `ui/alert_receiver.dart` (`AlertReceiverHost` = Index mount) |
| `PartnerCareCard.tsx`, `DailySummaryAutoSync.tsx` | `ui/partner_care_card.dart` |
| `PartnerNotificationsScreen.tsx` | `ui/partner_notifications_screen.dart` |
| `lib/feature37-i18n.ts` (partner keys) | `partner_copy.dart` + `generated/partner_copy.g.dart` |

Generated data (`generated/*.g.dart`) comes from `app/tool/partner/gen_partner_data.mjs`
(`node app/tool/partner/gen_partner_data.mjs`); the tests compare it with the React JSON.

## For the screens of the next agent

The 16 partner sub-screens open through the shell (`openPartnerScreen` → `shell.openScreenId`) and show the shell
placeholder until registered. What they need:

| Screen (`ScreenId`) | Data already here |
|---|---|
| `nameVoting` | — (`usePartnerFavoriteNames` / `useFavoriteNames` still to port) |
| `partnerHospitalBag` | `partnerHospitalBagProvider` (`items`, `hiddenItems`, `controller.toggleItem / addItem / deleteItem / setHidden`) |
| `dailySummary` | `dailySummaryProvider`, `partnerDataProvider` (`partner_day_stage_stats_v1` via `partnerBackendProvider.rpc`) |
| `partnerShopping` | tools `shoppingItemsProvider` |
| `partnerAppointments` | `partnerDataProvider` (`sharing.shareAppointments`, her `userId`) |
| `partnerBabyDay` | `partnerDataProvider` (`partnerChildren`, `sharing.shareBabyLogs`) |
| `partnerWeeklyStats` | `partnerDataProvider`, `partnerStatsProvider` (`usePartnerWeeklyStats` still to port) |
| `partnerSurprises` | `surprisesProvider`, `surpriseCategoriesQuery` / `fallbackSurpriseCategories()` |
| `partnerParenting` | `partnerDataProvider` (`partnerChildren`, profile baby) + domain `partnerParentingChild` |
| `hospitalRun` | `partnerHospitalBagProvider`, `sosAlertProvider` (`alerts`) |
| `liveContractions` | `partnerDataProvider`, `partnerBackendProvider.subscribe` |
| `partnerSharing` (mother) | `partnerSharingProvider`, `partnerDataProvider`, `partnerMessagesFeedProvider` |
| `nightShift` | `nightShiftsQuery`, `setNightShiftMutation`, `partnerDataProvider` |
| `birthPlan` | `birthPlanQuery`, `saveBirthPlanMutation` |
| `postpartumSupport` | `postpartumPartnerText`, `postpartumWeek`, `partnerRecentMoodsProvider`, `partnerChatSenderProvider` |
| `partnerLossSupport` | `partnerDataProvider`, `partnerRecentMoodsProvider` (+ the pregnancy-loss text of its feature) |

Shared widgets: `PartnerCard`, `PartnerTap`, `PartnerLucide` (filled lucide), `pText` (`ui/partner_ui.dart`),
`LevelUpCelebration`, `SosButton`, `MotherSosSheet`.

## Partner screens (`screens/`)

All 16 are ported; `registerPartnerScreens` (`screens/register_screens.dart`) registers them (role guards stay in the
shell). Tests: `app/test/features/partner/screens/`.

| React | Dart |
|---|---|
| `NameVotingScreen.tsx`, `hooks/usePartnerFavoriteNames.ts` | `screens/name_voting_screen.dart`, `screens/data/partner_favorite_names.dart` (tools `favoriteNamesProvider`, `babyNamesQuery(null)`) |
| `PartnerHospitalBagScreen.tsx` | `screens/partner_hospital_bag_screen.dart` (`partnerHospitalBagProvider`, tools `confirmPromptProvider`) |
| `DailySummaryScreen.tsx` | `screens/daily_summary_screen.dart` (`partnerDayStageQuery`) |
| `v2/PartnerShoppingScreen.tsx` | `screens/partner_shopping_screen.dart` (tools `shoppingItemsProvider`) |
| `v2/PartnerAppointmentsScreen.tsx` | `screens/partner_appointments_screen.dart` |
| `v2/PartnerBabyDayScreen.tsx` | `screens/partner_baby_day_screen.dart` (`partnerSleepPlanProvider` ← sleep-training `fetchSharedSleepPlan`) |
| `v2/PartnerWeeklyStatsScreen.tsx`, `WeeklyStatsTab.tsx`, `hooks/usePartnerWeeklyStats.ts` | `screens/partner_weekly_stats_screen.dart`, `screens/data/partner_weekly_stats.dart` |
| `v2/PartnerSurprisesScreen.tsx`, `SurpriseTab.tsx` | `screens/partner_surprises_screen.dart` (tools `surpriseIdeasQuery`) |
| `tools/parenting/PartnerParentingScreen.tsx` (data + Index boundary) | `screens/partner_parenting.dart` (the screen itself is the parenting tool's) |
| `v2/HospitalRunScreen.tsx` | `screens/hospital_run_screen.dart` |
| `v2/LiveContractionsScreen.tsx`, `PartnerBabyDayScreen` realtime | `screens/live_contractions_screen.dart`, `screens/data/partner_live_rows.dart` |
| `v2/PartnerSharingScreen.tsx` (mother) | `screens/partner_sharing_screen.dart` (profile `accountActionsProvider` / `shareServiceProvider` / `premiumPromptProvider`, settings `unlinkPartnersProvider`) |
| `v2/NightShiftScreen.tsx`, `v2/BirthPlanScreen.tsx` | `screens/night_shift_screen.dart`, `screens/birth_plan_screen.dart` |
| `v2/PostpartumSupportScreen.tsx` | `screens/postpartum_support_screen.dart` |
| `pregnancy-loss/PartnerLossSupportScreen.tsx`, `PartnerLossCard.tsx` | `screens/partner_loss_support_screen.dart` (text, `LossSignsChecker` and the loss kit of `features/health_screens/loss/`) |
| table reads with ranges / orderings | `screens/data/screens_backend.dart` (`partnerScreensBackendProvider`) |
| `feature37Text` keys `ph_*`, `ns_*`, `bp_*`, `family_*` | `screens/screens_copy.dart` + `screens/generated/partner_screens_copy.g.dart` (`node app/lib/features/partner/screens/generated/gen_partner_screens_data.mjs`) |

`partnerWiringOverrides()` includes `partnerScreensWiringOverrides()` (`screens/screens_wiring.dart`):
`partnerParentingDataProvider` ← `usePartnerData`, and `partnerHomeSlotsProvider` with `lossCard` (PartnerLossCard) and
`lossText` (the pregnancy-loss text).

## Seams (`partner_ports.dart`) and their defaults

| Provider | Default |
|---|---|
| `partnerHapticsProvider` | Flutter `HapticFeedback` light / medium / heavy |
| `sosLocationProvider` | no location (`geolocator` is not a dependency): the alert is sent without coordinates, React's denied-permission branch |
| `partnerChatSenderProvider` | chat feature `sendPartnerMessage` (chat_send_message_v2 + push) |
| `partnerMessagesFeedProvider` | chat feature `partnerMessagesProvider` |
| `partnerHomeSlotsProvider` (`illnessHomeCard`, `lossCard`, `lossText`, `adInlineAnchor`) | not shown; `partnerWiringOverrides()` fills `lossCard` / `lossText` (partner screens); illness and ads still to come |
| `alertMapsOpenerProvider` | `ShellPlatform.openExternalUrl` |
| `partnerLinkActionProvider` | `AuthController.linkPartner` |
