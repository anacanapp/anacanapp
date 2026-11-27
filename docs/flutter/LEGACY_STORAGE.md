# Legacy storage inventory (Capacitor 52/53 → Flutter 60)

Every key the native consumer app (`src/`, excluding `src/website/`, `src/brand-portal/`, `src/public-blog/` and the
web-only admin console) writes on the device, and what Flutter 60.0 does with it. See plan §6
(`docs/FLUTTER_MIGRATION_PLAN.md`) and the bridge release `docs/RELEASE_53_BRIDGE.md`.

Inventory taken 2026-11-27 from `src/` by grepping `localStorage`, `sessionStorage`, `safe-storage`, zustand `persist`,
the react-query persister, `Preferences.*`, `indexedDB` and `registerPlugin` writers. `<uid>` = account user id,
`<backend>` = backend URL, `<lang>` = app language, `<mode>` = ad mode, `<rev>` = puzzle library revision.

## Migration classes

| Class | Meaning |
|---|---|
| `preferences` | Already in Capacitor Preferences; Flutter reads it natively (iOS `UserDefaults` key `CapacitorStorage.<key>`, Android SharedPreferences file `CapacitorStorage`). Nothing to do. |
| `export` | Local-only user state. 53.0 copies the raw string into the Preferences entry `anacan.migration.localstore.v1` (see below). Flutter parses each value itself. |
| `refetch` | Server-derived cache. Flutter downloads it again; do not import. |
| `drop` | Obsolete, transient, per-tab or web-only. Ignore. |

## The export entry (53.0)

Writer: `src/lib/migration-export.ts` (rule list `MIGRATION_EXPORT_RULES`; `migration-export.test.ts` fails if a rule
below is missing from this file). Native only. First write about 4 s after the first render, then 3 s after any
change to an exported key, and immediately when the app goes to the background.

Preferences key `anacan.migration.localstore.v1` (iOS `CapacitorStorage.anacan.migration.localstore.v1`), value:

```json
{
  "schema": "anacan-migration-localstore-v1",
  "exportedAt": "2026-11-27T10:00:00.000Z",
  "appVersion": "53.0",
  "entries": { "anacan_lock_enabled": "1", "anacan-timers": "{\"state\":{\"activeTimers\":[]},\"version\":0}" },
  "skipped": ["anacan_baby_chat_v1:…"]
}
```

- `entries`: localStorage key → raw stored string, byte for byte. A key removed from localStorage disappears here.
- `skipped`: keys that matched but were not copied: a single value over 256 Ki chars, or the total over 1.5 Mi chars
  (lower-priority rules, later in the list, are dropped first). Flutter should treat these keys as missing.
- `exportedAt` changes only when the content changes. Values for every user who signed in on the device are present
  (keys carry `<uid>`); import only the current account's keys plus the unscoped ones.
- Never contains auth tokens (`sb-*-auth-token`), session backups, admission pins or the react-query cache, even if a
  pattern would match (`MIGRATION_EXPORT_EXCLUDED`).
- Users who skip 53.0 (52 → 60) have no export; plan §6 fallback (hidden WebView on the same origin) applies.

## Capacitor Preferences (native, already readable)

| Key or pattern | Storage | Writer | Value shape | Class | Reason |
|---|---|---|---|---|---|
| `anacan.auth.session.v2:<realm>` | Preferences | `src/lib/session-persistence.ts` | `{realm, session:{access_token, refresh_token}}` or `session:null` tombstone | `preferences` | Session backup / logout tombstone; contract rule 8 keeps the shape. |
| `anacan.auth.session.v1` | Preferences | `src/lib/session-persistence.ts` (removes only) | `{access_token, refresh_token}` | `preferences` | Legacy Source backup, read only as fallback. |
| `anacan.auth.adoption.v1:<origin>` | Preferences | `src/lib/session-persistence.ts` | `{schema:"anacan-auth-adoption-v1", …}` | `preferences` | One-way adoption receipt. |
| `anacan.backend-admission.v1` | Preferences + localStorage | `src/integrations/supabase/backend-bootstrap.ts` | admission pin JSON | `preferences` | Admission pin; Preferences copy is authoritative. |
| `anacan_app_language`, `anacan_has_selected_language`, `anacan_has_seen_intro` | Preferences | `src/store/userStore.ts` | `"az"`, `"true"`/`"false"` | `preferences` | Language flags. |
| `anacan_privacy_consent_v1` | Preferences + localStorage | `src/lib/privacyConsent.ts` | `{analytics, ads, attribution, decidedAt…}` | `preferences` | Mirrored to Preferences on every change. |
| `anacan.migration.localstore.v1` | Preferences | `src/lib/migration-export.ts` | see above | `preferences` | The 53.0 export itself. |
| App Group / shared prefs widget snapshot | App Group (iOS), SharedPreferences (Android) | native `AnacanWidgets` plugin via `src/lib/home-widgets.ts` | localized widget snapshot JSON | `preferences` | Native storage; Flutter's widget bridge rewrites it on first run. |
| Native SDK stores (Firebase, Customer.io, RevenueCat, AdMob, HealthKit) | native | plugins | SDK-owned | `preferences` | Not WebView storage; SDKs keep their own state. |

## localStorage: `export`

| Key or pattern | Storage | Writer | Value shape | Class | Reason |
|---|---|---|---|---|---|
| `anacan_lock_enabled`, `anacan_lock_hash`, `anacan_lock_salt`, `anacan_lock_bio` | localStorage | `src/lib/appLock.ts` | `"1"`; hex SHA-256 of `salt:pin:anacan`; 32-hex salt; `"1"` | `export` | App lock PIN must keep working; hash+salt only, never the PIN. |
| `anacan-user-store` | localStorage | `src/store/userStore.ts` (zustand persist) | `{state:{isAuthenticated,isOnboarded,hasSeenIntro,hasCompletedFunnel,userId,email,name,role,lifeStage,partnerCode,linkedPartnerId,lastPeriodDate,cycleLength,periodLength,dueDate,babyBirthDate,babyName,babyGender,babyCount,multiplesType,deliveryType,language,hasSelectedLanguage,countryCode},version:0}` | `export` | Offline profile/stage snapshot and funnel flags. |
| `selected-child-storage` | localStorage | `src/store/childStore.ts` (zustand persist) | `{state:{selectedChildId},version:0}` | `export` | Selected child. |
| `language` | localStorage | `src/store/userStore.ts`, `src/App.tsx` | `"az"` | `export` | Legacy sync language read by `getLocaleTag`/startup. |
| `anacan-timers` | localStorage | `src/store/timerStore.ts` (zustand persist) | `{state:{activeTimers:[{id,type,feedType?,label?,childId?,childName?,startTime}]},version:0}` | `export` | Running sleep/feeding/diaper/white-noise timers. |
| `anacan_tool_live_timer_v1` | localStorage | `src/lib/tool-live-timer.ts` | `{<toolKey>: <liveActivityId>}` | `export` | Live Activity ids to end leftovers. |
| `anacan_contraction_timer_v1:*` | localStorage | `src/hooks/useContractions.ts` | `{activeStart,lastStart,lastEnd}` (epoch ms or null); suffix `<uid>` | `export` | Running contraction timer. |
| `anacan_kick_active_v1:*` | localStorage | `src/lib/kickSession.ts` | `{startedAt,kicks,position?}`; suffix `<uid>` | `export` | Running kick-count session. |
| `anacan_outbox_v1:*` | localStorage | `src/lib/offline-outbox.ts` | `[{id,table,payload,createdAt,attempts,rejects?}]`; suffix `<uid>` | `export` | Offline outbox: unsent baby logs, kicks, weight, meals, water… |
| `anacan_contraction_queue_v1:*` | localStorage | `src/hooks/useContractions.ts` | `[{id,user_id,start_time,duration_seconds,interval_seconds,created_at,pending}]` | `export` | Contractions saved offline, not synced yet. |
| `anacan_consent_pending_v1:*` | localStorage | `src/lib/consentGate.ts` | `{items:[{kind,granted,version,variant?}],…}`; suffix `<backend>:<uid>` | `export` | Consent decisions not yet recorded on the server. |
| `anacan-moderator-warning-acks-v1:*` | localStorage | `src/components/moderation/ModeratorEnforcement.tsx` | `[{id,…}]` (≤100) | `export` | Warning acknowledgements waiting to be sent. |
| `anacan.sleepTraining.*` | localStorage | `src/lib/sleep-training-sync.ts`, `src/hooks/useSleepTrainingPlan.ts` | v2 `.v2.<uid>.<childId>`: `{v:2,plan:{wakeTime,method,planStartDate,planDone,stepsDone,routineDone,nightWakes,safetyDone…},updatedAt,dirty}`; legacy `.v1.<uid>` PlanState; `.v1.claimed.<uid>` = childId | `export` | Home/sleep plan ticks; `dirty` copies are not on the server yet. |
| `anacan.parenting.v1.*` | localStorage | `src/lib/parenting.ts` | parenting state JSON (programmes, done days, `dirty`); suffix `<uid>` | `export` | Tərbiyə progress, offline-first. |
| `anacan.weaning.v1.*` | localStorage | `src/lib/weaning-sync.ts` | `{…state, checkins:[…≤MAX]}`; suffix `<uid>` | `export` | Weaning plan + check-ins. |
| `anacan_kid_exercises_v1:*` | localStorage | `src/lib/kid-exercises.ts` | kid-exercise done state; suffix `<uid>` | `export` | Local progress. |
| `anacan.play-together.v1.*` | localStorage | `src/lib/play-together.ts` | play-together state; suffix `<uid>` | `export` | Local progress. |
| `anacan:weight-tracker:height-cm*` | localStorage | `src/lib/profileHeight.ts` | `"165"`; `-synced:<uid>` = `"1"` | `export` | Height for BMI and its sync marker. |
| `anacan-onboarding-v3:*` | localStorage | `src/lib/onboarding-model.ts` | `{schema:"anacan-onboarding-v3",id,actor,backend,stage,step,name,children[],answers,…}`; suffix `<host>:<uid>` | `export` | Unfinished onboarding draft. |
| `anacan_loss_letter_v1:*`, `anacan_loss_todo_v1:*` | localStorage | `src/lib/pregnancy-loss.ts` | letter text (≤5000 chars); `{<todoId>: true}` | `export` | User-written letter and checklist (device-only). |
| `anacan_baby_chat_v1:*` | localStorage | `src/lib/baby-chat.ts` | `{<YYYY-MM-DD>:[{id,from,text,at}]}` last 14 days | `export` | Device-only baby chat threads. |
| `anacan_pending_funnel` | localStorage | `src/components/onboarding/PremiumOnboarding.tsx` | `{userId,backend,…}` | `export` | Pending premium funnel. |
| `anacan_iep_pending_v1` | localStorage | `src/lib/in-app-epoint.ts` | `{userId,at}` | `export` | Epoint payment in flight; Flutter re-checks status. |
| `anacan:promo-code` | localStorage | `src/lib/promo.ts` | `{code,at}` (TTL) | `export` | Promo code waiting for sign-in. |
| `anacan_books_cart_v1`, `anacan_books_pending_v1` | localStorage | `src/lib/books/api.ts`, `src/components/books/BookStoreScreen.tsx` | `["<bookId>"]`; `{ids:[…],…}` | `export` | Book cart / pending purchase. |
| `anacan_partner_basket_v1`, `anacan_olivia_basket_v1` | localStorage | `src/hooks/usePartnerShop.ts` | `{<productId>: qty}` (legacy key read once) | `export` | Partner-store basket. |
| `anacan-aptek-checkout`, `anacan-aptek-recent` | localStorage | `src/components/aptek/AptekScreen.tsx` | checkout form draft JSON; recent searches/items JSON | `export` | Pharmacy checkout draft and recents. |
| `cake-cart` | localStorage | `src/hooks/useCakeCart.ts` | zustand persist envelope `{state:{items:[…]},version}` | `export` | Cake cart contents. |
| `anacan_colorsort_round_v1`, `anacan_colorsort_level_count_v1`, `anacan_colorsort_markers_v1` | localStorage | `src/components/games/color-sort/*` | `{version:1,level,seed,session}`; `"44"`; `"true"`/`"false"` | `export` | Color Sort unfinished round, unlocked count, marker preference. |
| `anacan:qabarciq:best:v1`, `anacan:qabarciq:sound:v1` | localStorage | `src/components/games/qabarciq/BubblePop.tsx` | number string; `"off"`/`"on"` | `export` | Bubble Pop best score and sound. |
| `anacan_two_friends_preferences_v1`, `anacan_word_garden_preferences_v1` | localStorage | `src/components/games/iki-dost/TwoFriends.tsx`, `src/components/games/word-garden/storage.ts` | `{sound,haptics}`; `{sound,haptics,highContrast,reducedMotion,theme}` | `export` | Game preferences. |
| `anacan_word_garden_v1:*` | localStorage | `src/components/games/word-garden/storage.ts` | `{schema:"anacan-word-garden-profile-v1",language,revision,mode,seed,…progress}`; suffix `<lang>:<rev>:<mode>` | `export` | Word Garden progress (bounded save). |
| `anacan_two_friends_v1:*` | localStorage | `src/components/games/iki-dost/state.ts` | `{schema:"anacan-two-friends-profile-v1",revision,…progress}`; suffix `<rev>` | `export` | Two Friends progress. |
| `anacan_casual_v1:*` | localStorage | `src/components/games/casual/storage.ts` | `{schema:"anacan-casual-profile-v1",game,revision,…}` (≤28 KB); suffix `<game>:<rev>` | `export` | Leaf Flight / Clear the Way progress. |
| `anacan_minigame_progress_*` | localStorage | `src/hooks/useLocalGameProgress.ts` | `{unlockedLevel,levels:{<n>:{stars,bestScore}},bestScoreOverall}`; suffix `<gameId>` | `export` | Mini-game progress. |
| `anacan_health_connected`, `anacan_health_cycle_write` | localStorage | `src/lib/health.ts`, `src/lib/healthCycle.ts` | epoch ms; `"1"` | `export` | HealthKit/Health Connect toggles. |
| `anacan_health_vitals_*` | localStorage | `src/lib/healthVitals.ts` | `_write` = `"1"`; `_synced:<uid>` = `{<metric>: watermark}`; `_last:<uid>` = epoch ms | `export` | Vitals write toggle and sync watermarks (prevents duplicate writes). |
| `anacan_glucose_unit`, `anacan.illness.temp-unit` | localStorage | `src/lib/bloodSugar.ts`, `src/lib/illness.ts` | `"mgdl"`/`"mmol"`; `"C"`/`"F"` | `export` | Unit preferences. |
| `anacan.mommyPeriod.endedOn.*` | localStorage | `src/components/mommy/MommyPeriodTracker.tsx` | `YYYY-MM-DD`; suffix `<uid>` | `export` | Device-only marker. |
| `anacan_water_reminder_enabled` | localStorage | `src/hooks/useNotificationSettings.ts` | `"true"`/`"false"` | `export` | Water reminder (read at startup scheduling). |
| `anacan.vaccineReminders.v1`, `anacan.vaccineReminders.childSlots.v1` | localStorage | `src/lib/vaccine-reminders.ts` | `"1"`/`"0"`; `{<childId>: slot}` | `export` | Per-device vaccine reminder toggle and notification id slots. |
| `anacan.localNotifications.v1` | localStorage | `src/lib/local-notification-scheduler.ts` | `{v:1,owner,namespaces:{<ns>:[…]},scheduled:{<id>: fingerprint}}` | `export` | Ids of OS-scheduled local notifications; Flutter must cancel/replace them. |
| `anacan.napAlerts.v1` | localStorage | `src/lib/nap-alerts.ts` | nap alert settings JSON | `export` | Per-device nap alerts. |
| `anacan.parenting.reminders.v1` | localStorage | `src/components/tools/parenting/useParentingReminders.ts` | slots fingerprint string | `export` | Last scheduled parenting reminder set. |
| `anacan_kick_ten_notified_day`, `last_push_prompt_date` | localStorage | `src/hooks/useKickSessions.ts`, `src/hooks/useDeviceToken.ts` | `YYYY-MM-DD` | `export` | Once-per-day notification/prompt markers. |
| `silent_hours_*` | localStorage | `src/hooks/useSilentHours.ts` (read by `src/lib/chat-notifications.ts`) | `{enabled,startTime:"22:00",endTime:"07:00"}`; suffix `<uid>` | `export` | Silent hours mirror (server copy exists, this is the offline read). |
| `anacan.widgets.settings.v1` | localStorage | `src/lib/home-widgets.ts` | `{showFeed,showNap,showActions,privacy}` | `export` | Widget settings. |
| `anacan.sleepCues.v1` | localStorage | `src/components/sleep/NextNapSection.tsx` | sleep cue toggles JSON | `export` | Per-device settings. |
| `anacan_recent_stickers_v1` | localStorage | `src/lib/stickers.ts` | `["<stickerId>"]` ≤12 | `export` | Recent stickers. |
| `anacan_ai_consent_v1:*` | localStorage | `src/lib/consentGate.ts` | `{granted,at}`; suffix `<backend>:<uid>` | `export` | Offline AI-consent decision. |
| `anacan.hospital-bag.hidden.*` | localStorage | `src/lib/hospital-bag.ts` | `["<itemId>"]` ≤500; suffix `<uid>` | `export` | Hidden checklist items (device-only). |
| `anacan_app_usage_count`, `anacan_rating_done`, `anacan.review.firstOpenAt`, `anacan.feedback.sentAt`, `anacan.feedback.dismissedAt` | localStorage | `src/hooks/useAppRating.ts`, `src/lib/app-feedback.ts` | number string; `"true"`; epoch ms | `export` | Rating/feedback prompt counters. |
| `anacan_referral_converted_synced` | localStorage | `src/lib/referralSync.ts` | `"1"` | `export` | Avoids repeating the conversion RPC. |
| `anacan.ads.ledger.v1:*` | localStorage | `src/lib/ads/storage.ts` | `{date,session_id,placements:{<id>:{session,day,last}},fullscreen,last_banner,pause_until}`; suffix `<mode>` | `export` | Ad frequency caps. |
| `anacan_app_update_later_*` | localStorage | `src/hooks/useAppUpdate.ts` | epoch ms; suffix `<ruleId>` | `export` | "Later" snooze per update rule. |
| `anacan_ai_warn_dismissed`, `anacan_partner_tour_v2`, `anacan.lockOffer.seenAt`, `anacan.prompt.lastShownDay` | localStorage | `src/components/AIChatScreen.tsx`, `src/components/partner/v2/PartnerHomeScreen.tsx`, `src/lib/lock-offer.ts`, `src/lib/prompt-day.ts` | `"1"`; epoch ms; epoch ms; `YYYY-MM-DD` | `export` | Seen-once flags. |
| `anacan_tour_v*` | localStorage | `src/components/onboarding/OnboardingTourHost.tsx` | tour state string; key `anacan_tour_v<TOUR_VERSION>_<uid>` | `export` | Onboarding tour seen. |
| `anacan.parenting.intro.v1.*`, `anacan.weaning.homecard.v1.*`, `preemie-backfill-dismissed-*`, `anacan_qc_intro_dismissed_v1:*` | localStorage | `src/components/tools/parenting/ParentingIntro.tsx`, `src/lib/weaning-entry.ts`, `src/components/mommy/PrematurityBackfillCard.tsx`, `src/lib/qaygicash.ts` | `"1"` | `export` | Intro/card dismissed flags. |
| `anacan-ad-free-offer-seen-v1:*` | localStorage | `src/components/premium/AdFreePremiumOffer.tsx` | `"1"`; suffix `<backend>:<uid>` | `export` | One-time offer flag. |
| `community_seen_*` | localStorage | `src/hooks/useUnreadCommunityPosts.ts` | `_posts_v2:<scope>` = `["<postId>"]`; `_at_v2:<scope>` = ISO; legacy `_posts:<uid>` | `export` | Seen-post markers. |
| `anacan-stories-seen:*` | localStorage | `src/components/stories/DashboardStories.tsx` | `["<storyId>"]` ≤400; suffix `<uid>` | `export` | Seen stories. |
| `anacan.market.inbox.seen.v1:*` | localStorage | `src/lib/marketInbox.ts` | `{<listingId:counterpartId>: ISO}`; suffix `<uid>` | `export` | Market inbox last-seen marks. |

## localStorage: `refetch`

| Key or pattern | Storage | Writer | Value shape | Class | Reason |
|---|---|---|---|---|---|
| `anacan-rq-cache` | localStorage | `src/App.tsx`, `src/lib/deferred-persister.ts` | react-query dehydrated client (buster `anacan-rq-v1…`) | `refetch` | Server cache; may hold sensitive rows; explicitly excluded. |
| `anacan_i18n_cache:<lang>`, `anacan_i18n_sig:<lang>` | localStorage | `src/lib/i18n.ts` | translation map; signature | `refetch` | Translations overlay. |
| `anacan_ocache_v1:*` | localStorage | `src/lib/offlineCache.ts` (children, profile, role, household premium) | `{at,data}` envelope | `refetch` | Offline last-state cache. |
| `anacan_content_pack_hot:<lang>` | localStorage | `src/lib/content-i18n.ts` | `["<id>"]` | `refetch` | Content-pack hot list. |
| `anacan-server-stories:v1:<lang>`, `anacan.parenting.overrides.v1.<lang>`, `anacan-firstaid-v1` | localStorage | `src/lib/server-stories.ts`, `src/lib/parenting-overrides.ts`, `src/hooks/useFirstAid.ts` | cached rows | `refetch` | Server content caches. |
| `anacan_app_update_v1` | localStorage | `src/hooks/useAppUpdate.ts` | `{at,decision}` | `refetch` | Update rule cache. |
| `anacan_premium_grant_v1:<backend>:<uid>` | localStorage | `src/lib/premium-grant-cache.ts` | `{ownUntil,householdUntil}` | `refetch` | Entitlement cache; RevenueCat/server are authoritative. |
| `anacan-baby-insight-v2:<scope>:<section>` | localStorage | `src/hooks/useBabyInsight.ts` | `{hash,insight}` | `refetch` | AI insight cache. |
| `anacan_email_verified_v1:<uid>`, `anacan_consent_gate_v1:<backend>:<uid>` | localStorage | `src/pages/Index.tsx`, `src/lib/consentGate.ts` | `"1"`; `{version,at}` | `refetch` | Caches of server answers. |
| `anacan_colorsort_level_v1_<n>`, `anacan_colorsort_level_index_v1` | localStorage | `src/components/games/color-sort/levels.ts` | generated level JSON; `[n…]` | `refetch` | Deterministically regenerated levels. |
| `anacan-content-packs` (object store `kv`) | IndexedDB | `src/lib/content-packs.ts` | `s:<lang>:<id>` → string shards, manifests | `refetch` | Downloaded content packs; re-downloaded from `/content-packs/`. |

## localStorage / sessionStorage: `drop`

| Key or pattern | Storage | Writer | Value shape | Class | Reason |
|---|---|---|---|---|---|
| `sb-<ref>-auth-token` (+`-user`, `-code-verifier`), `anacan.auth-key.v1:<realm>` | localStorage | supabase auth via `src/integrations/supabase/authStorage.ts`, `auth-storage-key.ts` | auth-js session JSON; key name | `drop` | Credentials; the Preferences backup is the migration path. Never exported. |
| `anacan_lock_last_bg` | localStorage | `src/lib/appLock.ts` | epoch ms | `drop` | Transient background timestamp. |
| `anacan.vaccineReminders.refreshedOn.v1`, `anacan.appointmentLocalReminders.cleared.v1` | localStorage | `src/lib/vaccine-reminders.ts`, `src/lib/native.ts` | stamp; `"1"` | `drop` | Re-plan markers / finished one-time cleanup. |
| `shopping_notif_<date>` | localStorage | `src/hooks/useShoppingItems.ts` | `"1"` | `drop` | Per-day dedupe. |
| `anacan_admin_language`, `admin_draft_*`, `anacan_admin_favourites_v1`, `anacan_admin_recent_v1`, `anacan_admin_sidebar_collapsed_v1` | localStorage | admin console (`src/contexts/AdminLanguageContext.tsx`, `src/hooks/useUnsavedChanges.ts`, `src/components/admin/*`) | strings/JSON | `drop` | Web-only admin. |
| `anacan_web_cart_*`, `anacan_sh_sticky_closed` | localStorage | `src/website/*` | JSON | `drop` | Website only, not in native bundle. |
| `anacan-chunk-reload-at`, `anacan_pending_app_link`, `anacan-pending-blog-v1`, `anacan-blog-module-navigation-v1`, `anacan_profile_tab`, `anacan_books_open_v1`, `anacan_email_code_sent_v1:<uid>`, `anacan_partner_invite_v1`, `anacan.ads.admin-preview.v1` | sessionStorage | various | small JSON/strings | `drop` | Per-tab state, lost on app restart anyway. |

## State that cannot be preserved by the export

- IndexedDB `anacan-content-packs`: not exported (multi-MB); Flutter re-downloads. Offline-first users need one
  online launch after updating.
- Values listed under `skipped` (very large baby-chat history or many game profiles exceeding the 1.5 Mi total).
- Anything written after the last export and before the app was killed without a background transition (rare:
  the debounce is 3 s and backgrounding flushes).
- Users who update 52 → 60 directly: no export; only the plan §6 hidden-WebView fallback can recover their keys.
- The offline outbox is exported, but Flutter must replay it with the same client ids (`id` is the row primary key) so
  a partial send by 53.0 does not duplicate rows.
